import { In, EntityRepository } from "typeorm";
import { PolicyRule } from "./PolicyRule";
import { PolicyGroup } from "./PolicyGroup";
import Model from "../Model";
import { isArray } from "util";
import { Repository } from "../../database/repository";

@EntityRepository(PolicyRule)
export class PolicyRuleRepository extends Repository<PolicyRule> {

    /**
     * Updates one or multiple PolicyRule styles
     * 
     * @param policyRule 
     * @param style 
     */
    public async updateStyle(policyRule: PolicyRule, style: string): Promise<PolicyRule>;
    public async updateStyle(policyRules: Array<PolicyRule>, style: string): Promise<PolicyRule>;
    public async updateStyle(oneOrMany: PolicyRule | Array<PolicyRule>, style: string): Promise<PolicyRule | Array<PolicyRule>> {
        
        const entities: Array<PolicyRule> = isArray(oneOrMany) ? oneOrMany: [oneOrMany];

        await this.createQueryBuilder().update(PolicyRule)
        .set({style: style})
        .whereInIds(this.getIdsFromEntityCollection(entities)).execute();

        return await this.reloadEntities(oneOrMany);
    }

    /**
     * Assign one or multiple policyRule to a PolicyGroup. If policyGroup is null, then policyRule is unassigned.
     * 
     * @param policyRule 
     * @param newPolicyGroup 
     */
    public async assignToGroup(policyRule: PolicyRule, newPolicyGroup: PolicyGroup): Promise<PolicyRule>
    public async assignToGroup(policyRules: Array<PolicyRule>, newPolicyGroup: PolicyGroup): Promise<Array<PolicyRule>>;
    public async assignToGroup(oneOrMany: PolicyRule | Array<PolicyRule>, newPolicyGroup: PolicyGroup = null): Promise<PolicyRule | Array<PolicyRule>> {
        
        const entities: Array<PolicyRule> = isArray(oneOrMany) ? oneOrMany: [oneOrMany];
        
        const criterias: any = {
            id: In(this.getIdsFromEntityCollection(entities))
        };

        if (newPolicyGroup && newPolicyGroup.firewall) {
            criterias.firewall = newPolicyGroup.firewall;
        }
        
        await this.createQueryBuilder().update(PolicyRule)
        .set({policyGroup: newPolicyGroup})
        .where(criterias)
        .execute();

        return await this.reloadEntities(oneOrMany);
    }

    /**
     * Updates one or array of policyRule active flag
     * 
     * @param policyRule 
     * @param active 
     */
    public async updateActive(policyRule: PolicyRule, active: 0 | 1): Promise<PolicyRule>;
    public async updateActive(policyRules: Array<PolicyRule>, active: 0 | 1): Promise<Array<PolicyRule>>;
    public async updateActive(oneOrMany: PolicyRule | Array<PolicyRule>, active: 0 | 1): Promise<PolicyRule | Array<PolicyRule>> {

        const entities: Array<PolicyRule> = isArray(oneOrMany) ? oneOrMany: [oneOrMany];

        await this.createQueryBuilder().update(PolicyRule)
        .set({active: active})
        .where({
            id: In(this.getIdsFromEntityCollection(entities)),
            special: 0
        }).execute();

        return await this.reloadEntities(oneOrMany);
    }
}