import { TableExporter } from "./table-exporter";
import Model from "../../models/Model";
import { SelectQueryBuilder } from "typeorm";
import { PolicyRule } from "../../models/policy/PolicyRule";
import { PolicyGroup } from "../../models/policy/PolicyGroup";
import { PolicyGroupExporter } from "./policy-group.exporter";
import { Firewall } from "../../models/firewall/Firewall";
import { FirewallExporter } from "./firewall.exporter";
import { Mark } from "../../models/ipobj/Mark";
import { MarkExporter } from "./mark.exporter";

export class PolicyRuleExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return PolicyRule;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where((qb) => {
            const subquery = qb.subQuery().from(PolicyGroup, 'policy_g').select('policy_g.id');

            return `${alias}.policyGroupId IN ` + new PolicyGroupExporter()
                .getFilterBuilder(subquery, 'policy_g', fwCloudId).getQuery()
        })
        .where((qb) => {
            const subquery = qb.subQuery().from(Firewall, 'firewall').select('firewall.id');

            return `${alias}.firewallId IN ` + new FirewallExporter()
                .getFilterBuilder(subquery, 'firewall', fwCloudId).getQuery()
        })
        .where((qb) => {
            const subquery = qb.subQuery().from(Mark, 'mark').select('mark.id');

            return `${alias}.markId IN ` + new MarkExporter()
                .getFilterBuilder(subquery, 'mark', fwCloudId).getQuery()
        });
    }
}