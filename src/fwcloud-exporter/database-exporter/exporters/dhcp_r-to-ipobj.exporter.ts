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

import Model from "../../../models/Model";
import { IPObj } from "../../../models/ipobj/IPObj";
import { DHCPRuleToIPObj } from "../../../models/system/dhcp/dhcp_r/dhcp_r-to-ipobj.model";
import { DHCPRule } from "../../../models/system/dhcp/dhcp_r/dhcp_r.model";
import { DHCPRuleExporter } from "./dhcp_r.exporter";
import { IPObjExporter } from "./ipobj.exporter";
import { TableExporter } from "./table-exporter";

export class DHCPRuleToIPObjExporter extends TableExporter {
  protected getEntity(): typeof Model {
    return DHCPRuleToIPObj;
  }

  public getFilterBuilder(qb: any, alias: string, fwCloudId: number): any {
    return qb
      .where((qb: any) => {
        const subquery = qb
          .subQuery()
          .from(DHCPRule, "dhcp_r")
          .select("dhcp_r.id");

        return (
          `${alias}.dhcpRuleId IN ` +
          new DHCPRuleExporter()
            .getFilterBuilder(subquery, "dhcp_r", fwCloudId)
            .getQuery()
        );
      })
      .orWhere((qb: any) => {
        const subquery = qb.subQuery().from(IPObj, "ipobj").select("ipobj.id");

        return (
          `${alias}.ipObjId IN ` +
          new IPObjExporter()
            .getFilterBuilder(subquery, "ipobj", fwCloudId)
            .getQuery()
        );
      });
  }
}
