/*!
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import {
  ProgressInfoPayload,
  ProgressSuccessPayload,
} from './../../../../sockets/messages/socket-message';
import { Validate } from '../../../../decorators/validate.decorator';
import { app, logger } from '../../../../fonaments/abstract-application';
import { Controller } from '../../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../../fonaments/http/response-builder';
import { OpenVPNService } from '../../../../models/vpn/openvpn/openvpn.service';
import { Request } from 'express';
import { Channel } from '../../../../sockets/channels/channel';

export class OpenVPNArchiveController extends Controller {
  protected _openvpnService: OpenVPNService;

  async make() {
    this._openvpnService = await app().getService<OpenVPNService>(OpenVPNService.name);
  }

  /**
   * Starts a history archive
   *
   * @param request
   * @param response
   */
  @Validate()
  public async store(request: Request): Promise<ResponseBuilder> {
    const channel: Channel = await Channel.fromRequest(request);

    const rowsArchived: number = await this._openvpnService.archiveHistory(channel);
    return ResponseBuilder.buildResponse().status(201).body({
      rows: rowsArchived,
    });
  }
}
