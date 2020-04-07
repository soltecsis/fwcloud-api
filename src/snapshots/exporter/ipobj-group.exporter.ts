import { TableExporter } from "./table-exporter";
import { IPObjGroup } from "../../models/ipobj/IPObjGroup";
import Model from "../../models/Model";
import { SelectQueryBuilder } from "typeorm";
import { IPObjToIPObjGroup } from "../../models/ipobj/IPObjToIPObjGroup";
import { IPObjToIPObjGroupExporter } from "./ipobj-to-ipobj-group.exporter";
import { OpenVPN } from "../../models/vpn/openvpn/OpenVPN";
import { OpenVPNExporter } from "./openvpn.exporter";
import { OpenVPNPrefix } from "../../models/vpn/openvpn/OpenVPNPrefix";
import { OpenVPNPrefixExporter } from "./openvpn-prefix.exporter";

export class IPObjGroupExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return IPObjGroup;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where((qb) => {
            /**
             * Get the IPObjGroups which are related with IPObj which are exported
             */
            const subquery = qb.subQuery().from(IPObjToIPObjGroup, 'ipobj__ipobjg').select('ipobj__ipobjg.ipObjGroupId');

            return `${alias}.id IN` + new IPObjToIPObjGroupExporter()
                .getFilterBuilder(subquery, 'ipobj__ipobjg', fwCloudId).getQuery()
        })
        .orWhere((qb) => {
            /**
             * Get the IPObjGroups which are related with OpenVPN. As openvpn__ipobj_g is not modelized, 
             * we can not use queryBuilder
             */
            const subquery = qb.subQuery().select('openvpn__ipobj_g.ipobj_g').from(OpenVPN, 'openvpn');
            new OpenVPNExporter().getFilterBuilder(subquery, 'openvpn', fwCloudId)
            .innerJoin('openvpn__ipobj_g', 'openvpn__ipobj_g', 'openvpn__ipobj_g.openvpn = openvpn.id');

            return `${alias}.id IN ` + subquery.getQuery()
        })
        .orWhere((qb) => {
            /**
             * Get the IPObjGroups which are related with OpenVPNPrefix. As openvpn_prefix__ipobj_g is not modelized, 
             * we can not use queryBuilder
             */
            const subquery = qb.subQuery().select('openvpn_prefix__ipobj_g.ipobj_g').from(OpenVPNPrefix, 'openvpn_prefix');
            new OpenVPNPrefixExporter().getFilterBuilder(subquery, 'openvpn_prefix', fwCloudId)
            .innerJoin('openvpn_prefix__ipobj_g', 'openvpn_prefix__ipobj_g', 'openvpn_prefix__ipobj_g.prefix = openvpn_prefix.id');

            return `${alias}.id IN ` + subquery.getQuery()
        });
    }
}