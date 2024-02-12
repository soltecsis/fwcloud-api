import { getRepository } from "typeorm";
import { Authorization, Policy } from "../fonaments/authorization/policy";
import { Firewall } from "../models/firewall/Firewall";
import { User } from "../models/user/User";
import { KeepalivedGroup } from "../models/system/keepalived/keepalived_g/keepalived_g.model";

export class KeepalivedGroupPolicy extends Policy {
    static async index(firewall: Firewall, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        firewall = await getRepository(Firewall).findOne(firewall.id, { relations: ['fwCloud'] });
        return this.checkAuthorization(user, firewall);
    }

    static async show(group: KeepalivedGroup, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        const firewall = await getRepository(Firewall).findOne(group.firewallId, { relations: ['fwCloud'] });
        return this.checkAuthorization(user, firewall);
    }

    static async create(firewall: Firewall, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        firewall = await getRepository(Firewall).findOne(firewall.id, { relations: ['fwCloud'] });
        return this.checkAuthorization(user, firewall);
    }

    static async update(group: KeepalivedGroup, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        const firewall = await getRepository(Firewall).findOne(group.firewallId, { relations: ['fwCloud'] });
        return this.checkAuthorization(user, firewall);
    }

    static async remove(group: KeepalivedGroup, user: User): Promise<Authorization> {
        user = await this.getUser(user.id);
        const firewall = await getRepository(Firewall).findOne(group.firewallId, { relations: ['fwCloud'] });
        return this.checkAuthorization(user, firewall);
    }

    protected static async checkAuthorization(user: User, firewall: Firewall): Promise<Authorization> {
        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === firewall.fwCloud.id });

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    protected static async getUser(id: number): Promise<User> {
        return getRepository(User).findOneOrFail(id, { relations: ['fwClouds'] });
    }
}
