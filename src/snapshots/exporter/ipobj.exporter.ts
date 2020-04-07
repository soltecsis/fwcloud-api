import { TableExporter } from "./table-exporter";
import { Connection, SelectQueryBuilder, QueryBuilder } from "typeorm";
import { IPObj } from "../../models/ipobj/IPObj";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import Model from "../../models/Model";
import { InterfaceExporter } from "./interface.exporter";
import { Interface } from "../../models/interface/Interface";

export class IPObjExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return IPObj;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where(`${alias}.id >= 100000`)
        .leftJoin(FwCloud, "fwcloud", "fwcloud.id = :id", {id: fwCloudId})
        .leftJoin("ipobj.interface", "interface")
        .where((qb) => {
            const subquery = qb.subQuery().from(Interface, 'interface').select('interface.id');

            return 'interface.id IN ' + new InterfaceExporter()
                .getFilterBuilder(subquery, 'interface', fwCloudId).getQuery()
        });
    }
}