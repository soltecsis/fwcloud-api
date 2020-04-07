import { TableExporter } from "./table-exporter";
import Model from "../../models/Model";
import { SelectQueryBuilder } from "typeorm";
import { PolicyGroup } from "../../models/policy/PolicyGroup";
import { Firewall } from "../../models/firewall/Firewall";
import { FirewallExporter } from "./firewall.exporter";

export class PolicyGroupExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return PolicyGroup;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where((qb) => {
            const subquery = qb.subQuery().from(Firewall, 'firewall').select('firewall.id');

            return `${alias}.firewallId IN ` + new FirewallExporter()
                .getFilterBuilder(subquery, 'firewall', fwCloudId).getQuery()
        });
    }
}