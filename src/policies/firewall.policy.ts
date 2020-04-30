import { Policy, Authorization } from "../fonaments/authorization/policy";
import { Firewall } from "../models/firewall/Firewall";
import { User } from "../models/user/User";
import { RepositoryService } from "../database/repository.service";
import { app } from "../fonaments/abstract-application";
import { getRepository } from "typeorm";

export class FirewallPolicy extends Policy {

    static async compile(firewall: Firewall, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, {relations: ['fwClouds']});
        
        if (user.role === 1) {
            return Authorization.grant();
        }

        if (firewall.fwCloudId) {
            const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === firewall.fwCloudId});

            return match.length > 0 ? Authorization.grant() : Authorization.revoke();
        }
        return Authorization.revoke();
    }
}