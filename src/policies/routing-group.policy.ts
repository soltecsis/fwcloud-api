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
import { RoutingTable } from '../models/routing/routing-table/routing-table.model';
import { Firewall } from '../models/firewall/Firewall';
import { RoutingGroup } from '../models/routing/routing-group/routing-group.model';
import db from '../database/database-manager';
import { authorizeCloudMembership, loadPolicyUser } from './policy-authorization';

export class RoutingGroupPolicy extends Policy {
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

  static async show(group: RoutingGroup, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    group = await this.getGroup(group.id);

    return authorizeCloudMembership(user, group.firewall.fwCloud.id);
  }

  static async update(group: RoutingGroup, user: User): Promise<Authorization> {
    return this.show(group, user);
  }

  static async remove(group: RoutingGroup, user: User): Promise<Authorization> {
    return this.show(group, user);
  }

  protected static getUser(userId: number): Promise<User> {
    return loadPolicyUser(userId);
  }

  protected static getRoutingTable(routingTableId: number): Promise<RoutingTable> {
    return db
      .getSource()
      .manager.getRepository(RoutingTable)
      .findOne({
        where: { id: routingTableId },
        relations: { firewall: { fwCloud: true } },
      });
  }

  protected static getGroup(groupId: number): Promise<RoutingGroup> {
    return db
      .getSource()
      .manager.getRepository(RoutingGroup)
      .findOne({
        where: { id: groupId },
        relations: { firewall: { fwCloud: true } },
      });
  }
}
