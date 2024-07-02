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
  In,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Service } from '../../../../fonaments/services/service';
import { DHCPRule } from '../dhcp_r/dhcp_r.model';
import { DHCPGroup } from './dhcp_g.model';
import { Firewall } from '../../../firewall/Firewall';
import { Application } from '../../../../Application';
import db from '../../../../database/database-manager';

interface IFindManyDHCPGPath {
  fwcloudId?: number;
  firewallId?: number;
}

interface IFindOneDHCPGPath extends IFindManyDHCPGPath {
  id: number;
}

interface ICreateDHCGroup {
  firewallId: number;
  name: string;
  comment?: string;
  style?: string;
  rules?: Partial<DHCPRule>[];
}

interface IUpdateDHCPGroup {
  name: string;
  comment?: string;
  style?: string;
  rules?: Partial<DHCPRule>[];
}

export class DHCPGroupService extends Service {
  constructor(app: Application) {
    super(app);
  }

  findManyInPath(path: IFindManyDHCPGPath): Promise<DHCPGroup[]> {
    return this.getFindInPathOptions(path).getMany();
  }

  findOneInPath(
    path: IFindOneDHCPGPath,
    options?: FindOneOptions<DHCPGroup>,
  ): Promise<DHCPGroup | undefined> {
    return this.getFindInPathOptions(path, options).getOne();
  }

  protected getFindInPathOptions(
    path: Partial<IFindOneDHCPGPath>,
    options: FindOneOptions<DHCPGroup> | FindManyOptions<DHCPGroup> = {},
  ): SelectQueryBuilder<DHCPGroup> {
    const qb: SelectQueryBuilder<DHCPGroup> = db
      .getSource()
      .manager.getRepository(DHCPGroup)
      .createQueryBuilder('group')
      .innerJoin('group.firewall', 'firewall')
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
          qb.leftJoinAndSelect(`keepalived.${value}`, `${value}`);
          break;
        default:
      }
    });

    return qb;
  }

  async create(data: ICreateDHCGroup): Promise<DHCPGroup> {
    const groupData: Partial<DHCPGroup> = {
      name: data.name,
      firewall: (await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOne({ where: { id: data.firewallId } })) as unknown as Firewall,
      style: data.style,
    };

    const group: DHCPGroup = await db
      .getSource()
      .manager.getRepository(DHCPGroup)
      .save(groupData);
    return db
      .getSource()
      .manager.getRepository(DHCPGroup)
      .findOne({ where: { id: group.id } });
  }

  async update(id: number, data: IUpdateDHCPGroup): Promise<DHCPGroup> {
    let group: DHCPGroup | undefined = await db
      .getSource()
      .manager.getRepository(DHCPGroup)
      .findOne({ where: { id: id } });

    if (!group) {
      throw new Error('DHCPGroup not found');
    }

    Object.assign(group, data);
    await db.getSource().manager.getRepository(DHCPGroup).save(group);

    return group;
  }

  async remove(path: IFindOneDHCPGPath): Promise<DHCPGroup> {
    const group: DHCPGroup = await this.findOneInPath(path);
    if (!group) {
      throw new Error('DHCPGroup not found');
    }
    if (group.rules && group.rules.length > 0) {
      await db
        .getSource()
        .manager.getRepository(DHCPRule)
        .update(
          { id: In(group.rules.map((rule) => rule.id)) },
          { group: null },
        );
    }

    await db.getSource().manager.getRepository(DHCPGroup).remove(group);
    return group;
  }
}
