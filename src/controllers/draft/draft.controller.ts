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

import type { Request } from 'express';
import { Validate } from '../../decorators/validate.decorator';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { NotFoundException } from '../../fonaments/exceptions/not-found-exception';
import { FwCloud } from '../../models/fwcloud/FwCloud';
import { AuditLogHelper } from '../../models/audit/audit-log.helper';
import type { FirewallProfileDraft } from '../../models/firewall-profile-draft/firewall-profile-draft.model';
import type { FirewallProfileDraftSummary } from '../../models/firewall-profile-draft/firewall-profile-draft-state.service';
import {
  FirewallProfileDraftService,
  type FirewallProfileDraftActor,
} from '../../models/firewall-profile-draft/firewall-profile-draft.service';
import { FirewallProfileDraftPreviewService } from '../../models/firewall-profile-draft/firewall-profile-draft-preview.service';
import { FirewallProfileDraftApplyService } from '../../models/firewall-profile-draft/firewall-profile-draft-apply.service';
import { FirewallProfileDraftApplyIdempotencyKeyMissingError } from '../../models/firewall-profile-draft/firewall-profile-draft-apply.errors';
import type { ReplicationProfileTargetKind } from '../../models/replication-profile/replication-profile.constants';
import { IdempotencyKeyStore } from '../../models/idempotency-key/idempotency-key-store.service';
import { DraftPolicy } from '../../policies/draft.policy';
import { Channel } from '../../sockets/channels/channel';
import { AssistedProfileGenerationService } from '../../communications/assistant-agent/assisted-profile-generation.service';
import { AssistedProfileInstructionTooLargeException } from '../../communications/assistant-agent/assisted-profile-generation.errors';
import { isAssistedProfileDeploymentEnabled } from '../../communications/assistant-agent/assisted-profile-deployment.config';
import type {
  FirewallProfileDraftDetailDto,
  FirewallProfileDraftSummaryDto,
} from './dtos/draft-response.dto';
import { deriveAssistedProfileReconciliationData } from '../../models/firewall-profile-draft/firewall-profile-draft-reconciliation';
import { GenerateFirewallProfileDraftDto } from './dtos/generate-draft.dto';
import { ApplyFirewallProfileDraftDto } from './dtos/apply-draft.dto';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
const DRAFT_APPLY_OPERATION = 'assistant.drafts.apply';

const MAX_INSTRUCTION_BYTES = 2048;

const toIsoString = (value: Date | null): string | null => value?.toISOString() ?? null;

const toSummary = (draft: FirewallProfileDraftSummary): FirewallProfileDraftSummaryDto => ({
  id: draft.id,
  fwcloud_id: draft.fwCloudId,
  user_id: draft.createdBy,
  status: draft.status,
  contract_version: draft.contractVersion,
  request_id: draft.requestId,
  instruction_original: draft.instructionOriginal,
  created_at: draft.createdAt.toISOString(),
  updated_at: draft.updatedAt.toISOString(),
  validated_at: toIsoString(draft.validatedAt),
  previewed_at: toIsoString(draft.previewedAt),
  apply_pending_at: toIsoString(draft.applyPendingAt),
  applied_at: toIsoString(draft.appliedAt),
  failed_at: toIsoString(draft.failedAt),
  discarded_at: toIsoString(draft.discardedAt),
  expired_at: toIsoString(draft.expiredAt),
});

const toDetail = (draft: FirewallProfileDraft): FirewallProfileDraftDetailDto => ({
  ...toSummary(draft),
  proposal: draft.proposal,
  target_ids: draft.targetIds,
  step_log: draft.stepLog,
  reconciliation: deriveAssistedProfileReconciliationData(draft),
});

export class DraftController extends Controller {
  protected _fwCloud: FwCloud;

  public async make(request: Request): Promise<void> {
    if (!isAssistedProfileDeploymentEnabled(this._app)) {
      throw new NotFoundException('Assisted Profile is not enabled');
    }

    this._fwCloud = await FwCloud.findOneOrFail({
      where: { id: parseInt(String(request.params.fwcloud)) },
    });
  }

  @Validate()
  public async index(request: Request): Promise<ResponseBuilder> {
    (await DraftPolicy.index(request.session.user, this._fwCloud)).authorize();

    const draftService = await this.draftService();
    const drafts = await draftService.listByFwCloud(this._fwCloud.id);

    return ResponseBuilder.buildResponse().status(200).body(drafts.map(toSummary));
  }

  @Validate()
  public async show(request: Request): Promise<ResponseBuilder> {
    (await DraftPolicy.show(request.session.user, this._fwCloud)).authorize();

    const draftService = await this.draftService();
    const draft = await draftService.getByIdAndFwCloud(
      this.parseDraftParam(request),
      this._fwCloud.id,
    );

    return ResponseBuilder.buildResponse().status(200).body(toDetail(draft));
  }

  @Validate()
  public async discard(request: Request): Promise<ResponseBuilder> {
    (await DraftPolicy.discard(request.session.user, this._fwCloud)).authorize();

    const draftService = await this.draftService();
    const draft = await draftService.discard(
      this.parseDraftParam(request),
      this._fwCloud.id,
      this.actor(request),
    );

    return ResponseBuilder.buildResponse().status(200).body(toDetail(draft));
  }

  /**
   * Synthetic preview: reports what the stored proposal would create, together
   * with the domain validator's verdict and the assumptions recorded when it
   * was generated, and binds all of it to a `preview_hash` the later apply flow
   * can check. Nothing outside the draft's own lifecycle is touched.
   */
  @Validate()
  public async preview(request: Request): Promise<ResponseBuilder> {
    (await DraftPolicy.preview(request.session.user, this._fwCloud)).authorize();

    const previewService = await this.previewService();
    const preview = await previewService.preview(
      this.parseDraftParam(request),
      this._fwCloud.id,
      this.actor(request),
    );

    return ResponseBuilder.buildResponse().status(200).body(preview);
  }

  /**
   * Confirmed apply onto an EXISTING firewall/cluster (API-14). Requires the
   * global confirm-token guard (`ConfirmationToken` middleware, already
   * applied to every mutating route) plus an `Idempotency-Key` header; the
   * body's `preview_hash` must match what API-12 issued, or the confirmation
   * is rejected without touching the draft's state. Never creates
   * infrastructure -- that is `TargetOrchestrationService` (API-15).
   */
  @Validate(ApplyFirewallProfileDraftDto)
  public async apply(request: Request): Promise<ResponseBuilder> {
    (await DraftPolicy.apply(request.session.user, this._fwCloud)).authorize();

    const draftId = this.parseDraftParam(request);
    const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
      throw new FirewallProfileDraftApplyIdempotencyKeyMissingError(draftId);
    }

    const body = request.body as ApplyFirewallProfileDraftDto;
    const actor = this.actor(request);
    const [applyService, idempotencyKeyStore] = await Promise.all([
      this.applyService(),
      this.idempotencyKeyStore(),
    ]);

    const snapshot = await idempotencyKeyStore.executeOnce(
      {
        operation: DRAFT_APPLY_OPERATION,
        fwCloudId: this._fwCloud.id,
        userId: actor.userId!,
        idempotencyKey,
        payload: { draftId, previewHash: body.preview_hash, target: body.target },
        requestId: actor.sessionId ? String(actor.sessionId) : null,
      },
      async () => {
        const draft = await applyService.apply(
          draftId,
          this._fwCloud.id,
          {
            previewHash: body.preview_hash,
            target: {
              kind: body.target.kind as ReplicationProfileTargetKind,
              id: body.target.id,
            },
          },
          actor,
        );
        return { statusCode: 200, body: toDetail(draft) };
      },
    );

    return ResponseBuilder.buildResponse().status(snapshot.statusCode).body(snapshot.body);
  }

  @Validate(GenerateFirewallProfileDraftDto)
  public async generate(request: Request): Promise<ResponseBuilder> {
    (await DraftPolicy.generate(request.session.user, this._fwCloud)).authorize();

    const body = request.body as GenerateFirewallProfileDraftDto;
    if (body.instruction !== undefined) {
      const instructionBytes = Buffer.byteLength(body.instruction, 'utf8');
      if (instructionBytes > MAX_INSTRUCTION_BYTES) {
        throw new AssistedProfileInstructionTooLargeException(MAX_INSTRUCTION_BYTES);
      }
    }

    const generationService = await this.generationService();
    const generationActor = { fwCloudId: this._fwCloud.id, ...this.actor(request) };

    await generationService.checkRateLimit(generationActor);

    const channel = await Channel.fromRequest(request);

    const { generationId } = await generationService.accept({
      ...generationActor,
      instruction: body.instruction,
      language: body.language,
      targetKind: body.targetKind,
      clarification: body.clarification
        ? { generationId: body.clarification.generation_id, answer: body.clarification.answer }
        : undefined,
      channel,
    });

    return ResponseBuilder.buildResponse().status(202).body({ generation_id: generationId });
  }

  private previewService(): Promise<FirewallProfileDraftPreviewService> {
    return this._app.getService<FirewallProfileDraftPreviewService>(
      FirewallProfileDraftPreviewService.name,
    );
  }

  private generationService(): Promise<AssistedProfileGenerationService> {
    return this._app.getService<AssistedProfileGenerationService>(
      AssistedProfileGenerationService.name,
    );
  }

  private applyService(): Promise<FirewallProfileDraftApplyService> {
    return this._app.getService<FirewallProfileDraftApplyService>(
      FirewallProfileDraftApplyService.name,
    );
  }

  private idempotencyKeyStore(): Promise<IdempotencyKeyStore> {
    return this._app.getService<IdempotencyKeyStore>(IdempotencyKeyStore.name);
  }

  private parseDraftParam(request: Request): number {
    const draftId = parseInt(String(request.params.draft), 10);

    if (Number.isNaN(draftId)) {
      throw new NotFoundException('Firewall Profile draft not found');
    }

    return draftId;
  }

  private actor(request: Request): FirewallProfileDraftActor {
    return {
      userId: request.session.user?.id ?? null,
      userName: request.session.user?.username ?? null,
      sessionId: AuditLogHelper.resolveSessionId(request),
      sourceIp: request.ip ?? null,
    };
  }

  private draftService(): Promise<FirewallProfileDraftService> {
    return this._app.getService<FirewallProfileDraftService>(FirewallProfileDraftService.name);
  }
}
