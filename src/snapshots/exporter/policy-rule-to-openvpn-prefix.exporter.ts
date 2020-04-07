import { TableExporter } from "./table-exporter";
import Model from "../../models/Model";
import { SelectQueryBuilder } from "typeorm";
import { PolicyRule } from "../../models/policy/PolicyRule";
import { PolicyRuleExporter } from "./policy-rule.exporter";
import { PolicyRuleToOpenVPNPrefix } from "../../models/policy/PolicyRuleToOpenVPNPrefix";
import { OpenVPNPrefix } from "../../models/vpn/openvpn/OpenVPNPrefix";
import { OpenVPNPrefixExporter } from "./openvpn-prefix.exporter";

export class PolicyRuleToOpenVPNPrefixExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return PolicyRuleToOpenVPNPrefix;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where((qb) => {
            const subquery = qb.subQuery().from(PolicyRule, 'policy_r').select('policy_r.id');

            return `${alias}.policyRuleId IN` + new PolicyRuleExporter()
                .getFilterBuilder(subquery, 'policy_r', fwCloudId).getQuery()
        })
        .orWhere((qb) => {
            const subquery = qb.subQuery().from(OpenVPNPrefix, 'openvpn_prefix').select('openvpn_prefix.id');

            return `${alias}.openVPNPrefixId IN` + new OpenVPNPrefixExporter()
                .getFilterBuilder(subquery, 'openvpn_prefix', fwCloudId).getQuery()
        });
    }
}