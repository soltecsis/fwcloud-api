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

import { Request } from 'express';
import { AgentCommunication } from '../../../communications/agent.communication';
import { Validate } from '../../../decorators/validate.decorator';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';
import { Controller } from '../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { Firewall, FirewallInstallCommunication } from '../../../models/firewall/Firewall';
import { CrowdSecPolicy } from '../../../policies/crowdsec.policy';
import db from '../../../database/database-manager';
import { CrowdSecUninstallDto } from './dto/uninstall.dto';

export class CrowdSecController extends Controller {
  protected _firewall: Firewall;

  public async make(request: Request): Promise<void> {
    const firewallId = Number(request.params.firewall);
    const fwcloudId = Number(request.params.fwcloud);

    if (
      !Number.isInteger(firewallId) ||
      firewallId < 1 ||
      !Number.isInteger(fwcloudId) ||
      fwcloudId < 1
    ) {
      throw new HttpException('Invalid firewall context', 400);
    }

    this._firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({ where: { id: firewallId, fwCloudId: fwcloudId } });
  }

  @Validate()
  public async status(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();

    if (this._firewall.install_communication !== FirewallInstallCommunication.Agent) {
      throw new HttpException('CrowdSec requires FWCloud Agent communication', 409);
    }

    const communication = await this._firewall.getCommunication();
    if (!(communication instanceof AgentCommunication)) {
      throw new HttpException('CrowdSec requires FWCloud Agent communication', 409);
    }

    const status = await communication.getCrowdSecStatus();
    return ResponseBuilder.buildResponse().status(200).body(status);
  }

  @Validate()
  public async install(): Promise<ResponseBuilder> {
    return this.notImplemented();
  }

  @Validate(CrowdSecUninstallDto)
  public async uninstall(): Promise<ResponseBuilder> {
    return this.notImplemented();
  }

  private notImplemented(): ResponseBuilder {
    return ResponseBuilder.buildResponse().status(501).body({
      message: 'CrowdSec API operation is not implemented yet',
    });
  }
}
