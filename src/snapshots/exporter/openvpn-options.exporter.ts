import { TableExporter } from "./table-exporter";
import { OpenVPN } from "../../models/vpn/openvpn/OpenVPN";
import Model from "../../models/Model";
import { SelectQueryBuilder } from "typeorm";
import { OpenVPNExporter } from "./openvpn.exporter";
import { IPObj } from "../../models/ipobj/IPObj";
import { IPObjExporter } from "./ipobj.exporter";
import { OpenVPNOptions } from "../../models/vpn/openvpn/openvpn-options.model";

export class OpenVPNOptionsExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return OpenVPNOptions;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where((qb) => {
            const subquery = qb.subQuery().from(OpenVPN, 'openvpn').select('openvpn.id');

            return `${alias}.openVPNId IN ` + new OpenVPNExporter()
                .getFilterBuilder(subquery, 'openvpn', fwCloudId).getQuery()
        })
        .orWhere((qb) => {
            const subquery = qb.subQuery().from(IPObj, 'ipobj').select('ipobj.id');

            return `${alias}.ipObjId IN ` + new IPObjExporter()
                .getFilterBuilder(subquery, 'ipobj', fwCloudId).getQuery()
        });
    }
}