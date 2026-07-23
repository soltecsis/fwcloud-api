import { Service } from '../../fonaments/services/service';
import { AuditLogService } from '../audit/AuditLog.service';
import type { FirewallProfileDraft } from './firewall-profile-draft.model';
import {
  FirewallProfileDraftStateService,
  type FirewallProfileDraftSummary,
} from './firewall-profile-draft-state.service';

export const FIREWALL_PROFILE_DRAFT_DISCARD_AUDIT_CALL = 'assistant.drafts.discard';

/** Identity of the user requesting a draft mutation. */
export interface FirewallProfileDraftActor {
  userId: number | null;
  userName?: string | null;
  sessionId?: number | null;
  sourceIp?: string | null;
}

/** FWCloud-scoped draft reads and audited user actions. */
export class FirewallProfileDraftService extends Service {
  protected _stateService: FirewallProfileDraftStateService;
  protected _auditLogService: AuditLogService;

  public async build(): Promise<FirewallProfileDraftService> {
    [this._stateService, this._auditLogService] = await Promise.all([
      this._app.getService<FirewallProfileDraftStateService>(FirewallProfileDraftStateService.name),
      this._app.getService<AuditLogService>(AuditLogService.name),
    ]);

    return this;
  }

  public listByFwCloud(fwCloudId: number): Promise<FirewallProfileDraftSummary[]> {
    return this._stateService.listByFwCloud(fwCloudId);
  }

  /** Detail/action reads enforce the supported contract-version window. */
  public getByIdAndFwCloud(draftId: number, fwCloudId: number): Promise<FirewallProfileDraft> {
    return this._stateService.loadForProcessing(draftId, fwCloudId);
  }

  /**
   * Uses the central state machine, then records the user-facing discard.
   * Rejected transitions fail before the dedicated audit entry is written.
   */
  public async discard(
    draftId: number,
    fwCloudId: number,
    actor: FirewallProfileDraftActor,
  ): Promise<FirewallProfileDraft> {
    const draft = await this.getByIdAndFwCloud(draftId, fwCloudId);

    const transitioned = await this._stateService.transition(draft.id, draft.status, 'discarded', {
      fwCloudId,
      userId: actor.userId,
      requestId: draft.requestId,
      step: 'discard',
    });

    await this._auditLogService.logMutation({
      ...actor,
      call: FIREWALL_PROFILE_DRAFT_DISCARD_AUDIT_CALL,
      description: `Assisted Profile draft ${draft.id} discarded.`,
      status: 200,
      fwCloudId,
      data: {
        draftId: draft.id,
        fwCloudId,
        creatorUserId: draft.createdBy,
        actorUserId: actor.userId,
        previousStatus: draft.status,
        newStatus: 'discarded',
        requestId: draft.requestId,
      },
    });

    return transitioned;
  }
}
