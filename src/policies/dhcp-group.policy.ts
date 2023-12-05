import { getRepository } from "typeorm";
import { Authorization, Policy } from "../fonaments/authorization/policy";
import { Firewall } from "../models/firewall/Firewall";
import { User } from "../models/user/User";
import { DHCPGroup } from "../models/system/dhcp/dhcp_g/dhcp_g.model";

export class DHCPGroupPolicy extends Policy {
    static async index(firewall: Firewall, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        firewall = await getRepository(Firewall).findOne(firewall.id, {relations: ['fwCloud']});
        return this.checkAuthorization(user, firewall);
    }

    static async show(group: DHCPGroup, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        return this.checkAuthorization(user, group.firewall);
    }

    static async create(firewall: Firewall, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        firewall = await getRepository(Firewall).findOne(firewall.id, {relations: ['fwCloud']});
        return this.checkAuthorization(user, firewall);
    }

    static async update(group: DHCPGroup, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        return this.checkAuthorization(user, group.firewall);
    }

    static async remove(group: DHCPGroup, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        return this.checkAuthorization(user, group.firewall);
    }

    protected static async checkAuthorization(user: User, firewall: Firewall): Promise<Authorization> {
        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === firewall.fwCloud.id});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    protected static async getUser(id: number): Promise<User> {
        return getRepository(User).findOneOrFail(id, {relations: ['fwClouds']});
    }
}
