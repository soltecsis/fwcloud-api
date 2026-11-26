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
import { Firewall } from '../models/firewall/Firewall';
import { User } from '../models/user/User';
import { RoutingTable } from '../models/routing/routing-table/routing-table.model';
import db from '../database/database-manager';
import {
  authorizeCloudMembership,
  authorizeFirewall,
  loadPolicyUser,
} from './policy-authorization';

export class RoutingTablePolicy extends Policy {
  static async create(firewall: Firewall, user: User): Promise<Authorization> {
    return authorizeFirewall(firewall, user);
  }

  static async index(firewall: Firewall, user: User): Promise<Authorization> {
    return authorizeFirewall(firewall, user);
  }

  static async show(table: RoutingTable, user: User): Promise<Authorization> {
    return this.authorizeTable(table, user);
  }

  static async update(table: RoutingTable, user: User): Promise<Authorization> {
    return this.authorizeTable(table, user);
  }

  static async delete(table: RoutingTable, user: User): Promise<Authorization> {
    return this.authorizeTable(table, user);
  }

  private static async authorizeTable(table: RoutingTable, user: User): Promise<Authorization> {
    user = await loadPolicyUser(user.id);
    table = await db
      .getSource()
      .manager.getRepository(RoutingTable)
      .findOneOrFail({
        where: { id: table.id },
        relations: { firewall: { fwCloud: true } },
      });

    if (user.role === 1) {
      return Authorization.grant();
    }

    return authorizeCloudMembership(user, table.firewall.fwCloudId);
  }
}
