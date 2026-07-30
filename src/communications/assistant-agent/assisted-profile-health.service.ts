/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { AbstractApplication } from '../../fonaments/abstract-application';
import { Service } from '../../fonaments/services/service';
import { isAssistedProfileDeploymentEnabled } from './assisted-profile-deployment.config';
import { AgentHttpClient, type AssistedProfileAgentHealthGateway } from './agent-http-client';
import { AgentHealthCheckError, type AgentHealthCheckResponse } from './agent-health.types';
import {
  resolveAssistedProfileHealthConfiguration,
  type AssistedProfileHealthConfiguration,
  type AssistedProfileHealthConfigurationInput,
} from './assisted-profile-health.configuration';
import type {
  AssistedProfileHealthObservation,
  AssistedProfileHealthObserver,
  AssistedProfileHealthSnapshot,
  AssistedProfileHealthStats,
} from './assisted-profile-health.types';
import {
  NOOP_OBSERVER,
  recordObservationSafely,
  safeElapsedMs,
  safeMonotonicNow,
  safeTimestamp,
} from './assistant-agent.utils';

export interface AssistedProfileHealthCreateOptions {
  readonly configuration?: AssistedProfileHealthConfigurationInput;
  readonly agentHealthClient?: AssistedProfileAgentHealthGateway;
  readonly observer?: AssistedProfileHealthObserver;
  /** Monotonic clock used only to measure check duration. */
  readonly clock?: () => number;
  /** Wall clock used only for snapshot timestamps. */
  readonly now?: () => Date;
}

const INITIAL_SNAPSHOT: AssistedProfileHealthSnapshot = {
  available: false,
  busy: false,
  alive: false,
  modelReady: false,
  status: 'unavailable',
};

interface ObservationLoggerApplication {
  logger(): { info(message: string): unknown; warn(message: string): unknown };
}

function createHealthTransitionLogger(
  application: ObservationLoggerApplication | null,
): AssistedProfileHealthObserver {
  if (!application) {
    return NOOP_OBSERVER;
  }

  return {
    record: (observation: AssistedProfileHealthObservation): void => {
      if (!observation.transitioned) {
        return;
      }

      const logger = application.logger();
      const message = `assisted-profile.health ${transitionMessage(observation.snapshot)}`;

      if (observation.snapshot.status === 'unavailable') {
        logger.warn(message);
      } else {
        logger.info(message);
      }
    },
  };
}

function transitionMessage(snapshot: AssistedProfileHealthSnapshot): string {
  if (snapshot.status === 'ready') {
    return 'Assisted Profile agent recovered and is ready';
  }
  if (snapshot.status === 'busy') {
    return 'Assisted Profile agent is busy';
  }
  if (snapshot.failureCode === 'model_not_ready') {
    return 'Assisted Profile agent model is not ready';
  }
  return `Assisted Profile agent became unavailable: ${snapshot.failureCode ?? 'unknown'}`;
}

/**
 * Process-local poller for the fwcloud-ai-agent AG-3 health contract. Holds
 * the single in-memory availability snapshot consumed by the UI-facing
 * availability endpoint. Never persists an audit event: it only ever calls
 * AgentHttpClient.getHealth(), which does not touch AuditLogService/Channel.
 */
export class AssistedProfileHealthService extends Service {
  private _configuration: AssistedProfileHealthConfiguration;
  private _observer: AssistedProfileHealthObserver = NOOP_OBSERVER;
  private _clock: () => number = () => performance.now();
  private _now: () => Date = () => new Date();

  private _snapshot: AssistedProfileHealthSnapshot = INITIAL_SNAPSHOT;
  private _inFlight: Promise<AssistedProfileHealthSnapshot> | null = null;
  private _timer: NodeJS.Timeout | null = null;
  private _started = false;
  private _stats = { checkCount: 0, successCount: 0, failureCount: 0, transitionCount: 0 };

  public constructor(
    app: AbstractApplication | null,
    private readonly _overrides: AssistedProfileHealthCreateOptions = {},
  ) {
    super(app);
  }

  /** Creates an initialized service with explicit dependencies (tests/tools). */
  public static async create(
    options: AssistedProfileHealthCreateOptions = {},
  ): Promise<AssistedProfileHealthService> {
    return new AssistedProfileHealthService(null, options).build();
  }

  public async build(): Promise<AssistedProfileHealthService> {
    this._configuration = resolveAssistedProfileHealthConfiguration(
      this._overrides.configuration ?? this.configurationFromApplication(),
    );
    this._observer = this._overrides.observer ?? createHealthTransitionLogger(this._app);
    this._clock = this._overrides.clock ?? this._clock;
    this._now = this._overrides.now ?? this._now;
    return this;
  }

  public async close(): Promise<void> {
    this.stop();
  }

  public get snapshot(): AssistedProfileHealthSnapshot {
    return this._snapshot;
  }

  public get stats(): AssistedProfileHealthStats {
    return { ...this._stats };
  }

  public get pollIntervalMs(): number {
    return this._configuration.pollIntervalMs;
  }

  /** Idempotent. Runs the first check immediately, then reschedules after each result. */
  public start(): void {
    if (this._started || !this._configuration.enabled) {
      return;
    }

    this._started = true;
    this.runAndReschedule();
  }

  /** Idempotent. Safe to call during application shutdown and between tests. */
  public stop(): void {
    this._started = false;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /**
   * Performs exactly one health check. Concurrent callers observe the same
   * in-flight result instead of triggering a second request to the agent.
   */
  public async checkNow(): Promise<AssistedProfileHealthSnapshot> {
    if (this._inFlight) {
      return this._inFlight;
    }

    const inFlight = this.performCheck().finally(() => {
      if (this._inFlight === inFlight) {
        this._inFlight = null;
      }
    });
    this._inFlight = inFlight;
    return inFlight;
  }

  private runAndReschedule(): void {
    void this.checkNow().finally(() => {
      if (!this._started) {
        return;
      }
      this._timer = setTimeout(() => this.runAndReschedule(), this._configuration.pollIntervalMs);
      this._timer.unref?.();
    });
  }

  private async performCheck(): Promise<AssistedProfileHealthSnapshot> {
    const startedAt = safeMonotonicNow(this._clock);
    const checkedAt = safeTimestamp(this._now);
    const previous = this._snapshot;
    let nextSnapshot: AssistedProfileHealthSnapshot;
    let outcome: 'success' | 'failure';

    try {
      const client = await this.resolveAgentHealthClient();
      const response = await client.getHealth({ timeoutMs: this._configuration.timeoutMs });
      nextSnapshot = this.deriveSnapshot(response, checkedAt);
      outcome = 'success';
    } catch (error) {
      nextSnapshot = this.failureSnapshot(error, checkedAt, previous);
      outcome = 'failure';
    }

    this._snapshot = nextSnapshot;
    this._stats.checkCount += 1;
    this._stats[outcome === 'success' ? 'successCount' : 'failureCount'] += 1;
    const transitioned = this.hasTransitioned(previous, nextSnapshot);
    if (transitioned) {
      this._stats.transitionCount += 1;
    }

    this.observe({
      type: 'check',
      outcome,
      durationMs: safeElapsedMs(startedAt, safeMonotonicNow(this._clock)),
      snapshot: nextSnapshot,
      transitioned,
    });

    return nextSnapshot;
  }

  private async resolveAgentHealthClient(): Promise<AssistedProfileAgentHealthGateway> {
    if (this._overrides.agentHealthClient) {
      return this._overrides.agentHealthClient;
    }
    if (!this._app) {
      throw new AgentHealthCheckError('connection_error');
    }
    return this._app.getService<AgentHttpClient>(AgentHttpClient.name);
  }

  /**
   * Mirrors the derivation rules documented in the module README:
   * `available = alive && model.ready`; `busy` is informational only and
   * never turns an otherwise-available agent unavailable.
   */
  private deriveSnapshot(
    response: AgentHealthCheckResponse,
    checkedAt: string,
  ): AssistedProfileHealthSnapshot {
    const { alive, busy, modelReady } = response;
    const available = alive && modelReady;

    return {
      available,
      busy,
      alive,
      modelReady,
      status: !available ? 'unavailable' : busy ? 'busy' : 'ready',
      failureCode: !alive ? null : !modelReady ? 'model_not_ready' : null,
      lastCheckedAt: checkedAt,
      lastSuccessfulCheckAt: checkedAt,
    };
  }

  private failureSnapshot(
    error: unknown,
    checkedAt: string,
    previous: AssistedProfileHealthSnapshot,
  ): AssistedProfileHealthSnapshot {
    const failureCode =
      error instanceof AgentHealthCheckError ? error.failureCode : 'connection_error';

    return {
      available: false,
      busy: false,
      alive: false,
      modelReady: false,
      status: 'unavailable',
      failureCode,
      lastCheckedAt: checkedAt,
      lastSuccessfulCheckAt: previous.lastSuccessfulCheckAt,
    };
  }

  private hasTransitioned(
    previous: AssistedProfileHealthSnapshot,
    next: AssistedProfileHealthSnapshot,
  ): boolean {
    return (
      previous.status !== next.status ||
      previous.available !== next.available ||
      (previous.failureCode ?? null) !== (next.failureCode ?? null)
    );
  }

  private observe(observation: AssistedProfileHealthObservation): void {
    recordObservationSafely(this._observer, observation);
  }

  private configurationFromApplication(): AssistedProfileHealthConfigurationInput {
    if (!this._app) {
      return {};
    }

    const config = this._app.config.get('assisted_profile.health');
    return {
      enabled: config.poll_enabled && isAssistedProfileDeploymentEnabled(this._app),
      pollIntervalMs: config.poll_interval_ms,
      timeoutMs: config.timeout_ms,
      path: config.path,
    };
  }
}

export type {
  AssistedProfileAvailability,
  AssistedProfileHealthObservation,
  AssistedProfileHealthObserver,
  AssistedProfileHealthSnapshot,
  AssistedProfileHealthStats,
  AssistedProfileHealthStatus,
} from './assisted-profile-health.types';
