import { FindOneOptions, getCustomRepository, getRepository, SelectQueryBuilder } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { Application } from "../../../Application";
import { Service } from "../../../fonaments/services/service";
import { Route } from "../route/route.model";
import { RouteGroup } from "./route-group.model";
import { RouteGroupRepository } from "./route-group.repository";

export interface IFindManyPath {
    firewallId?: number,
    fwCloudId?: number
}

export interface IFindOnePath extends IFindManyPath {
    id: number
}

export interface ICreateRouteGroup {
    firewallId: number;
    name: string;
    comment?: string;
}

export class RouteGroupService extends Service {
    protected _repository: RouteGroupRepository;

    constructor(app: Application) {
        super(app);
        this._repository = getCustomRepository(RouteGroupRepository);
    }

    findManyInPath(path: IFindManyPath): Promise<RouteGroup[]> {
        return this._repository.find({
            join: {
                alias: 'group',
                innerJoin: {
                    firewall: 'group.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<RouteGroup>) => {
                if (path.firewallId) {
                    qb.andWhere('firewall.id = :firewall', {firewall: path.firewallId})
                }

                if (path.fwCloudId) {
                    qb.andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: path.fwCloudId})
                }
            }
        });
    }

    findOneInPath(path: IFindOnePath): Promise<RouteGroup | undefined> {
        return this._repository.findOne(this.getFindOneOptions(path));
    }

    async findOneInPathOrFail(path: IFindOnePath): Promise<RouteGroup> {
        return this._repository.findOneOrFail(this.getFindOneOptions(path));
    }

    async create(data: ICreateRouteGroup): Promise<RouteGroup> {
        let group: RouteGroup = await this._repository.save(data);
        return this._repository.findOne(group.id);
    }

    async update(id: number, data: QueryDeepPartialEntity<RouteGroup>): Promise<RouteGroup> {
        await this._repository.update(id, data);
        return this._repository.findOne(id);
    }

    async remove(path: IFindOnePath): Promise<RouteGroup> {
        const group: RouteGroup = await this.findOneInPath(path);
        getRepository(Route).update(group.routes.map(route => route.id), {
            routeGroupId: null
        });
        await this._repository.remove(group);
        return group;
    }

    protected getFindOneOptions(path: IFindOnePath): FindOneOptions<RouteGroup> {
        return {
            join: {
                alias: 'group',
                innerJoin: {
                    firewall: 'group.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<RouteGroup>) => {
                if (path.firewallId) {
                    qb.andWhere('firewall.id = :firewall', {firewall: path.firewallId})
                }

                if (path.fwCloudId) {
                    qb.andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: path.fwCloudId})
                }

                qb.andWhere('group.id = :id', {id: path.id})
            }
        }
    }
}