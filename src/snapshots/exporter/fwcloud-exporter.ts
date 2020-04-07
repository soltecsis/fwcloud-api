import { TableExporter } from "./table-exporter";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { Connection, SelectQueryBuilder } from "typeorm";
import Model from "../../models/Model";

export class FwCloudExporter extends TableExporter {
    
    protected getEntity(): typeof Model {
        return FwCloud;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where(`${alias}.id = :id`, {
            id: fwCloudId
        });
    }
}