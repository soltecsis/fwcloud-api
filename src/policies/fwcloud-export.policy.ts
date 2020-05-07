import { Policy, Authorization } from "../fonaments/authorization/policy";
import { FwCloud } from "../models/fwcloud/FwCloud";
import { User } from "../models/user/User";
import { getRepository } from "typeorm";
import { FwCloudExportMetadata } from "../fwcloud-exporter/fwcloud-export";

export class FwCloudExportPolicy extends Policy {
    static async store(fwCloud: FwCloud, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, {relations: ['fwClouds']});
        
        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((f) => { return f.id === fwCloud.id});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async download(metadata: FwCloudExportMetadata, fwCloud: FwCloud, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, {relations: ['fwClouds']});
        
        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((f) => { return f.id === fwCloud.id});

        if (match.length <= 0 || metadata.user_id !== user.id) {
            return Authorization.revoke();
        }

        return Authorization.grant();
    }
}