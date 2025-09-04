/*!
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { IPSec } from './IPSec';
import { EntityManager, SelectQueryBuilder } from 'typeorm';
import { ValidEntities } from '../../ipobj/IPObj.repository';
import { Repository } from '../../../database/repository';

//@EntityRepository(IPSec)
export class IPSecRepository extends Repository<IPSec> {
  constructor(manager?: EntityManager) {
    super(IPSec, manager);
  }

  public async markAllAsUninstalled(): Promise<void> {
    await this.createQueryBuilder()
      .update(IPSec)
      .set({
        status: 1,
        installed_at: null,
      })
      .execute();
  }

  getIPSecInRouting_ForGrid(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable?: number,
  ): SelectQueryBuilder<IPSec> {
    let query = this.createQueryBuilder('ips')
      .select('ips.id', 'id')
      .addSelect('crt.cn', 'name')
      .addSelect('(select id from ipobj_type where id=331)', 'type')
      .addSelect('ipsFirewall.id', 'firewall_id')
      .addSelect('ipsFirewall.name', 'firewall_name')
      .addSelect('ipsCluster.id', 'cluster_id')
      .addSelect('ipsCluster.name', 'cluster_name')
      .addSelect(`${entity}.id`, 'entityId');

    if (entity === 'rule') {
      query
        .innerJoin('ips.routingRuleToIPSecs', 'routingRuleToIPSecs')
        .addSelect('routingRuleToIPSecs.order', '_order')
        .innerJoin('routingRuleToIPSecs.routingRule', entity);
    }

    if (entity === 'route') {
      query
        .innerJoin('ips.routeToIPSecs', 'routeToIPSecs')
        .addSelect('routeToIPSecs.order', '_order')
        .innerJoin('routeToIPSecs.route', entity);
    }

    query
      .innerJoin(`${entity}.routingTable`, 'table')
      .innerJoin('table.firewall', 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .innerJoin('ips.firewall', 'ipsFirewall')
      .leftJoin('ipsFirewall.cluster', 'ipsCluster')
      .innerJoin('ips.crt', 'crt')
      .where('fwcloud.id = :fwcloud', { fwcloud: fwcloud })
      .andWhere('firewall.id = :firewall', { firewall: firewall });

    if (routingTable) query = query.andWhere('table.id = :routingTable', { routingTable });

    return query;
  }
}
