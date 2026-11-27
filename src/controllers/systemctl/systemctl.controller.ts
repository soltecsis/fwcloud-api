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
import { Firewall, FirewallInstallCommunication } from '../../models/firewall/Firewall';
import { SystemCtlDto } from './dtos/systemctl.dto';
import { Request } from 'express';
import { SystemctlPolicy } from '../../policies/systemctl.policy';
import { SSHCommunication } from '../../communications/ssh.communication';
import { IPObj } from '../../models/ipobj/IPObj';
import { PgpHelper } from '../../utils/pgp';
import { Communication } from '../../communications/communication';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import { OpenVPN } from '../../models/vpn/openvpn/OpenVPN';
import db from '../../database/database-manager';

export class SystemCtlController extends Controller {
  @Validate(SystemCtlDto)
  async systemctlCommunication(req: Request) {
    (
      await SystemctlPolicy.communicate(req.session.user, req.body.fwcloud, req.body.firewall)
    ).authorize();
    const firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .createQueryBuilder('firewall')
      .where(`firewall.id = :id`, { id: req.body.firewall })
      .andWhere('firewall.fwcloud = :fwcloud', { fwcloud: req.body.fwcloud })
      .getOne();
    await this.validateOpenVPNActivation(firewall, req.body.command, req.body.service);

    let communication: Communication<unknown>;
    if (firewall.install_communication === FirewallInstallCommunication.SSH) {
      const pgp: PgpHelper = new PgpHelper(req.session.pgp);
      communication = new SSHCommunication({
        host: (
          await db
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

    const response = await communication.systemctlManagement(req.body.command, req.body.service);
    return ResponseBuilder.buildResponse().status(200).body(response);
  }

  private async validateOpenVPNActivation(
    firewall: Firewall,
    command: string,
    service: string,
  ): Promise<void> {
    if (!['start', 'restart', 'reload', 'enable'].includes(command)) return;

    const instance = /^(?:openvpn|openvpn-server)@(.+)$/.exec(service)?.[1];
    if (service !== 'openvpn' && !instance) return;

    const serversQuery = db
      .getSource()
      .manager.getRepository(OpenVPN)
      .createQueryBuilder('openvpn')
      .select(['openvpn.id', 'openvpn.install_name'])
      .innerJoin('openvpn.crt', 'crt')
      .innerJoin('openvpn.firewall', 'firewall')
      .where('firewall.fwCloudId = :fwcloud', { fwcloud: firewall.fwCloudId })
      .andWhere('crt.type = 2')
      .andWhere('openvpn.install_name != :empty', { empty: '' });

    if (firewall.clusterId) {
      serversQuery
        .andWhere('firewall.clusterId = :clusterId', { clusterId: firewall.clusterId })
        .andWhere('firewall.fwmaster = 1');
    } else {
      serversQuery.andWhere('firewall.id = :id', { id: firewall.id });
    }

    const servers = await serversQuery.getMany();
    const dbCon = db.getQuery();
    for (const server of servers) {
      if (instance && server.install_name.replace(/\.conf$/, '') !== instance) continue;

      try {
        await OpenVPN.validateSavedServerNetwork(dbCon, firewall.fwCloudId, server.id);
      } catch (error) {
        if (typeof error?.fwcErr === 'number' && typeof error.msg === 'string') {
          throw new HttpException(error.msg, 400);
        }
        throw error;
      }
    }
  }
}
