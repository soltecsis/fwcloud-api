import { Connection, FindManyOptions, getConnection, getCustomRepository, getRepository, Repository } from "typeorm";
import { Application } from "../../../Application";
import db from "../../../database/database-manager";
import Query from "../../../database/Query";
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