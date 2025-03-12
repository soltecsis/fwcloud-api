/*!
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { FindManyOptions, FindOneOptions, Repository, SelectQueryBuilder } from 'typeorm';
import { Application } from '../../../Application';
import db, { DatabaseManager } from '../../../database/database-manager';
import { ValidationException } from '../../../fonaments/exceptions/validation-exception';
import { Service } from '../../../fonaments/services/service';
import { ErrorBag } from '../../../fonaments/validation/validator';
import { Firewall } from '../../firewall/Firewall';
import { FirewallService } from '../../firewall/firewall.service';
import { IPObj } from '../../ipobj/IPObj';
import { IPObjRepository } from '../../ipobj/IPObj.repository';
import { IPObjGroup } from '../../ipobj/IPObjGroup';
import { IPObjGroupRepository } from '../../ipobj/IPObjGroup.repository';
import { Tree } from '../../tree/Tree';
import { OpenVPN } from '../../vpn/openvpn/OpenVPN';
import { OpenVPNRepository } from '../../vpn/openvpn/openvpn-repository';
import { OpenVPNPrefix } from '../../vpn/openvpn/OpenVPNPrefix';
import { OpenVPNPrefixRepository } from '../../vpn/openvpn/OpenVPNPrefix.repository';
import { Route } from '../route/route.model';
import { RouteRepository } from '../route/route.repository';
import { RouteService } from '../route/route.service';
import { AvailableDestinations, ItemForGrid, RouteItemForCompiler, RoutingUtils } from '../shared';
import { RoutingTable } from './routing-table.model';
import { DatabaseService } from '../../../database/database.service';
import { WireGuardRepository } from '../../vpn/wireguard/wireguard-repository';
import { WireGuardPrefixRepository } from '../../vpn/wireguard/WireGuardPrefix.repository';
import { WireGuard } from '../../vpn/wireguard/WireGuard';
import { WireGuardPrefix } from '../../vpn/wireguard/WireGuardPrefix';

interface IFindManyRoutingTablePath {
  firewallId?: number;
  fwCloudId?: number;
}

interface IFindOneRoutingTablePath extends IFindManyRoutingTablePath {
  id: number;
}

interface ICreateRoutingTable {
  firewallId: number;
  number: number;
  name: string;
  comment?: string;
}

interface IUpdateRoutingTable {
  name?: string;
  comment?: string;
  number?: number;
}

export interface RouteData<T extends ItemForGrid | RouteItemForCompiler> extends Route {
  items: (T & { _order: number })[];
}

export class RoutingTableService extends Service {
  private _routeService: RouteService;
  private _routeRepository: RouteRepository;
  private _ipobjRepository: IPObjRepository;
  private _ipobjGroupRepository: IPObjGroupRepository;
  private _openvpnRepository: OpenVPNRepository;
  private _openvpnPrefixRepository: OpenVPNPrefixRepository;
  private _wireguardRepository: WireGuardRepository;
  private _wireguardPrefixRepository: WireGuardPrefixRepository;
  protected _firewallService: FirewallService;
  protected _databaseService: DatabaseService;
  constructor(app: Application) {
    super(app);
  }

  public async build(): Promise<Service> {
    this._firewallService = await this._app.getService(FirewallService.name);
    this._routeService = await this._app.getService<RouteService>(RouteService.name);
    this._databaseService = await this._app.getService(DatabaseService.name);

    this._ipobjRepository = new IPObjRepository(this._databaseService.dataSource.manager);
    this._routeRepository = new RouteRepository(this._databaseService.dataSource.manager);
    this._ipobjGroupRepository = new IPObjGroupRepository(this._databaseService.dataSource.manager);
    this._openvpnRepository = new OpenVPNRepository(this._databaseService.dataSource.manager);
    this._openvpnPrefixRepository = new OpenVPNPrefixRepository(
      this._databaseService.dataSource.manager,
    );
    this._wireguardRepository = new WireGuardRepository(this._databaseService.dataSource.manager);
    this._wireguardPrefixRepository = new WireGuardPrefixRepository(
      this._databaseService.dataSource.manager,
    );

    return this;
  }

  findManyInPath(path: IFindManyRoutingTablePath): Promise<RoutingTable[]> {
    return this.getFindInPathOptions(path).getMany();
  }

  findOneInPath(path: IFindOneRoutingTablePath): Promise<RoutingTable | undefined> {
    return this.getFindInPathOptions(path).getOne();
  }

  findOneInPathOrFail(path: IFindOneRoutingTablePath): Promise<RoutingTable> {
    return this.getFindInPathOptions(path).getOneOrFail();
  }

  async create(data: ICreateRoutingTable): Promise<RoutingTable> {
    await this.validateRoutingTableNumber(data);
    const result: { id: number } = await db
      .getSource()
      .manager.getRepository(RoutingTable)
      .save(data);
    const routingTable: RoutingTable = await db
      .getSource()
      .manager.getRepository(RoutingTable)
      .findOne({ where: { id: result.id } });
    const firewall: Firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOne({
        where: { id: routingTable.firewallId },
        relations: ['fwCloud'],
      });

    const node: { id: number } = (await Tree.getNodeUnderFirewall(
      db.getQuery(),
      firewall.fwCloud.id,
      firewall.id,
      'RTS',
    )) as { id: number };
    if (node && Object.prototype.hasOwnProperty.call(node, 'id')) {
      await Tree.newNode(
        db.getQuery(),
        firewall.fwCloud.id,
        routingTable.name,
        node.id,
        'RT',
        routingTable.id,
        null,
      );
    }

    await this._firewallService.markAsUncompiled(routingTable.firewallId);

    return routingTable;
  }

  async update(id: number, data: IUpdateRoutingTable): Promise<RoutingTable> {
    const table: RoutingTable = await db
      .getSource()
      .manager.getRepository(RoutingTable)
      .preload(Object.assign(data, { id }));
    await this.validateRoutingTableNumber(table);
    await db.getSource().manager.getRepository(RoutingTable).save(table);

    await this._firewallService.markAsUncompiled(table.firewallId);

    return table;
  }

  async remove(path: IFindOneRoutingTablePath): Promise<RoutingTable> {
    const table: RoutingTable = await this.findOneInPath(path);
    const tableWithRules: RoutingTable = await db
      .getSource()
      .manager.getRepository(RoutingTable)
      .findOne({
        where: { id: table.id },
        relations: ['routingRules', 'routes', 'firewall'],
      });

    if (tableWithRules.routingRules.length > 0) {
      throw new ValidationException('Routing table cannot be removed', {
        id: ['Cannot remove a routing table used in a routing rule'],
      });
    }

    if (tableWithRules.routes.length > 0) {
      await this._routeService.bulkRemove(tableWithRules.routes.map((item) => item.id));
    }

    await db.getSource().manager.getRepository(RoutingTable).remove(table);

    const nodes: any[] = (await Tree.getNodeInfo(
      db.getQuery(),
      tableWithRules.firewall.fwCloudId,
      'RT',
      tableWithRules.id,
    )) as any[];
    if (nodes.length > 0) {
      const node_id = nodes[0].id;
      await Tree.deleteNodesUnderMe(db.getQuery(), tableWithRules.firewall.fwCloudId, node_id);
      await Tree.deleteFwc_Tree_node(node_id);
    }

    await this._firewallService.markAsUncompiled(tableWithRules.firewallId);

    return table;
  }

  protected getFindInPathOptions(
    path: Partial<IFindOneRoutingTablePath>,
  ): SelectQueryBuilder<RoutingTable> {
    const qb: SelectQueryBuilder<RoutingTable> = db
      .getSource()
      .manager.getRepository(RoutingTable)
      .createQueryBuilder('table');
    qb.innerJoin('table.firewall', 'firewall').innerJoin('firewall.fwCloud', 'fwcloud');

    if (path.firewallId) {
      qb.andWhere('firewall.id = :firewall', { firewall: path.firewallId });
    }

    if (path.fwCloudId) {
      qb.andWhere('firewall.fwCloudId = :fwcloud', { fwcloud: path.fwCloudId });
    }

    if (path.id) {
      qb.andWhere('table.id = :id', { id: path.id });
    }

    return qb;
  }

  /**
   * Returns an array of routes and in each route an array of items containing the information
   * required for compile the routes of the indicated routing table or for show the routing table routes
   * items in the FWCloud-UI.
   * @param dst
   * @param fwcloud
   * @param firewall
   * @param routingTable
   * @param routes
   * @returns
   */
  public async getRoutingTableData<T extends ItemForGrid | RouteItemForCompiler>(
    dst: AvailableDestinations,
    fwcloud: number,
    firewall: number,
    routingTable: number,
    routes?: number[],
  ): Promise<RouteData<T>[]> {
    const routesData: RouteData<T>[] = (await this._routeRepository.getRoutingTableRoutes(
      fwcloud,
      firewall,
      routingTable,
      routes,
    )) as RouteData<T>[];

    // Init the map for access the objects array for each route.
    const ItemsArrayMap = new Map<number, T[]>();
    for (let i = 0; i < routesData.length; i++) {
      routesData[i].items = [];

      // Map each route with it's corresponding items array.
      // These items array will be filled with objects data in the Promise.all()
      ItemsArrayMap.set(routesData[i].id, routesData[i].items);
    }

    const sqls =
      dst === 'grid'
        ? this.buildSQLsForGrid(fwcloud, firewall, routingTable)
        : this.buildSQLsForCompiler(fwcloud, firewall, routingTable, routes);
    await Promise.all(sqls.map((sql) => RoutingUtils.mapEntityData<T>(sql, ItemsArrayMap)));

    return routesData.map((data) => {
      data.items = data.items.sort((a, b) => a._order - b._order);
      return data;
    });
  }

  /**
   * Checks Routing Table create data is valid. It will check:
   *  - Number is not already being used by other table in the same firewall
   *
   */
  protected async validateRoutingTableNumber(routingTable: Partial<RoutingTable>): Promise<void> {
    const errors: ErrorBag = {};

    const tablesWithSameNumber: RoutingTable[] = await db
      .getSource()
      .manager.getRepository(RoutingTable)
      .find({
        where: {
          number: routingTable.number,
          firewallId: routingTable.firewallId,
        },
      });

    // Number is not being used.
    if (tablesWithSameNumber.length === 0) {
      return;
    }

    // The number is assigned to the provided routingTable
    if (tablesWithSameNumber.filter((item) => item.id === routingTable.id).length > 0) {
      return;
    }

    errors['number'] = ['number already used'];
    throw new ValidationException('The given data was invalid', errors);
  }

  /**
   * Move routing tables form source firewall to destination firewall.
   * @param srcFW
   * @param dstFW
   * @returns
   */
  public async moveToOtherFirewall(srcFW: number, dstFW: number): Promise<void> {
    const routingTables: RoutingTable[] = await db
      .getSource()
      .manager.getRepository(RoutingTable)
      .find({
        where: {
          firewallId: srcFW,
        },
      });

    for (const table of routingTables) {
      table.firewallId = dstFW;
      await db.getSource().manager.getRepository(RoutingTable).update(table.id, table);
    }
  }

  private buildSQLsForCompiler(
    fwcloud: number,
    firewall: number,
    routingTable: number,
    routes?: number[],
  ): SelectQueryBuilder<IPObj>[] {
    return [
      this._ipobjRepository.getIpobjsInRouting_excludeHosts(
        'route',
        fwcloud,
        firewall,
        routingTable,
        routes,
      ),
      this._ipobjRepository.getIpobjsInRouting_onlyHosts(
        'route',
        fwcloud,
        firewall,
        routingTable,
        routes,
      ),
      this._ipobjRepository.getIpobjsInGroupsInRouting_excludeHosts(
        'route',
        fwcloud,
        firewall,
        routingTable,
        routes,
      ),
      this._ipobjRepository.getIpobjsInGroupsInRouting_onlyHosts(
        'route',
        fwcloud,
        firewall,
        routingTable,
        routes,
      ),
      this._ipobjRepository.getIpobjsInOpenVPNInRouting(
        'route',
        fwcloud,
        firewall,
        routingTable,
        routes,
      ),
      this._ipobjRepository.getIpobjsInOpenVPNInGroupsInRouting(
        'route',
        fwcloud,
        firewall,
        routingTable,
        routes,
      ),
      this._ipobjRepository.getIpobjsInOpenVPNPrefixesInRouting(
        'route',
        fwcloud,
        firewall,
        routingTable,
        routes,
      ),
      this._ipobjRepository.getIpobjsInOpenVPNPrefixesInGroupsInRouting(
        'route',
        fwcloud,
        firewall,
        routingTable,
        routes,
      ),
      this._ipobjRepository.getIpobjsInWireGuardInRouting(
        'route',
        fwcloud,
        firewall,
        routingTable,
        routes,
      ),
      this._ipobjRepository.getIpobjsInWireGuardInGroupsInRouting(
        'route',
        fwcloud,
        firewall,
        routingTable,
        routes,
      ),
      this._ipobjRepository.getIpobjsInWireGuardPrefixesInRouting(
        'route',
        fwcloud,
        firewall,
        routingTable,
        routes,
      ),
      this._ipobjRepository.getIpobjInWireGuardPrefixesInGroupsInRouting(
        'route',
        fwcloud,
        firewall,
        routingTable,
        routes,
      ),
    ];
  }

  private buildSQLsForGrid(
    fwcloud: number,
    firewall: number,
    routingTable: number,
  ): SelectQueryBuilder<
    IPObj | IPObjGroup | OpenVPN | OpenVPNPrefix | WireGuard | WireGuardPrefix
  >[] {
    return [
      this._ipobjRepository.getIpobjsInRouting_ForGrid('route', fwcloud, firewall, routingTable),
      this._ipobjGroupRepository.getIpobjGroupsInRouting_ForGrid(
        'route',
        fwcloud,
        firewall,
        routingTable,
      ),
      this._openvpnRepository.getOpenVPNInRouting_ForGrid('route', fwcloud, firewall, routingTable),
      this._openvpnPrefixRepository.getOpenVPNPrefixInRouting_ForGrid(
        'route',
        fwcloud,
        firewall,
        routingTable,
      ),
      this._wireguardRepository.getWireGuardInRouting_ForGrid(
        'route',
        fwcloud,
        firewall,
        routingTable,
      ),
      this._wireguardPrefixRepository.getWireGuardPrefixInRouting_ForGrid(
        'route',
        fwcloud,
        firewall,
        routingTable,
      ),
    ] as SelectQueryBuilder<
      IPObj | IPObjGroup | OpenVPN | OpenVPNPrefix | WireGuard | WireGuardPrefix
    >[];
  }
}
