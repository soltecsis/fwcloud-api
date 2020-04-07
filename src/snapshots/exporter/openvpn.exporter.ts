import { TableExporter } from "./table-exporter";
import { OpenVPN } from "../../models/vpn/openvpn/OpenVPN";
import Model from "../../models/Model";
import { SelectQueryBuilder } from "typeorm";
import { Firewall } from "../../models/firewall/Firewall";
import { FirewallExporter } from "./firewall.exporter";
import { Crt } from "../../models/vpn/pki/Crt";
import { CrtExporter } from "./crt.exporter";

export class OpenVPNExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return OpenVPN;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where((qb) => {
            const subquery = qb.subQuery().from(Firewall, 'firewall').select('firewall.id');

            return `${alias}.firewallId IN ` + new FirewallExporter()
                .getFilterBuilder(subquery, 'firewall', fwCloudId).getQuery()
        })
        .orWhere((qb) => {
            const subquery = qb.subQuery().from(Crt, 'crt').select('crt.id');

            return `${alias}.crtId IN ` + new CrtExporter()
                .getFilterBuilder(subquery, 'crt', fwCloudId).getQuery()
        });
    }
}