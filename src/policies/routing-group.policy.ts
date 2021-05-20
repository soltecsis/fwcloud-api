import { Policy, Authorization } from "../fonaments/authorization/policy";
import { User } from "../models/user/User";
import { getRepository } from "typeorm";
import { RoutingTable } from "../models/routing/routing-table/routing-table.model";
import { Route } from "../models/routing/route/route.model";
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