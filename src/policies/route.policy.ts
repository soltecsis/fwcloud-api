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
import { getRepository } from 'typeorm';
import { RoutingTable } from '../models/routing/routing-table/routing-table.model';
import { Route } from '../models/routing/route/route.model';

export class RoutePolicy extends Policy {
  static async create(table: RoutingTable, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    table = await this.getRoutingTable(table.id);

    const match = user.fwClouds.filter((fwcloud) => {
      return fwcloud.id === table.firewall.fwCloud.id;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  static async index(table: RoutingTable, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    table = await this.getRoutingTable(table.id);

    const match = user.fwClouds.filter((fwcloud) => {
      return fwcloud.id === table.firewall.fwCloud.id;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  static async show(route: Route, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    route = await this.getRoute(route.id);

    const match = user.fwClouds.filter((fwcloud) => {
      return fwcloud.id === route.routingTable.firewall.fwCloud.id;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  static async update(route: Route, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    route = await this.getRoute(route.id);

    const match = user.fwClouds.filter((fwcloud) => {
      return fwcloud.id === route.routingTable.firewall.fwCloud.id;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  static async delete(route: Route, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    route = await this.getRoute(route.id);

    const match = user.fwClouds.filter((fwcloud) => {
      return fwcloud.id === route.routingTable.firewall.fwCloud.id;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  protected static getUser(userId: number): Promise<User> {
    return getRepository(User).findOneOrFail(userId, {
      relations: ['fwClouds'],
    });
  }

  protected static getRoutingTable(
    routingTableId: number,
  ): Promise<RoutingTable> {
    return getRepository(RoutingTable).findOne(routingTableId, {
      relations: ['firewall', 'firewall.fwCloud'],
    });
  }

  protected static getRoute(routeId: number): Promise<Route> {
    return getRepository(Route).findOne(routeId, {
      relations: [
        'routingTable',
        'routingTable.firewall',
        'routingTable.firewall.fwCloud',
      ],
    });
  }
}
