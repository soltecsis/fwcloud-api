import { FindManyOptions, getCustomRepository } from "typeorm";
import { Application } from "../../../Application";
import { Service } from "../../../fonaments/services/service";
import { Route } from "./route.model";
import { FindOneWithinFwCloud, RouteRepository } from "./route.repository";

export interface ICreateRoute {
    routingTableId: number;
    gatewayId?: number;
    interfaceId?: number;
    active?: boolean;
    comment?: string;
}

interface IUpdateRoute {
    active?: boolean;
    comment?: string;
    gatewayId?: number;
    interfaceId?: number;
}

export class RouteService extends Service {
    protected _repository: RouteRepository;

    constructor(app: Application) {
        super(app);
        this._repository = getCustomRepository(RouteRepository);
    }

    findOne(id: number): Promise<Route | undefined> {
        return this._repository.findOne(id);
    }

    findOneWithinFwCloud(criteria: FindOneWithinFwCloud): Promise<Route | undefined> {
        return this._repository.findOneWithinFwCloud(criteria);
    }

    findOneWithinFwCloudOrFail(criteria: FindOneWithinFwCloud): Promise<Route> {
        return this._repository.findOneWithinFwCloudOrFail(criteria);
    }

    find(options: FindManyOptions<Route>): Promise<Route[]> {
        return this._repository.find(options);
    }

    create(data: ICreateRoute): Promise<Route> {
        return this._repository.save(data);
    }

    async update(criteria: number | Route, values: IUpdateRoute): Promise<Route> {
        await this._repository.update(this.getId(criteria), values);
        return this.findOne(this.getId(criteria));
    }

    async delete(criteria: number | Route): Promise<Route> {
        const table: Route =  await this.findOne(this.getId(criteria));
        await this._repository.delete(criteria);

        return table;
    }

    /**
     * Returns the id if the data is a RoutingTable instance
     * @param data 
     * @returns 
     */
    protected getId(data: number | Route): number {
        return typeof data !== 'number' ? data.id : data;
    }
}