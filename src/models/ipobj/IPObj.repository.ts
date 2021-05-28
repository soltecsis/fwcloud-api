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

@EntityRepository(IPObj)
export class IPObjRepository extends Repository<IPObj> {

  private routingCompilerData(entity: string): SelectQueryBuilder<IPObj> {
    return this.createQueryBuilder("ipobj")
      .select("ipobj.type","type").addSelect("ipobj.address","address").addSelect("ipobj.netmask","netmask")
      .addSelect("ipobj.range_start","range_start").addSelect("ipobj.range_end","range_end")
      .addSelect(`${entity}.id`,"entityId");
  }

  private belongsToFWCloud(entity: string, fwcloud: number, firewall: number, routingTable: number, route: number, query: SelectQueryBuilder<IPObj>): SelectQueryBuilder<IPObj> {
    let q = query.innerJoin("route.routingTable", "table")
      .innerJoin("table.firewall", "firewall")
      .innerJoin("firewall.fwCloud", "fwcloud")
      .where("table.id = :routingTable", {routingTable})
      .andWhere("firewall.id = :firewall", {firewall: firewall}) 
      .andWhere("fwcloud.id = :fwcloud", {fwcloud: fwcloud});

      return route ? q.andWhere("route.id = :route", {route: route}) : q;
  }

  // All ipobj under a position excluding hosts.
  getIpobjsInRoutes_excludeHosts(entity: string, fwcloud: number, firewall: number, routingTable: number, route: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, route, this.routingCompilerData(entity)
      .innerJoin("ipobj.routes", "route"))
      .andWhere("ipobj.type<>8");
  }    
  
  // All ipobj under host (type=8).
  getIpobjsInRoutes_onlyHosts(entity: string, fwcloud: number, firewall: number, routingTable: number, route: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, route, this.routingCompilerData(entity)
      .innerJoin("ipobj.interface", "interface")
      .innerJoin("interface.hosts", "interfaceHost")
      .innerJoin("interfaceHost.hostIPObj", "host")
      .innerJoin("host.routes", "route"));
  }
  
  // All ipobj under group excluding hosts (type=8)
  getIpobjsInGroupsInRoutes_excludeHosts(entity: string, fwcloud: number, firewall: number, routingTable: number, route: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, route, this.routingCompilerData(entity)
      .innerJoin("ipobj.ipObjToIPObjGroups", "ipObjToIPObjGroup")
      .innerJoin("ipObjToIPObjGroup.ipObjGroup", "ipobjGroup")
      .innerJoin("ipobjGroup.routes", "route"))
      .andWhere("ipobj.type<>8");
  }  

  // All ipobj under host (type=8) included in IP objects groups 
  getIpobjsInGroupsInRoutes_onlyHosts(entity: string, fwcloud: number, firewall: number, routingTable: number, route: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, route, this.routingCompilerData(entity)
      .innerJoin("ipobj.interface", "interface")
      .innerJoin("interface.hosts", "interfaceHost")
      .innerJoin("interfaceHost.hostIPObj", "host")
      .innerJoin("host.ipObjToIPObjGroups", "ipObjToIPObjGroup")
      .innerJoin("ipObjToIPObjGroup.ipObjGroup", "ipobjGroup")
      .innerJoin("ipobjGroup.routes", "route"));
    } 
    
  // All ipobj under OpenVPNs 
  getIpobjsInOpenVPNInRoutes(entity: string, fwcloud: number, firewall: number, routingTable: number, route: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, route, this.routingCompilerData(entity)
      .innerJoin("ipobj.optionsList", "vpnOpt")
      .innerJoin("vpnOpt.openVPN", "vpn")
      .innerJoin("vpn.routes", "route"))
      .andWhere("vpnOpt.name='ifconfig-push'");
  } 

  // All ipobj under OpenVPNs in groups
  getIpobjsInOpenVPNInGroupsInRoutes(entity: string, fwcloud: number, firewall: number, routingTable: number, route: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, route, this.routingCompilerData(entity)
      .innerJoin("ipobj.optionsList", "vpnOpt")
      .innerJoin("vpnOpt.openVPN", "vpn")
      .innerJoin("vpn.ipObjGroups", "ipobjGroup")
      .innerJoin("ipobjGroup.routes", "route"))
      .andWhere("vpnOpt.name='ifconfig-push'");
  } 

  // All ipobj under OpenVPN prefixes 
  getIpobjsInOpenVPNPrefixesInRoutes(entity: string, fwcloud: number, firewall: number, routingTable: number, route: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, route, this.routingCompilerData(entity)
      .innerJoin("ipobj.optionsList", "vpnOpt")
      .innerJoin("vpnOpt.openVPN", "vpn")
      .innerJoin("vpn.crt", "crt")
      .innerJoin("vpn.parent", "vpnServer")
      .innerJoin("vpnServer.openVPNPrefixes", "prefix")      
      .innerJoin("prefix.routes", "route"))
      .andWhere("crt.type=1 and crt.cn like CONCAT(prefix.name,'%') and vpnOpt.name='ifconfig-push'");
  } 

  // All ipobj under OpenVPN prefixes in groups
  getIpobjsInOpenVPNPrefixesInGroupsInRoutes(entity: string, fwcloud: number, firewall: number, routingTable: number, route: number): SelectQueryBuilder<IPObj> {
    return this.belongsToFWCloud(entity, fwcloud, firewall, routingTable, route, this.routingCompilerData(entity)
      .innerJoin("ipobj.optionsList", "vpnOpt")
      .innerJoin("vpnOpt.openVPN", "vpn")
      .innerJoin("vpn.crt", "crt")
      .innerJoin("vpn.parent", "vpnServer")
      .innerJoin("vpnServer.openVPNPrefixes", "prefix")      
      .innerJoin("prefix.ipObjGroups", "ipobjGroup")
      .innerJoin("ipobjGroup.routes", "route"))
      .andWhere("crt.type=1 and crt.cn like CONCAT(prefix.name,'%') and vpnOpt.name='ifconfig-push'");
  } 

  // All ipobj under a position excluding hosts.
  getIpobjsInRoutes_ForGrid(fwcloud: number, firewall: number, routingTable: number): SelectQueryBuilder<IPObj> {
    return this.createQueryBuilder("ipobj")
      .select("ipobj.id","id").addSelect("ipobj.name","name").addSelect("ipobj.type","type")
      .addSelect("firewall.id","firewall_id").addSelect("firewall.name","firewall_name")
      .addSelect("cluster.id","cluster_id").addSelect("cluster.name","cluster_name")
      .addSelect("route.id","entityId")
      .innerJoin("ipobj.routes", "route")
      .innerJoin("route.routingTable", "table")
      .innerJoin("table.firewall", "firewall")
      .innerJoin("firewall.fwCloud", "fwcloud")
      .leftJoin("firewall.cluster", "cluster")
      .where("table.id = :routingTable", {routingTable})
      .andWhere("firewall.id = :firewall", {firewall: firewall}) 
      .andWhere("fwcloud.id = :fwcloud", {fwcloud: fwcloud});
  }    
}