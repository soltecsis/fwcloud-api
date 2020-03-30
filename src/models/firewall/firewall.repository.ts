import { Repository } from "../../database/repository";
import { Firewall } from "./Firewall";
import { isArray } from "util";
import { In, EntityRepository } from "typeorm";

@EntityRepository(Firewall)
export class FirewallRepository extends Repository<Firewall> {
    public async markAsUncompiled(Firewall: Firewall): Promise<Firewall>;
    public async markAsUncompiled(Firewalls: Array<Firewall>): Promise<Firewall>;
    public async markAsUncompiled(oneOrMany: Firewall | Array<Firewall>): Promise<Firewall | Array<Firewall>> {
        const entities: Array<Firewall> = isArray(oneOrMany) ? oneOrMany: [oneOrMany];

        await this.createQueryBuilder().update(Firewall)
        .where({id: In(this.getIdsFromEntityCollection(entities))})
        .set({
            status: 0,
            installed_at: null,
            compiled_at: null
        }).execute();

        return await this.reloadEntities(oneOrMany);
    }
}