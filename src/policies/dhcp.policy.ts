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
import { Policy, Authorization } from '../fonaments/authorization/policy';
import { User } from '../models/user/User';
import { DHCPRule } from '../models/system/dhcp/dhcp_r/dhcp_r.model';
import { Firewall } from '../models/firewall/Firewall';
import db from '../database/database-manager';
import {
  authorizeCloudMembership,
  authorizeFirewall,
  loadPolicyUser,
} from './policy-authorization';

export class DhcpPolicy extends Policy {
  static async index(firewall: Firewall, user: User): Promise<Authorization> {
    return authorizeFirewall(firewall, user);
  }

  static async show(dhcp: DHCPRule, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    dhcp = await this.getDhcpR(dhcp.id);

    return this.checkAuthorization(user, dhcp.firewall.fwCloud.id);
  }

  static async create(firewall: Firewall, user: User): Promise<Authorization> {
    return authorizeFirewall(firewall, user);
  }

  static async copy(dhcp: DHCPRule, user: User): Promise<Authorization> {
    return this.show(dhcp, user);
  }

  static async move(firewall: Firewall, user: User): Promise<Authorization> {
    return this.create(firewall, user);
  }

  static async update(dhcp: DHCPRule, user: User): Promise<Authorization> {
    return this.show(dhcp, user);
  }

  static async delete(dhcp: DHCPRule, user: User): Promise<Authorization> {
    return this.show(dhcp, user);
  }

  private static async checkAuthorization(user: User, fwCloudId: number): Promise<Authorization> {
    return authorizeCloudMembership(user, fwCloudId);
  }

  private static getDhcpR(dhcpId: number): Promise<DHCPRule> {
    return db
      .getSource()
      .manager.getRepository(DHCPRule)
      .findOneOrFail({
        where: { id: dhcpId },
        relations: { group: true, firewall: { fwCloud: true } },
      });
  }

  private static getUser(userId: number): Promise<User> {
    return loadPolicyUser(userId);
  }
}
