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
import { KeepalivedRule } from '../keepalived_r/keepalived_r.model';
import { KeepalivedGroup } from './keepalived_g.model';
import { Firewall } from '../../../firewall/Firewall';
import { Application } from '../../../../Application';
import db from '../../../../database/database-manager';

interface IFindManyKeepalivedGPath {
  fwcloudId?: number;
  firewallId?: number;
}

interface IFindOneKeepalivedGPath extends IFindManyKeepalivedGPath {
  id: number;
}

interface ICreateKeepalivedGroup {
  firewallId: number;
  name: string;
  comment?: string;
  style?: string;
  rules?: Partial<KeepalivedRule>[];
}

interface IUpdateKeepalivedGroup {
  name: string;
  comment?: string;
  style?: string;
  rules?: Partial<KeepalivedRule>[];
}

export class KeepalivedGroupService extends Service {
  constructor(app: Application) {
    super(app);
  }

  findManyInPath(path: IFindManyKeepalivedGPath): Promise<KeepalivedGroup[]> {
    return this.getFindInPathOptions(path).getMany();
  }

  findOneInPath(
    path: IFindOneKeepalivedGPath,
    options?: FindOneOptions<KeepalivedGroup>,
  ): Promise<KeepalivedGroup | undefined> {
    return this.getFindInPathOptions(path, options).getOne();
  }

  protected getFindInPathOptions(
    path: Partial<IFindOneKeepalivedGPath>,
    options:
      | FindOneOptions<KeepalivedGroup>
      | FindManyOptions<KeepalivedGroup> = {},
  ): SelectQueryBuilder<KeepalivedGroup> {
    const qb: SelectQueryBuilder<KeepalivedGroup> = db
      .getSource()
      .manager.getRepository(KeepalivedGroup)
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

    // Aplica las opciones adicionales que se pasaron a la función
    Object.entries(options).forEach(([key, value]) => {
      switch (key) {
        case 'where':
          qb.andWhere(value);
          break;
        case 'relations':
          qb.leftJoinAndSelect(`group.${value}`, `${value}`);
          break;
        default:
      }
    });

    return qb;
  }

  async create(data: ICreateKeepalivedGroup): Promise<KeepalivedGroup> {
    const groupData: Partial<KeepalivedGroup> = {
      name: data.name,
      firewall: (await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOne({ where: { id: data.firewallId } })) as unknown as Firewall,
      style: data.style,
    };

    const group: KeepalivedGroup = await db
      .getSource()
      .manager.getRepository(KeepalivedGroup)
      .save(groupData);
    return db
      .getSource()
      .manager.getRepository(KeepalivedGroup)
      .findOne({ where: { id: group.id } });
  }

  async update(
    id: number,
    data: IUpdateKeepalivedGroup,
  ): Promise<KeepalivedGroup> {
    const group: KeepalivedGroup | undefined = await db
      .getSource()
      .manager.getRepository(KeepalivedGroup)
      .findOne({ where: { id: id } });

    if (!group) {
      throw new Error('KeepalivedGroup not found');
    }

    Object.assign(group, data);
    await db.getSource().manager.getRepository(KeepalivedGroup).save(group);

    return group;
  }

  async remove(path: IFindOneKeepalivedGPath): Promise<KeepalivedGroup> {
    const group: KeepalivedGroup = await this.findOneInPath(path);
    if (!group) {
      throw new Error('KeepalivedGroup not found');
    }
    if (group.rules && group.rules.length > 0) {
      await db
        .getSource()
        .manager.getRepository(KeepalivedRule)
        .update(
          group.rules.map((rule) => rule.id),
          {
            group: null,
          },
        );
    }
    await db.getSource().manager.getRepository(KeepalivedGroup).remove(group);
    return group;
  }
}
