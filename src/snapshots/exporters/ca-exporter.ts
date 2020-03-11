import { EntityExporter } from "./entity-exporter";
import { Ca } from "../../models/vpn/pki/Ca";
import { SnapshotData } from "../snapshot-data";

export class CaExporter extends EntityExporter<Ca> {
    public async exportEntity(): Promise<SnapshotData> {
        const result = new SnapshotData();
        
        result.data.Ca = [this.exportToJSON()];
    
        return result;
    }
}