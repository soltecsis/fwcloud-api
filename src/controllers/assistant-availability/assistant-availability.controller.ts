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
import { FwCloud } from '../../models/fwcloud/FwCloud';
import { AssistantAvailabilityPolicy } from '../../policies/assistant-availability.policy';
import { AssistedProfileHealthService } from '../../communications/assistant-agent/assisted-profile-health.service';
import type { AssistedProfileHealthSnapshot } from '../../communications/assistant-agent/assisted-profile-health.types';
import type { AssistantAvailabilityDto } from './dto/assistant-availability-response.dto';

const toDto = (snapshot: AssistedProfileHealthSnapshot): AssistantAvailabilityDto => ({
  available: snapshot.available,
  busy: snapshot.busy,
  alive: snapshot.alive,
  modelReady: snapshot.modelReady,
  status: snapshot.status,
  lastCheckedAt: snapshot.lastCheckedAt ?? null,
});

export class AssistantAvailabilityController extends Controller {
  protected _fwCloud: FwCloud;

  public async make(request: Request): Promise<void> {
    this._fwCloud = await FwCloud.findOneOrFail({
      where: { id: parseInt(String(request.params.fwcloud)) },
    });
  }

  @Validate()
  public async show(request: Request): Promise<ResponseBuilder> {
    (await AssistantAvailabilityPolicy.show(request.session.user, this._fwCloud)).authorize();

    const healthService = await this._app.getService<AssistedProfileHealthService>(
      AssistedProfileHealthService.name,
    );

    return ResponseBuilder.buildResponse().status(200).body(toDto(healthService.snapshot));
  }
}
