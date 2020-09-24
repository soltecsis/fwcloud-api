import { Service } from "../../fonaments/services/service";
import { DeepPartial } from "typeorm";
import { FwCloud, colorUsage, fwcloudColors } from "./FwCloud";
import { User } from "../user/User";
import { Tree } from "../tree/Tree";
import { getRepository } from "typeorm";
import { PolicyRule } from '../policy/PolicyRule';
import { PolicyGroup } from '../policy/PolicyGroup';


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

    public async colors(fwCloud: FwCloud): Promise<colorUsage[]> {
        const policyRulesColors: fwcloudColors = new fwcloudColors(await getRepository(PolicyRule).createQueryBuilder("policy_r")
                .select("policy_r.style", 'color')
                .addSelect("COUNT(policy_r.style)", 'count')
                .leftJoin("policy_r.firewall", "firewall")
                .leftJoin("firewall.fwCloud", "fwcloud")
                .where("policy_r.style is not null")
                .andWhere(`policy_r.style!=121`)
                .andWhere(`fwcloud.id=${fwCloud.id}`)
                .groupBy("policy_r.style")
                .getRawMany()
            );

        const groupRulesColors: fwcloudColors = new fwcloudColors(await getRepository(PolicyGroup).createQueryBuilder("policy_g")
                .select("policy_g.groupstyle", 'color')
                .addSelect("COUNT(policy_g.groupstyle)", 'count')
                .leftJoin("policy_g.firewall", "firewall")
                .leftJoin("firewall.fwCloud", "fwcloud")
                .where("policy_g.groupstyle is not null")
                .andWhere(`policy_g.groupstyle!=121`)
                .andWhere(`fwcloud.id=${fwCloud.id}`)
                .groupBy("policy_g.groupstyle")
                .getRawMany()
            );
        
        policyRulesColors.combine(groupRulesColors);
        policyRulesColors.sort();   

        return policyRulesColors.colors;
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