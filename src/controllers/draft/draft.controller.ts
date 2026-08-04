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
import { DraftPolicy } from '../../policies/draft.policy';
import { Channel } from '../../sockets/channels/channel';
import { AssistedProfileGenerationService } from '../../communications/assistant-agent/assisted-profile-generation.service';
import { AssistedProfileInstructionTooLargeException } from '../../communications/assistant-agent/assisted-profile-generation.errors';
import { isAssistedProfileDeploymentEnabled } from '../../communications/assistant-agent/assisted-profile-deployment.config';
import type {
  FirewallProfileDraftDetailDto,
  FirewallProfileDraftSummaryDto,
} from './dtos/draft-response.dto';
import { GenerateFirewallProfileDraftDto } from './dtos/generate-draft.dto';

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
