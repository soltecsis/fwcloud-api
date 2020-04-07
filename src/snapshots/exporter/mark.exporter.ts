import { TableExporter } from "./table-exporter";
import { Mark } from "../../models/ipobj/Mark";
import Model from "../../models/Model";
import { SelectQueryBuilder } from "typeorm";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { FwCloudExporter } from "./fwcloud-exporter";

export class MarkExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return Mark;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where((qb) => {
            const subquery = qb.subQuery().from(FwCloud, 'fwcloud').select('fwcloud.id');

            return `${alias}.fwCloudId IN ` + new FwCloudExporter()
                .getFilterBuilder(subquery, 'fwcloud', fwCloudId).getQuery()
        });
    }
}