import { EntityExporter } from "./entity-exporter";
import { FwcTree } from "../../models/tree/fwc-tree.model";
import { SnapshotData } from "../snapshot-data";

export class FwcTreeExporter extends EntityExporter<FwcTree> {
    public async exportEntity(): Promise<SnapshotData> {
        const result = new SnapshotData();
        
        result.data.FwcTree = [this.exportToJSON()];

        return result;
    }
}