import { TableExporter } from "./table-exporter";
import Model from "../../models/Model";
import { SelectQueryBuilder } from "typeorm";
import { IPObj } from "../../models/ipobj/IPObj";
import { IPObjExporter } from "./ipobj.exporter";
import { IPObjToIPObjGroup } from "../../models/ipobj/IPObjToIPObjGroup";
import { IPObjGroup } from "../../models/ipobj/IPObjGroup";
import { IPObjGroupExporter } from "./ipobj-group.exporter";
//import { IPObjGroupExporter } from "../exporters/ipobj-group-exporter";

export class IPObjToIPObjGroupExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return IPObjToIPObjGroup;
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb
        .where((qb) => {
            const subquery = qb.subQuery().from(IPObj, 'ipobj').select('ipobj.id');

            return `${alias}.ipObjId IN` + new IPObjExporter()
                .getFilterBuilder(subquery, 'ipobj', fwCloudId).getQuery()
        })
        /*.orWhere((qb) => {
            const subquery = qb.subQuery().from(IPObjGroup, 'ipobj_g').select('ipobj_g.id');

            return `${alias}.ipObjGroupId IN` + new IPObjGroupExporter()
                .getFilterBuilder(subquery, 'ipobj_g', fwCloudId).getQuery()
        });*/
    }
}