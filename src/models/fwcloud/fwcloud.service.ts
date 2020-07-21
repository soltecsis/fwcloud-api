import { Service } from "../../fonaments/services/service";
import { getRepository, DeepPartial } from "typeorm";
import { FwCloud } from "./FwCloud";
import { User } from "../user/User";
import { Tree } from "../tree/Tree";

export class FwCloudService extends Service {
    
    /**
     * Creates and store a new FwCloud
     */
    public async store(data: DeepPartial<FwCloud>): Promise<FwCloud> {
        let fwCloud: FwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create(data));

        // Data directories are created by typeorm listener
        await this.grantAdminAccess(fwCloud);
        await Tree.createAllTreeCloud(fwCloud);

        return fwCloud;
    }

    /**
     * Grant access to all admin users to the FwCloud
     * 
     * @param fwCloud FwCloud resource
     */
    protected async grantAdminAccess(fwCloud: FwCloud): Promise<FwCloud> {
        const users: Array<User> = await getRepository(User).find({where: {role: 1}});

        fwCloud.users = users;
        return await getRepository(FwCloud).save(fwCloud);
    }
}