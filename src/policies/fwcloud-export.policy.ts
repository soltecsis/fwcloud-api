import { Policy, Authorization } from "../fonaments/authorization/policy";
import { FwCloud } from "../models/fwcloud/FwCloud";
import { User } from "../models/user/User";
import { getRepository } from "typeorm";

export class FwCloudExportPolicy extends Policy {
    static async store(fwCloud: FwCloud, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, {relations: ['fwClouds']});
        
        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((f) => { return f.id === fwCloud.id});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async import(user: User): Promise<Authorization> {
        return user.role === 1 ? Authorization.grant() : Authorization.revoke();
    }
}