import { TableExporter } from "./table-exporter";
import Model from "../../models/Model";
import { SelectQueryBuilder } from "typeorm";
import { PolicyRule } from "../../models/policy/PolicyRule";
import { PolicyRuleExporter } from "./policy-rule.exporter";
import { PolicyRuleToOpenVPN } from "../../models/policy/PolicyRuleToOpenVPN";
import { OpenVPN } from "../../models/vpn/openvpn/OpenVPN";
import { OpenVPNExporter } from "./openvpn.exporter";

export class PolicyRuleToOpenVPNExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return PolicyRuleToOpenVPN;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where((qb) => {
            const subquery = qb.subQuery().from(PolicyRule, 'policy_r').select('policy_r.id');

            return `${alias}.policyRuleId IN` + new PolicyRuleExporter()
                .getFilterBuilder(subquery, 'policy_r', fwCloudId).getQuery()
        })
        .orWhere((qb) => {
            const subquery = qb.subQuery().from(OpenVPN, 'openvpn').select('openvpn.id');

            return `${alias}.openVPNId IN` + new OpenVPNExporter()
                .getFilterBuilder(subquery, 'openvpn', fwCloudId).getQuery()
        });
    }
}