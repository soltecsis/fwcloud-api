import { TableExporter } from "./table-exporter";
import { OpenVPN } from "../../models/vpn/openvpn/OpenVPN";
import Model from "../../models/Model";
import { SelectQueryBuilder } from "typeorm";
import { OpenVPNExporter } from "./openvpn.exporter";
import { OpenVPNPrefix } from "../../models/vpn/openvpn/OpenVPNPrefix";

export class OpenVPNPrefixExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return OpenVPNPrefix;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where((qb) => {
            const subquery = qb.subQuery().from(OpenVPN, 'openvpn').select('openvpn.id');

            return `${alias}.openVPNId IN ` + new OpenVPNExporter()
                .getFilterBuilder(subquery, 'openvpn', fwCloudId).getQuery()
        });
    }
}