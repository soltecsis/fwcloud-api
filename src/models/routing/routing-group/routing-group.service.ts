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

import { FindOneOptions, getRepository, Repository, SelectQueryBuilder } from "typeorm";
import { Application } from "../../../Application";
import { Service } from "../../../fonaments/services/service";
import { Firewall } from "../../firewall/Firewall";
import { RoutingRule } from "../routing-rule/routing-rule.model";
import { RoutingGroup } from "./routing-group.model";

interface IFindManyRoutingGroupPath {
    firewallId?: number,
    fwCloudId?: number
}

interface IFindOneRoutingGroupPath extends IFindManyRoutingGroupPath {
    id: number
}

interface ICreateRoutingGroup {
    firewallId: number;
    name: string;
    comment?: string;
    routingRules: Partial<RoutingRule>[]
}

interface IUpdateRoutingGroup {
    name?: string;
    comment?: string;
    style?: string;
    routingRules?: Partial<RoutingRule>[]
}

export class RoutingGroupService extends Service {
    protected _repository: Repository<RoutingGroup>;

    constructor(app: Application) {
        super(app);
        this._repository = getRepository(RoutingGroup);
    }

    findManyInPath(path: IFindManyRoutingGroupPath): Promise<RoutingGroup[]> {
        return this._repository.find(this.getFindInPathOptions(path));
    }

    findOneInPath(path: IFindOneRoutingGroupPath): Promise<RoutingGroup | undefined> {
        return this._repository.findOne(this.getFindInPathOptions(path));
    }

    async findOneInPathOrFail(path: IFindOneRoutingGroupPath): Promise<RoutingGroup> {
        return this._repository.findOneOrFail(this.getFindInPathOptions(path));
    }

    async create(data: ICreateRoutingGroup): Promise<RoutingGroup> {
        let group: RoutingGroup = await this._repository.save(data);
        return this._repository.findOne(group.id);
    }

    async update(id: number, data: IUpdateRoutingGroup): Promise<RoutingGroup> {
        let group: RoutingGroup = await this._repository.preload(Object.assign(data, {id}));
        let firewall: Firewall = await getRepository(Firewall).findOne(group.firewallId)
        group.routingRules = data.routingRules as RoutingRule[];
        group = await this._repository.save(group);

        group = await this._repository.findOneOrFail(group.id, {relations: ['routingRules']})
        if (group.routingRules.length === 0) {
            return this.remove({
                id: group.id,
                firewallId: firewall.id,
                fwCloudId: firewall.fwCloudId
            });
        }

        return group;
    }

    async remove(path: IFindOneRoutingGroupPath): Promise<RoutingGroup> {
        const group: RoutingGroup = await this.findOneInPath(path);
        getRepository(RoutingRule).update(group.routingRules.map(rule => rule.id), {
            routingGroupId: null
        });
        await this._repository.remove(group);
        return group;
    }

    protected getFindInPathOptions(path: Partial<IFindOneRoutingGroupPath>): FindOneOptions<RoutingGroup> {
        return {
            join: {
                alias: 'group',
                innerJoin: {
                    firewall: 'group.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<RoutingGroup>) => {
                if (path.firewallId) {
                    qb.andWhere('firewall.id = :firewall', {firewall: path.firewallId})
                }

                if (path.fwCloudId) {
                    qb.andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: path.fwCloudId})
                }

                if (path.id) {
                    qb.andWhere('group.id = :id', {id: path.id})
                }
            }
        }
    }
}