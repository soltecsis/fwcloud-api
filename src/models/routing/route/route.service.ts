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

import {
  FindManyOptions,
  FindOneOptions,
  getCustomRepository,
  getRepository,
  In,
  Not,
  SelectQueryBuilder,
} from 'typeorm';
import { Application } from '../../../Application';
import db from '../../../database/database-manager';
import { ValidationException } from '../../../fonaments/exceptions/validation-exception';
import { Service } from '../../../fonaments/services/service';
import { ErrorBag } from '../../../fonaments/validation/validator';
import { Offset } from '../../../offset';
import { Firewall } from '../../firewall/Firewall';
import { FirewallService } from '../../firewall/firewall.service';
import { Interface } from '../../interface/Interface';
import { IPObj } from '../../ipobj/IPObj';
import { IPObjGroup } from '../../ipobj/IPObjGroup';
import { PolicyRuleToIPObj } from '../../policy/PolicyRuleToIPObj';
import { OpenVPN } from '../../vpn/openvpn/OpenVPN';
import { OpenVPNPrefix } from '../../vpn/openvpn/OpenVPNPrefix';
import { RouteToIPObjGroup } from './route-to-ipobj-group.model';
import { RouteToIPObj } from './route-to-ipobj.model';
import { RouteToOpenVPNPrefix } from './route-to-openvpn-prefix.model';
import { RouteToOpenVPN } from './route-to-openvpn.model';
import { Route } from './route.model';
import { RouteRepository } from './route.repository';

interface IFindManyRoutePath {
  firewallId?: number;
  fwCloudId?: number;
  routingTableId?: number;
}

interface IFindOneRoutePath extends IFindManyRoutePath {
  id: number;
}

export interface ICreateRoute {
  routingTableId: number;
  gatewayId: number;
  interfaceId?: number;
  active?: boolean;
  comment?: string;
  style?: string;
  firewallApplyToId?: number;
  ipObjIds?: { id: number; order: number }[];
  ipObjGroupIds?: { id: number; order: number }[];
  openVPNIds?: { id: number; order: number }[];
  openVPNPrefixIds?: { id: number; order: number }[];
  to?: number; //Reference where create the route
  offset?: Offset;
}

interface IUpdateRoute {
  active?: boolean;
  comment?: string;
  gatewayId?: number;
  interfaceId?: number;
  style?: string;
  firewallApplyToId?: number;
  ipObjIds?: { id: number; order: number }[];
  ipObjGroupIds?: { id: number; order: number }[];
  openVPNIds?: { id: number; order: number }[];
  openVPNPrefixIds?: { id: number; order: number }[];
}

interface IBulkUpdateRoute {
  style?: string;
  active?: boolean;
}

interface IMoveToRoute {
  fromId: number;
  toId: number;
  ipObjId?: number;
  ipObjGroupId?: number;
  openVPNId?: number;
  openVPNPrefixId?: number;
}

interface IMoveToGatewayRoute {
  fromId: number;
  toId: number;
  ipObjId?: number;
}

interface IMoveInterfaceRoute {
  fromId: number;
  toId: number;
  interfaceId?: number;
}

export class RouteService extends Service {
  protected _repository: RouteRepository;
  protected _firewallService: FirewallService;

  constructor(app: Application) {
    super(app);
    this._repository = getCustomRepository(RouteRepository);
  }

  public async build(): Promise<RouteService> {
    this._firewallService = await this._app.getService(FirewallService.name);

    return this;
  }

  findManyInPath(path: IFindManyRoutePath): Promise<Route[]> {
    return this._repository.find(this.getFindInPathOptions(path));
  }

  findOneInPath(
    path: IFindOneRoutePath,
    options?: FindOneOptions<Route>,
  ): Promise<Route | undefined> {
    return this._repository.findOne(this.getFindInPathOptions(path, options));
  }

  findOneInPathOrFail(path: IFindOneRoutePath): Promise<Route> {
    return this._repository.findOneOrFail(this.getFindInPathOptions(path));
  }

  async create(data: ICreateRoute): Promise<Route> {
    const routeData: Partial<Route> = {
      routingTableId: data.routingTableId,
      gatewayId: data.gatewayId,
      interfaceId: data.interfaceId,
      active: data.active,
      comment: data.comment,
      style: data.style,
    };

    const lastRuoute: Route = await this._repository.getLastRouteInRoutingTable(
      data.routingTableId,
    );
    const route_order: number = lastRuoute?.route_order
      ? lastRuoute.route_order + 1
      : 1;
    routeData.route_order = route_order;

    let persisted: Route = await this._repository.save(routeData);

    persisted = await this.update(persisted.id, {
      ipObjIds: data.ipObjIds,
      ipObjGroupIds: data.ipObjGroupIds,
      openVPNIds: data.openVPNIds,
      openVPNPrefixIds: data.openVPNPrefixIds,
      firewallApplyToId: data.firewallApplyToId,
      interfaceId: data.interfaceId,
    });

    if (
      Object.prototype.hasOwnProperty.call(data, 'to') &&
      Object.prototype.hasOwnProperty.call(data, 'offset')
    ) {
      return (await this.move([persisted.id], data.to, data.offset))[0];
    }

    //There is no need to update firewall compilation status as it is done during update()
    //await this._firewallService.markAsUncompiled(firewall.id);
    return persisted;
  }

  async update(id: number, data: IUpdateRoute): Promise<Route> {
    let route: Route = await this._repository.preload(
      Object.assign(
        {
          active: data.active,
          comment: data.comment,
          gatewayId: data.gatewayId,
          style: data.style,
        },
        { id },
      ),
    );

    const firewall: Firewall = (
      await this._repository.findOne(route.id, {
        relations: ['routingTable', 'routingTable.firewall'],
      })
    ).routingTable.firewall;

    if (data.ipObjIds) {
      await this.validateUpdateIPObjs(firewall, data);
      route.routeToIPObjs = data.ipObjIds.map(
        (item) =>
          ({
            routeId: route.id,
            ipObjId: item.id,
            order: item.order,
          }) as RouteToIPObj,
      );
    }

    if (data.ipObjGroupIds) {
      await this.validateUpdateIPObjGroups(firewall, data);

      route.routeToIPObjGroups = data.ipObjGroupIds.map(
        (item) =>
          ({
            routeId: route.id,
            ipObjGroupId: item.id,
            order: item.order,
          }) as RouteToIPObjGroup,
      );
    }

    if (data.openVPNIds) {
      await this.validateOpenVPNs(firewall, data);

      route.routeToOpenVPNs = data.openVPNIds.map(
        (item) =>
          ({
            routeId: route.id,
            openVPNId: item.id,
            order: item.order,
          }) as RouteToOpenVPN,
      );
    }

    if (data.openVPNPrefixIds) {
      await this.validateOpenVPNPrefixes(firewall, data);

      route.routeToOpenVPNPrefixes = data.openVPNPrefixIds.map(
        (item) =>
          ({
            routeId: route.id,
            openVPNPrefixId: item.id,
            order: item.order,
          }) as RouteToOpenVPNPrefix,
      );
    }

    await this.validateFirewallApplyToId(firewall, data);
    route.firewallApplyToId = data.firewallApplyToId;

    if (Object.prototype.hasOwnProperty.call(data, 'interfaceId')) {
      if (data.interfaceId !== null) {
        await this.validateInterface(firewall, data);
      }

      route.interfaceId = data.interfaceId;
    }

    route = await this._repository.save(route);

    await this.reorderTo(route.id);

    await this._firewallService.markAsUncompiled(firewall.id);

    return route;
  }

  protected async reorderTo(ruleId: number): Promise<void> {
    const route: Route = await this._repository.findOneOrFail(ruleId, {
      relations: [
        'routeToIPObjs',
        'routeToIPObjGroups',
        'routeToOpenVPNs',
        'routeToOpenVPNPrefixes',
      ],
    });

    const items: { order: number }[] = [].concat(
      route.routeToIPObjs,
      route.routeToIPObjGroups,
      route.routeToOpenVPNs,
      route.routeToOpenVPNPrefixes,
    );

    items
      .sort((a, b) => a.order - b.order)
      .map((item, index) => {
        item.order = index + 1;
        return item;
      });

    await this._repository.save(route);
  }

  async copy(
    ids: number[],
    destRule: number,
    position: Offset,
  ): Promise<Route[]> {
    const routes: Route[] = await this._repository.find({
      where: {
        id: In(ids),
      },
      relations: [
        'routingTable',
        'routeToIPObjs',
        'routeToIPObjGroups',
        'routeToOpenVPNs',
        'routeToOpenVPNPrefixes',
      ],
    });

    const lastRuoute: Route = await this._repository.getLastRouteInRoutingTable(
      routes[0].routingTableId,
    );
    routes.map((item, index) => {
      item.id = undefined;
      item.route_order = lastRuoute.route_order + index + 1;
    });

    const persisted: Route[] = await this._repository.save(routes);

    const firewalls: Firewall[] = await getRepository(Firewall).find({
      where: {
        id: In(routes.map((route) => route.routingTable.firewallId)),
      },
    });

    await this._firewallService.markAsUncompiled(
      firewalls.map((firewall) => firewall.id),
    );

    return this.move(
      persisted.map((item) => item.id),
      destRule,
      position,
    );
  }

  async bulkUpdate(ids: number[], data: IBulkUpdateRoute): Promise<Route[]> {
    await this._repository.update(
      {
        id: In(ids),
      },
      data,
    );

    const firewallIds: number[] = (
      await this._repository.find({
        where: {
          id: In(ids),
        },
        join: {
          alias: 'route',
          innerJoinAndSelect: {
            table: 'route.routingTable',
          },
        },
      })
    ).map((route) => route.routingTable.firewallId);

    await this._firewallService.markAsUncompiled(firewallIds);

    return this._repository.find({
      where: {
        id: In(ids),
      },
    });
  }

  async move(
    ids: number[],
    destRule: number,
    offset: Offset,
  ): Promise<Route[]> {
    const routes: Route[] = await this._repository.move(ids, destRule, offset);
    const firewallIds: number[] = (
      await this._repository.find({
        where: {
          id: In(ids),
        },
        join: {
          alias: 'route',
          innerJoinAndSelect: {
            table: 'route.routingTable',
          },
        },
      })
    ).map((route) => route.routingTable.firewallId);

    await this._firewallService.markAsUncompiled(firewallIds);

    return routes;
  }

  async moveTo(
    fromId: number,
    toId: number,
    data: IMoveToRoute,
  ): Promise<[Route, Route]> {
    const fromRule: Route = await getRepository(Route).findOneOrFail(fromId, {
      relations: [
        'routeToIPObjs',
        'routeToIPObjGroups',
        'routeToOpenVPNs',
        'routeToOpenVPNPrefixes',
      ],
    });
    const toRule: Route = await getRepository(Route).findOneOrFail(toId, {
      relations: [
        'routeToIPObjs',
        'routeToIPObjGroups',
        'routeToOpenVPNs',
        'routeToOpenVPNPrefixes',
      ],
    });

    let lastPosition: number = 0;

    []
      .concat(
        toRule.routeToIPObjs,
        toRule.routeToIPObjGroups,
        toRule.routeToOpenVPNs,
        toRule.routeToOpenVPNPrefixes,
      )
      .forEach((item) => {
        lastPosition < item.order ? (lastPosition = item.order) : null;
      });

    if (data.ipObjId !== undefined) {
      const index: number = fromRule.routeToIPObjs.findIndex(
        (item) => item.ipObjId === data.ipObjId,
      );
      if (index >= 0) {
        fromRule.routeToIPObjs.splice(index, 1);
        toRule.routeToIPObjs.push({
          routeId: toRule.id,
          ipObjId: data.ipObjId,
          order: lastPosition + 1,
        } as RouteToIPObj);
      }
    }

    if (data.ipObjGroupId !== undefined) {
      const index: number = fromRule.routeToIPObjGroups.findIndex(
        (item) => item.ipObjGroupId === data.ipObjGroupId,
      );
      if (index >= 0) {
        fromRule.routeToIPObjGroups.splice(index, 1);
        toRule.routeToIPObjGroups.push({
          routeId: toRule.id,
          ipObjGroupId: data.ipObjGroupId,
          order: lastPosition + 1,
        } as RouteToIPObjGroup);
      }
    }

    if (data.openVPNId !== undefined) {
      const index: number = fromRule.routeToOpenVPNs.findIndex(
        (item) => item.openVPNId === data.openVPNId,
      );
      if (index >= 0) {
        fromRule.routeToOpenVPNs.splice(index, 1);
        toRule.routeToOpenVPNs.push({
          routeId: toRule.id,
          openVPNId: data.openVPNId,
          order: lastPosition + 1,
        } as RouteToOpenVPN);
      }
    }

    if (data.openVPNPrefixId !== undefined) {
      const index: number = fromRule.routeToOpenVPNPrefixes.findIndex(
        (item) => item.openVPNPrefixId === data.openVPNPrefixId,
      );
      if (index >= 0) {
        fromRule.routeToOpenVPNPrefixes.splice(index, 1);
        toRule.routeToOpenVPNPrefixes.push({
          routeId: toRule.id,
          openVPNPrefixId: data.openVPNPrefixId,
          order: lastPosition + 1,
        } as RouteToOpenVPNPrefix);
      }
    }

    return (await this._repository.save([fromRule, toRule])) as [Route, Route];
  }

  async moveToGateway(
    fromId: number,
    toId: number,
    data: IMoveToGatewayRoute,
  ): Promise<[Route, Route]> {
    const fromRule: Route = await getRepository(Route).findOneOrFail(fromId, {
      relations: ['routeToIPObjs'],
    });
    const toRule: Route = await getRepository(Route).findOneOrFail(toId);

    if (data.ipObjId !== undefined) {
      const index: number = fromRule.routeToIPObjs.findIndex(
        (item) => item.ipObjId === data.ipObjId,
      );
      if (index >= 0) {
        fromRule.routeToIPObjs.splice(index, 1);
        toRule.gatewayId = data.ipObjId;
      }
    }

    return (await this._repository.save([fromRule, toRule])) as [Route, Route];
  }

  async moveInterface(
    fromId: number,
    toId: number,
    data: IMoveInterfaceRoute,
  ): Promise<[Route, Route]> {
    const fromRule: Route = await getRepository(Route).findOneOrFail(fromId);
    const toRule: Route = await getRepository(Route).findOneOrFail(toId);

    if (fromRule.interfaceId === data.interfaceId) {
      toRule.interfaceId = fromRule.interfaceId;
      fromRule.interfaceId = null;
    }

    return (await this._repository.save([fromRule, toRule])) as [Route, Route];
  }

  async remove(path: IFindOneRoutePath): Promise<Route> {
    const route: Route = await this.findOneInPath(path);
    const firewall: Firewall = await getRepository(Firewall)
      .createQueryBuilder('firewall')
      .innerJoin('firewall.routingTables', 'table')
      .innerJoin('table.routes', 'route', 'route.id = :id', { id: route.id })
      .getOne();

    route.routeToOpenVPNPrefixes = [];
    route.routeToOpenVPNs = [];
    route.routeToIPObjGroups = [];
    route.routeToIPObjs = [];
    await this._repository.save(route);

    await this._repository.remove(route);
    await this._firewallService.markAsUncompiled(firewall.id);
    return route;
  }

  async bulkRemove(ids: number[]): Promise<Route[]> {
    const routes: Route[] = await this._repository.find({
      where: {
        id: In(ids),
      },
    });

    // For unknown reason, this._repository.remove(routes) is not working
    for (const route of routes) {
      await this.remove({
        id: route.id,
      });
    }

    //There is no need to set uncompiled firewalls because this is done in the remove()
    //await this._firewallService.markAsUncompiled(firewallIds);

    return routes;
  }

  /**
   * Checks IPObj are valid to be attached to the route. It will check:
   *  - IPObj belongs to the same FWCloud
   *  - IPObj contains at least one addres if its type is host
   *
   */
  protected async validateUpdateIPObjs(
    firewall: Firewall,
    data: IUpdateRoute,
  ): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.ipObjIds || data.ipObjIds.length === 0) {
      return;
    }

    const ipObjs: IPObj[] = await getRepository(IPObj).find({
      where: {
        id: In(data.ipObjIds.map((item) => item.id)),
        ipObjTypeId: In([
          5, // ADDRESS
          6, // ADDRESS RANGE
          7, // NETWORK
          8, // HOST
          9, // DNS
        ]),
      },
      relations: ['fwCloud'],
    });

    for (let i = 0; i < ipObjs.length; i++) {
      const ipObj: IPObj = ipObjs[i];

      if (ipObj.fwCloudId && ipObj.fwCloudId !== firewall.fwCloudId) {
        errors[`ipObjIds.${i}`] = ['ipObj id must exist'];
      } else if (ipObj.ipObjTypeId === 8) {
        // 8 = HOST
        const addrs: any = await Interface.getHostAddr(db.getQuery(), ipObj.id);
        if (addrs.length === 0) {
          errors[`ipObjIds.${i}`] = ['ipObj must contain at least one address'];
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }

  /**
   * Checks IPObjGroups are valid to be attached to the route. It will check:
   *  - IPObjGroup belongs to the same FWCloud
   *  - IPObjGroup is not empty
   *
   */
  protected async validateUpdateIPObjGroups(
    firewall: Firewall,
    data: IUpdateRoute,
  ): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.ipObjGroupIds || data.ipObjGroupIds.length === 0) {
      return;
    }

    const ipObjGroups: IPObjGroup[] = await getRepository(IPObjGroup).find({
      where: {
        id: In(data.ipObjGroupIds.map((item) => item.id)),
      },
      relations: [
        'fwCloud',
        'openVPNPrefixes',
        'openVPNs',
        'ipObjToIPObjGroups',
        'ipObjToIPObjGroups.ipObj',
      ],
    });

    for (let i = 0; i < ipObjGroups.length; i++) {
      const ipObjGroup: IPObjGroup = ipObjGroups[i];

      if (ipObjGroup.type !== 20) {
        errors[`ipObjGroupIds.${i}`] = ['ipObjGroupId not valid'];
      } else if (
        ipObjGroup.fwCloudId &&
        ipObjGroup.fwCloudId !== firewall.fwCloudId
      ) {
        errors[`ipObjGroupIds.${i}`] = ['ipObjGroupId must exist'];
      } else if (
        await PolicyRuleToIPObj.isGroupEmpty(db.getQuery(), ipObjGroup.id)
      ) {
        errors[`ipObjGroupIds.${i}`] = ['ipObjGroupId must not be empty'];
      } else {
        let valid: boolean = false;
        for (const ipObjToIPObjGroup of ipObjGroup.ipObjToIPObjGroups) {
          if (ipObjToIPObjGroup.ipObj.ipObjTypeId === 8) {
            // 8 = HOST
            const addrs: any = await Interface.getHostAddr(
              db.getQuery(),
              ipObjToIPObjGroup.ipObj.id,
            );
            if (addrs.length > 0) {
              valid = true;
            }
          }

          if (
            ipObjToIPObjGroup.ipObj.ipObjTypeId === 5 ||
            ipObjToIPObjGroup.ipObj.ipObjTypeId === 6 ||
            ipObjToIPObjGroup.ipObj.ipObjTypeId === 7
          ) {
            valid = true;
          }
        }

        if (
          ipObjGroup.openVPNs.length > 0 ||
          ipObjGroup.openVPNPrefixes.length > 0
        ) {
          valid = true;
        }

        if (!valid) {
          errors[`ipObjGroupIds.${i}`] = [
            'ipObjGroupId is not suitable as it does not contains any valid host',
          ];
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }

  protected async validateOpenVPNs(
    firewall: Firewall,
    data: IUpdateRoute,
  ): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.openVPNIds || data.openVPNIds.length === 0) {
      return;
    }

    const openvpns: OpenVPN[] = await getRepository(OpenVPN)
      .createQueryBuilder('openvpn')
      .innerJoin('openvpn.crt', 'crt')
      .innerJoin('openvpn.firewall', 'firewall')
      .whereInIds(data.openVPNIds.map((item) => item.id))
      .andWhere('firewall.fwCloudId = :fwcloud', {
        fwcloud: firewall.fwCloudId,
      })
      .andWhere('openvpn.parentId IS NOT null')
      .andWhere('crt.type = 1')
      .getMany();

    for (let i = 0; i < data.openVPNIds.length; i++) {
      if (openvpns.findIndex((item) => item.id === data.openVPNIds[i].id) < 0) {
        errors[`openVPNIds.${i}.id`] = [
          'openVPN does not exists or is not a client',
        ];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }

  protected async validateOpenVPNPrefixes(
    firewall: Firewall,
    data: IUpdateRoute,
  ): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.openVPNPrefixIds || data.openVPNPrefixIds.length === 0) {
      return;
    }

    const openvpnprefixes: OpenVPNPrefix[] = await getRepository(OpenVPNPrefix)
      .createQueryBuilder('prefix')
      .innerJoin('prefix.openVPN', 'openvpn')
      .innerJoin('openvpn.firewall', 'firewall')
      .whereInIds(data.openVPNPrefixIds.map((item) => item.id))
      .andWhere('firewall.fwCloudId = :fwcloud', {
        fwcloud: firewall.fwCloudId,
      })
      .getMany();

    for (let i = 0; i < data.openVPNPrefixIds.length; i++) {
      if (
        openvpnprefixes.findIndex(
          (item) => item.id === data.openVPNPrefixIds[i].id,
        ) < 0
      ) {
        errors[`openVPNPrefixIds.${i}.id`] = ['openVPNPrefix does not exists'];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }

  protected async validateFirewallApplyToId(
    firewall: Firewall,
    data: IUpdateRoute,
  ): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.firewallApplyToId) {
      return;
    }

    const firewallApplyToId: Firewall = await getRepository(Firewall)
      .createQueryBuilder('firewall')
      .where('firewall.id = :id', { id: data.firewallApplyToId })
      .getOne();

    if (firewallApplyToId.clusterId !== firewall.clusterId) {
      errors[`firewallApplyToId`] = [
        'This firewall does not belong to cluster',
      ];
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }

  protected async validateInterface(
    firewall: Firewall,
    data: ICreateRoute | IUpdateRoute,
  ): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.interfaceId) {
      return;
    }

    const intr: Interface = await getRepository(Interface)
      .createQueryBuilder('interface')
      .where('interface.id = :id', { id: data.interfaceId })
      .andWhere('interface.firewallId = :firewallId', {
        firewallId: firewall.id,
      })
      .getOne();

    if (intr) {
      return;
    }

    errors.interfaceId = ['interface is not valid'];
    throw new ValidationException('The given data was invalid', errors);
  }

  protected getFindInPathOptions(
    path: Partial<IFindOneRoutePath>,
    options: FindOneOptions<Route> | FindManyOptions<Route> = {},
  ): FindOneOptions<Route> | FindManyOptions<Route> {
    return Object.assign(
      {
        join: {
          alias: 'route',
          innerJoin: {
            table: 'route.routingTable',
            firewall: 'table.firewall',
            fwcloud: 'firewall.fwCloud',
          },
        },
        where: (qb: SelectQueryBuilder<Route>) => {
          if (path.firewallId) {
            qb.andWhere('firewall.id = :firewall', {
              firewall: path.firewallId,
            });
          }

          if (path.fwCloudId) {
            qb.andWhere('firewall.fwCloudId = :fwcloud', {
              fwcloud: path.fwCloudId,
            });
          }

          if (path.routingTableId) {
            qb.andWhere('table.id = :table', { table: path.routingTableId });
          }

          if (path.id) {
            qb.andWhere('route.id = :id', { id: path.id });
          }
        },
      },
      options,
    );
  }
}
