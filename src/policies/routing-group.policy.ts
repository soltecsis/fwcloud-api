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

import { Policy, Authorization } from "../fonaments/authorization/policy";
import { User } from "../models/user/User";
import { getRepository } from "typeorm";
import { RoutingTable } from "../models/routing/routing-table/routing-table.model";
import { Firewall } from "../models/firewall/Firewall";
import { RoutingGroup } from "../models/routing/routing-group/routing-group.model";

export class RoutingGroupPolicy extends Policy {

    static async create(firewall: Firewall, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        firewall = await getRepository(Firewall).findOne(firewall.id, {relations: ['fwCloud']});
        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === firewall.fwCloud.id});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async index(firewall: Firewall, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        firewall = await getRepository(Firewall).findOne(firewall.id, {relations: ['fwCloud']});
        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === firewall.fwCloud.id});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async show(group: RoutingGroup, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        if (user.role === 1) {
            return Authorization.grant();
        }

        group = await this.getGroup(group.id);

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === group.firewall.fwCloud.id});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async update(group: RoutingGroup, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        if (user.role === 1) {
            return Authorization.grant();
        }

        group = await this.getGroup(group.id);

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === group.firewall.fwCloud.id});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async remove(group: RoutingGroup, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        if (user.role === 1) {
            return Authorization.grant();
        }

        group = await this.getGroup(group.id);

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === group.firewall.fwCloud.id});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    protected static getUser(userId: number): Promise<User> {
        return getRepository(User).findOneOrFail(userId, {relations: ['fwClouds']});
    }

    protected static getRoutingTable(routingTableId: number): Promise<RoutingTable> {
        return getRepository(RoutingTable).findOne(routingTableId, {
            relations: [
                'firewall',
                'firewall.fwCloud'
            ]
        });
    }

    protected static getGroup(groupId: number): Promise<RoutingGroup> {
        return getRepository(RoutingGroup).findOne(groupId, {
            relations: [
                'firewall',
                'firewall.fwCloud'
            ]
        });
    }
}