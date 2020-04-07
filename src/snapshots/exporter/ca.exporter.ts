import { TableExporter } from "./table-exporter";
import { Connection, SelectQueryBuilder } from "typeorm";
import { Ca } from "../../models/vpn/pki/Ca";
import Model from "../../models/Model";

export class CaExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return Ca;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where(`${alias}.fwCloudId = :id`, {
            id: fwCloudId
        });
    }
}