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
} from "typeorm";
import { Service } from "../../../../fonaments/services/service";
import { Application } from "../../../../Application";
import { HAProxyGroup } from "./haproxy_g.model";
import { Firewall } from "../../../firewall/Firewall";
import { HAProxyRule } from "../haproxy_r/haproxy_r.model";

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
  protected _repository: Repository<HAProxyGroup>;

  constructor(app: Application) {
    super(app);
    this._repository = getRepository(HAProxyGroup);
  }

  findManyInPath(path: IFindManyHAProxyGPath): Promise<HAProxyGroup[]> {
    return this._repository.find(this.getFindInPathOptions(path));
  }

  findOneInPath(path: IFindOneHAProxyGPath): Promise<HAProxyGroup> {
    return this._repository.findOne(this.getFindInPathOptions(path));
  }

  protected getFindInPathOptions(
    path: Partial<IFindOneHAProxyGPath>,
    options: FindOneOptions<HAProxyGroup> | FindManyOptions<HAProxyGroup> = {},
  ): FindOneOptions<HAProxyGroup> | FindManyOptions<HAProxyGroup> {
    return Object.assign(
      {
        join: {
          alias: "group",
          innerJoin: {
            firewall: "group.firewall",
            fwcloud: "firewall.fwCloud",
          },
        },
        where: (qb: SelectQueryBuilder<HAProxyGroup>) => {
          if (path.firewallId) {
            qb.andWhere("firewall.id = :firewallId", {
              firewallId: path.firewallId,
            });
          }
          if (path.fwcloudId) {
            qb.andWhere("firewall.fwCloudId = :fwcloudId", {
              fwcloudId: path.fwcloudId,
            });
          }
          if (path.id) {
            qb.andWhere("group.id = :id", { id: path.id });
          }
        },
      },
      options,
    );
  }

  async create(data: ICreateHAProxyGroup): Promise<HAProxyGroup> {
    const groupData: Partial<HAProxyGroup> = {
      name: data.name,
      firewall: (await getRepository(Firewall).findOne(
        data.firewallId,
      )) as unknown as Firewall,
      style: data.style,
    };

    const group: HAProxyGroup = await this._repository.save(groupData);
    return this._repository.findOne(group.id);
  }

  async update(id: number, data: IUpdateHAProxyGroup): Promise<HAProxyGroup> {
    const group: HAProxyGroup | undefined = await this._repository.findOne(id);

    if (!group) {
      throw new Error("HAProxyGroup not found");
    }

    Object.assign(group, data);
    await this._repository.save(group);

    return group;
  }

  async remove(path: IFindOneHAProxyGPath): Promise<HAProxyGroup> {
    const group: HAProxyGroup = await this.findOneInPath(path);
    if (!group) {
      throw new Error("HAProxyGroup not found");
    }
    if (group.rules && group.rules.length > 0) {
      await getRepository(HAProxyRule).update(
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
