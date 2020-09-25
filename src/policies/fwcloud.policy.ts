import { Policy, Authorization } from "../fonaments/authorization/policy";
import { User } from "../models/user/User";
import { FwCloud } from "../models/fwcloud/FwCloud";

export class FwCloudPolicy extends Policy {
    static async store(user: User): Promise<Authorization> {
        return user.role === 1 ? Authorization.grant() : Authorization.revoke();
    }

    static async update(user: User): Promise<Authorization> {
        return user.role === 1 ? Authorization.grant() : Authorization.revoke();
    }

    static async colors(user: User, fwCloud: FwCloud): Promise<Authorization> {
        if (user.role === 1) {
            return Authorization.grant();
        }
        
        user = await User.findOne({where: {id: user.id}, relations: ['fwClouds']})
        return user.fwClouds.findIndex(item => item.id === fwCloud.id) >= 0 ? Authorization.grant() : Authorization.revoke();
    }
}