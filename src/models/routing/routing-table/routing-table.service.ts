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

import { FindManyOptions, getCustomRepository, getRepository } from "typeorm";
import { Application } from "../../../Application";
import db from "../../../database/database-manager";
import { Service } from "../../../fonaments/services/service";
import { Firewall } from "../../firewall/Firewall";
import { Tree } from "../../tree/Tree";
import { RoutingTable } from "./routing-table.model";
import { RoutingTableRepository } from "./routing-table.repository";

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
    protected _repository: RoutingTableRepository;

    constructor(app: Application) {
        super(app);
        this._repository = getCustomRepository(RoutingTableRepository);
    }

    findOne(id: number): Promise<RoutingTable | undefined> {
        return this._repository.findOne(id);
    }

    findOneWithinFwCloud(id: number, firewallId: number, fwCloudId: number): Promise<RoutingTable | undefined> {
        return this._repository.findOneWithinFwCloud(id, firewallId, fwCloudId);
    }

    findOneWithinFwCloudOrFail(id: number, firewallId: number, fwCloudId: number): Promise<RoutingTable> {
        return this._repository.findOneWithinFwCloudOrFail(id, firewallId, fwCloudId);
    }

    async findOneOrFail(id: number): Promise<RoutingTable> {
        return this._repository.findOneOrFail(id);
    }

    find(options: FindManyOptions<RoutingTable>): Promise<RoutingTable[]> {
        return this._repository.find(options);
    }

    async create(data: ICreateRoutingTable): Promise<RoutingTable> {
        const routingTable: RoutingTable = await this._repository.save(data);
        const firewall: Firewall = await getRepository(Firewall).findOne(routingTable.firewallId, {relations: ['fwCloud']});

        const node: {id: number} = await Tree.getNodeUnderFirewall(db.getQuery(), firewall.fwCloud.id, firewall.id, 'RTS') as {id: number};
        await Tree.newNode(db.getQuery(), firewall.fwCloud.id, routingTable.name, node.id, 'IR', routingTable.id, null);


        return routingTable;
    }

    async update(criteria: number | RoutingTable, values: IUpdateRoutingTable): Promise<RoutingTable> {
        await this._repository.update(this.getId(criteria), values);
        return this.findOne(this.getId(criteria));
    }

    async delete(criteria: number | RoutingTable): Promise<RoutingTable> {
        const table: RoutingTable =  await this.findOne(this.getId(criteria));
        await this._repository.delete(criteria);

        return table;
    }

    /**
     * Returns the id if the data is a RoutingTable instance
     * @param data 
     * @returns 
     */
    protected getId(data: number | RoutingTable): number {
        return typeof data !== 'number' ? data.id : data;
    }

}