import { EntityExporter } from "./entity-exporter";
import { IPObjType } from "../../models/ipobj/IPObjType";

export class IPObjTypeExporter extends EntityExporter {
    shouldIgnoreThisInstance(ipObjType: IPObjType): boolean {
        return true;
    }
}