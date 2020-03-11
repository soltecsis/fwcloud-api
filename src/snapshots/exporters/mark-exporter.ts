import { EntityExporter } from "./entity-exporter";
import { SnapshotData } from "../snapshot-data";
import { Mark } from "../../models/ipobj/Mark";

export class MarkExporter extends EntityExporter<Mark> {
    public async exportEntity(): Promise<SnapshotData> {
        const result = new SnapshotData();
        
        result.data.Mark = [this.exportToJSON()];

        return result;
    }
}