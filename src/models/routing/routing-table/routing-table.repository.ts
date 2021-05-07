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
            .innerJoinAndSelect("table.firewall", "firewall")
            .innerJoinAndSelect("firewall.fwCloud", "fwcloud")
            .where("table.id = :id", {id})
            .andWhere("firewall.id = :firewallId", {firewallId})
            .andWhere("fwcloud.id = :fwCloudId", {fwCloudId})
    }
}