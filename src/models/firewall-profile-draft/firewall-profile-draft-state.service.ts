import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
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
import type {
  DraftTransitionContext,
  FirewallProfileDraftStatus,
  FirewallProfileDraftStepLogEntry,
} from './firewall-profile-draft.types';

const statuses = (...values: FirewallProfileDraftStatus[]) => Object.freeze(values);

export const FIREWALL_PROFILE_DRAFT_TRANSITIONS = Object.freeze({
  validated: statuses('preview_ok', 'discarded', 'expired'),
  preview_ok: statuses('apply_pending', 'discarded', 'expired'),
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

class GuardedTransitionLostError extends Error {}

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
        const stepLog = [...(draft.stepLog ?? []), this.makeStepLogEntry(nextStatus, now, context)];
        const values: Partial<FirewallProfileDraft> = {
          status: nextStatus,
          updatedAt: now,
          updatedBy: context.userId ?? draft.updatedBy,
          requestId: context.requestId ?? draft.requestId,
          stepLog,
        };
        values[LIFECYCLE_TIMESTAMP_BY_STATUS[nextStatus]] = now;
        if (context.previewHash !== undefined) values.previewHash = context.previewHash;
        if (context.applyHash !== undefined) values.applyHash = context.applyHash;
        if (context.targetIds !== undefined) values.targetIds = context.targetIds;

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
