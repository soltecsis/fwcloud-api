import { EntityRepository, QueryBuilder, Repository, SelectQueryBuilder } from "typeorm";
import { RoutingTable } from "./routing-table.model";

@EntityRepository(RoutingTable)
export class RoutingTableRepository extends Repository<RoutingTable> {
    findOneWithinFwCloud(id: number, firewallId: number, fwCloudId: number): Promise<RoutingTable | undefined> {
        return this.getFindOneWithinFwCloudQueryBuilder(id, firewallId, fwCloudId).getOne();
    }

    findOneWithinFwCloudOrFail(id: number, firewallId: number, fwCloudId: number): Promise<RoutingTable | undefined> {
        return this.getFindOneWithinFwCloudQueryBuilder(id, firewallId, fwCloudId).getOneOrFail();
    }

    protected getFindOneWithinFwCloudQueryBuilder(id: number, firewallId: number, fwCloudId: number): SelectQueryBuilder<RoutingTable> {
        return this.createQueryBuilder("table")
            .leftJoinAndSelect("table.firewall", "firewall")
            .where("table.id = :id", {id})
            .where("table.firewallId = :firewallId", {firewallId})
            .andWhere("firewall.fwCloud = :fwCloudId", {fwCloudId})
    }
}