import { SelectQueryBuilder } from "typeorm";
import Model from "../../../models/Model";
import { Firewall } from "../../../models/firewall/Firewall";
import { DHCPGroup } from "../../../models/system/dhcp/dhcp_g/dhcp_g.model";
import { FirewallExporter } from "./firewall.exporter";
import { TableExporter } from "./table-exporter";

export class DHCPGroupExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return DHCPGroup;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
            .where((qb) => {
                const subquery = qb.subQuery().from(Firewall, 'firewall').select('firewall.id');
                
                return `${alias}.firewallId IN ` + new FirewallExporter()
                    .getFilterBuilder(subquery, 'firewall', fwCloudId).getQuery()
            })
    }
}