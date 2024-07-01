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
  getRepository,
} from 'typeorm';
import { Service } from '../../../../fonaments/services/service';
import { KeepalivedRule } from '../keepalived_r/keepalived_r.model';
import { KeepalivedGroup } from './keepalived_g.model';
import { Firewall } from '../../../firewall/Firewall';
import { Application } from '../../../../Application';

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
  protected _repository: Repository<KeepalivedGroup>;

  constructor(app: Application) {
    super(app);
    this._repository = getRepository(KeepalivedGroup);
  }

  findManyInPath(path: IFindManyKeepalivedGPath): Promise<KeepalivedGroup[]> {
    return this._repository.find(this.getFindInPathOptions(path));
  }

  findOneInPath(
    path: IFindOneKeepalivedGPath,
    options?: FindOneOptions<KeepalivedGroup>,
  ): Promise<KeepalivedGroup | undefined> {
    return this._repository.findOne(this.getFindInPathOptions(path, options));
  }

  protected getFindInPathOptions(
    path: Partial<IFindOneKeepalivedGPath>,
    options:
      | FindOneOptions<KeepalivedGroup>
      | FindManyOptions<KeepalivedGroup> = {},
  ): FindOneOptions<KeepalivedGroup> | FindManyOptions<KeepalivedGroup> {
    return Object.assign(
      {
        join: {
          alias: 'group',
          innerJoin: {
            firewall: 'group.firewall',
            fwcloud: 'firewall.fwCloud',
          },
        },
        where: (qb: SelectQueryBuilder<KeepalivedGroup>) => {
          if (path.firewallId) {
            qb.andWhere('firewall.id = :firewallId', {
              firewallId: path.firewallId,
            });
          }
          if (path.fwcloudId) {
            qb.andWhere('firewall.fwCloudId = :fwcloudId', {
              fwcloudId: path.fwcloudId,
            });
          }
          if (path.id) {
            qb.andWhere('group.id = :id', { id: path.id });
          }
        },
      },
      options,
    );
  }

  async create(data: ICreateKeepalivedGroup): Promise<KeepalivedGroup> {
    const groupData: Partial<KeepalivedGroup> = {
      name: data.name,
      firewall: (await getRepository(Firewall).findOne(
        data.firewallId,
      )) as unknown as Firewall,
      style: data.style,
    };

    const group: KeepalivedGroup = await this._repository.save(groupData);
    return this._repository.findOne(group.id);
  }

  async update(
    id: number,
    data: IUpdateKeepalivedGroup,
  ): Promise<KeepalivedGroup> {
    const group: KeepalivedGroup | undefined =
      await this._repository.findOne(id);

    if (!group) {
      throw new Error('KeepalivedGroup not found');
    }

    Object.assign(group, data);
    await this._repository.save(group);

    return group;
  }

  async remove(path: IFindOneKeepalivedGPath): Promise<KeepalivedGroup> {
    const group: KeepalivedGroup = await this.findOneInPath(path);
    if (!group) {
      throw new Error('KeepalivedGroup not found');
    }
    if (group.rules && group.rules.length > 0) {
      await getRepository(KeepalivedRule).update(
        group.rules.map((rule) => rule.id),
        {
          group: null,
        },
      );
    }
    await this._repository.remove(group);
    return group;
  }
}
