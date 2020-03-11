import { EntityExporter } from "./entity-exporter";
import { SnapshotData } from "../snapshot-data";
import { IPObj } from "../../models/ipobj/IPObj";

export class IPObjExporter extends EntityExporter<IPObj> {
    public async exportEntity(): Promise<SnapshotData> {
        const result = new SnapshotData();
        
        result.data.IPObj = [this.exportToJSON()];

        return result;
    }
}