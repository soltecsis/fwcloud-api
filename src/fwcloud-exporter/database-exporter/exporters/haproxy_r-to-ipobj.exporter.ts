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

import { SelectQueryBuilder } from 'typeorm';
import Model from '../../../models/Model';
import { HAProxyRuleToIPObj } from '../../../models/system/haproxy/haproxy_r/haproxy_r-to_ipobj.model';
import { HAProxyGroupExporter } from './haproxy_g.exporter';
import { HAProxyRule } from '../../../models/system/haproxy/haproxy_r/haproxy_r.model';
import { HAProxyRuleExporter } from './haproxy_r.exporter';
import { IPObj } from '../../../models/ipobj/IPObj';
import { IPObjExporter } from './ipobj.exporter';
import { TableExporter } from './table-exporter';

export class HAProxyRuleToIPObjExporter extends TableExporter {
  protected getEntity(): typeof Model {
    return HAProxyRuleToIPObj;
  }

  public getFilterBuilder(
    qb: SelectQueryBuilder<any>,
    alias: string,
    fwCloudId: number,
  ): SelectQueryBuilder<any> {
    return qb
      .where((qb) => {
        const query = qb.subQuery().from(HAProxyRule, 'haproxy_r').select('haproxy_r.id');

        return (
          `${alias}.haproxyRuleId IN ` +
          new HAProxyRuleExporter().getFilterBuilder(query, 'haproxy_r', fwCloudId).getQuery()
        );
      })
      .orWhere((qb) => {
        const subquery = qb.subQuery().from(IPObj, 'ipobj').select('ipobj.id');

        return (
          `${alias}.ipObjId IN ` +
          new IPObjExporter().getFilterBuilder(subquery, 'ipobj', fwCloudId).getQuery()
        );
      });
  }
}
