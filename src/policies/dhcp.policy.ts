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
import { FwCloud } from '../models/fwcloud/FwCloud';
import db from '../database/database-manager';

export class DhcpPolicy extends Policy {
  static async index(firewall: Firewall, user: User): Promise<Authorization> {
    user = await db
      .getSource()
      .manager.getRepository(User)
      .findOneOrFail({
        where: { id: user.id },
        relations: ['fwClouds'],
      });
    firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: { id: firewall.id },
        relations: ['fwCloud'],
      });

    if (user.role === 1) {
      return Authorization.grant();
    }

    const match: FwCloud[] = user.fwClouds.filter((FwCloud: FwCloud): boolean => {
      return FwCloud.id === firewall.fwCloudId;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
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
    user = await db
      .getSource()
      .manager.getRepository(User)
      .findOneOrFail({
        where: { id: user.id },
        relations: ['fwClouds'],
      });
    firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: { id: firewall.id },
        relations: ['fwCloud'],
      });

    if (user.role === 1) {
      return Authorization.grant();
    }

    const match: FwCloud[] = user.fwClouds.filter((fwcloud: FwCloud): boolean => {
      return fwcloud.id === firewall.fwCloudId;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  static async copy(dhcp: DHCPRule, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    dhcp = await this.getDhcpR(dhcp.id);

    return this.checkAuthorization(user, dhcp.firewall.fwCloud.id);
  }

  static async move(firewall: Firewall, user: User): Promise<Authorization> {
    return this.create(firewall, user);
  }

  static async update(dhcp: DHCPRule, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    dhcp = await this.getDhcpR(dhcp.id);

    return this.checkAuthorization(user, dhcp.firewall.fwCloud.id);
  }

  static async delete(dhcp: DHCPRule, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    dhcp = await this.getDhcpR(dhcp.id);

    return this.checkAuthorization(user, dhcp.firewall.fwCloud.id);
  }

  private static async checkAuthorization(user: User, fwCloudId: number): Promise<Authorization> {
    return new Promise((resolve, reject) => {
      try {
        const match: FwCloud[] = user.fwClouds.filter(
          (fwcloud: FwCloud): boolean => fwcloud.id === fwCloudId,
        );
        resolve(match.length > 0 ? Authorization.grant() : Authorization.revoke());
      } catch (e) {
        reject(e);
      }
    });
  }

  private static getDhcpR(dhcpId: number): Promise<DHCPRule> {
    return db
      .getSource()
      .manager.getRepository(DHCPRule)
      .findOneOrFail({
        where: { id: dhcpId },
        relations: ['group', 'firewall', 'firewall.fwCloud'],
      });
  }

  private static getUser(userId: number): Promise<User> {
    return db
      .getSource()
      .manager.getRepository(User)
      .findOneOrFail({
        where: { id: userId },
        relations: ['fwClouds'],
      });
  }
}
