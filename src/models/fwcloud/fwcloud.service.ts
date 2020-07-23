import { Service } from "../../fonaments/services/service";
import { DeepPartial } from "typeorm";
import { FwCloud } from "./FwCloud";
import { User } from "../user/User";
import { Tree } from "../tree/Tree";

export class FwCloudService extends Service {
    
    /**
     * Creates and store a new FwCloud
     */
    public async store(data: DeepPartial<FwCloud>): Promise<FwCloud> {
        let fwCloud: FwCloud = FwCloud.create(data);
        await fwCloud.save();
        
        // Data directories are created by typeorm listener
        await this.grantAdminAccess(fwCloud);
        await Tree.createAllTreeCloud(fwCloud);

        return FwCloud.findOne(fwCloud.id);
    }

    public async update(fwCloud: FwCloud, data: DeepPartial<FwCloud>): Promise<FwCloud> {
        fwCloud = Object.assign(fwCloud, data);
        await fwCloud.save();

        return fwCloud;
    }

    /**
     * Grant access to all admin users to the FwCloud
     * 
     * @param fwCloud FwCloud resource
     */
    protected async grantAdminAccess(fwCloud: FwCloud): Promise<FwCloud> {
        const users: Array<User> = await User.find({where: {role: 1}});

        fwCloud.users = users;
        return await fwCloud.save();
    }
}