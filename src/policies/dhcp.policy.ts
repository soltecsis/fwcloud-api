import { getRepository } from "typeorm";
import { Policy, Authorization } from "../fonaments/authorization/policy";
import { User } from "../models/user/User";
import { DHCPRule } from "../models/system/dhcp/dhcp_r/dhcp_r.model";
import { Firewall } from "../models/firewall/Firewall";
import {FwCloud} from "../models/fwcloud/FwCloud";

export class DhcpPolicy extends Policy {
    static async index(firewall: Firewall, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, { relations: ['fwClouds'] });
        firewall = await getRepository(Firewall).findOneOrFail(firewall.id, { relations: ['fwCloud'] });

        if (user.role === 1) {
            return Authorization.grant();
        }

        const match: FwCloud[] = user.fwClouds.filter((FwCloud: FwCloud): boolean => { return FwCloud.id === firewall.fwCloudId });

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async show(dhcp: DHCPRule, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        if (user.role === 1) {
            return Authorization.grant();
        }

        dhcp = await this.getDhcpR(dhcp.id);

        return this.checkAuthorization(user, dhcp.firewall.fwCloud.id);
    }

    static async create(firewall: Firewall, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, { relations: ['fwClouds'] });
        firewall = await getRepository(Firewall).findOneOrFail(firewall.id, { relations: ['fwCloud'] });

        if (user.role === 1) {
            return Authorization.grant();
        }

        const match: FwCloud[] = user.fwClouds.filter((fwcloud: FwCloud): boolean => { return fwcloud.id === firewall.fwCloudId });

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async copy(dhcp: DHCPRule, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        if (user.role === 1) {
            return Authorization.grant();
        }

        dhcp = await this.getDhcpR(dhcp.id);

        return this.checkAuthorization(user, dhcp.firewall.fwCloud.id);
    }

    static async move(firewall: Firewall, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, { relations: ['fwClouds'] });
        firewall = await getRepository(Firewall).findOneOrFail(firewall.id, { relations: ['fwCloud'] });

        if (user.role === 1) {
            return Authorization.grant();
        }

        const match: FwCloud[] = user.fwClouds.filter((fwcloud: FwCloud): boolean => { return fwcloud.id === firewall.fwCloudId });

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async update(dhcp: DHCPRule, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        if (user.role === 1) {
            return Authorization.grant();
        }

        dhcp = await this.getDhcpR(dhcp.id);

        return this.checkAuthorization(user, dhcp.firewall.fwCloud.id);
    }

    static async delete(dhcp: DHCPRule, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        if (user.role === 1) {
            return Authorization.grant();
        }

        dhcp = await this.getDhcpR(dhcp.id);

        return this.checkAuthorization(user, dhcp.firewall.fwCloud.id);
    }

    private static async checkAuthorization(user: User, fwCloudId: number): Promise<Authorization> {
        const match: FwCloud[] = user.fwClouds.filter((fwcloud: FwCloud): boolean => fwcloud.id === fwCloudId);

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    private static getDhcpR(dhcpId: number): Promise<DHCPRule> {
        return getRepository(DHCPRule).findOneOrFail(dhcpId, { relations: ['group', 'firewall', 'firewall.fwCloud'] });
    }

    private static getUser(userId: number): Promise<User> {
        return getRepository(User).findOneOrFail(userId, { relations: ['fwClouds'] });
    }
}
