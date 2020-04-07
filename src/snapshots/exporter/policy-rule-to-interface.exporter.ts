import { TableExporter } from "./table-exporter";
import { SelectQueryBuilder } from "typeorm";
import Model from "../../models/Model";
import { Interface } from "../../models/interface/Interface";
import { InterfaceExporter } from "./interface.exporter";
import { PolicyRuleToInterface } from "../../models/policy/PolicyRuleToInterface";
import { PolicyRule } from "../../models/policy/PolicyRule";
import { PolicyRuleExporter } from "./policy-rule.exporter";

export class PolicyRuleToInterfaceExporter extends TableExporter {
    
    protected getEntity(): typeof Model {
        return PolicyRuleToInterface;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where((qb) => {
            const subquery = qb.subQuery().from(Interface, 'interface').select('interface.id');

            return `${alias}.interfaceId IN ` + new InterfaceExporter()
                .getFilterBuilder(subquery, 'interface', fwCloudId).getQuery()
        })
        .orWhere((qb) => {
            const subquery = qb.subQuery().from(PolicyRule, 'policy_r').select('policy_r.id');

            return `${alias}.policyRuleId IN ` + new PolicyRuleExporter()
                .getFilterBuilder(subquery, 'policy_r', fwCloudId).getQuery()
        });;
    }
}