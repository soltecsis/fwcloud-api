import { EntityRepository, FindManyOptions, Repository, SelectQueryBuilder } from "typeorm";
import { RoutingRule } from "./routing-rule.model";

export interface IWhereUniqueRoutingRule {
    id: number;
    firewallId: number;
    fwCloudId: number;
}

export interface IWhereRoutingRule {
    routingTableId: number;
}

@EntityRepository(RoutingRule)
export class RoutingRuleRepository extends Repository<RoutingRule> {
    findOneWithinFwCloud(criteria: IWhereUniqueRoutingRule): Promise<RoutingRule | undefined> {
        return this.getFindOneWithinFwCloudQueryBuilder(criteria).getOne();
    }

    findOneWithinFwCloudOrFail(criteria: IWhereUniqueRoutingRule): Promise<RoutingRule> {
        return this.getFindOneWithinFwCloudQueryBuilder(criteria).getOneOrFail();
    }

    protected getFindOneWithinFwCloudQueryBuilder(criteria: IWhereUniqueRoutingRule): SelectQueryBuilder<RoutingRule> {
        return this.createQueryBuilder("rule")
            .innerJoinAndSelect("rule.routingTable", "table")
            .innerJoinAndSelect("table.firewall", "firewall")
            .innerJoinAndSelect("firewall.fwCloud", "fwcloud")
            .where("rule.id = :id", {id: criteria.id})
            .andWhere("firewall.id = :firewallId", {firewallId: criteria.firewallId})
            .andWhere("fwcloud.id = :fwCloudId", {fwCloudId: criteria.fwCloudId})
    }
}