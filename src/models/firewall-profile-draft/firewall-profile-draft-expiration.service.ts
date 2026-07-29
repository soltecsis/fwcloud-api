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

import * as uuid from 'uuid';
import { DataSource, In, LessThanOrEqual, type FindOptionsSelect } from 'typeorm';
import type { AbstractApplication } from '../../fonaments/abstract-application';
import { logger } from '../../fonaments/abstract-application';
import { Service } from '../../fonaments/services/service';
import { DatabaseService } from '../../database/database.service';
import { AuditLogService } from '../audit/AuditLog.service';
import { FirewallProfileDraft } from './firewall-profile-draft.model';
import {
  FIREWALL_PROFILE_DRAFT_TRANSITIONS,
  FirewallProfileDraftStateService,
} from './firewall-profile-draft-state.service';
import { FirewallProfileDraftTransitionConflictError } from './firewall-profile-draft.errors';
import type { FirewallProfileDraftStatus } from './firewall-profile-draft.types';
import {
  resolveFirewallProfileDraftExpirationConfiguration,
  type FirewallProfileDraftExpirationConfiguration,
  type FirewallProfileDraftExpirationConfigurationInput,
} from './firewall-profile-draft-expiration.configuration';

/** Non-terminal statuses eligible for TTL expiration: every status the state
 * machine allows to reach `expired` (excludes `apply_pending` — an apply may
 * still be in progress — and the already-terminal statuses). Derived from
 * `FIREWALL_PROFILE_DRAFT_TRANSITIONS` rather than hardcoded so it can never
 * drift out of sync with the transitions the state machine actually allows. */
export const FIREWALL_PROFILE_DRAFT_EXPIRATION_ELIGIBLE_STATUSES: readonly FirewallProfileDraftStatus[] =
  Object.freeze(
    (Object.keys(FIREWALL_PROFILE_DRAFT_TRANSITIONS) as FirewallProfileDraftStatus[]).filter(
      (status) => FIREWALL_PROFILE_DRAFT_TRANSITIONS[status].includes('expired'),
    ),
  );

export const FIREWALL_PROFILE_DRAFT_EXPIRATION_AUDIT_CALL = 'assistant.drafts.expire';
export const FIREWALL_PROFILE_DRAFT_EXPIRATION_JOB_AUDIT_CALL =
  'CRON firewall-profile-draft.expire';

export interface ExpireFirewallProfileDraftsJobCreateOptions {
  readonly configuration?: FirewallProfileDraftExpirationConfigurationInput;
  readonly dataSource?: DataSource;
  readonly stateService?: FirewallProfileDraftStateService;
  readonly auditLogService?: AuditLogService;
  /** Wall clock used to compute the expiration threshold; overridable for deterministic tests. */
  readonly now?: () => Date;
}

export interface FirewallProfileDraftExpirationRunStats {
  readonly scanned: number;
  readonly expired: number;
  readonly skipped: number;
  readonly failed: number;
  readonly durationMs: number;
  readonly thresholdIso: string;
  readonly jobRunId: string;
}

const EXPIRATION_CANDIDATE_SELECT = {
  id: true,
  fwCloudId: true,
  status: true,
  createdBy: true,
  updatedAt: true,
} as const satisfies FindOptionsSelect<FirewallProfileDraft>;

type ExpirationCandidate = Pick<FirewallProfileDraft, keyof typeof EXPIRATION_CANDIDATE_SELECT>;

/**
 * Periodic maintenance job that expires Assisted Profile drafts inactive
 * beyond the configured TTL. Every transition goes through
 * `FirewallProfileDraftStateService.transition()` so it inherits the same
 * compare-and-set guard, timestamp bookkeeping and per-transition audit row
 * as every other draft mutation — this job never writes `status`/`expired_at`
 * directly. See the assistant-contract README's "Mapper retention rule" for
 * how this TTL relates to when a contract-version mapper may be retired.
 */
export class ExpireFirewallProfileDraftsJob extends Service {
  private _configuration: FirewallProfileDraftExpirationConfiguration;
  private _dataSource: DataSource;
  private _stateService: FirewallProfileDraftStateService;
  private _auditLogService: AuditLogService;
  private _now: () => Date = () => new Date();

  private _timer: NodeJS.Timeout | null = null;
  private _started = false;

  public constructor(
    app: AbstractApplication | null,
    private readonly _overrides: ExpireFirewallProfileDraftsJobCreateOptions = {},
  ) {
    super(app);
  }

  /** Creates an initialized job with explicit dependencies (tests/tools). */
  public static async create(
    options: ExpireFirewallProfileDraftsJobCreateOptions = {},
  ): Promise<ExpireFirewallProfileDraftsJob> {
    return new ExpireFirewallProfileDraftsJob(null, options).build();
  }

  public async build(): Promise<ExpireFirewallProfileDraftsJob> {
    this._configuration = resolveFirewallProfileDraftExpirationConfiguration(
      this._overrides.configuration ?? this.configurationFromApplication(),
    );
    this._now = this._overrides.now ?? this._now;

    this._dataSource =
      this._overrides.dataSource ??
      (await this._app.getService<DatabaseService>(DatabaseService.name)).dataSource;
    this._stateService =
      this._overrides.stateService ??
      (await this._app.getService<FirewallProfileDraftStateService>(
        FirewallProfileDraftStateService.name,
      ));
    this._auditLogService =
      this._overrides.auditLogService ??
      (await this._app.getService<AuditLogService>(AuditLogService.name));

    return this;
  }

  public async close(): Promise<void> {
    this.stop();
  }

  public get configuration(): FirewallProfileDraftExpirationConfiguration {
    return this._configuration;
  }

  /**
   * Idempotent. First sweep runs after one interval, not immediately at boot.
   *
   * Uses a self-rescheduling timer (like `AssistedProfileHealthService`)
   * rather than `CronService`/`cron` (like `BackupService`'s retention job):
   * `expiration_job.interval_seconds` is a delay-since-completion, not a
   * fixed clock-time schedule, and a plain positive-integer-seconds config
   * value has no clean 1:1 mapping to a cron expression.
   */
  public start(): void {
    if (this._started || !this._configuration.enabled) {
      return;
    }

    this._started = true;
    this.scheduleNext();
  }

  /** Idempotent. Safe to call during application shutdown and between tests. */
  public stop(): void {
    this._started = false;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  private scheduleNext(): void {
    this._timer = setTimeout(() => {
      void this.run().finally(() => {
        if (!this._started) {
          return;
        }
        this.scheduleNext();
      });
    }, this._configuration.intervalSeconds * 1000);
    this._timer.unref?.();
  }

  /**
   * Runs exactly one bounded sweep: selects up to `batchSize` eligible
   * inactive drafts and attempts a guarded transition to `expired` for each.
   * Callable directly (bypassing `enabled`/scheduling) for manual/test runs.
   */
  public async run(): Promise<FirewallProfileDraftExpirationRunStats> {
    const startedAtMs = Date.now();
    const jobRunId = `draft-expire-${uuid.v4()}`;
    const threshold = new Date(this._now().getTime() - this._configuration.ttlSeconds * 1000);

    const candidates: ExpirationCandidate[] = await this._dataSource
      .getRepository(FirewallProfileDraft)
      .find({
        select: EXPIRATION_CANDIDATE_SELECT,
        where: {
          status: In([...FIREWALL_PROFILE_DRAFT_EXPIRATION_ELIGIBLE_STATUSES]),
          updatedAt: LessThanOrEqual(threshold),
        },
        order: { updatedAt: 'ASC' },
        take: this._configuration.batchSize,
      });

    let expired = 0;
    let skipped = 0;
    let failed = 0;

    for (const candidate of candidates) {
      try {
        await this._stateService.transition(candidate.id, candidate.status, 'expired', {
          fwCloudId: candidate.fwCloudId,
          step: 'expire',
          requestId: jobRunId,
          message: `Expired after ${this._configuration.ttlSeconds}s of inactivity`,
        });
        expired += 1;
        await this.auditExpiration(candidate, jobRunId, threshold);
      } catch (error) {
        if (error instanceof FirewallProfileDraftTransitionConflictError) {
          // Concurrent activity moved the draft since it was selected: skip
          // safely, never overwrite the newer state, no expiration audit.
          skipped += 1;
          continue;
        }
        failed += 1;
        logger().error(
          `Assisted Profile draft expiration failed for draft ${candidate.id} ` +
            `(fwcloud ${candidate.fwCloudId}): ${error?.constructor?.name ?? 'Error'} ` +
            `${(error as { code?: string })?.code ?? error?.message ?? ''}`,
        );
      }
    }

    const stats: FirewallProfileDraftExpirationRunStats = {
      scanned: candidates.length,
      expired,
      skipped,
      failed,
      durationMs: Date.now() - startedAtMs,
      thresholdIso: threshold.toISOString(),
      jobRunId,
    };

    logger().info(
      `Assisted Profile draft expiration completed: scanned=${stats.scanned}, ` +
        `expired=${stats.expired}, skipped=${stats.skipped}, failed=${stats.failed}.`,
    );

    await this._auditLogService.logMutation({
      call: FIREWALL_PROFILE_DRAFT_EXPIRATION_JOB_AUDIT_CALL,
      description:
        `Cron task. Assisted Profile draft expiration scanned=${stats.scanned}, ` +
        `expired=${stats.expired}, skipped=${stats.skipped}, failed=${stats.failed}.`,
      data: {
        source: 'cron',
        task: 'assisted-profile.drafts.expire',
        jobRunId,
        ttlSeconds: this._configuration.ttlSeconds,
        ...stats,
      },
    });

    return stats;
  }

  private async auditExpiration(
    candidate: ExpirationCandidate,
    jobRunId: string,
    threshold: Date,
  ): Promise<void> {
    await this._auditLogService.logMutation({
      call: FIREWALL_PROFILE_DRAFT_EXPIRATION_AUDIT_CALL,
      description: `Assisted Profile draft ${candidate.id} expired after ${this._configuration.ttlSeconds} seconds of inactivity.`,
      status: 200,
      fwCloudId: candidate.fwCloudId,
      data: {
        draftId: candidate.id,
        fwCloudId: candidate.fwCloudId,
        creatorUserId: candidate.createdBy,
        previousStatus: candidate.status,
        newStatus: 'expired',
        ttlSeconds: this._configuration.ttlSeconds,
        expirationThresholdIso: threshold.toISOString(),
        lastActivityAtIso: candidate.updatedAt.toISOString(),
        jobRunId,
      },
    });
  }

  private configurationFromApplication(): FirewallProfileDraftExpirationConfigurationInput {
    if (!this._app) {
      return {};
    }

    const config = this._app.config.get('assisted_profile.draft');
    return {
      ttlSeconds: config.ttl_seconds,
      enabled: config.expiration_job.enabled,
      intervalSeconds: config.expiration_job.interval_seconds,
      batchSize: config.expiration_job.batch_size,
    };
  }
}
