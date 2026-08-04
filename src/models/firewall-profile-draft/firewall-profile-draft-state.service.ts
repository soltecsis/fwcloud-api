import { DataSource, type EntityManager, type FindOptionsSelect } from 'typeorm';
import type { AbstractApplication } from '../../fonaments/abstract-application';
import { NotFoundException } from '../../fonaments/exceptions/not-found-exception';
import { Service } from '../../fonaments/services/service';
import { DatabaseService } from '../../database/database.service';
import { AuditLog } from '../audit/AuditLog';
import {
  getSupportedContractSchemas,
  VENDORED_CONTRACT_SCHEMAS,
} from '../assistant-contract/schemas/manifest';
import type { VendoredContractSchema } from '../assistant-contract/schemas/manifest';
import { FirewallProfileDraft } from './firewall-profile-draft.model';
import {
  FirewallProfileDraftTransitionConflictError,
  UnsupportedFirewallProfileDraftContractVersionError,
} from './firewall-profile-draft.errors';
import type { AssistedProfileAssumption } from '../assistant-contract/assisted-profile-assumptions';
import type {
  DraftTransitionContext,
  FirewallProfileDraftStatus,
  FirewallProfileDraftStepLogEntry,
  PreviewBoundDraftContent,
} from './firewall-profile-draft.types';

const statuses = (...values: FirewallProfileDraftStatus[]) => Object.freeze(values);

export const FIREWALL_PROFILE_DRAFT_TRANSITIONS = Object.freeze({
  validated: statuses('preview_ok', 'discarded', 'expired'),
  // preview_ok -> validated exists solely for preview invalidation: once
  // preview-bound content changes, the persisted preview hash no longer
  // describes the draft, so the draft must go back to requiring a preview.
  // `updatePreviewBoundContent()` is the only supported way to take it.
  preview_ok: statuses('apply_pending', 'validated', 'discarded', 'expired'),
  apply_pending: statuses('applied', 'apply_failed'),
  applied: statuses(),
  apply_failed: statuses('apply_pending', 'discarded', 'expired'),
  discarded: statuses(),
  expired: statuses(),
}) satisfies Readonly<Record<FirewallProfileDraftStatus, readonly FirewallProfileDraftStatus[]>>;

export const FIREWALL_PROFILE_DRAFT_TRANSITION_AUDIT_CALL = 'firewall-profile-draft.transition';

type DraftLifecycleTimestamp =
  | 'validatedAt'
  | 'previewedAt'
  | 'applyPendingAt'
  | 'appliedAt'
  | 'failedAt'
  | 'discardedAt'
  | 'expiredAt';

const LIFECYCLE_TIMESTAMP_BY_STATUS = Object.freeze({
  validated: 'validatedAt',
  preview_ok: 'previewedAt',
  apply_pending: 'applyPendingAt',
  applied: 'appliedAt',
  apply_failed: 'failedAt',
  discarded: 'discardedAt',
  expired: 'expiredAt',
}) satisfies Readonly<Record<FirewallProfileDraftStatus, DraftLifecycleTimestamp>>;

const transitionResult = (status: FirewallProfileDraftStatus): 'success' | 'failed' =>
  status === 'apply_failed' ? 'failed' : 'success';

const DRAFT_SUMMARY_SELECT = {
  id: true,
  fwCloudId: true,
  createdBy: true,
  status: true,
  contractVersion: true,
  requestId: true,
  instructionOriginal: true,
  createdAt: true,
  updatedAt: true,
  validatedAt: true,
  previewedAt: true,
  applyPendingAt: true,
  appliedAt: true,
  failedAt: true,
  discardedAt: true,
  expiredAt: true,
} as const satisfies FindOptionsSelect<FirewallProfileDraft>;

export type FirewallProfileDraftSummary = Pick<
  FirewallProfileDraft,
  keyof typeof DRAFT_SUMMARY_SELECT
>;

class GuardedTransitionLostError extends Error {}

/** Fields required to insert a freshly generated, already-validated draft. */
export interface CreateFirewallProfileDraftInput {
  readonly fwCloudId: number;
  readonly createdBy: number | null;
  readonly contractVersion: string;
  /** The API-9 mapped `ReplicationProfileStoreDto`, never the raw agent response. */
  readonly proposal: unknown;
  /** Values the mapper or the agent supplied; unrecoverable from `proposal`. */
  readonly assumptions?: AssistedProfileAssumption[] | null;
  readonly requestId?: string | null;
  readonly instructionOriginal?: string | null;
  readonly stepLog?: FirewallProfileDraftStepLogEntry[] | null;
}

export class FirewallProfileDraftStateService extends Service {
  private dataSource: DataSource;
  private readonly supportedVersions: readonly string[];

  public constructor(
    app: AbstractApplication,
    dataSource?: DataSource,
    manifest: readonly VendoredContractSchema[] = VENDORED_CONTRACT_SCHEMAS,
  ) {
    super(app);
    this.dataSource = dataSource;
    const supported = getSupportedContractSchemas(manifest);
    // Accept the gateway's contract family identifier and its retained schema
    // versions. This preserves compatibility with drafts created by API-1,
    // which exposes both values in its accepted result.
    this.supportedVersions = Object.freeze([
      ...new Set(
        supported.flatMap(({ contractVersion, schemaVersion }) => [contractVersion, schemaVersion]),
      ),
    ]);
  }

  public async build(): Promise<FirewallProfileDraftStateService> {
    if (!this.dataSource) {
      const database = await this._app.getService<DatabaseService>(DatabaseService.name);
      this.dataSource = database.dataSource;
    }
    return this;
  }

  /**
   * Also load-bearing for `transition()`'s CAS update below: the contract
   * version check runs before any write, including a transition to
   * `expired`. `ExpireFirewallProfileDraftsJob` depends on that ordering
   * never leaving a draft permanently stuck — see the assistant-contract
   * README's "Mapper retention rule" for why a mapper must not be retired
   * while a non-terminal draft still carries its version.
   */
  public async loadForProcessing(
    draftId: number,
    fwCloudId?: number,
  ): Promise<FirewallProfileDraft> {
    const where = fwCloudId === undefined ? { id: draftId } : { id: draftId, fwCloudId };

    const draft = await this.dataSource.getRepository(FirewallProfileDraft).findOne({ where });
    if (!draft) {
      throw new NotFoundException(`Firewall Profile draft ${draftId} was not found`);
    }
    this.assertSupportedContractVersion(draft);
    return draft;
  }

  /** Lists draft history without loading internal payload and integrity columns. */
  public listByFwCloud(fwCloudId: number): Promise<FirewallProfileDraftSummary[]> {
    return this.dataSource.getRepository(FirewallProfileDraft).find({
      select: DRAFT_SUMMARY_SELECT,
      where: { fwCloudId },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  /**
   * Inserts a freshly generated draft directly into `validated`. This is not
   * a state transition (there is no prior row), so unlike `transition()` it
   * performs no CAS guard and writes no `firewall-profile-draft.transition`
   * audit row of its own — the caller (AssistedProfileGenerationService)
   * owns the single audit record for the whole generation attempt.
   */
  public async create(input: CreateFirewallProfileDraftInput): Promise<FirewallProfileDraft> {
    const repository = this.dataSource.getRepository(FirewallProfileDraft);
    const draft = repository.create({
      fwCloudId: input.fwCloudId,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      contractVersion: input.contractVersion,
      proposal: input.proposal,
      assumptions: input.assumptions ?? null,
      requestId: input.requestId ?? null,
      instructionOriginal: input.instructionOriginal ?? null,
      stepLog: input.stepLog ?? null,
    });
    return repository.save(draft);
  }

  /**
   * The single supported way to change preview-bound draft content.
   *
   * Content and invalidation share one transaction: a draft can never end up
   * with new content while still advertising `preview_ok` and the hash of the
   * content it no longer holds. A draft already in `validated` is only rewritten
   * (any leftover hash is cleared defensively); one in `preview_ok` is walked
   * back to `validated` through the state machine's dedicated invalidation
   * transition, so a new preview is required before it can be applied.
   *
   * Only those two states accept a content change. Once a draft has reached
   * apply or a terminal state its content is the record of what was applied or
   * abandoned, and rewriting it would falsify that history.
   */
  public async updatePreviewBoundContent(
    draftId: number,
    content: PreviewBoundDraftContent,
    context: DraftTransitionContext = {},
  ): Promise<FirewallProfileDraft> {
    const draft = await this.loadForProcessing(draftId, context.fwCloudId);

    if (draft.status !== 'validated' && draft.status !== 'preview_ok') {
      throw new FirewallProfileDraftTransitionConflictError(draft.id, draft.status, 'validated');
    }

    if (draft.status === 'preview_ok') {
      return this.transition(draftId, 'preview_ok', 'validated', {
        ...context,
        fwCloudId: draft.fwCloudId,
        step: 'preview_invalidated',
        message: 'Preview-bound draft content changed.',
        previewHash: null,
        previewedAt: null,
        previewBoundContent: content,
      });
    }

    // No preview to invalidate; the content write still clears any leftover
    // hash so nothing downstream can accept a binding to superseded content.
    const values: Partial<FirewallProfileDraft> = {
      previewHash: null,
      previewedAt: null,
      updatedAt: new Date(),
      ...(context.userId !== undefined ? { updatedBy: context.userId } : {}),
    };
    this.applyPreviewBoundContent(values, content);

    await this.dataSource
      .getRepository(FirewallProfileDraft)
      .createQueryBuilder()
      .update(FirewallProfileDraft)
      .set(values)
      .where('id = :draftId', { draftId })
      .andWhere('fwcloud_id = :fwCloudId', { fwCloudId: draft.fwCloudId })
      .execute();

    return this.loadForProcessing(draftId, draft.fwCloudId);
  }

  private applyPreviewBoundContent(
    values: Partial<FirewallProfileDraft>,
    content: PreviewBoundDraftContent,
  ): void {
    if (content.contractVersion !== undefined) values.contractVersion = content.contractVersion;
    if (content.assumptions !== undefined) values.assumptions = content.assumptions;
  }

  /**
   * Records a step without moving the draft, for the failure paths that must
   * leave the status untouched. Guarded by the expected status so a log entry
   * can never land on a draft another request has meanwhile advanced.
   */
  public async appendStepLog(
    draftId: number,
    expectedStatus: FirewallProfileDraftStatus,
    entry: FirewallProfileDraftStepLogEntry,
    fwCloudId?: number,
  ): Promise<void> {
    const where = fwCloudId === undefined ? { id: draftId } : { id: draftId, fwCloudId };
    const repository = this.dataSource.getRepository(FirewallProfileDraft);
    const draft = await repository.findOne({ where });

    if (!draft || draft.status !== expectedStatus) {
      return;
    }

    await repository
      .createQueryBuilder()
      .update(FirewallProfileDraft)
      .set({ stepLog: [...(draft.stepLog ?? []), entry] })
      .where('id = :draftId', { draftId })
      .andWhere('fwcloud_id = :fwCloudId', { fwCloudId: draft.fwCloudId })
      .andWhere('status = :expectedStatus', { expectedStatus })
      .execute();
  }

  public async transition(
    draftId: number,
    expectedStatus: FirewallProfileDraftStatus,
    nextStatus: FirewallProfileDraftStatus,
    context: DraftTransitionContext = {},
  ): Promise<FirewallProfileDraft> {
    const draft = await this.loadForProcessing(draftId, context.fwCloudId);
    this.assertTransition(draft, expectedStatus, nextStatus);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const now = new Date();
        const stepLog = [
          ...(draft.stepLog ?? []),
          ...(context.precedingSteps ?? []),
          this.makeStepLogEntry(nextStatus, now, context),
        ];
        const values: Partial<FirewallProfileDraft> = {
          status: nextStatus,
          updatedAt: now,
          updatedBy: context.userId ?? draft.updatedBy,
          requestId: context.requestId ?? draft.requestId,
          stepLog,
        };
        values[LIFECYCLE_TIMESTAMP_BY_STATUS[nextStatus]] = now;
        // After the status timestamp, so an invalidation can clear the
        // `previewed_at` belonging to the status it is leaving.
        if (context.previewedAt !== undefined) values.previewedAt = context.previewedAt;
        if (context.previewHash !== undefined) values.previewHash = context.previewHash;
        if (context.applyHash !== undefined) values.applyHash = context.applyHash;
        if (context.targetIds !== undefined) values.targetIds = context.targetIds;
        // Folded into the guarded update so a content change and the preview
        // invalidation it forces are literally the same statement.
        if (context.previewBoundContent !== undefined) {
          this.applyPreviewBoundContent(values, context.previewBoundContent);
        }

        // The expected-status predicate is the database compare-and-set guard.
        // In particular, preview_ok -> apply_pending can affect only one row
        // across concurrent API processes; no in-memory lock is involved.
        const repository = manager.getRepository(FirewallProfileDraft);
        const result = await repository
          .createQueryBuilder()
          .update(FirewallProfileDraft)
          .set(values)
          .where('id = :draftId', { draftId })
          .andWhere('fwcloud_id = :fwCloudId', { fwCloudId: draft.fwCloudId })
          .andWhere('status = :expectedStatus', { expectedStatus })
          .execute();

        if (result.affected !== 1) {
          throw new GuardedTransitionLostError();
        }

        await this.writeAudit(manager, draft, nextStatus, now, context);
        const transitioned = await repository.findOneBy({
          id: draftId,
          fwCloudId: draft.fwCloudId,
        });
        if (!transitioned) {
          throw new Error(`Firewall Profile draft ${draftId} disappeared after transition`);
        }
        return transitioned;
      });
    } catch (error) {
      if (!(error instanceof GuardedTransitionLostError)) {
        throw error;
      }

      // Reload only after the losing transaction has rolled back. This avoids
      // MySQL REPEATABLE READ returning the snapshot observed before the CAS.
      const current = await this.loadForProcessing(draftId, context.fwCloudId);
      throw new FirewallProfileDraftTransitionConflictError(draftId, current.status, nextStatus);
    }
  }

  private assertSupportedContractVersion(draft: FirewallProfileDraft): void {
    if (!this.supportedVersions.includes(draft.contractVersion)) {
      throw new UnsupportedFirewallProfileDraftContractVersionError(
        draft.id,
        draft.contractVersion,
        [...this.supportedVersions],
      );
    }
  }

  private assertTransition(
    draft: FirewallProfileDraft,
    expectedStatus: FirewallProfileDraftStatus,
    nextStatus: FirewallProfileDraftStatus,
  ): void {
    if (
      draft.status !== expectedStatus ||
      !FIREWALL_PROFILE_DRAFT_TRANSITIONS[draft.status].includes(nextStatus)
    ) {
      throw new FirewallProfileDraftTransitionConflictError(draft.id, draft.status, nextStatus);
    }
  }

  private makeStepLogEntry(
    nextStatus: FirewallProfileDraftStatus,
    now: Date,
    context: DraftTransitionContext,
  ): FirewallProfileDraftStepLogEntry {
    return {
      step: context.step ?? nextStatus,
      status: transitionResult(nextStatus),
      timestamp: now.toISOString(),
      ...(context.message ? { message: context.message } : {}),
      ...(context.requestId ? { requestId: context.requestId } : {}),
      ...(context.errorCode ? { errorCode: context.errorCode } : {}),
    };
  }

  private async writeAudit(
    manager: EntityManager,
    draft: FirewallProfileDraft,
    nextStatus: FirewallProfileDraftStatus,
    now: Date,
    context: DraftTransitionContext,
  ): Promise<void> {
    const targetIds = context.targetIds ?? draft.targetIds;
    const data = {
      draftId: draft.id,
      fwCloudId: draft.fwCloudId,
      userId: context.userId ?? null,
      previousStatus: draft.status,
      newStatus: nextStatus,
      requestId: context.requestId ?? draft.requestId ?? null,
      result: transitionResult(nextStatus),
      ...(context.errorCode ? { failureReason: context.errorCode } : {}),
      timestamp: now.toISOString(),
    };

    await manager.getRepository(AuditLog).insert({
      startedAt: now,
      userId: context.userId ?? null,
      userName: null,
      sessionId: null,
      sourceIp: null,
      fwCloudId: draft.fwCloudId,
      fwCloudName: null,
      firewallId: targetIds?.firewallId ?? null,
      firewallName: null,
      clusterId: targetIds?.clusterId ?? null,
      clusterName: null,
      call: FIREWALL_PROFILE_DRAFT_TRANSITION_AUDIT_CALL,
      status: 200,
      durationMs: 0,
      data: JSON.stringify(data),
      description: `Firewall Profile draft ${draft.id}: ${draft.status} -> ${nextStatus}`,
    });
  }
}
