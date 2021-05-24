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

import { FindOneOptions, getCustomRepository, getRepository, Repository, SelectQueryBuilder } from "typeorm";
import { Application } from "../../../Application";
import db from "../../../database/database-manager";
import { Service } from "../../../fonaments/services/service";
import { Firewall } from "../../firewall/Firewall";
import { Tree } from "../../tree/Tree";
import { RoutingTable } from "./routing-table.model";

export interface IFindManyRoutingTablePath {
    firewallId?: number,
    fwCloudId?: number
}

export interface IFindOneRoutingTablePath extends IFindManyRoutingTablePath {
    id: number
}

interface ICreateRoutingTable {
    firewallId: number;
    number: number;
    name: string;
    comment?: string;
}

interface IUpdateRoutingTable {
    name?: string;
    comment?: string;
}

export class RoutingTableService extends Service {
    protected _repository: Repository<RoutingTable>;

    constructor(app: Application) {
        super(app);
        this._repository = getRepository(RoutingTable);
    }

    findManyInPath(path: IFindManyRoutingTablePath): Promise<RoutingTable[]> {
        return this._repository.find({
            join: {
                alias: 'table',
                innerJoin: {
                    firewall: 'table.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<RoutingTable>) => {
                if (path.firewallId) {
                    qb.andWhere('firewall.id = :firewall', {firewall: path.firewallId})
                }

                if (path.fwCloudId) {
                    qb.andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: path.fwCloudId})
                }
            }
        });
    }

    findOneInPath(path: IFindOneRoutingTablePath): Promise<RoutingTable | undefined> {
        return this._repository.findOne(this.getFindOneOptions(path))
    }

    findOneInPathOrFail(path: IFindOneRoutingTablePath): Promise<RoutingTable> {
        return this._repository.findOneOrFail(this.getFindOneOptions(path));
    }

    async create(data: ICreateRoutingTable): Promise<RoutingTable> {
        const routingTable: RoutingTable = await this._repository.save(data);
        const firewall: Firewall = await getRepository(Firewall).findOne(routingTable.firewallId, {relations: ['fwCloud']});

        const node: {id: number} = await Tree.getNodeUnderFirewall(db.getQuery(), firewall.fwCloud.id, firewall.id, 'RTS') as {id: number};
        await Tree.newNode(db.getQuery(), firewall.fwCloud.id, routingTable.name, node.id, 'IR', routingTable.id, null);


        return routingTable;
    }

    async update(id: number, data: IUpdateRoutingTable): Promise<RoutingTable> {
        let table: RoutingTable = await this._repository.preload(Object.assign(data, {id}));
        await this._repository.save(table);

        return table;
    }

    async remove(path: IFindOneRoutingTablePath): Promise<RoutingTable> {
        const table: RoutingTable =  await this.findOneInPath(path);
        
        await this._repository.remove(table);
        return table;
    }

    protected getFindOneOptions(path: IFindOneRoutingTablePath): FindOneOptions<RoutingTable> {
        return {
            join: {
                alias: 'table',
                innerJoin: {
                    firewall: 'table.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<RoutingTable>) => {
                if (path.firewallId) {
                    qb.andWhere('firewall.id = :firewall', {firewall: path.firewallId})
                }

                if (path.fwCloudId) {
                    qb.andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: path.fwCloudId})
                }

                qb.andWhere('table.id = :id', {id: path.id})
            }
        }
    }

}