import { FindOneOptions, getCustomRepository, getRepository, SelectQueryBuilder } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { Application } from "../../../Application";
import { Service } from "../../../fonaments/services/service";
import { RoutingRule } from "../routing-rule/routing-rule.model";
import { RoutingGroup } from "./routing-group.model";
import { RoutingGroupRepository } from "./routing-group.repository";

export interface IFindManyPath {
    firewallId?: number,
    fwCloudId?: number
}

export interface IFindOnePath extends IFindManyPath {
    id: number
}

export interface ICreateRoutingGroup {
    firewallId: number;
    name: string;
    comment?: string;
}

export class RoutingGroupService extends Service {
    protected _repository: RoutingGroupRepository;

    constructor(app: Application) {
        super(app);
        this._repository = getCustomRepository(RoutingGroupRepository);
    }

    findManyInPath(path: IFindManyPath): Promise<RoutingGroup[]> {
        return this._repository.find({
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
            }
        });
    }

    findOneInPath(path: IFindOnePath): Promise<RoutingGroup | undefined> {
        return this._repository.findOne(this.getFindOneOptions(path));
    }

    async findOneInPathOrFail(path: IFindOnePath): Promise<RoutingGroup> {
        return this._repository.findOneOrFail(this.getFindOneOptions(path));
    }

    async create(data: ICreateRoutingGroup): Promise<RoutingGroup> {
        let group: RoutingGroup = await this._repository.save(data);
        return this._repository.findOne(group.id);
    }

    async update(id: number, data: QueryDeepPartialEntity<RoutingGroup>): Promise<RoutingGroup> {
        await this._repository.update(id, data);
        return this._repository.findOne(id);
    }

    async remove(path: IFindOnePath): Promise<RoutingGroup> {
        const group: RoutingGroup = await this.findOneInPath(path);
        getRepository(RoutingRule).update(group.routingRules.map(rule => rule.id), {
            groupId: null
        });
        await this._repository.remove(group);
        return group;
    }

    protected getFindOneOptions(path: IFindOnePath): FindOneOptions<RoutingGroup> {
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

                qb.andWhere('group.id = :id', {id: path.id})
            }
        }
    }
}