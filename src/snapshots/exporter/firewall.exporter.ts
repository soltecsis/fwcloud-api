import { TableExporter } from "./table-exporter";
import { Connection, SelectQueryBuilder } from "typeorm";
import Model from "../../models/Model";
import { Firewall } from "../../models/firewall/Firewall";

export class FirewallExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return Firewall;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where(`${alias}.fwCloudId = :id`, {
            id: fwCloudId
        });
    }
}