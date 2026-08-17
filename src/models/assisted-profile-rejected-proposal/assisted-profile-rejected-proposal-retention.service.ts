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
import type { AbstractApplication } from '../../fonaments/abstract-application';
import { logger } from '../../fonaments/abstract-application';
import { Service } from '../../fonaments/services/service';
import { PeriodicSweep } from '../../fonaments/services/periodic-sweep';
import { AuditLogService } from '../audit/AuditLog.service';
import {
  readAssistedProfileRejectedProposalConfiguration,
  resolveAssistedProfileRejectedProposalConfiguration,
  type AssistedProfileRejectedProposalConfiguration,
  type AssistedProfileRejectedProposalConfigurationInput,
} from './assisted-profile-rejected-proposal.configuration';
import {
  resolveAssistedProfileRejectedProposalRepository,
  type AssistedProfileRejectedProposalRepository,
} from './assisted-profile-rejected-proposal.repository';

export const ASSISTED_PROFILE_REJECTED_PURGE_AUDIT_CALL =
  'CRON assisted-profile.rejected-proposal.purge';

/** Upper bound on batches per run, so one sweep can never scan unbounded. */
export const REJECTED_PROPOSAL_PURGE_MAX_BATCHES_PER_RUN = 10;

export interface PurgeAssistedProfileRejectedProposalsJobCreateOptions {
  readonly configuration?: AssistedProfileRejectedProposalConfigurationInput;
  readonly repository?: AssistedProfileRejectedProposalRepository;
  readonly auditLogService?: Pick<AuditLogService, 'logMutation'>;
  /** Wall clock used to evaluate `now >= expires_at`; overridable in tests. */
  readonly now?: () => Date;
}

export interface AssistedProfileRejectedProposalPurgeRunStats {
  readonly scanned: number;
  readonly purged: number;
  readonly batches: number;
  readonly durationMs: number;
  readonly nowIso: string;
  readonly jobRunId: string;
}

/**
 * Retention enforcement for the optional rejected-proposal corpus: physically
 * deletes every sample whose `expires_at` has been reached.
 *
 * Retention correctness never depends on someone running SQL by hand — this
 * job is the mechanism, `run()` is directly callable for a deterministic
 * manual/test sweep, and its stats are the observable result. Expiry is
 * evaluated in exactly one place (`findExpired()` in the repository, `now >=
 * expires_at`), never re-derived from `captured_at` elsewhere.
 *
 * The job runs regardless of the capture flag: turning capture off must still
 * let already-captured samples age out.
 */
export class PurgeAssistedProfileRejectedProposalsJob extends Service {
  private _configuration: AssistedProfileRejectedProposalConfiguration;
  private _repository: AssistedProfileRejectedProposalRepository;
  private _auditLogService: Pick<AuditLogService, 'logMutation'>;
  private _now: () => Date = () => new Date();

  private _sweep: PeriodicSweep;

  public constructor(
    app: AbstractApplication | null,
    private readonly _overrides: PurgeAssistedProfileRejectedProposalsJobCreateOptions = {},
  ) {
    super(app);
  }

  /** Creates an initialized job with explicit dependencies (tests/tools). */
  public static async create(
    options: PurgeAssistedProfileRejectedProposalsJobCreateOptions = {},
  ): Promise<PurgeAssistedProfileRejectedProposalsJob> {
    return new PurgeAssistedProfileRejectedProposalsJob(null, options).build();
  }

  public async build(): Promise<PurgeAssistedProfileRejectedProposalsJob> {
    this._configuration = resolveAssistedProfileRejectedProposalConfiguration(
      this._overrides.configuration ?? readAssistedProfileRejectedProposalConfiguration(this._app),
    );
    this._now = this._overrides.now ?? this._now;

    this._repository =
      this._overrides.repository ??
      (await resolveAssistedProfileRejectedProposalRepository(this._app));
    this._auditLogService =
      this._overrides.auditLogService ??
      (await this._app.getService<AuditLogService>(AuditLogService.name));

    this._sweep = new PeriodicSweep({
      enabled: this._configuration.purgeEnabled,
      intervalSeconds: this._configuration.purgeIntervalSeconds,
      run: () => this.run(),
    });

    return this;
  }

  public async close(): Promise<void> {
    this.stop();
  }

  public get configuration(): AssistedProfileRejectedProposalConfiguration {
    return this._configuration;
  }

  /**
   * Idempotent, and a no-op when the purge job is disabled. The first sweep
   * runs after one interval, not immediately at boot — see `PeriodicSweep`,
   * which `ExpireFirewallProfileDraftsJob` shares for the same reason: the
   * interval is a delay-since-completion, not a clock-time cron schedule.
   */
  public start(): void {
    this._sweep.start();
  }

  /** Idempotent. Safe to call during application shutdown and between tests. */
  public stop(): void {
    this._sweep.stop();
  }

  /**
   * Runs one bounded sweep: up to `REJECTED_PROPOSAL_PURGE_MAX_BATCHES_PER_RUN`
   * batches of `purge_job.batch_size` expired samples. Callable directly
   * (bypassing `purgeEnabled` and scheduling) for manual/test runs.
   */
  public async run(): Promise<AssistedProfileRejectedProposalPurgeRunStats> {
    const startedAtMs = Date.now();
    const jobRunId = `rejected-proposal-purge-${uuid.v4()}`;
    const now = this._now();

    let scanned = 0;
    let purged = 0;
    let batches = 0;

    while (batches < REJECTED_PROPOSAL_PURGE_MAX_BATCHES_PER_RUN) {
      const expired = await this._repository.findExpired(now, this._configuration.purgeBatchSize);
      if (expired.length === 0) {
        break;
      }

      batches += 1;
      scanned += expired.length;
      purged += await this._repository.deleteByIds(expired.map((record) => record.id));

      if (expired.length < this._configuration.purgeBatchSize) {
        break;
      }
    }

    const stats: AssistedProfileRejectedProposalPurgeRunStats = {
      scanned,
      purged,
      batches,
      durationMs: Date.now() - startedAtMs,
      nowIso: now.toISOString(),
      jobRunId,
    };

    // Always logged, so operators can verify the sweep is actually running;
    // never carries sample contents.
    logger().info(
      `Assisted Profile expired rejected proposals purged: count=${stats.purged} ` +
        `(scanned=${stats.scanned}, batches=${stats.batches}).`,
    );

    // One summarized audit event per sweep that removed something. Nothing is
    // audited per historical sample, and a sweep that found nothing stays out
    // of the audit log entirely.
    if (stats.purged > 0) {
      await this._auditLogService.logMutation({
        call: ASSISTED_PROFILE_REJECTED_PURGE_AUDIT_CALL,
        description: `Cron task. Assisted Profile expired rejected proposals purged: count=${stats.purged}.`,
        data: {
          source: 'cron',
          task: 'assisted-profile.rejected-proposal.purge',
          retentionDays: this._configuration.retentionDays,
          ...stats,
        },
      });
    }

    return stats;
  }
}
