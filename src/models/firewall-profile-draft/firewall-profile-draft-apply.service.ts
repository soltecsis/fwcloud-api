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

import { DataSource } from 'typeorm';
import { Service } from '../../fonaments/services/service';
import { DatabaseService } from '../../database/database.service';
import { User } from '../user/User';
import type { ReplicationProfileTargetKind } from '../replication-profile/replication-profile.constants';
import { ReplicationProfileService } from '../replication-profile/replication-profile.service';
import { ProfileApplicationService } from '../replication-profile/profile-application.service';
import {
  describeApplyError,
  materializeCustomProfileFromDraftProposal,
} from './firewall-profile-draft-profile-materialization';
import type { FirewallProfileDraft } from './firewall-profile-draft.model';
import { FirewallProfileDraftStateService } from './firewall-profile-draft-state.service';
import type { FirewallProfileDraftActor } from './firewall-profile-draft.service';
import {
  FirewallProfileDraftApplyPreviewHashMismatchError,
  FirewallProfileDraftApplyTargetKindMismatchError,
} from './firewall-profile-draft-apply.errors';
import { FirewallProfileDraftTransitionConflictError } from './firewall-profile-draft.errors';
import { TargetOrchestrationService } from './target-orchestration.service';

export const FIREWALL_PROFILE_DRAFT_APPLY_ERROR_CODE = 'APPLY_FAILED';

export interface FirewallProfileDraftApplyTarget {
  readonly kind: ReplicationProfileTargetKind;
  readonly id: number;
}

export interface FirewallProfileDraftApplyRequest {
  readonly previewHash: string;
  readonly target: FirewallProfileDraftApplyTarget;
}

/**
 * The new-target counterpart: there is no id yet, because the confirmed apply
 * is what creates the firewall/cluster. `kind` is the caller's statement of
 * what it expects to be created, checked against the proposal; `name` is an
 * optional override for the created infrastructure's name.
 */
export interface FirewallProfileDraftApplyNewTargetRequest {
  readonly previewHash: string;
  readonly target: {
    readonly kind: ReplicationProfileTargetKind;
    readonly name?: string;
  };
}

/**
 * Confirmed apply of a `preview_ok` draft, in its two destinations:
 * `apply()` applies onto an EXISTING firewall/cluster chosen by the user
 * (API-14 / F2a), and `applyToNewTarget()` creates the infrastructure the
 * proposal describes (API-15 / F2b). Neither creates infrastructure here:
 * the second one delegates every real mutation to
 * `TargetOrchestrationService`, which owns its own step log and terminal
 * transitions.
 *
 * Both share exactly one thing, `loadConfirmedForApply()`: a confirmed apply
 * is only legal from `preview_ok` and only for the precise content the user
 * reviewed. What follows the guard is deliberately not shared -- the two
 * destinations differ in what they know up front (an existing target id vs.
 * nothing yet) and in who owns the terminal transition.
 *
 * Confirm-token and `Idempotency-Key` handling live outside this service (the
 * former is a global request middleware that already guards every mutating
 * route; the latter wraps this service's `apply()` call from the controller,
 * see `DraftController#apply`) -- this service owns only the parts that are
 * genuinely specific to applying a draft: the `preview_ok -> apply_pending`
 * guard, binding the confirmation to the exact previewed content, delegating
 * the real mutation to `ProfileApplicationService`, and the terminal
 * `applied` / `apply_failed` transition.
 */
export class FirewallProfileDraftApplyService extends Service {
  private dataSource: DataSource;
  private stateService: FirewallProfileDraftStateService;
  private replicationProfileService: ReplicationProfileService;
  private profileApplicationService: ProfileApplicationService;
  private targetOrchestrationService: TargetOrchestrationService;

  public async build(): Promise<FirewallProfileDraftApplyService> {
    const database = await this._app.getService<DatabaseService>(DatabaseService.name);
    this.dataSource = database.dataSource;
    this.stateService = await this._app.getService<FirewallProfileDraftStateService>(
      FirewallProfileDraftStateService.name,
    );
    this.replicationProfileService = await this._app.getService<ReplicationProfileService>(
      ReplicationProfileService.name,
    );
    this.profileApplicationService = await this._app.getService<ProfileApplicationService>(
      ProfileApplicationService.name,
    );
    this.targetOrchestrationService = await this._app.getService<TargetOrchestrationService>(
      TargetOrchestrationService.name,
    );
    return this;
  }

  /**
   * The half of a confirmed apply both destinations share: the draft must
   * still be `preview_ok`, and the confirmation must name the exact content
   * the user reviewed. Runs before any state mutation, so a stale or tampered
   * confirmation never reaches the atomic `preview_ok -> apply_pending` guard.
   */
  private async loadConfirmedForApply(
    draftId: number,
    fwCloudId: number,
    previewHash: string,
  ): Promise<FirewallProfileDraft> {
    const draft = await this.stateService.loadForProcessing(draftId, fwCloudId);

    // Reports the illegal-state case as a plain conflict (matching every
    // other draft action) rather than a spurious "wrong preview_hash": a
    // draft that never reached preview_ok has no meaningful hash to compare
    // against yet.
    if (draft.status !== 'preview_ok') {
      throw new FirewallProfileDraftTransitionConflictError(
        draft.id,
        draft.status,
        'apply_pending',
      );
    }

    if (!draft.previewHash || draft.previewHash !== previewHash) {
      throw new FirewallProfileDraftApplyPreviewHashMismatchError(draftId);
    }

    return draft;
  }

  /**
   * Confirmed apply that CREATES the firewall/cluster the proposal describes
   * (API-15 / F2b), for a draft whose proposal has no existing target to
   * apply onto.
   *
   * This method owns only the confirmed-apply guard chain and the
   * `preview_ok -> apply_pending` transition; everything after it belongs to
   * `TargetOrchestrationService.execute()`, which records its own per-step
   * log and performs the terminal `applied` / `apply_failed` transition. That
   * is why there is no try/catch here: a failed step is already a durable
   * terminal state, not an exception to translate, and wrapping it would
   * either duplicate or contradict the orchestrator's own accounting.
   */
  public async applyToNewTarget(
    draftId: number,
    fwCloudId: number,
    request: FirewallProfileDraftApplyNewTargetRequest,
    actor: FirewallProfileDraftActor,
  ): Promise<FirewallProfileDraft> {
    const draft = await this.loadConfirmedForApply(draftId, fwCloudId, request.previewHash);

    // Both checks deliberately precede the transition. `execute()` would
    // reject an unorchestratable proposal with the same error, but only after
    // the draft has left `preview_ok`, and `apply_pending` is excluded from
    // TTL expiration on purpose -- the draft would be stuck with no
    // transition able to move it and nothing created to reconcile.
    const proposalKind = this.targetOrchestrationService.orchestrationTargetKind(draft);
    if (proposalKind !== request.target.kind) {
      throw new FirewallProfileDraftApplyTargetKindMismatchError(
        draftId,
        request.target.kind,
        proposalKind,
      );
    }

    // No `targetIds` delta: unlike an apply onto an existing target, the ids
    // do not exist yet -- the orchestrator records each one as it creates it.
    const pending = await this.stateService.transition(draftId, 'preview_ok', 'apply_pending', {
      fwCloudId,
      userId: actor.userId,
      requestId: draft.requestId,
      step: 'apply_pending',
      applyHash: draft.previewHash,
    });

    const result = await this.targetOrchestrationService.execute(pending, {
      fwCloudId,
      userId: actor.userId,
      requestId: draft.requestId,
      targetName: request.target.name,
    });

    return result.draft;
  }

  public async apply(
    draftId: number,
    fwCloudId: number,
    request: FirewallProfileDraftApplyRequest,
    actor: FirewallProfileDraftActor,
  ): Promise<FirewallProfileDraft> {
    const draft = await this.loadConfirmedForApply(draftId, fwCloudId, request.previewHash);

    const targetIdsDelta =
      request.target.kind === 'cluster'
        ? { clusterId: request.target.id }
        : { firewallId: request.target.id };

    // The atomic, solely-from-preview_ok guard: `transition()` throws
    // `FirewallProfileDraftTransitionConflictError` (409) for any other
    // current status, and only one of any concurrent callers can win the
    // underlying compare-and-set update.
    const pending = await this.stateService.transition(draftId, 'preview_ok', 'apply_pending', {
      fwCloudId,
      userId: actor.userId,
      requestId: draft.requestId,
      step: 'apply_pending',
      applyHash: draft.previewHash,
      targetIds: { ...(draft.targetIds ?? {}), ...targetIdsDelta },
    });

    try {
      const [profile, user] = await Promise.all([
        materializeCustomProfileFromDraftProposal(
          this.replicationProfileService,
          pending.proposal,
          {
            fwCloudId,
            userId: actor.userId,
          },
        ),
        this.dataSource.getRepository(User).findOneByOrFail({ id: actor.userId! }),
      ]);

      await this.profileApplicationService.apply(
        { user, sessionId: actor.sessionId ?? null, sourceIp: actor.sourceIp ?? null },
        {
          fwCloudId,
          profileCode: profile.code,
          profileVersion: profile.version,
          replication: { target: request.target, mode: 'replace_defaults' },
        },
      );

      return await this.stateService.transition(draftId, 'apply_pending', 'applied', {
        fwCloudId,
        userId: actor.userId,
        requestId: draft.requestId,
        step: 'applied',
        targetIds: {
          ...pending.targetIds,
          profileId: profile.id,
          profileVersion: profile.version,
        },
      });
    } catch (error) {
      // A failed apply is a legitimate, durable terminal state -- not
      // rethrown, so the controller's Idempotency-Key wrapper caches this
      // exact outcome instead of leaving the key "in progress" forever.
      return this.stateService.transition(draftId, 'apply_pending', 'apply_failed', {
        fwCloudId,
        userId: actor.userId,
        requestId: draft.requestId,
        step: 'apply_failed',
        errorCode: FIREWALL_PROFILE_DRAFT_APPLY_ERROR_CODE,
        message: describeApplyError(error),
        targetIds: pending.targetIds,
      });
    }
  }
}
