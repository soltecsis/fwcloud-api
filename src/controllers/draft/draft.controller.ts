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
import { DraftPolicy } from '../../policies/draft.policy';
import type {
  FirewallProfileDraftDetailDto,
  FirewallProfileDraftSummaryDto,
} from './dtos/draft-response.dto';

const toIsoString = (value: Date | null): string | null => value?.toISOString() ?? null;

const toSummary = (draft: FirewallProfileDraftSummary): FirewallProfileDraftSummaryDto => ({
  id: draft.id,
  fwcloud_id: draft.fwCloudId,
  user_id: draft.createdBy,
  status: draft.status,
  contract_version: draft.contractVersion,
  request_id: draft.requestId,
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
