import { Repository, In, EntityRepository } from "typeorm";
import { PolicyRule } from "./PolicyRule";
import { PolicyGroup } from "./PolicyGroup";
import Model from "../Model";

@EntityRepository(PolicyRule)
export class PolicyRuleRepository extends Repository<PolicyRule> {

    public async updateStyle(policyRules: Array<PolicyRule>, style: string): Promise<Array<PolicyRule>> {
        const ids = policyRules.map((policyRule: PolicyRule) => {
            return policyRule.id;
        });

        await this.createQueryBuilder().update(PolicyRule)
        .set({style: style})
        .whereInIds(ids).execute();

        return await this.find({ where: {
            id: In(ids)
        }});
    }

    public async assignToGroup(policyRules: Array<PolicyRule>, newPolicyGroup: PolicyGroup = null): Promise<Array<PolicyRule>> {
        const criterias: any = {};

        criterias.id = In(this.getIdsFromEntityCollection(policyRules));

        if (newPolicyGroup && newPolicyGroup.firewall) {
            criterias.firewall = newPolicyGroup.firewall;
        }
        
        await this.createQueryBuilder().update(PolicyRule)
        .set({policyGroup: newPolicyGroup})
        .where(criterias)
        .execute();

        return await this.find({where: In(this.getIdsFromEntityCollection(policyRules))});
    }

    public async updateActive(policyRules: Array<PolicyRule>, active: 0 | 1): Promise<Array<PolicyRule>> {
        await this.createQueryBuilder().update(PolicyRule)
        .set({active: active})
        .where({
            id: In(this.getIdsFromEntityCollection(policyRules)),
            special: 0
        }).execute();

        return await this.find({where: In(this.getIdsFromEntityCollection(policyRules))})
    }

    protected getIdsFromEntityCollection(policyRules: Array<Model>): Array<any> {
        return policyRules.map((policyRule: PolicyRule) => {
            return policyRule.id;
        });
    }
}