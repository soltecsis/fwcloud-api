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
import { logger } from '../../fonaments/abstract-application';
import { Service } from '../../fonaments/services/service';
import { AuditLogService } from '../audit/AuditLog.service';
import { hashFirewallProfileDraftValue } from '../firewall-profile-draft/firewall-profile-draft.hash';
import {
  AssistedProfileProposalAnonymizationError,
  AssistedProfileProposalAnonymizer,
  type AnonymizedRejectedProposal,
} from './assisted-profile-proposal-anonymizer';
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
import {
  isCapturableAssistedProfileRejectionCategory,
  type AssistedProfileRejectionCategory,
} from './assisted-profile-rejected-proposal.types';

export const ASSISTED_PROFILE_REJECTED_CAPTURE_AUDIT_CALL = 'assistant.rejected-proposal.capture';

const MILLISECONDS_PER_DAY = 86_400_000;

export interface AssistedProfileRejectedProposalCaptureInput {
  /**
   * The rejected proposal as received. It never leaves this call: it is
   * anonymized in-place here and only the anonymized result is handed to the
   * repository.
   */
  readonly proposal: unknown;
  readonly rejectionCategory: AssistedProfileRejectionCategory;
  readonly rejectionCode?: string | null;
  readonly contractVersion?: string | null;
  /** fwcloud-api's own generated request id. Never a client-supplied value. */
  readonly requestId?: string | null;
}

export type AssistedProfileRejectedProposalCaptureSkipReason =
  'disabled' | 'not_eligible' | 'anonymization_failed' | 'persistence_failed';

export type AssistedProfileRejectedProposalCaptureOutcome =
  | { readonly captured: false; readonly reason: AssistedProfileRejectedProposalCaptureSkipReason }
  | {
      readonly captured: true;
      readonly id: number;
      readonly expiresAt: Date;
      readonly fingerprint: string;
    };

export interface AssistedProfileRejectedProposalCaptureCreateOptions {
  readonly configuration?: AssistedProfileRejectedProposalConfigurationInput;
  readonly repository?: AssistedProfileRejectedProposalRepository;
  readonly anonymizer?: Pick<AssistedProfileProposalAnonymizer, 'anonymize'>;
  readonly auditLogService?: Pick<AuditLogService, 'logMutation'>;
  /** Capture/expiry clock; injectable so retention boundaries stay testable. */
  readonly now?: () => Date;
}

/**
 * Optional, opt-in capture of anonymized validator-rejected proposals.
 *
 * Three invariants govern every line of this service:
 *
 * 1. **Off by default.** With the flag disabled, neither the anonymizer nor the
 *    repository is invoked — nothing is written, nothing is even computed.
 * 2. **Anonymized only.** The raw proposal reaches `AnonymizationService` and
 *    stops there. `AssistedProfileRejectedProposalRepository` has no field that
 *    could carry it, and a failed anonymization means "no sample", never "store
 *    the original".
 * 3. **Never load-bearing.** `capture()` resolves rather than throws for every
 *    failure mode. Corpus collection is secondary to the validation response
 *    the caller already decided on, so it can never turn a contract or domain
 *    validation error into an unrelated server failure.
 */
export class AssistedProfileRejectedProposalCaptureService extends Service {
  private _configuration: AssistedProfileRejectedProposalConfiguration;
  private _repository: AssistedProfileRejectedProposalRepository;
  private _anonymizer: Pick<AssistedProfileProposalAnonymizer, 'anonymize'>;
  private _auditLogService: Pick<AuditLogService, 'logMutation'>;
  private _now: () => Date = () => new Date();

  public constructor(
    app: AbstractApplication | null,
    private readonly _overrides: AssistedProfileRejectedProposalCaptureCreateOptions = {},
  ) {
    super(app);
  }

  /** Creates an initialized service with explicit dependencies (tests/tools). */
  public static async create(
    options: AssistedProfileRejectedProposalCaptureCreateOptions = {},
  ): Promise<AssistedProfileRejectedProposalCaptureService> {
    return new AssistedProfileRejectedProposalCaptureService(null, options).build();
  }

  public async build(): Promise<AssistedProfileRejectedProposalCaptureService> {
    this._configuration = resolveAssistedProfileRejectedProposalConfiguration(
      this._overrides.configuration ?? readAssistedProfileRejectedProposalConfiguration(this._app),
    );
    this._anonymizer = this._overrides.anonymizer ?? new AssistedProfileProposalAnonymizer();
    this._now = this._overrides.now ?? this._now;

    this._repository =
      this._overrides.repository ??
      (await resolveAssistedProfileRejectedProposalRepository(this._app));
    this._auditLogService =
      this._overrides.auditLogService ??
      (await this._app.getService<AuditLogService>(AuditLogService.name));

    return this;
  }

  public get configuration(): AssistedProfileRejectedProposalConfiguration {
    return this._configuration;
  }

  public get enabled(): boolean {
    return this._configuration.captureEnabled;
  }

  /**
   * Records the capture state once per process. The flag is deployment-time
   * environment configuration, so the application cannot attribute a change to
   * a user: there is no runtime admin path to audit, and this operational log
   * line is the honest substitute for a user-level audit event.
   */
  public logStartupState(): void {
    if (!this._configuration.captureEnabled) {
      logger().info('Assisted Profile rejected-proposal capture: disabled.');
      return;
    }

    logger().warn(
      'Assisted Profile rejected-proposal capture: enabled. Anonymized samples of ' +
        `rejected proposals will be retained for ${this._configuration.retentionDays} day(s).`,
    );
  }

  /**
   * Captures one rejected proposal. Resolves with what happened; never throws
   * and never rethrows, whatever the anonymizer or the database do.
   */
  public async capture(
    input: AssistedProfileRejectedProposalCaptureInput,
  ): Promise<AssistedProfileRejectedProposalCaptureOutcome> {
    if (!this._configuration.captureEnabled) {
      return { captured: false, reason: 'disabled' };
    }
    if (!isCapturableAssistedProfileRejectionCategory(input.rejectionCategory)) {
      return { captured: false, reason: 'not_eligible' };
    }

    let anonymized: AnonymizedRejectedProposal;
    try {
      anonymized = this._anonymizer.anonymize(input.proposal);
    } catch (error) {
      this.logFailure('anonymization', input, error);
      return { captured: false, reason: 'anonymization_failed' };
    }

    const capturedAt = this._now();
    const expiresAt = new Date(
      capturedAt.getTime() + this._configuration.retentionDays * MILLISECONDS_PER_DAY,
    );
    // Calculated from the anonymized payload only: a hash of the original would
    // itself be a stable identifier for sensitive content. Reuses the drafts'
    // canonicalize-then-SHA-256 procedure so one hashing rule covers both.
    const fingerprint = hashFirewallProfileDraftValue(anonymized.payload);

    try {
      const record = await this._repository.persist({
        rejectionCategory: input.rejectionCategory,
        rejectionCode: input.rejectionCode ?? null,
        contractVersion: input.contractVersion ?? null,
        anonymizedProposal: anonymized.payload,
        anonymizationVersion: anonymized.anonymizationVersion,
        proposalFingerprint: fingerprint,
        requestId: input.requestId ?? null,
        capturedAt,
        expiresAt,
      });

      await this.auditCapture(record.id, input, anonymized, expiresAt, fingerprint);

      return { captured: true, id: record.id, expiresAt, fingerprint };
    } catch (error) {
      this.logFailure('persistence', input, error);
      return { captured: false, reason: 'persistence_failed' };
    }
  }

  /** Metadata only: no proposal body, no instruction, no PII, no credentials. */
  private async auditCapture(
    id: number,
    input: AssistedProfileRejectedProposalCaptureInput,
    anonymized: AnonymizedRejectedProposal,
    expiresAt: Date,
    fingerprint: string,
  ): Promise<void> {
    try {
      await this._auditLogService.logMutation({
        call: ASSISTED_PROFILE_REJECTED_CAPTURE_AUDIT_CALL,
        description:
          `Assisted Profile rejected proposal captured (anonymized) as sample ${id}: ` +
          `${input.rejectionCategory}.`,
        status: 201,
        data: {
          captureId: id,
          rejectionCategory: input.rejectionCategory,
          rejectionCode: input.rejectionCode ?? null,
          contractVersion: input.contractVersion ?? null,
          anonymizationVersion: anonymized.anonymizationVersion,
          // Counts per anonymization rule; never the values they replaced.
          redactions: anonymized.redactions,
          proposalFingerprint: fingerprint,
          requestId: input.requestId ?? null,
          retentionDays: this._configuration.retentionDays,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (error) {
      // The sample is already stored; an audit failure must not undo it or
      // surface as a capture failure.
      this.logFailure('audit', input, error);
    }
  }

  /**
   * Non-sensitive diagnostics only: stage, category and error identity. The
   * error's own message is included solely for anonymization failures, whose
   * messages are built from field paths and structural limits rather than from
   * proposal content; a database error message could quote the offending row.
   */
  private logFailure(
    stage: 'anonymization' | 'persistence' | 'audit',
    input: AssistedProfileRejectedProposalCaptureInput,
    error: unknown,
  ): void {
    const identity = error?.constructor?.name ?? 'Error';
    const detail =
      error instanceof AssistedProfileProposalAnonymizationError
        ? `: ${error.message}`
        : (error as { code?: string })?.code
          ? `: ${(error as { code?: string }).code}`
          : '';
    logger().error(
      `Assisted Profile rejected proposal capture failed during ${stage} ` +
        `(category ${input.rejectionCategory}): ${identity}${detail}.`,
    );
  }
}
