import { Policy, Authorization } from "../fonaments/authorization/policy";
import { User } from "../models/user/User";

export class FwCloudPolicy extends Policy {
    static async store(user: User): Promise<Authorization> {
        return user.role === 1 ? Authorization.grant() : Authorization.revoke();
    }
}