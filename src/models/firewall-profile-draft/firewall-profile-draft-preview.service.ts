/*!
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

import { Service } from '../../fonaments/services/service';
import { AuditLogService } from '../audit/AuditLog.service';
import {
  asReplicationProfileNonEmptyString,
  asReplicationProfileRecord,
} from '../replication-profile/replication-profile.constants';
import { ReplicationProfileValidationService } from '../replication-profile/replication-profile-validation.service';
import type { FirewallProfileDraft } from './firewall-profile-draft.model';
import { FirewallProfileDraftStateService } from './firewall-profile-draft-state.service';
import type { FirewallProfileDraftActor } from './firewall-profile-draft.service';
import { FirewallProfileDraftTransitionConflictError } from './firewall-profile-draft.errors';
import { readPreviewAssumptions } from './firewall-profile-draft-preview.assumptions';
import { FirewallProfileDraftPreviewValidationError } from './firewall-profile-draft-preview.errors';
import {
  FirewallProfileDraftPreviewHasher,
  FIREWALL_PROFILE_DRAFT_PREVIEW_CONTRACT_VERSION,
} from './firewall-profile-draft-preview.hasher';
import type {
  AssistedProfilePreviewTarget,
  AssistedProfilePreviewValidation,
  FirewallProfileDraftPreview,
  FirewallProfileDraftPreviewHashInput,
} from './firewall-profile-draft-preview.types';
import type { FirewallProfileDraftStepLogEntry } from './firewall-profile-draft.types';

export const FIREWALL_PROFILE_DRAFT_PREVIEW_AUDIT_CALL = 'assistant.drafts.preview';

/**
 * Builds the synthetic preview of a validated draft.
 *
 * Synthetic because no target exists yet: everything reported is derived from
 * the persisted proposal and the recorded assumptions. This service reads
 * draft rows and writes only draft lifecycle columns and audit rows — it holds
 * no reference to any firewall, cluster, interface, rule or apply service, so
 * the "nothing mutates before human review" invariant is a property of its
 * dependencies rather than of its control flow.
 */
export class FirewallProfileDraftPreviewService extends Service {
  protected _stateService: FirewallProfileDraftStateService;
  protected _validationService: ReplicationProfileValidationService;
  protected _auditLogService: AuditLogService;
  protected _hasher = new FirewallProfileDraftPreviewHasher();

  public async build(): Promise<FirewallProfileDraftPreviewService> {
    [this._stateService, this._validationService, this._auditLogService] = await Promise.all([
      this._app.getService<FirewallProfileDraftStateService>(FirewallProfileDraftStateService.name),
      this._app.getService<ReplicationProfileValidationService>(
        ReplicationProfileValidationService.name,
      ),
      this._app.getService<AuditLogService>(AuditLogService.name),
    ]);

    return this;
  }

  public async preview(
    draftId: number,
    fwCloudId: number,
    actor: FirewallProfileDraftActor,
  ): Promise<FirewallProfileDraftPreview> {
    // Throws UnsupportedFirewallProfileDraftContractVersionError before any
    // mapping or validation happens, and scopes the lookup to the FWCloud so a
    // foreign draft is indistinguishable from a missing one.
    const draft = await this._stateService.loadForProcessing(draftId, fwCloudId);

    // Before the mapper and the validator run: an illegal state must cost
    // nothing and must not be observable as anything but a conflict.
    if (draft.status !== 'validated') {
      await this.auditFailure(draft, actor, 'illegal_state', 409);
      throw new FirewallProfileDraftTransitionConflictError(draft.id, draft.status, 'preview_ok');
    }

    const startedAt = new Date();
    // The stored proposal is already the API-9 mapper's
    // `ReplicationProfileStoreDto` (the generation flow persists mapped output,
    // never the raw agent response), so it is read once through that same
    // contract here rather than re-walked by each step below.
    const proposal = asReplicationProfileRecord(draft.proposal) ?? {};
    const target = this.describeTarget(proposal);
    const validation = this.runDomainValidator(proposal);

    if (!validation.valid) {
      await this.recordFailedStep(draft, 'domain_validation_failed');
      await this.auditFailure(draft, actor, 'domain_validation_failed', 422);
      throw new FirewallProfileDraftPreviewValidationError(draft.id, validation.errors);
    }

    // Replayed, never derived: the mapped proposal no longer distinguishes a
    // defaulted value from a requested one, so anything invented here would be
    // presentation rather than a record of what actually happened.
    const assumptions = readPreviewAssumptions(draft.id, draft.assumptions);
    const hashInput: FirewallProfileDraftPreviewHashInput = {
      preview_contract_version: FIREWALL_PROFILE_DRAFT_PREVIEW_CONTRACT_VERSION,
      draft_id: draft.id,
      fwcloud_id: draft.fwCloudId,
      contract_version: draft.contractVersion,
      proposal_hash: draft.proposalHash,
      proposal: draft.proposal,
      target_kind: target.kind,
      validation,
      assumptions,
    };

    let previewHash: string;
    try {
      previewHash = this._hasher.calculatePreviewHash(hashInput);
    } catch (error) {
      await this.recordFailedStep(draft, 'hash_generation_failed');
      await this.auditFailure(draft, actor, 'hash_generation_failed', 500);
      throw error;
    }

    // The guarded update is the only thing that decides whether this preview
    // happened: hash, timestamp, status and the transition audit row move
    // together, and a concurrent preview that loses the compare-and-set gets a
    // 409 here rather than a second successful response.
    let previewed: FirewallProfileDraft;
    try {
      previewed = await this._stateService.transition(draft.id, 'validated', 'preview_ok', {
        fwCloudId,
        userId: actor.userId,
        requestId: draft.requestId,
        step: 'preview_completed',
        previewHash,
        precedingSteps: this.successStepLog(startedAt),
      });
    } catch (error) {
      await this.auditFailure(draft, actor, 'transition_conflict', 409);
      throw error;
    }

    await this._auditLogService.logMutation({
      ...actor,
      call: FIREWALL_PROFILE_DRAFT_PREVIEW_AUDIT_CALL,
      description: `Assisted Profile draft preview generated.`,
      status: 200,
      fwCloudId,
      data: {
        draftId: draft.id,
        fwCloudId,
        creatorUserId: draft.createdBy,
        actorUserId: actor.userId,
        previousStatus: 'validated',
        newStatus: previewed.status,
        contractVersion: draft.contractVersion,
        previewContractVersion: FIREWALL_PROFILE_DRAFT_PREVIEW_CONTRACT_VERSION,
        proposalHash: draft.proposalHash,
        previewHash,
        assumptionCount: assumptions.length,
        validationValid: validation.valid,
        validationErrorCount: validation.errors.length,
        validationWarningCount: validation.warnings.length,
        requestId: draft.requestId,
        result: 'preview_ok',
      },
    });

    return {
      draft_id: previewed.id,
      fwcloud_id: previewed.fwCloudId,
      user_id: previewed.createdBy,
      status: 'preview_ok',
      preview_contract_version: FIREWALL_PROFILE_DRAFT_PREVIEW_CONTRACT_VERSION,
      contract_version: previewed.contractVersion,
      proposal_hash: previewed.proposalHash,
      preview_hash: previewHash,
      proposal: previewed.proposal,
      target,
      validation,
      assumptions,
      previewed_at: (previewed.previewedAt ?? new Date()).toISOString(),
    };
  }

  /**
   * Runs the existing FWCloud domain validator over the stored proposal.
   *
   * Secret validation stays off for the same reason as in generation: the
   * entity's own guard already rejects credential-like keys at persistence
   * time.
   */
  private runDomainValidator(proposal: Record<string, unknown>): AssistedProfilePreviewValidation {
    const messages = this._validationService.validate(
      { targetKind: proposal.targetKind, model: proposal.model },
      { validateSecrets: false },
    );

    const errors = messages.filter((message) => message.severity !== 'warning');
    const warnings = messages.filter((message) => message.severity === 'warning');

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Describes what would be created. Counts come from the stored proposal and
   * nothing is looked up, allocated or reserved.
   */
  private describeTarget(proposal: Record<string, unknown>): AssistedProfilePreviewTarget {
    const model = asReplicationProfileRecord(proposal.model) ?? {};
    const provision = asReplicationProfileRecord(model.provision) ?? {};
    const topology = asReplicationProfileRecord(model.topologyPreset) ?? {};
    const kind = proposal.targetKind === 'cluster' ? 'cluster' : 'firewall';
    const name = asReplicationProfileNonEmptyString(proposal.name);
    const nodes = topology.nodes;

    return {
      kind,
      ...(name ? { name } : {}),
      ...(kind === 'cluster' ? { node_count: Array.isArray(nodes) ? nodes.length : 0 } : {}),
      interface_count: Array.isArray(provision.interfaces) ? provision.interfaces.length : 0,
      rule_count: Array.isArray(provision.rules) ? provision.rules.length : 0,
    };
  }

  /**
   * The steps a successful preview went through, written by the same guarded
   * update that performs the transition so they never describe a preview that
   * lost the race.
   */
  private successStepLog(startedAt: Date): FirewallProfileDraftStepLogEntry[] {
    const timestamp = startedAt.toISOString();
    return [
      { step: 'preview_started', status: 'started', timestamp },
      { step: 'preview_validation_completed', status: 'success', timestamp },
      { step: 'preview_hash_created', status: 'success', timestamp },
    ];
  }

  private recordFailedStep(draft: FirewallProfileDraft, errorCode: string): Promise<void> {
    return this._stateService.appendStepLog(
      draft.id,
      draft.status,
      {
        step: 'preview_failed',
        status: 'failed',
        timestamp: new Date().toISOString(),
        errorCode,
        ...(draft.requestId ? { requestId: draft.requestId } : {}),
      },
      draft.fwCloudId,
    );
  }

  /**
   * Rejected attempts are audited, never as a successful preview: no hash, no
   * new status and an explicit failure reason.
   */
  private async auditFailure(
    draft: FirewallProfileDraft,
    actor: FirewallProfileDraftActor,
    failureReason: string,
    status: number,
  ): Promise<void> {
    await this._auditLogService.logMutation({
      ...actor,
      call: FIREWALL_PROFILE_DRAFT_PREVIEW_AUDIT_CALL,
      description: `Assisted Profile draft preview rejected: ${failureReason}.`,
      status,
      fwCloudId: draft.fwCloudId,
      data: {
        draftId: draft.id,
        fwCloudId: draft.fwCloudId,
        creatorUserId: draft.createdBy,
        actorUserId: actor.userId,
        currentStatus: draft.status,
        attemptedStatus: 'preview_ok',
        contractVersion: draft.contractVersion,
        requestId: draft.requestId,
        result: 'preview_rejected',
        failureReason,
      },
    });
  }
}
