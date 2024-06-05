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
import { getRepository } from "typeorm";
import { Authorization, Policy } from "../fonaments/authorization/policy";
import { Firewall } from "../models/firewall/Firewall";
import { User } from "../models/user/User";
import { DHCPGroup } from "../models/system/dhcp/dhcp_g/dhcp_g.model";
import {FwCloud} from "../models/fwcloud/FwCloud";

export class DHCPGroupPolicy extends Policy {
    static async index(firewall: Firewall, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        firewall = await getRepository(Firewall).findOne({
            where: { id: firewall.id },
            relations: ['fwCloud']
        });
        return this.checkAuthorization(user, firewall);
    }

    static async show(group: DHCPGroup, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        const firewall: Firewall = await getRepository(Firewall).findOne({
            where: { id: group.firewallId },
            relations: ['fwCloud']
        });
        return this.checkAuthorization(user, firewall);
    }

    static async create(firewall: Firewall, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        firewall = await getRepository(Firewall).findOne({
            where: { id: firewall.id },
            relations: ['fwCloud']
        });
        return this.checkAuthorization(user, firewall);
    }

    static async update(group: DHCPGroup, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        const firewall: Firewall = await getRepository(Firewall).findOne({
            where: { id: group.firewallId },
            relations: ['fwCloud']
        });
        return this.checkAuthorization(user, firewall);
    }

    static async remove(group: DHCPGroup, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        const firewall: Firewall = await getRepository(Firewall).findOne({
            where: { id: group.firewallId },
            relations: ['fwCloud']
        });
        return this.checkAuthorization(user, firewall);
    }

    protected static async checkAuthorization(user: User, firewall: Firewall): Promise<Authorization> {
        if (user.role === 1) {
            return Authorization.grant();
        }

        const match: FwCloud[] = user.fwClouds.filter((fwcloud: FwCloud): boolean => { return fwcloud.id === firewall.fwCloud.id });

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    protected static async getUser(id: number): Promise<User> {
        return getRepository(User).findOneOrFail({
            where: { id },
            relations: ['fwClouds']
        });
    }
}
