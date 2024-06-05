/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { EntityRepository, SelectQueryBuilder } from 'typeorm';
import { Repository } from '../../../database/repository';
import { ValidEntities } from '../../ipobj/IPObj.repository';
import { OpenVPNPrefix } from './OpenVPNPrefix';

@EntityRepository(OpenVPNPrefix)
export class OpenVPNPrefixRepository extends Repository<OpenVPNPrefix> {
  getOpenVPNPrefixInRouting_ForGrid(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable?: number,
  ): SelectQueryBuilder<OpenVPNPrefix> {
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
        .innerJoin('vpnPrefix.routeToOpenVPNPrefixes', 'routeToOpenVPNPrefixes')
        .addSelect('routeToOpenVPNPrefixes.order', '_order')
        .innerJoin('routeToOpenVPNPrefixes.route', entity);
    }

    if (entity === 'rule') {
      query
        .innerJoin(
          'vpnPrefix.routingRuleToOpenVPNPrefixes',
          'routingRuleToOpenVPNPrefixes',
        )
        .addSelect('routingRuleToOpenVPNPrefixes.order', '_order')
        .innerJoin('routingRuleToOpenVPNPrefixes.routingRule', entity);
    }

    query
      .innerJoin(`${entity}.routingTable`, 'table')
      .innerJoin('table.firewall', 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .innerJoin('vpnPrefix.openVPN', 'vpnServer')
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
