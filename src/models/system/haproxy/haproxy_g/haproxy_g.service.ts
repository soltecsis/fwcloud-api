/*!
    Copyright 2023 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { Service } from '../../../../fonaments/services/service';
import { Application } from '../../../../Application';
import { HAProxyGroup } from './haproxy_g.model';
import { Firewall } from '../../../firewall/Firewall';
import { HAProxyRule } from '../haproxy_r/haproxy_r.model';
import db from '../../../../database/database-manager';

interface IFindManyHAProxyGPath {
  fwcloudId?: number;
  firewallId?: number;
}

interface IFindOneHAProxyGPath extends IFindManyHAProxyGPath {
  id: number;
}

interface ICreateHAProxyGroup {
  firewallId?: number;
  name: string;
  comment?: string;
  style?: string;
  rules?: Partial<HAProxyRule>[];
}

interface IUpdateHAProxyGroup {
  name: string;
  comment?: string;
  style?: string;
  rules?: Partial<HAProxyRule>[];
}

export class HAProxyGroupService extends Service {
  constructor(app: Application) {
    super(app);
  }

  findManyInPath(path: IFindManyHAProxyGPath): Promise<HAProxyGroup[]> {
    return this.getFindInPathOptions(path).getMany();
  }

  findOneInPath(path: IFindOneHAProxyGPath): Promise<HAProxyGroup> {
    return this.getFindInPathOptions(path).getOne();
  }

  protected getFindInPathOptions(
    path: Partial<IFindOneHAProxyGPath>,
    options: FindOneOptions<HAProxyGroup> | FindManyOptions<HAProxyGroup> = {},
  ): SelectQueryBuilder<HAProxyGroup> {
    const qb: SelectQueryBuilder<HAProxyGroup> = db
      .getSource()
      .manager.getRepository(HAProxyGroup)
      .createQueryBuilder('group');
    qb.innerJoin('group.firewall', 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .leftJoinAndSelect('group.rules', 'rules');

    if (path.firewallId) {
      qb.andWhere('firewall.id = :firewallId', { firewallId: path.firewallId });
    }
    if (path.fwcloudId) {
      qb.andWhere('firewall.fwCloudId = :fwcloudId', {
        fwcloudId: path.fwcloudId,
      });
    }
    if (path.id) {
      qb.andWhere('group.id = :id', { id: path.id });
    }

    return qb;
  }

  async create(data: ICreateHAProxyGroup): Promise<HAProxyGroup> {
    const groupData: Partial<HAProxyGroup> = {
      name: data.name,
      firewall: (await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOne({ where: { id: data.firewallId } })) as unknown as Firewall,
      style: data.style,
    };

    const group: HAProxyGroup = await db
      .getSource()
      .manager.getRepository(HAProxyGroup)
      .save(groupData);
    return db
      .getSource()
      .manager.getRepository(HAProxyGroup)
      .findOne({ where: { id: group.id } });
  }

  async update(id: number, data: IUpdateHAProxyGroup): Promise<HAProxyGroup> {
    const group: HAProxyGroup | undefined = await db
      .getSource()
      .manager.getRepository(HAProxyGroup)
      .findOne({ where: { id: id } });

    if (!group) {
      throw new Error('HAProxyGroup not found');
    }

    Object.assign(group, data);
    await db.getSource().manager.getRepository(HAProxyGroup).save(group);

    return group;
  }

  async remove(path: IFindOneHAProxyGPath): Promise<HAProxyGroup> {
    const group: HAProxyGroup = await this.findOneInPath(path);
    if (!group) {
      throw new Error('HAProxyGroup not found');
    }
    if (group.rules && group.rules.length > 0) {
      await db
        .getSource()
        .manager.getRepository(HAProxyRule)
        .update(
          group.rules.map((rule) => rule.id),
          {
            group: null,
          },
        );
    }
    await db.getSource().manager.getRepository(HAProxyGroup).remove(group);
    return group;
  }
}
