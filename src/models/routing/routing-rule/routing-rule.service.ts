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

import { FindManyOptions, FindOneOptions, getRepository, Repository, SelectQueryBuilder } from "typeorm";
import { Application } from "../../../Application";
import { Service } from "../../../fonaments/services/service";
import { RoutingRule } from "./routing-rule.model";

interface IFindManyRoutingRulePath {
    firewallId?: number;
    fwCloudId?: number;
}

interface IFindOneRoutingRulePath extends IFindManyRoutingRulePath {
    id: number;
}

interface ICreateRoutingRule {
    routingTableId: number;
    active?: boolean;
    comment?: string;
}

interface IUpdateRoutingRule {
    routingTableId: number;
    active?: boolean;
    comment?: string;
}



export class RoutingRuleService extends Service {
    protected _repository: Repository<RoutingRule>;

    constructor(app: Application) {
        super(app);
        this._repository = getRepository(RoutingRule);
    }

    findManyInPath(path: IFindManyRoutingRulePath): Promise<RoutingRule[]> {
        return this._repository.find(this.getFindInPathOptions(path));
    }

    findOneInPath(path: IFindOneRoutingRulePath): Promise<RoutingRule | undefined> {
        return this._repository.findOne(this.getFindInPathOptions(path));
    }

    findOneInPathOrFail(path: IFindOneRoutingRulePath): Promise<RoutingRule> {
        return this._repository.findOneOrFail(this.getFindInPathOptions(path));
    }

    async create(data: ICreateRoutingRule): Promise<RoutingRule> {
        const result: RoutingRule = await this._repository.save(data);
        return this._repository.findOne(result.id);
    }

    async update(id: number, data: IUpdateRoutingRule): Promise<RoutingRule> {
        let rule: RoutingRule = await this._repository.preload(Object.assign(data, {id}));
        rule = await this._repository.save(rule);

        return rule;
    }

    async remove(path: IFindOneRoutingRulePath): Promise<RoutingRule> {
        const rule: RoutingRule = await this.findOneInPath(path);
        
        await this._repository.remove(rule);

        return rule;
    }

    protected getFindInPathOptions(path: Partial<IFindOneRoutingRulePath>): FindOneOptions<RoutingRule> | FindManyOptions<RoutingRule> {
        return {
            join: {
                alias: 'rule',
                innerJoin: {
                    table: 'rule.routingTable',
                    firewall: 'table.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<RoutingRule>) => {
                if (path.firewallId) {
                    qb.andWhere('firewall.id = :firewall', {firewall: path.firewallId})
                }

                if (path.fwCloudId) {
                    qb.andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: path.fwCloudId})
                }

                if (path.id) {
                    qb.andWhere('rule.id = :id', {id: path.id})
                }
            }
        }
    }
}