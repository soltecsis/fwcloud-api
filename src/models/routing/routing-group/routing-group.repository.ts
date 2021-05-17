import { EntityRepository, Repository, SelectQueryBuilder } from "typeorm";
import { RoutingGroup } from "./routing-group.model";

export interface IFindManyInPathCriteria {
    firewallId?: number,
    fwCloudId?: number
}

export interface IFindOneInPathCriteria extends IFindManyInPathCriteria {
    id: number,
}

function isFindOneInPathCriteria(value: IFindOneInPathCriteria | IFindManyInPathCriteria): value is IFindOneInPathCriteria {
    return Object.prototype.hasOwnProperty.call(value, 'id');
}

@EntityRepository(RoutingGroup)
export class RoutingGroupRepository extends Repository<RoutingGroup> {
}