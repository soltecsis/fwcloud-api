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

import { EntityManager, SelectQueryBuilder } from 'typeorm';
import { IPObj } from './IPObj';
import { Repository } from '../../database/repository';

export type ValidEntities = 'route' | 'rule' | 'dhcp_r' | 'keepalived_r' | 'haproxy_r';

//@EntityRepository(IPObj)
export class IPObjRepository extends Repository<IPObj> {
  constructor(manager?: EntityManager) {
    super(IPObj, manager);
  }

  private routingSelects(entity: ValidEntities): SelectQueryBuilder<IPObj> {
    let q = this.createQueryBuilder('ipobj')
      .select('ipobj.type', 'type')
      .addSelect('ipobj.address', 'address')
      .addSelect('ipobj.netmask', 'netmask')
      .addSelect('ipobj.range_start', 'range_start')
      .addSelect('ipobj.range_end', 'range_end')
      .addSelect(`${entity}.id`, 'entityId');

    if (entity === 'rule') q = q.addSelect('null as mark_code');

    return q;
  }

  private belongsToFWCloud(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    ids: number[],
    query: SelectQueryBuilder<IPObj>,
  ): SelectQueryBuilder<IPObj> {
    let q = query
      .innerJoin(`${entity}.routingTable`, 'table')
      .innerJoin('table.firewall', 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .where('fwcloud.id = :fwcloud', { fwcloud: fwcloud })
      .andWhere('firewall.id = :firewall', { firewall: firewall });

    if (routingTable) q = q.andWhere('table.id = :routingTable', { routingTable });

    return ids ? q.andWhere(`${entity}.id IN (:...ids)`, { ids: ids }) : q;
  }

  // All ipobj under a position excluding hosts.
  getIpobjsInRouting_excludeHosts(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    ids: number[],
  ): SelectQueryBuilder<IPObj> {
    const query = this.routingSelects(entity);

    if (entity === 'route') {
      query
        .innerJoin('ipobj.routeToIPObjs', 'routeToIPObjs')
        .innerJoin('routeToIPObjs.route', entity);
    } else {
      query
        .innerJoin('ipobj.routingRuleToIPObjs', 'routingRuleToIPObjs')
        .innerJoin('routingRuleToIPObjs.routingRule', entity);
    }

    query.andWhere('ipobj.type<>8');

    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, ids, query);
  }

  // All ipobj under host (type=8).
  getIpobjsInRouting_onlyHosts(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    ids: number[],
  ): SelectQueryBuilder<IPObj> {
    const query = this.routingSelects(entity)
      .innerJoin('ipobj.interface', 'interface')
      .innerJoin('interface.hosts', 'interfaceHost')
      .innerJoin('interfaceHost.hostIPObj', 'host');

    if (entity === 'route') {
      query
        .innerJoin('host.routeToIPObjs', 'routeToIPObjs')
        .innerJoin('routeToIPObjs.route', entity);
    } else {
      query
        .innerJoin('host.routingRuleToIPObjs', 'routingRuleToIPObjs')
        .innerJoin('routingRuleToIPObjs.routingRule', entity);
    }

    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, ids, query);
  }

  // All ipobj under group excluding hosts (type=8)
  getIpobjsInGroupsInRouting_excludeHosts(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    ids: number[],
  ): SelectQueryBuilder<IPObj> {
    const query = this.routingSelects(entity)
      .innerJoin('ipobj.ipObjToIPObjGroups', 'ipObjToIPObjGroup')
      .innerJoin('ipObjToIPObjGroup.ipObjGroup', 'ipobjGroup');

    if (entity === 'route') {
      query
        .innerJoin('ipobjGroup.routeToIPObjGroups', 'routeToIPObjGroups')
        .innerJoin('routeToIPObjGroups.route', entity);
    }

    if (entity === 'rule') {
      query
        .innerJoin('ipobjGroup.routingRuleToIPObjGroups', 'routingRuleToIPObjGroups')
        .innerJoin('routingRuleToIPObjGroups.routingRule', entity);
    }

    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, ids, query).andWhere(
      'ipobj.type<>8',
    );
  }

  // All ipobj under host (type=8) included in IP objects groups
  getIpobjsInGroupsInRouting_onlyHosts(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    ids: number[],
  ): SelectQueryBuilder<IPObj> {
    const query = this.routingSelects(entity)
      .innerJoin('ipobj.interface', 'interface')
      .innerJoin('interface.hosts', 'interfaceHost')
      .innerJoin('interfaceHost.hostIPObj', 'host')
      .innerJoin('host.ipObjToIPObjGroups', 'ipObjToIPObjGroup')
      .innerJoin('ipObjToIPObjGroup.ipObjGroup', 'ipobjGroup');

    if (entity === 'route') {
      query
        .innerJoin('ipobjGroup.routeToIPObjGroups', 'routeToIPObjGroups')
        .innerJoin('routeToIPObjGroups.route', entity);
    }

    if (entity === 'rule') {
      query
        .innerJoin('ipobjGroup.routingRuleToIPObjGroups', 'routingRuleToIPObjGroups')
        .innerJoin('routingRuleToIPObjGroups.routingRule', entity);
    }

    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, ids, query);
  }

  // All ipobj under OpenVPNs
  getIpobjsInOpenVPNInRouting(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    ids: number[],
  ): SelectQueryBuilder<IPObj> {
    const query = this.routingSelects(entity)
      .innerJoin('ipobj.optionsList', 'vpnOpt')
      .innerJoin('vpnOpt.openVPN', 'vpn');

    if (entity === 'route') {
      query
        .innerJoin('vpn.routeToOpenVPNs', 'routeToOpenVPNs')
        .innerJoin('routeToOpenVPNs.route', entity);
    }

    if (entity === 'rule') {
      query
        .innerJoin('vpn.routingRuleToOpenVPNs', 'routingRuleToOpenVPNs')
        .innerJoin('routingRuleToOpenVPNs.routingRule', entity);
    }

    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, ids, query).andWhere(
      "vpnOpt.name='ifconfig-push'",
    );
  }

  getIpobjsInWireGuardInRouting(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    ids: number[],
  ): SelectQueryBuilder<IPObj> {
    const query = this.routingSelects(entity)
      .innerJoin('ipobj.optionsList', 'wgOpt')
      .innerJoin('wgOpt.wireguard', 'wg');

    if (entity === 'route') {
      query
        .innerJoin('wg.routeToWireGuards', 'routeToWireGuards')
        .innerJoin('routeToWireGuards.route', entity);
    }

    if (entity === 'rule') {
      query
        .innerJoin('wg.routingRuleToWireGuards', 'routingRuleToWireGuards')
        .innerJoin('routingRuleToWireGuards.routingRule', entity);
    }

    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, ids, query).andWhere(
      "wgOpt.name='address'",
    );
  }

  // All ipobj under OpenVPNs in groups
  getIpobjsInOpenVPNInGroupsInRouting(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    ids: number[],
  ): SelectQueryBuilder<IPObj> {
    const query = this.routingSelects(entity)
      .innerJoin('ipobj.optionsList', 'vpnOpt')
      .innerJoin('vpnOpt.openVPN', 'vpn')
      .innerJoin('vpn.ipObjGroups', 'ipobjGroup');

    if (entity === 'route') {
      query
        .innerJoin('ipobjGroup.routeToIPObjGroups', 'routeToIPObjGroups')
        .innerJoin('routeToIPObjGroups.route', entity);
    }

    if (entity === 'rule') {
      query
        .innerJoin('ipobjGroup.routingRuleToIPObjGroups', 'routingRuleToIPObjGroups')
        .innerJoin('routingRuleToIPObjGroups.routingRule', entity);
    }

    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, ids, query).andWhere(
      "vpnOpt.name='ifconfig-push'",
    );
  }

  getIpobjsInWireGuardInGroupsInRouting(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    ids: number[],
  ): SelectQueryBuilder<IPObj> {
    const query = this.routingSelects(entity)
      .innerJoin('ipobj.optionsList', 'wgOpt')
      .innerJoin('wgOpt.wireguard', 'wg')
      .innerJoin('wg.ipObjGroups', 'ipobjGroup');

    if (entity === 'route') {
      query
        .innerJoin('ipobjGroup.routeToIPObjGroups', 'routeToIPObjGroups')
        .innerJoin('routeToIPObjGroups.route', entity);
    }

    if (entity === 'rule') {
      query
        .innerJoin('ipobjGroup.routingRuleToIPObjGroups', 'routingRuleToIPObjGroups')
        .innerJoin('routingRuleToIPObjGroups.routingRule', entity);
    }

    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, ids, query).andWhere(
      "wgOpt.name='address'",
    );
  }

  getIpobjsInWireGuardPrefixesInRouting(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    ids: number[],
  ): SelectQueryBuilder<IPObj> {
    const query = this.routingSelects(entity)
      .innerJoin('ipobj.optionsList', 'wgOpt')
      .innerJoin('wgOpt.wireguard', 'wg')
      .innerJoin('wg.crt', 'crt')
      .innerJoin('wg.parent', 'wgServer')
      .innerJoin('wgServer.wireGuardPrefixes', 'prefix');

    if (entity === 'route') {
      query
        .innerJoin('prefix.routeToWireGuardPrefixes', 'routeToWireGuardPrefixes')
        .innerJoin('routeToWireGuardPrefixes.route', entity);
    }

    if (entity === 'rule') {
      query
        .innerJoin('prefix.routingRuleToWireGuardPrefixes', 'routingRuleToWireGuardPrefixes')
        .innerJoin('routingRuleToWireGuardPrefixes.routingRule', entity);
    }

    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, ids, query).andWhere(
      "crt.type=1 and crt.cn like CONCAT(prefix.name,'%') and wgOpt.name='address'",
    );
  }

  // All ipobj under OpenVPN prefixes
  getIpobjsInOpenVPNPrefixesInRouting(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    ids: number[],
  ): SelectQueryBuilder<IPObj> {
    const query = this.routingSelects(entity)
      .innerJoin('ipobj.optionsList', 'vpnOpt')
      .innerJoin('vpnOpt.openVPN', 'vpn')
      .innerJoin('vpn.crt', 'crt')
      .innerJoin('vpn.parent', 'vpnServer')
      .innerJoin('vpnServer.openVPNPrefixes', 'prefix');

    if (entity === 'route') {
      query
        .innerJoin('prefix.routeToOpenVPNPrefixes', 'routeToOpenVPNPrefixes')
        .innerJoin('routeToOpenVPNPrefixes.route', entity);
    }

    if (entity === 'rule') {
      query
        .innerJoin('prefix.routingRuleToOpenVPNPrefixes', 'routingRuleToOpenVPNPrefixes')
        .innerJoin('routingRuleToOpenVPNPrefixes.routingRule', entity);
    }

    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, ids, query).andWhere(
      "crt.type=1 and crt.cn like CONCAT(prefix.name,'%') and vpnOpt.name='ifconfig-push'",
    );
  }

  getIpobjGroupsInWireGuardInRouting(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    ids: number[],
  ): SelectQueryBuilder<IPObj> {
    const query = this.routingSelects(entity)
      .innerJoin('ipobj.optionsList', 'wgOpt')
      .innerJoin('wgOpt.wireguard', 'wg')
      .innerJoin('wg.crt', 'crt')
      .innerJoin('wg.parent', 'wgServer')
      .innerJoin('wgServer.wireGuardPrefixes', 'prefix')
      .innerJoin('prefix.ipObjGroups', 'ipobjGroup');

    if (entity === 'route') {
      query
        .innerJoin('ipobjGroup.routeToIPObjGroups', 'routeToIPObjGroups')
        .innerJoin('routeToIPObjGroups.route', entity);
    }

    if (entity === 'rule') {
      query
        .innerJoin('ipobjGroup.routingRuleToIPObjGroups', 'routingRuleToIPObjGroups')
        .innerJoin('routingRuleToIPObjGroups.routingRule', entity);
    }

    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, ids, query).andWhere(
      "crt.type=1 and crt.cn like CONCAT(prefix.name,'%') and wgOpt.name='address'",
    );
  }

  // All ipobj under OpenVPN prefixes in groups
  getIpobjsInOpenVPNPrefixesInGroupsInRouting(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    ids: number[],
  ): SelectQueryBuilder<IPObj> {
    const query = this.routingSelects(entity)
      .innerJoin('ipobj.optionsList', 'vpnOpt')
      .innerJoin('vpnOpt.openVPN', 'vpn')
      .innerJoin('vpn.crt', 'crt')
      .innerJoin('vpn.parent', 'vpnServer')
      .innerJoin('vpnServer.openVPNPrefixes', 'prefix')
      .innerJoin('prefix.ipObjGroups', 'ipobjGroup');

    if (entity === 'route') {
      query
        .innerJoin('ipobjGroup.routeToIPObjGroups', 'routeToIPObjGroups')
        .innerJoin('routeToIPObjGroups.route', entity);
    }

    if (entity === 'rule') {
      query
        .innerJoin('ipobjGroup.routingRuleToIPObjGroups', 'routingRuleToIPObjGroups')
        .innerJoin('routingRuleToIPObjGroups.routingRule', entity);
    }

    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, ids, query).andWhere(
      "crt.type=1 and crt.cn like CONCAT(prefix.name,'%') and vpnOpt.name='ifconfig-push'",
    );
  }

  getIpobjInWireGuardPrefixesInGroupsInRouting(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    ids: number[],
  ): SelectQueryBuilder<IPObj> {
    const query = this.routingSelects(entity)
      .innerJoin('ipobj.optionsList', 'wgOpt')
      .innerJoin('wgOpt.wireguard', 'wg')
      .innerJoin('wg.crt', 'crt')
      .innerJoin('wg.parent', 'wgServer')
      .innerJoin('wgServer.wireGuardPrefixes', 'prefix')
      .innerJoin('prefix.ipObjGroups', 'ipobjGroup');

    if (entity === 'route') {
      query
        .innerJoin('ipobjGroup.routeToIPObjGroups', 'routeToIPObjGroups')
        .innerJoin('routeToIPObjGroups.route', entity);
    }

    if (entity === 'rule') {
      query
        .innerJoin('ipobjGroup.routingRuleToIPObjGroups', 'routingRuleToIPObjGroups')
        .innerJoin('routingRuleToIPObjGroups.routingRule', entity);
    }

    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, ids, query).andWhere(
      "crt.type=1 and crt.cn like CONCAT(prefix.name,'%') and wgOpt.name='address'",
    );
  }

  getIpobjGroupsInWireGuardPrefixesInRouting(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    ids: number[],
  ): SelectQueryBuilder<IPObj> {
    const query = this.routingSelects(entity)
      .innerJoin('ipobj.optionsList', 'wgOpt')
      .innerJoin('wgOpt.wireguard', 'wg')
      .innerJoin('wg.crt', 'crt')
      .innerJoin('wg.parent', 'wgServer')
      .innerJoin('wgServer.wireGuardPrefixes', 'prefix')
      .innerJoin('prefix.ipObjGroups', 'ipobjGroup');

    if (entity === 'route') {
      query
        .innerJoin('ipobjGroup.routeToIPObjGroups', 'routeToIPObjGroups')
        .innerJoin('routeToIPObjGroups.route', entity);
    }

    if (entity === 'rule') {
      query
        .innerJoin('ipobjGroup.routingRuleToIPObjGroups', 'routingRuleToIPObjGroups')
        .innerJoin('routingRuleToIPObjGroups.routingRule', entity);
    }

    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, ids, query).andWhere(
      "crt.type=1 and crt.cn like CONCAT(prefix.name,'%') and wgOpt.name='address'",
    );
  }

  // All ipobj under a position excluding hosts.
  getIpobjsInRouting_ForGrid(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    routingTable?: number,
  ): SelectQueryBuilder<IPObj> {
    const query = this.createQueryBuilder('ipobj')
      .select('ipobj.id', 'id')
      .addSelect('ipobj.name', 'name')
      .addSelect('ipobj.type', 'type')
      .addSelect('host.id', 'host_id')
      .addSelect('host.name', 'host_name')
      .addSelect('int_firewall.id', 'firewall_id')
      .addSelect('int_firewall.name', 'firewall_name')
      .addSelect('int_cluster.id', 'cluster_id')
      .addSelect('int_cluster.name', 'cluster_name')
      .addSelect(`${entity}.id`, 'entityId');

    if (entity === 'route') {
      query
        .innerJoin('ipobj.routeToIPObjs', 'routeToIPObjs')
        .addSelect('routeToIPObjs.order', '_order')
        .innerJoin('routeToIPObjs.route', entity);
    } else {
      query
        .innerJoin('ipobj.routingRuleToIPObjs', 'routingRuleToIPObjs')
        .addSelect('routingRuleToIPObjs.order', '_order')
        .innerJoin('routingRuleToIPObjs.routingRule', entity);
    }

    query
      .innerJoin(`${entity}.routingTable`, 'table')
      .innerJoin('table.firewall', 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .leftJoin('ipobj.interface', 'int')
      .leftJoin('int.hosts', 'InterfaceIPObj')
      .leftJoin('InterfaceIPObj.hostIPObj', 'host')
      .leftJoin('int.firewall', 'int_firewall')
      .leftJoin('int_firewall.cluster', 'int_cluster')
      .where('fwcloud.id = :fwcloud', { fwcloud: fwcloud })
      .andWhere('firewall.id = :firewall', { firewall: firewall });

    if (routingTable) {
      query.andWhere('table.id = :routingTable', { routingTable });
    }

    return query;
  }

  getIPObjsInDhcp_ForGrid(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
  ): SelectQueryBuilder<IPObj> {
    const query: SelectQueryBuilder<IPObj> = this.createQueryBuilder('ipobj')
      .select('ipobj.id', 'id')
      .addSelect('ipobj.address', 'address')
      .addSelect('ipobj.name', 'name')
      .addSelect('ipobj.type', 'type')
      .addSelect('host.id', 'host_id')
      .addSelect('host.name', 'host_name')
      .addSelect('int_firewall.id', 'firewall_id')
      .addSelect('int_firewall.name', 'firewall_name')
      .addSelect('int_cluster.id', 'cluster_id')
      .addSelect('int_cluster.name', 'cluster_name')
      .addSelect(`${entity}.id`, 'entityId');

    if (entity === 'rule') {
      query
        .innerJoin('ipobj.dhcpRuleToIPObjs', 'dhcpRuleToIPObjs')
        .addSelect('dhcpRuleToIPObjs.order', '_order')
        .innerJoin('dhcpRuleToIPObjs.dhcpRule', entity);
    }

    query
      .innerJoin(`${entity}.firewall`, 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .leftJoin('ipobj.interface', 'int')
      .leftJoin('int.hosts', 'InterfaceIPObj')
      .leftJoin('InterfaceIPObj.hostIPObj', 'host')
      .leftJoin('int.firewall', 'int_firewall')
      .leftJoin('int_firewall.cluster', 'int_cluster')
      .where('fwcloud.id = :fwcloud', { fwcloud: fwcloud })
      .andWhere('firewall.id = :firewall', { firewall: firewall });

    return query;
  }

  getIpobjsInKeepalived_ForGrid(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
    dhcpRule?: number,
  ): SelectQueryBuilder<IPObj> {
    const query = this.createQueryBuilder('ipobj')
      .select('ipobj.id', 'id')
      .addSelect('ipobj.address', 'address')
      .addSelect('ipobj.name', 'name')
      .addSelect('ipobj.type', 'type')
      .addSelect('host.id', 'host_id')
      .addSelect('host.name', 'host_name')
      .addSelect('int_firewall.id', 'firewall_id')
      .addSelect('int_firewall.name', 'firewall_name')
      .addSelect('int_cluster.id', 'cluster_id')
      .addSelect('int_cluster.name', 'cluster_name')
      .addSelect(`${entity}.id`, 'entityId');

    if (entity === 'rule') {
      query
        .innerJoin('ipobj.keepalivedRuleToIPObjs', 'keepalivedToIPObjs')
        .addSelect('keepalivedToIPObjs.order', '_order')
        .innerJoin('keepalivedToIPObjs.keepalivedRule', entity);
    }

    query
      .innerJoin(`${entity}.firewall`, 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .leftJoin('ipobj.interface', 'int')
      .leftJoin('int.hosts', 'InterfaceIPObj')
      .leftJoin('InterfaceIPObj.hostIPObj', 'host')
      .leftJoin('int.firewall', 'int_firewall')
      .leftJoin('int_firewall.cluster', 'int_cluster')
      .where('fwcloud.id = :fwcloud', { fwcloud: fwcloud })
      .andWhere('firewall.id = :firewall', { firewall: firewall });

    return query;
  }

  getIPObjsInHAProxy_ForGrid(
    entity: ValidEntities,
    fwcloud: number,
    firewall: number,
  ): SelectQueryBuilder<IPObj> {
    const query: SelectQueryBuilder<IPObj> = this.createQueryBuilder('ipobj')
      .select('ipobj.id', 'id')
      .addSelect('ipobj.address', 'address')
      .addSelect('ipobj.name', 'name')
      .addSelect('ipobj.type', 'type')
      .addSelect('host.id', 'host_id')
      .addSelect('host.name', 'host_name')
      .addSelect('int_firewall.id', 'firewall_id')
      .addSelect('int_firewall.name', 'firewall_name')
      .addSelect('int_cluster.id', 'cluster_id')
      .addSelect('int_cluster.name', 'cluster_name')
      .addSelect(`${entity}.id`, 'entityId');

    if (entity === 'rule') {
      query
        .innerJoin('ipobj.haproxyRuleToIPObjs', 'haproxyRuleToIPObjs')
        .addSelect('haproxyRuleToIPObjs.order', '_order')
        .innerJoin('haproxyRuleToIPObjs.haproxyRule', entity);
    }

    query
      .innerJoin(`${entity}.firewall`, 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .leftJoin('ipobj.interface', 'int')
      .leftJoin('int.hosts', 'InterfaceIPObj')
      .leftJoin('InterfaceIPObj.hostIPObj', 'host')
      .leftJoin('int.firewall', 'int_firewall')
      .leftJoin('int_firewall.cluster', 'int_cluster')
      .where('fwcloud.id = :fwcloud', { fwcloud: fwcloud })
      .andWhere('firewall.id = :firewall', { firewall: firewall });

    return query;
  }
}
