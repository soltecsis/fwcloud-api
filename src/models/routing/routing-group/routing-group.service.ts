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

import { FindOneOptions, SelectQueryBuilder } from 'typeorm';
import { Application } from '../../../Application';
import { Service } from '../../../fonaments/services/service';
import { Firewall } from '../../firewall/Firewall';
import { RoutingRule } from '../routing-rule/routing-rule.model';
import { RoutingGroup } from './routing-group.model';
import db from '../../../database/database-manager';

interface IFindManyRoutingGroupPath {
  firewallId?: number;
  fwCloudId?: number;
}

interface IFindOneRoutingGroupPath extends IFindManyRoutingGroupPath {
  id: number;
}

interface ICreateRoutingGroup {
  firewallId: number;
  name: string;
  comment?: string;
  routingRules: Partial<RoutingRule>[];
}

interface IUpdateRoutingGroup {
  name?: string;
  comment?: string;
  style?: string;
  routingRules?: Partial<RoutingRule>[];
}

export class RoutingGroupService extends Service {
  constructor(app: Application) {
    super(app);
  }

  findManyInPath(path: IFindManyRoutingGroupPath): Promise<RoutingGroup[]> {
    return this.getFindInPathOptions(path).getMany();
  }

  findOneInPath(path: IFindOneRoutingGroupPath): Promise<RoutingGroup | undefined> {
    return this.getFindInPathOptions(path).getOne();
  }

  async findOneInPathOrFail(path: IFindOneRoutingGroupPath): Promise<RoutingGroup> {
    return this.getFindInPathOptions(path).getOneOrFail();
  }

  async create(data: ICreateRoutingGroup): Promise<RoutingGroup> {
    const group: RoutingGroup = await db.getSource().manager.getRepository(RoutingGroup).save(data);
    return db
      .getSource()
      .manager.getRepository(RoutingGroup)
      .findOne({ where: { id: group.id } });
  }

  async update(id: number, data: IUpdateRoutingGroup): Promise<RoutingGroup> {
    let group: RoutingGroup = await db
      .getSource()
      .manager.getRepository(RoutingGroup)
      .preload(Object.assign(data, { id }));
    const firewall: Firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOne({ where: { id: group.firewallId } });

    if (data.routingRules) {
      if (data.routingRules.length === 0) {
        return this.remove({
          id: group.id,
          firewallId: firewall.id,
          fwCloudId: firewall.fwCloudId,
        });
      }

      group.routingRules = data.routingRules as RoutingRule[];
    }

    group = await db.getSource().manager.getRepository(RoutingGroup).save(group);

    return db
      .getSource()
      .manager.getRepository(RoutingGroup)
      .findOneOrFail({ where: { id: group.id } });
  }

  async remove(path: IFindOneRoutingGroupPath): Promise<RoutingGroup> {
    const group: RoutingGroup = await this.findOneInPath(path);
    db.getSource()
      .manager.getRepository(RoutingRule)
      .update(
        group.routingRules.map((rule) => rule.id),
        {
          routingGroupId: null,
        },
      );
    await db.getSource().manager.getRepository(RoutingGroup).remove(group);
    return group;
  }

  protected getFindInPathOptions(
    path: Partial<IFindOneRoutingGroupPath>,
  ): SelectQueryBuilder<RoutingGroup> {
    const qb: SelectQueryBuilder<RoutingGroup> = db
      .getSource()
      .manager.getRepository(RoutingGroup)
      .createQueryBuilder('group');
    qb.innerJoin('group.firewall', 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .leftJoinAndSelect('group.routingRules', 'rules');

    if (path.firewallId) {
      qb.andWhere('firewall.id = :firewall', { firewall: path.firewallId });
    }

    if (path.fwCloudId) {
      qb.andWhere('firewall.fwCloudId = :fwcloud', { fwcloud: path.fwCloudId });
    }

    if (path.id) {
      qb.andWhere('group.id = :id', { id: path.id });
    }

    return qb;
  }
}
