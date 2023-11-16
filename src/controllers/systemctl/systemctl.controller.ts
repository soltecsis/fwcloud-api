/*!
    Copyright 2023 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Validate } from "../../decorators/validate.decorator";
import { getRepository } from "typeorm";
import { Controller } from "../../fonaments/http/controller";
import { ResponseBuilder } from "../../fonaments/http/response-builder";
import { Firewall } from "../../models/firewall/Firewall";
import { SystemCtlDto } from "./dtos/systemctl.dto";
import { Request } from "express";
import { SystemctlPolicy } from "../../policies/systemctl.policy";

/*export enum serviceOptions {
  openvpn = 'openvpn',
  dhcp = 'dhcp',
  keepalived = 'keepalived',
  HAProxy = 'HAProxy'
}

export enum commandOptions {
  status = 'status',
  start = 'start',
  stop = 'stop',
  restart = 'restart',
  reload = 'reload',
  enable = 'enable',
  disable = 'disable'
}*/
export class SystemCtlController extends Controller {
  public service: string
  public command: string

  @Validate(SystemCtlDto)
  async systemctlCommunication(req: Request) {
    (await SystemctlPolicy.communicate(req.session.user, req.body.fwCloud, req.body.firewall)).authorize();
    const service: string = req.body.service;
    const command: string = req.body.command;
    const firewall = await getRepository(Firewall).createQueryBuilder('firewall')
      .where(`firewall.id = :id`, { id: req.body.firewall }).andWhere('firewall.fwcloud = :fwcloud', { fwcloud: req.body.fwcloud })
      .getOne();
    let communication = await firewall.getCommunication();

    let response = await communication.systemctlManagement(command, service);
    return ResponseBuilder.buildResponse().status(200).body(response)
  }
}
