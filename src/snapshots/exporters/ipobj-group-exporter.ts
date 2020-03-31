import { EntityExporter } from "./entity-exporter";
import { IPObjGroup } from "../../models/ipobj/IPObjGroup";

export class IPObjGroupExporter extends EntityExporter {
    shouldIgnoreThisInstance(ipObjGroup: IPObjGroup): boolean {
        return ipObjGroup.isStandard() ? true : false;
    }
}