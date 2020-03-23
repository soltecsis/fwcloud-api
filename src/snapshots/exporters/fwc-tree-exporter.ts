import { EntityExporter } from "./entity-exporter";
import { IPObj } from "../../models/ipobj/IPObj";
import { FwcTree } from "../../models/tree/fwc-tree.model";

export class FwcTreeExporter extends EntityExporter {
    shouldIgnoreThisInstance(fwcTree: FwcTree): boolean {
        return true;
    }
}