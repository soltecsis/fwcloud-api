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
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Application } from '../../../Application';
import { Service } from '../../../fonaments/services/service';
import { Route } from '../route/route.model';
import { RouteGroup } from './route-group.model';
import db from '../../../database/database-manager';
import { DatabaseService } from '../../../database/database.service';
import { Firewall } from '../../firewall/Firewall';

interface IFindManyRouteGroupPath {
  firewallId?: number;
  fwCloudId?: number;
}

interface IFindOneRouteGroupPath extends IFindManyRouteGroupPath {
  id: number;
}

interface ICreateRouteGroup {
  firewallId: number;
  name: string;
  comment?: string;
  routes: Partial<Route>[];
}

interface IUpdateRouteGroup {
  name: string;
  comment?: string;
  style?: string;
  routes: Partial<Route>[];
}

export class RouteGroupService extends Service {
  protected _repository: Repository<RouteGroup>;
  protected _databaseService: DatabaseService;

  constructor(app: Application) {
    super(app);
  }

  public async build(): Promise<Service> {
    this._databaseService = await this._app.getService(DatabaseService.name);
    this._repository =
      this._databaseService.dataSource.manager.getRepository(RouteGroup);

    return this;
  }

  async findManyInPath(path: IFindManyRouteGroupPath): Promise<RouteGroup[]> {
    return (await this.getFindInPathOptions(path)).getMany();
  }

  async findOneInPath(
    path: IFindOneRouteGroupPath,
    options?: FindOneOptions<RouteGroup>,
  ): Promise<RouteGroup | undefined> {
    return (await this.getFindInPathOptions(path, options)).getOne();
  }

  async findOneInPathOrFail(path: IFindOneRouteGroupPath): Promise<RouteGroup> {
    return (await this.getFindInPathOptions(path)).getOneOrFail();
  }

  async create(data: ICreateRouteGroup): Promise<RouteGroup> {
    const group: RouteGroup = await this._repository.save(data);
    return this._repository.findOne({ where: { id: group.id } });
  }

  async update(id: number, data: IUpdateRouteGroup): Promise<RouteGroup> {
    let group: RouteGroup = await this._repository.findOneOrFail({
      where: { id },
      relations: ['firewall', 'routes'],
    });

    this._repository.merge(group, data);

    group = await this._repository.save(group);

    if (group.routes.length === 0) {
      return this.remove({
        id: group.id,
        firewallId: group.firewallId,
        fwCloudId: group.firewall.fwCloudId,
      });
    }

    return this.findOneInPath({
      id: group.id,
    });
  }

  async remove(path: IFindOneRouteGroupPath): Promise<RouteGroup> {
    const group: RouteGroup = await this.findOneInPath(path);
    db.getSource()
      .manager.getRepository(Route)
      .update(
        group.routes.map((route) => route.id),
        {
          routeGroupId: null,
        },
      );
    await this._repository.remove(group);
    return group;
  }

  protected async getFindInPathOptions(
    path: Partial<IFindOneRouteGroupPath>,
    options: FindOneOptions<RouteGroup> | FindManyOptions<RouteGroup> = {},
  ): Promise<SelectQueryBuilder<RouteGroup>> {
    const qb = this._repository.createQueryBuilder('group');
    qb.innerJoin('group.firewall', 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .leftJoinAndSelect('group.routes', 'route');

    if (path.id) {
      qb.where('group.id = :groupId', { groupId: path.id });
    }

    if (path.firewallId) {
      qb.andWhere('firewall.id = :firewall', { firewall: path.firewallId });
    }

    if (path.fwCloudId) {
      qb.andWhere('firewall.fwCloudId = :fwcloud', { fwcloud: path.fwCloudId });
    }

    // Aplica las opciones adicionales que se pasaron a la función
    Object.entries(options).forEach(([key, value]) => {
      switch (key) {
        case 'where':
          qb.andWhere(value);
          break;
        case 'relations':
          value.forEach((value: string) => {
            qb.leftJoinAndSelect(`group.${value}`, `${value}`);
          });
          break;
        default:
      }
    });

    return qb;
  }
}
