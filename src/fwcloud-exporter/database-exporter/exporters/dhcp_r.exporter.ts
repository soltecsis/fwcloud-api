/*!
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { SelectQueryBuilder } from "typeorm";
import Model from "../../../models/Model";
import { DHCPRule } from "../../../models/system/dhcp/dhcp_r/dhcp_r.model";
import { TableExporter } from "./table-exporter";
import { DHCPGroup } from "../../../models/system/dhcp/dhcp_g/dhcp_g.model";
import { Firewall } from "../../../models/firewall/Firewall";
import { FirewallExporter } from "./firewall.exporter";
import { DHCPGroupExporter } from "./dhcp_g.exporter";

export class DHCPRUleExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return DHCPRule;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
            .where((qb) => {
                const query = qb.subQuery().from(DHCPGroup, 'dhcp_g').select('dhcp_g.id');

                return `${alias}.dhcpGroupId IN ` + new DHCPGroupExporter()
                    .getFilterBuilder(query, 'dhcp_g', fwCloudId).getQuery()
            })
            .where((qb) => {
                const query = qb.subQuery().from(Firewall, 'firewall').select('firewall.id');
                return `${alias}.firewallId IN ` + new FirewallExporter()
                    .getFilterBuilder(query, 'firewall', fwCloudId).getQuery()
            })
    }
}
