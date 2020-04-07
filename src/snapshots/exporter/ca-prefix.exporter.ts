import { TableExporter } from "./table-exporter";
import { Connection, SelectQueryBuilder } from "typeorm";
import { CaPrefix } from "../../models/vpn/pki/CaPrefix";
import Model from "../../models/Model";

export class CaPrefixExporter extends TableExporter {
    
    protected getEntity(): typeof Model {
        return CaPrefix;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .innerJoin(`${alias}.ca`, "ca")
        .where("ca.fwCloudId = :id", {
            id: fwCloudId
        });
    }
}