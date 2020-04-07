import { TableExporter } from "./table-exporter";
import Model from "../../models/Model";
import { SelectQueryBuilder } from "typeorm";
import { PolicyRuleToIPObj } from "../../models/policy/PolicyRuleToIPObj";
import { PolicyRule } from "../../models/policy/PolicyRule";
import { PolicyRuleExporter } from "./policy-rule.exporter";

export class PolicyRuleToIPObjExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return PolicyRuleToIPObj;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where((qb) => {
            const subquery = qb.subQuery().from(PolicyRule, 'policy_r').select('policy_r.id');

            return `${alias}.policyRuleId IN` + new PolicyRuleExporter()
                .getFilterBuilder(subquery, 'policy_r', fwCloudId).getQuery()
        });
    }
}