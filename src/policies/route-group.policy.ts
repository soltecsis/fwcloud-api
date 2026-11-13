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

import { Policy, Authorization } from '../fonaments/authorization/policy';
import { User } from '../models/user/User';
import { Firewall } from '../models/firewall/Firewall';
import { RouteGroup } from '../models/routing/route-group/route-group.model';
import db from '../database/database-manager';
import { authorizeCloudMembership, loadPolicyUser } from './policy-authorization';

export class RouteGroupPolicy extends Policy {
  static async create(firewall: Firewall, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOne({
        where: { id: firewall.id },
        relations: { fwCloud: true },
      });
    if (user.role === 1) {
      return Authorization.grant();
    }

    return authorizeCloudMembership(user, firewall.fwCloud.id);
  }

  static async index(firewall: Firewall, user: User): Promise<Authorization> {
    return this.create(firewall, user);
  }

  static async show(group: RouteGroup, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    group = await this.getGroup(group.id);

    return authorizeCloudMembership(user, group.firewall.fwCloud.id);
  }

  static async update(group: RouteGroup, user: User): Promise<Authorization> {
    return this.show(group, user);
  }

  static async remove(group: RouteGroup, user: User): Promise<Authorization> {
    return this.show(group, user);
  }

  protected static getGroup(groupId: number): Promise<RouteGroup> {
    return db
      .getSource()
      .manager.getRepository(RouteGroup)
      .findOne({
        where: { id: groupId },
        relations: { firewall: { fwCloud: true } },
      });
  }

  protected static getUser(userId: number): Promise<User> {
    return loadPolicyUser(userId);
  }
}
