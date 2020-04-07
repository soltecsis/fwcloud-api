import { TableExporter } from "./table-exporter";
import { Connection, SelectQueryBuilder } from "typeorm";
import { Crt } from "../../models/vpn/pki/Crt";
import Model from "../../models/Model";
import { Ca } from "../../models/vpn/pki/Ca";
import { CaExporter } from "./ca.exporter";

export class CrtExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return Crt;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where((qb) => {
            const subquery = qb.subQuery().from(Ca, 'ca').select('ca.id');

            return `${alias}.caId IN ` + new CaExporter()
                .getFilterBuilder(subquery, 'ca', fwCloudId).getQuery()
        });
    }
}