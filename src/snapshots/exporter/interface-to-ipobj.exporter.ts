import { TableExporter } from "./table-exporter";
import { SelectQueryBuilder } from "typeorm";
import Model from "../../models/Model";
import { InterfaceIPObj } from "../../models/interface/InterfaceIPObj";
import { Interface } from "../../models/interface/Interface";
import { InterfaceExporter } from "./interface.exporter";
import { IPObj } from "../../models/ipobj/IPObj";
import { IPObjExporter } from "./ipobj.exporter";

export class InterfaceToIPObjExporter extends TableExporter {
    
    protected getEntity(): typeof Model {
        return InterfaceIPObj;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where((qb) => {
            const subquery = qb.subQuery().from(Interface, 'interface').select('interface.id');

            return `${alias}.interfaceId IN ` + new InterfaceExporter()
                .getFilterBuilder(subquery, 'interface', fwCloudId).getQuery()
        })
        .orWhere((qb) => {
            const subquery = qb.subQuery().from(IPObj, 'ipobj').select('ipobj.id');

            return `${alias}.ipObjId IN ` + new IPObjExporter()
                .getFilterBuilder(subquery, 'ipobj', fwCloudId).getQuery()
        });
    }
}