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
import { Authorization, Policy } from '../fonaments/authorization/policy';
import { Firewall } from '../models/firewall/Firewall';
import { User } from '../models/user/User';
import { DHCPGroup } from '../models/system/dhcp/dhcp_g/dhcp_g.model';
import db from '../database/database-manager';
import { authorizeCloudMembership, loadPolicyUser } from './policy-authorization';

export class DHCPGroupPolicy extends Policy {
  static async index(firewall: Firewall, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOne({
        where: { id: firewall.id },
        relations: { fwCloud: true },
      });
    return this.checkAuthorization(user, firewall);
  }

  static async show(group: DHCPGroup, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    const firewall: Firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOne({
        where: { id: group.firewallId },
        relations: { fwCloud: true },
      });
    return this.checkAuthorization(user, firewall);
  }

  static async create(firewall: Firewall, user: User): Promise<Authorization> {
    return this.index(firewall, user);
  }

  static async update(group: DHCPGroup, user: User): Promise<Authorization> {
    return this.show(group, user);
  }

  static async remove(group: DHCPGroup, user: User): Promise<Authorization> {
    return this.show(group, user);
  }

  protected static async checkAuthorization(
    user: User,
    firewall: Firewall,
  ): Promise<Authorization> {
    if (user.role === 1) {
      return Authorization.grant();
    }

    return authorizeCloudMembership(user, firewall.fwCloud.id);
  }

  protected static async getUser(id: number): Promise<User> {
    return loadPolicyUser(id);
  }
}
