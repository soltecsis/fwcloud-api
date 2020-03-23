import { EntityExporter } from "./entity-exporter";
import { IPObj } from "../../models/ipobj/IPObj";

export class IPObjExporter extends EntityExporter {
    shouldIgnoreThisInstance(ipobj: IPObj): boolean {
        return ipobj.isStandard() ? true : false;
    }
}