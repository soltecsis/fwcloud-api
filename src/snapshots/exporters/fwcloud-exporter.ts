import { EntityExporter } from "./entity-exporter";
import { IPObj } from "../../models/ipobj/IPObj";

export class FwCloudExporter extends EntityExporter {
    _ignoreRelations = [
        'users'
    ];

    _customRelationFilters = {
        ipObjs: async (entities: Array<IPObj>): Promise<Array<IPObj>> => {
            return entities.filter((item) => {
                return !item.isStandard();
            })
        }
    }
}