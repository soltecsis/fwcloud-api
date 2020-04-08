import { TableExporter } from "./table-exporter";
import { SelectQueryBuilder } from "typeorm";
import Model from "../../models/Model";
import { FwcTree } from "../../models/tree/fwc-tree.model";

export class FwcTreeExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return FwcTree;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where(`${alias}.fwCloudId = :id`, {
            id: fwCloudId
        });
    }
}