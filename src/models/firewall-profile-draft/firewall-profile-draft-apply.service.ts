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
import { FirewallProfileDraftApplyPreviewHashMismatchError } from './firewall-profile-draft-apply.errors';
import { FirewallProfileDraftTransitionConflictError } from './firewall-profile-draft.errors';

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
 * Confirmed apply of a `preview_ok` draft onto an EXISTING firewall/cluster
 * chosen by the user (API-14 / F2a). Never creates infrastructure -- that is
 * `TargetOrchestrationService`'s job for a different scenario (API-15).
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
    return this;
  }

  public async apply(
    draftId: number,
    fwCloudId: number,
    request: FirewallProfileDraftApplyRequest,
    actor: FirewallProfileDraftActor,
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

    // Checked before any state mutation: a stale or tampered confirmation
    // must never even reach the atomic preview_ok -> apply_pending guard.
    if (!draft.previewHash || draft.previewHash !== request.previewHash) {
      throw new FirewallProfileDraftApplyPreviewHashMismatchError(draftId);
    }

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
