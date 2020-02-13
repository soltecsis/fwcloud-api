import { Repository, UpdateResult, DeleteResult, InsertResult, EntityRepository } from "typeorm";
import { PolicyGroup } from "../models/policy/PolicyGroup";

@EntityRepository(PolicyGroup)
export default class PolicyGroupRepository extends Repository<PolicyGroup> {
    
    public async moveToFirewall(id: number, firewallId: number): Promise<UpdateResult> {
        return await this.update(id, {
            firewall: firewallId
        });
    }

    public async moveFirewallGroupsToFirewall(firewallId: number, destinationFirewallId: number): Promise<UpdateResult> {
        return await this.update({firewall: firewallId}, {firewall: destinationFirewallId});
    }

    public async deleteFirewallGroups(firewallId: number): Promise<DeleteResult> {
        return await this.delete({firewall: firewallId});
    };

    /**
     * Clone a policy group
     * 
     * @param original 
     */
    public async clone(original: PolicyGroup): Promise<PolicyGroup> {
        const cloned: PolicyGroup = this.create({
            firewall: original.firewall,
            name: original.name,
            comment: original.comment,
            groupstyle: original.groupstyle,
            idgroup: original.idgroup
        });

        return await this.save(cloned);
    }

    public async cloneFirewallPolicyGroups(firewallId: number): Promise<any> {
        const policyGroups: Array<PolicyGroup> = await this.find({firewall: firewallId});

        return await Promise.all(policyGroups.map((policyGroup: PolicyGroup) => {
            this.clone(policyGroup);
        }));
    }

    public async isEmpty(firewallId: number, groupId: number): Promise<boolean> {
        return (await this.find({firewall: firewallId, idgroup: groupId})).length > 0
    }
}