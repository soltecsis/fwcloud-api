import { TableExporter } from "./table-exporter";
import { SelectQueryBuilder } from "typeorm";
import { Interface } from "../../models/interface/Interface";
import Model from "../../models/Model";

export class InterfaceExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return Interface;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .leftJoin(`${alias}.firewall`, "firewall")
        .leftJoin(`${alias}.ipObjs`, "ipobj")
        .where("firewall.fwCloudId = :id", {
            id: fwCloudId
        })
        .orWhere("ipobj.fwCloudId = :id", {
            id: fwCloudId
        });
    }
}