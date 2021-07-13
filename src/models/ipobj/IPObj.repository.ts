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

import { EntityRepository, SelectQueryBuilder } from "typeorm";
import { Repository } from "../../database/repository";
import { IPObj } from "./IPObj";

export type ValidEntities = 'route' | 'rule';

@EntityRepository(IPObj)
export class IPObjRepository extends Repository<IPObj> {

  private routingSelects(entity: ValidEntities): SelectQueryBuilder<IPObj> {
    let q = this.createQueryBuilder("ipobj")
      .select("ipobj.type","type").addSelect("ipobj.address","address").addSelect("ipobj.netmask","netmask")
      .addSelect("ipobj.range_start","range_start").addSelect("ipobj.range_end","range_end")
      .addSelect(`${entity}.id`,"entityId");

      if (entity==='rule') q = q.addSelect("null as mark_code");

      return q;
  }

  private belongsToFWCloud(entity: ValidEntities, fwcloud: number, firewall: number, routingTable: number, entityId: number, query: SelectQueryBuilder<IPObj>): SelectQueryBuilder<IPObj> {
    let q = query.innerJoin(`${entity}.routingTable`, "table")
      .innerJoin("table.firewall", "firewall")
      .innerJoin("firewall.fwCloud", "fwcloud")
      .where("fwcloud.id = :fwcloud", {fwcloud: fwcloud})
      .andWhere("firewall.id = :firewall", {firewall: firewall});

      if (routingTable) q = q.andWhere("table.id = :routingTable", {routingTable});

      return entityId ? q.andWhere(`${entity}.id = :entityId`, {entityId: entityId}) : q;
  }

  // All ipobj under a position excluding hosts.
  getIpobjsInRouting_excludeHosts(entity: ValidEntities, fwcloud: number, firewall: number, routingTable: number, entityId: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, entityId, this.routingSelects(entity)
      .innerJoin(`ipobj.${entity=='route'?'routes':'routingRules'}`, `${entity}`))
      .andWhere("ipobj.type<>8");
  }    
  
  // All ipobj under host (type=8).
  getIpobjsInRouting_onlyHosts(entity: ValidEntities, fwcloud: number, firewall: number, routingTable: number, entityId: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, entityId, this.routingSelects(entity)
      .innerJoin("ipobj.interface", "interface")
      .innerJoin("interface.hosts", "interfaceHost")
      .innerJoin("interfaceHost.hostIPObj", "host")
      .innerJoin(`host.${entity=='route'?'routes':'routingRules'}`, `${entity}`));
  }
  
  // All ipobj under group excluding hosts (type=8)
  getIpobjsInGroupsInRouting_excludeHosts(entity: ValidEntities, fwcloud: number, firewall: number, routingTable: number, entityId: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, entityId, this.routingSelects(entity)
      .innerJoin("ipobj.ipObjToIPObjGroups", "ipObjToIPObjGroup")
      .innerJoin("ipObjToIPObjGroup.ipObjGroup", "ipobjGroup")
      .innerJoin(`ipobjGroup.${entity=='route'?'routes':'routingRules'}`, `${entity}`))
      .andWhere("ipobj.type<>8");
  }  

  // All ipobj under host (type=8) included in IP objects groups 
  getIpobjsInGroupsInRouting_onlyHosts(entity: ValidEntities, fwcloud: number, firewall: number, routingTable: number, entityId: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, entityId, this.routingSelects(entity)
      .innerJoin("ipobj.interface", "interface")
      .innerJoin("interface.hosts", "interfaceHost")
      .innerJoin("interfaceHost.hostIPObj", "host")
      .innerJoin("host.ipObjToIPObjGroups", "ipObjToIPObjGroup")
      .innerJoin("ipObjToIPObjGroup.ipObjGroup", "ipobjGroup")
      .innerJoin(`ipobjGroup.${entity=='route'?'routes':'routingRules'}`, `${entity}`));
    } 
    
  // All ipobj under OpenVPNs 
  getIpobjsInOpenVPNInRouting(entity: ValidEntities, fwcloud: number, firewall: number, routingTable: number, entityId: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, entityId, this.routingSelects(entity)
      .innerJoin("ipobj.optionsList", "vpnOpt")
      .innerJoin("vpnOpt.openVPN", "vpn")
      .innerJoin(`vpn.${entity=='route'?'routes':'routingRules'}`, `${entity}`))
      .andWhere("vpnOpt.name='ifconfig-push'");
  } 

  // All ipobj under OpenVPNs in groups
  getIpobjsInOpenVPNInGroupsInRouting(entity: ValidEntities, fwcloud: number, firewall: number, routingTable: number, entityId: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, entityId, this.routingSelects(entity)
      .innerJoin("ipobj.optionsList", "vpnOpt")
      .innerJoin("vpnOpt.openVPN", "vpn")
      .innerJoin("vpn.ipObjGroups", "ipobjGroup")
      .innerJoin(`ipobjGroup.${entity=='route'?'routes':'routingRules'}`, `${entity}`))
      .andWhere("vpnOpt.name='ifconfig-push'");
  } 

  // All ipobj under OpenVPN prefixes 
  getIpobjsInOpenVPNPrefixesInRouting(entity: ValidEntities, fwcloud: number, firewall: number, routingTable: number, entityId: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, entityId, this.routingSelects(entity)
      .innerJoin("ipobj.optionsList", "vpnOpt")
      .innerJoin("vpnOpt.openVPN", "vpn")
      .innerJoin("vpn.crt", "crt")
      .innerJoin("vpn.parent", "vpnServer")
      .innerJoin("vpnServer.openVPNPrefixes", "prefix")      
      .innerJoin(`prefix.${entity=='route'?'routes':'routingRules'}`, `${entity}`))
      .andWhere("crt.type=1 and crt.cn like CONCAT(prefix.name,'%') and vpnOpt.name='ifconfig-push'");
  } 

  // All ipobj under OpenVPN prefixes in groups
  getIpobjsInOpenVPNPrefixesInGroupsInRouting(entity: ValidEntities, fwcloud: number, firewall: number, routingTable: number, entityId: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, entityId, this.routingSelects(entity)
      .innerJoin("ipobj.optionsList", "vpnOpt")
      .innerJoin("vpnOpt.openVPN", "vpn")
      .innerJoin("vpn.crt", "crt")
      .innerJoin("vpn.parent", "vpnServer")
      .innerJoin("vpnServer.openVPNPrefixes", "prefix")      
      .innerJoin("prefix.ipObjGroups", "ipobjGroup")
      .innerJoin(`ipobjGroup.${entity=='route'?'routes':'routingRules'}`, `${entity}`))
      .andWhere("crt.type=1 and crt.cn like CONCAT(prefix.name,'%') and vpnOpt.name='ifconfig-push'");
  } 

  // All ipobj under a position excluding hosts.
  getIpobjsInRouting_ForGrid(entity: ValidEntities, fwcloud: number, firewall: number, routingTable?: number): SelectQueryBuilder<IPObj> {
    let q = this.createQueryBuilder("ipobj")
      .select("ipobj.id","id").addSelect("ipobj.name","name").addSelect("ipobj.type","type")
      .addSelect("firewall.id","firewall_id").addSelect("firewall.name","firewall_name")
      .addSelect("cluster.id","cluster_id").addSelect("cluster.name","cluster_name")
      .addSelect(`${entity}.id`,"entityId")
      .innerJoin(`ipobj.${entity==='route'?'routes':'routingRules'}`, `${entity}`)
      .innerJoin(`${entity}.routingTable`, "table")
      .innerJoin("table.firewall", "firewall")
      .innerJoin("firewall.fwCloud", "fwcloud")
      .leftJoin("firewall.cluster", "cluster")
      .where("fwcloud.id = :fwcloud", {fwcloud: fwcloud})
      .andWhere("firewall.id = :firewall", {firewall: firewall});

    if (routingTable) q = q.andWhere("table.id = :routingTable", {routingTable});

    return q;
  }    
}