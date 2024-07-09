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
import { HAProxyRule } from '../../../models/system/haproxy/haproxy_r/haproxy_r.model';
import { HAProxyGroup } from '../../../models/system/haproxy/haproxy_g/haproxy_g.model';
import { HAProxyGroupExporter } from './haproxy_g.exporter';
import { Firewall } from '../../../models/firewall/Firewall';
import { FirewallExporter } from './firewall.exporter';
import { TableExporter } from './table-exporter';

export class HAProxyRuleExporter extends TableExporter {
  protected getEntity(): typeof Model {
    return HAProxyRule;
  }

  public getFilterBuilder(
    qb: SelectQueryBuilder<any>,
    alias: string,
    fwCloudId: number,
  ): SelectQueryBuilder<any> {
    return qb
      .where((qb) => {
        const query = qb.subQuery().from(HAProxyGroup, 'haproxy_g').select('haproxy_g.id');

        return (
          `${alias}.haproxyGroupId IN ` +
          new HAProxyGroupExporter().getFilterBuilder(query, 'dhcp_g', fwCloudId).getQuery()
        );
      })
      .where((qb) => {
        const query = qb.subQuery().from(Firewall, 'firewall').select('firewall.id');
        return (
          `${alias}.firewallId IN ` +
          new FirewallExporter().getFilterBuilder(query, 'firewall', fwCloudId).getQuery()
        );
      });
  }
}
