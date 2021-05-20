import { Policy, Authorization } from "../fonaments/authorization/policy";
import { Firewall } from "../models/firewall/Firewall";
import { User } from "../models/user/User";
import { getRepository } from "typeorm";
import { RoutingRule } from "../models/routing/routing-rule/routing-rule.model";

export class RoutingRulePolicy extends Policy {

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

    static async show(rule: RoutingRule, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, {relations: ['fwClouds']});
        rule = await getRepository(RoutingRule).findOneOrFail(rule.id, {relations: ['routingTable', 'routingTable.firewall', 'routingTable.firewall.fwCloud']});

        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === rule.routingTable.firewall.fwCloudId});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async update(rule: RoutingRule, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, {relations: ['fwClouds']});
        rule = await getRepository(RoutingRule).findOneOrFail(rule.id, {relations: ['routingTable', 'routingTable.firewall', 'routingTable.firewall.fwCloud']});

        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === rule.routingTable.firewall.fwCloudId});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async delete(rule: RoutingRule, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, {relations: ['fwClouds']});
        rule = await getRepository(RoutingRule).findOneOrFail(rule.id, {relations: ['routingTable', 'routingTable.firewall', 'routingTable.firewall.fwCloud']});

        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === rule.routingTable.firewall.fwCloudId});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }
}