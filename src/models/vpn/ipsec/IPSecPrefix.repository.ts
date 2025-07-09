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

import { EntityManager, SelectQueryBuilder } from 'typeorm';
import { ValidEntities } from '../../ipobj/IPObj.repository';
import { IPSecPrefix } from './IPSecPrefix';
import { Repository } from '../../../database/repository';

//@EntityRepository(IPSecPrefix)
export class IPSecPrefixRepository extends Repository<IPSecPrefix> {
  constructor(manager?: EntityManager) {
    super(IPSecPrefix, manager);
  }

  getIPSecPrefixInRouting_ForGrid(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable?: number,
  ): SelectQueryBuilder<IPSecPrefix> {
    const query = this.createQueryBuilder('vpnPrefix')
      .select('vpnPrefix.id', 'id')
      .addSelect('vpnPrefix.name', 'name')
      .addSelect('(select id from ipobj_type where id=401)', 'type')
      .addSelect('vpnFirewall.id', 'firewall_id')
      .addSelect('vpnFirewall.name', 'firewall_name')
      .addSelect('vpnCluster.id', 'cluster_id')
      .addSelect('vpnCluster.name', 'cluster_name')
      .addSelect(`${entity}.id`, 'entityId');

    if (entity === 'route') {
      query
        .innerJoin('vpnPrefix.routeToIPSecPrefixes', 'routeToIPSecPrefixes')
        .addSelect('routeToIPSecPrefixes.order', '_order')
        .innerJoin('routeToIPSecPrefixes.route', entity);
    }

    if (entity === 'rule') {
      query
        .innerJoin('vpnPrefix.routingRuleToIPSecPrefixes', 'routingRuleToIPSecPrefixes')
        .addSelect('routingRuleToIPSecPrefixes.order', '_order')
        .innerJoin('routingRuleToIPSecPrefixes.routingRule', entity);
    }

    query
      .innerJoin(`${entity}.routingTable`, 'table')
      .innerJoin('table.firewall', 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .innerJoin('vpnPrefix.ipSec', 'vpnServer')
      .innerJoin('vpnServer.firewall', 'vpnFirewall')
      .leftJoin('vpnFirewall.cluster', 'vpnCluster')
      .where('fwcloud.id = :fwcloud', { fwcloud: fwcloud })
      .andWhere('firewall.id = :firewall', { firewall: firewall });

    if (routingTable) {
      query.andWhere('table.id = :routingTable', { routingTable });
    }

    return query;
  }
}
