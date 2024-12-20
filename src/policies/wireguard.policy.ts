/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import db from '../database/database-manager';
import { Policy, Authorization } from '../fonaments/authorization/policy';
import { Firewall } from '../models/firewall/Firewall';
import { User } from '../models/user/User';
import { OpenVPN } from '../models/vpn/openvpn/OpenVPN';

export class WireGuardPolicy extends Policy {
  static async installer(openvpn: OpenVPN, user: User): Promise<Authorization> {
    user = await db
      .getSource()
      .manager.getRepository(User)
      .findOneOrFail({
        where: { id: user.id },
        relations: ['fwClouds'],
      });
    openvpn = await db
      .getSource()
      .manager.getRepository(OpenVPN)
      .findOneOrFail({
        where: { id: openvpn.id },
        relations: ['firewall'],
      });

    if (user.role === 1) {
      return Authorization.grant();
    }

    if (openvpn.firewall) {
      const firewall: Firewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOneOrFail({
          where: { id: openvpn.firewall.id },
          relations: ['fwCloud'],
        });

      const match = user.fwClouds.filter((fwcloud) => {
        return fwcloud.id === firewall.fwCloudId;
      });

      return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    return Authorization.revoke();
  }

  static async history(openvpn: OpenVPN, user: User): Promise<Authorization> {
    user = await db
      .getSource()
      .manager.getRepository(User)
      .findOneOrFail({
        where: { id: user.id },
        relations: ['fwClouds'],
      });
    openvpn = await db
      .getSource()
      .manager.getRepository(OpenVPN)
      .findOneOrFail({
        where: { id: openvpn.id },
        relations: ['firewall'],
      });

    if (user.role === 1) {
      return Authorization.grant();
    }

    if (openvpn.firewall) {
      const firewall: Firewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOneOrFail({
          where: { id: openvpn.firewall.id },
          relations: ['fwCloud'],
        });

      const match = user.fwClouds.filter((fwcloud) => {
        return fwcloud.id === firewall.fwCloudId;
      });

      return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    return Authorization.revoke();
  }
}
