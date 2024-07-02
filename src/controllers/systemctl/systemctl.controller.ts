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

import { Validate } from '../../decorators/validate.decorator';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import {
  Firewall,
  FirewallInstallCommunication,
} from '../../models/firewall/Firewall';
import { SystemCtlDto } from './dtos/systemctl.dto';
import { Request } from 'express';
import { SystemctlPolicy } from '../../policies/systemctl.policy';
import { SSHCommunication } from '../../communications/ssh.communication';
import { IPObj } from '../../models/ipobj/IPObj';
import { PgpHelper } from '../../utils/pgp';
import { Communication } from '../../communications/communication';
import db from '../../database/database-manager';

export class SystemCtlController extends Controller {
  @Validate(SystemCtlDto)
  async systemctlCommunication(req: Request) {
    (
      await SystemctlPolicy.communicate(
        req.session.user,
        req.body.fwCloud,
        req.body.firewall,
      )
    ).authorize();
    const firewall = await await db
      .getSource()
      .manager.getRepository(Firewall)
      .createQueryBuilder('firewall')
      .where(`firewall.id = :id`, { id: req.body.firewall })
      .andWhere('firewall.fwcloud = :fwcloud', { fwcloud: req.body.fwcloud })
      .getOne();
    let communication: Communication<unknown>;
    if (firewall.install_communication === FirewallInstallCommunication.SSH) {
      const pgp: PgpHelper = new PgpHelper(req.session.pgp);
      communication = new SSHCommunication({
        host: (
          await await db
            .getSource()
            .manager.getRepository(IPObj)
            .findOneOrFail({ where: { id: firewall.install_ipobj } })
        ).address,
        port: firewall.install_port,
        username: Object.prototype.hasOwnProperty.call(req.body, 'sshuser')
          ? await pgp.decrypt(req.body.sshuser)
          : await pgp.decrypt(firewall.install_user),
        password: Object.prototype.hasOwnProperty.call(req.body, 'sshpass')
          ? await pgp.decrypt(req.body.sshpass)
          : await pgp.decrypt(firewall.install_pass),
        options: null,
      });
    } else {
      communication = await firewall.getCommunication();
    }

    const response = await communication.systemctlManagement(
      req.body.command,
      req.body.service,
    );
    return ResponseBuilder.buildResponse().status(200).body(response);
  }
}
