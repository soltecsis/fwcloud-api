/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { TableExporter } from "./table-exporter";
import Model from "../../../models/Model";
import { IPObjGroup } from "../../../models/ipobj/IPObjGroup";
import { SelectQueryBuilder } from "typeorm";
import { IPObjToIPObjGroup } from "../../../models/ipobj/IPObjToIPObjGroup";
import { IPObjToIPObjGroupExporter } from "./ipobj-to-ipobj-group.exporter";
import { OpenVPN } from "../../../models/vpn/openvpn/OpenVPN";
import { OpenVPNExporter } from "./openvpn.exporter";
import { OpenVPNPrefix } from "../../../models/vpn/openvpn/OpenVPNPrefix";
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