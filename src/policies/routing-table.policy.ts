import { Policy, Authorization } from "../fonaments/authorization/policy";
import { Firewall } from "../models/firewall/Firewall";
import { User } from "../models/user/User";
import { getRepository } from "typeorm";
import { RoutingTable } from "../models/routing/routing-table/routing-table.model";

export class RoutingTablePolicy extends Policy {

    static async create(firewall: Firewall, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, {relations: ['fwClouds']});
        firewall = await getRepository(Firewall).findOneOrFail(firewall.id, {relations: ['fwCloud']});

        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === firewall.fwCloudId});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async index(firewall: Firewall, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, {relations: ['fwClouds']});
        firewall = await getRepository(Firewall).findOneOrFail(firewall.id, {relations: ['fwCloud']});

        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === firewall.fwCloudId});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async show(table: RoutingTable, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, {relations: ['fwClouds']});
        table = await getRepository(RoutingTable).findOneOrFail(table.id, {relations: ['firewall', 'firewall.fwCloud']});

        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === table.firewall.fwCloudId});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async update(table: RoutingTable, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, {relations: ['fwClouds']});
        table = await getRepository(RoutingTable).findOneOrFail(table.id, {relations: ['firewall', 'firewall.fwCloud']});

        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === table.firewall.fwCloudId});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async delete(table: RoutingTable, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, {relations: ['fwClouds']});
        table = await getRepository(RoutingTable).findOneOrFail(table.id, {relations: ['firewall', 'firewall.fwCloud']});

        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === table.firewall.fwCloudId});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }
}