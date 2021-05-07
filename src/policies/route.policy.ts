import { Policy, Authorization } from "../fonaments/authorization/policy";
import { Firewall } from "../models/firewall/Firewall";
import { User } from "../models/user/User";
import { createQueryBuilder, getRepository } from "typeorm";
import { RoutingTable } from "../models/routing/routing-table/routing-table.model";
import { Route } from "../models/routing/route/route.model";

export class RoutePolicy extends Policy {

    static async create(table: RoutingTable, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        if (user.role === 1) {
            return Authorization.grant();
        }

        table = await this.getRoutingTable(table.id);

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === table.firewall.fwCloud.id});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async index(table: RoutingTable, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        if (user.role === 1) {
            return Authorization.grant();
        }

        table = await this.getRoutingTable(table.id);

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === table.firewall.fwCloud.id});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async show(route: Route, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        if (user.role === 1) {
            return Authorization.grant();
        }

        route = await this.getRoute(route.id);

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === route.routingTable.firewall.fwCloud.id});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async update(route: Route, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        if (user.role === 1) {
            return Authorization.grant();
        }

        route = await this.getRoute(route.id);

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === route.routingTable.firewall.fwCloud.id});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async delete(route: Route, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        if (user.role === 1) {
            return Authorization.grant();
        }

        route = await this.getRoute(route.id);

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === route.routingTable.firewall.fwCloud.id});

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

    protected static getRoute(routeId: number): Promise<Route> {
        return getRepository(Route).findOne(routeId, {
            relations: [
                'routingTable',
                'routingTable.firewall',
                'routingTable.firewall.fwCloud'
            ]
        });
    }
}