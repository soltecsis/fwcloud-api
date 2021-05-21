import { FindOneOptions, getCustomRepository, getRepository, Repository, SelectQueryBuilder } from "typeorm";
import { Application } from "../../../Application";
import { Service } from "../../../fonaments/services/service";
import { RoutingRule } from "../routing-rule/routing-rule.model";
import { RoutingGroup } from "./routing-group.model";

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
    routingRules: Partial<RoutingRule>[]
}

export interface IUpdateRoutingGroup {
    name: string;
    comment?: string;
    routingRules: Partial<RoutingRule>[]
}

export class RoutingGroupService extends Service {
    protected _repository: Repository<RoutingGroup>;

    constructor(app: Application) {
        super(app);
        this._repository = getRepository(RoutingGroup);
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

    async update(id: number, data: IUpdateRoutingGroup): Promise<RoutingGroup> {
        let group: RoutingGroup = await this._repository.preload(Object.assign(data, {id}));
        group.routingRules = data.routingRules as RoutingRule[];
        group = await this._repository.save(group);

        if (group.routingRules.length === 0) {
            return this.remove({
                id: group.id,
                firewallId: group.firewallId,
                fwCloudId: group.firewall.fwCloudId
            });
        }

        return group;
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