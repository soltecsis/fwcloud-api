import { Connection, FindManyOptions, getConnection, getCustomRepository, getRepository, Repository, SelectQueryBuilder } from "typeorm";
import { Application } from "../../../Application";
import db from "../../../database/database-manager";
import Query from "../../../database/Query";
import { Service } from "../../../fonaments/services/service";
import { IPObjExporter } from "../../../fwcloud-exporter/database-exporter/exporters/ipobj.exporter";
import { Firewall } from "../../firewall/Firewall";
import { IPObj } from "../../ipobj/IPObj";
import { IPObjRepository } from "../../ipobj/IPObj.repository";
import { IPObjGroup } from "../../ipobj/IPObjGroup";
import { IPObjGroupRepository } from "../../ipobj/IPObjGroup.repository";
import { Tree } from "../../tree/Tree";
import { OpenVPN } from "../../vpn/openvpn/OpenVPN";
import { OpenVPNRepository } from "../../vpn/openvpn/openvpn-repository";
import { OpenVPNPrefix } from "../../vpn/openvpn/OpenVPNPrefix";
import { OpenVPNPrefixRepository } from "../../vpn/openvpn/OpenVPNPrefix.repository";
import { Route } from "../route/route.model";
import { RouteRepository } from "../route/route.repository";
import { RoutingTable } from "./routing-table.model";
import { RoutingTableRepository } from "./routing-table.repository";

interface ICreateRoutingTable {
    firewallId: number;
    number: number;
    name: string;
    comment?: string;
}

interface IUpdateRoutingTable {
    name?: string;
    comment?: string;
}

export type RouteItemDataForGrid = {
    route_id: number;
    id: number; // Item id.
    name: string;
    type: number;
    //order: number;
    firewall_id: number;
    firewall_name: string;
    cluster_id: number;
    cluster_name: string;
}

export type RouteItemDataForCompiler = {
    route_id: number;
    type: number;
    address: string;
    netmask: string;
    range_start: string;
    range_end: string;
}

type ItemsDataTypes = RouteItemDataForGrid | RouteItemDataForCompiler;
type AvailableDestinations = 'grid' | 'compiler';

interface RouteData<T extends ItemsDataTypes> extends Route {
    items: T[];
}
    
export class RoutingTableService extends Service {
    protected _repository: RoutingTableRepository;
    private _routeRepository: RouteRepository;
    private _ipobjRepository: IPObjRepository;
    private _ipobjGroupRepository: IPObjGroupRepository;   
    private _openvpnRepository: OpenVPNRepository;
    private _openvpnPrefixRepository: OpenVPNPrefixRepository; 

    constructor(app: Application) {
        super(app);
        this._repository = getCustomRepository(RoutingTableRepository);
        this._routeRepository = getCustomRepository(RouteRepository);
        this._ipobjRepository = getCustomRepository(IPObjRepository);
        this._ipobjGroupRepository = getCustomRepository(IPObjGroupRepository);
        this._openvpnRepository = getCustomRepository(OpenVPNRepository);
        this._openvpnPrefixRepository = getCustomRepository(OpenVPNPrefixRepository);
    }

    findOne(id: number): Promise<RoutingTable | undefined> {
        return this._repository.findOne(id);
    }

    findOneWithinFwCloud(id: number, firewallId: number, fwCloudId: number): Promise<RoutingTable | undefined> {
        return this._repository.findOneWithinFwCloud(id, firewallId, fwCloudId);
    }

    findOneWithinFwCloudOrFail(id: number, firewallId: number, fwCloudId: number): Promise<RoutingTable> {
        return this._repository.findOneWithinFwCloudOrFail(id, firewallId, fwCloudId);
    }

    async findOneOrFail(id: number): Promise<RoutingTable> {
        return this._repository.findOneOrFail(id);
    }

    find(options: FindManyOptions<RoutingTable>): Promise<RoutingTable[]> {
        return this._repository.find(options);
    }

    async create(data: ICreateRoutingTable): Promise<RoutingTable> {
        const routingTable: RoutingTable = await this._repository.save(data);
        const firewall: Firewall = await getRepository(Firewall).findOne(routingTable.firewallId, {relations: ['fwCloud']});

        const node: {id: number} = await Tree.getNodeUnderFirewall(db.getQuery(), firewall.fwCloud.id, firewall.id, 'RTS') as {id: number};
        await Tree.newNode(db.getQuery(), firewall.fwCloud.id, routingTable.name, node.id, 'IR', routingTable.id, null);


        return routingTable;
    }

    async update(criteria: number | RoutingTable, values: IUpdateRoutingTable): Promise<RoutingTable> {
        await this._repository.update(this.getId(criteria), values);
        return this.findOne(this.getId(criteria));
    }

    async delete(criteria: number | RoutingTable): Promise<RoutingTable> {
        const table: RoutingTable =  await this.findOne(this.getId(criteria));
        await this._repository.delete(criteria);

        return table;
    }

    /**
     * Returns the id if the data is a RoutingTable instance
     * @param data 
     * @returns 
     */
    protected getId(data: number | RoutingTable): number {
        return typeof data !== 'number' ? data.id : data;
    }


    /**
     * Returns the an array of rules and in each rule an array of items containing the information
     * required for compile the routes of the indicated routing table or for show the routing table routes
     * items in the FWCloud-UI.
     * @param dst 
     * @param fwcloud 
     * @param firewall 
     * @param routingTable 
     * @param route 
     * @returns 
     */
     public async getRoutingTableData<T extends ItemsDataTypes>(dst: AvailableDestinations, fwcloud: number, firewall: number, routingTable: number, route?: number): Promise<RouteData<T>[]> {
        const rules: RouteData<T>[] = await this._routeRepository.getRoutingTableRoutes(fwcloud, firewall, routingTable, route) as RouteData<T>[];
         
        // Init the map for access the objects array for each route.
        let ItemsArrayMap = new Map<number, T[]>();
        for (let i=0; i<rules.length; i++) {
          rules[i].items = [];
    
          // Map each rule id and position with it's corresponding ipobjs array.
          // These ipobjs array will be filled with objects data in the Promise.all()
          // next to the outer for loop.
          ItemsArrayMap.set(rules[i].id, rules[i].items);
        }
    
        const sqls = (dst === 'grid') ? 
            this.buildSQLsForGrid(fwcloud, firewall, routingTable) : 
            this.buildSQLsForCompiler(fwcloud, firewall, routingTable, route);
        await Promise.all(sqls.map(sql => this.mapRoutingData<T>(sql,ItemsArrayMap)));
        
        return rules;
      }
    
    private buildSQLsForCompiler(fwcloud: number, firewall: number, routingTable: number, route?: number): SelectQueryBuilder<IPObj>[] {
        return [
            this._ipobjRepository.getIpobjsInRoutes_excludeHosts(fwcloud, firewall, routingTable, route),
            this._ipobjRepository.getIpobjsInRoutes_onlyHosts(fwcloud, firewall, routingTable, route),
            this._ipobjRepository.getIpobjsInGroupsInRoutes_excludeHosts(fwcloud, firewall, routingTable, route),
            this._ipobjRepository.getIpobjsInGroupsInRoutes_onlyHosts(fwcloud, firewall, routingTable, route),
            this._ipobjRepository.getIpobjsInOpenVPNInRoutes(fwcloud, firewall, routingTable, route),
            this._ipobjRepository.getIpobjsInOpenVPNInGroupsInRoutes(fwcloud, firewall, routingTable, route),
            this._ipobjRepository.getIpobjsInOpenVPNPrefixesInRoutes(fwcloud, firewall, routingTable, route),
            this._ipobjRepository.getIpobjsInOpenVPNPrefixesInGroupsInRoutes(fwcloud, firewall, routingTable, route),
        ];
    }

    private buildSQLsForGrid(fwcloud: number, firewall: number, routingTable: number): SelectQueryBuilder<IPObj|IPObjGroup|OpenVPN|OpenVPNPrefix>[] {
        return [
            this._ipobjRepository.getIpobjsInRoutes_ForGrid(fwcloud, firewall, routingTable),
            this._ipobjGroupRepository.getIpobjGroupsInRoutes_ForGrid(fwcloud, firewall, routingTable),
            this._openvpnRepository.getOpenVPNInRoutes_ForGrid(fwcloud, firewall, routingTable),
            this._openvpnPrefixRepository.getOpenVPNPrefixInRoutes_ForGrid(fwcloud, firewall, routingTable),
        ];
    }

    private async mapRoutingData<T extends ItemsDataTypes>(sql: SelectQueryBuilder<IPObj|IPObjGroup|OpenVPN|OpenVPNPrefix>, ItemsArrayMap: Map<number, T[]>): Promise<void> {
        //console.log(sql.getQueryAndParameters());
        const data: T[] = await sql.getRawMany() as T[];

        for (let i=0; i<data.length; i++) {
            const items: T[] = ItemsArrayMap.get(data[i].route_id);
            items?.push(data[i]);
        }

        return;
    }    
}