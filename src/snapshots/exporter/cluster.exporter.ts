import { TableExporter } from "./table-exporter";
import { Connection, SelectQueryBuilder } from "typeorm";
import { Cluster } from "../../models/firewall/Cluster";
import Model from "../../models/Model";

export class ClusterExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return Cluster;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where(`${alias}.fwCloudId = :id`, {
            id: fwCloudId
        });
    }
}