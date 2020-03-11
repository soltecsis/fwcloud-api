import { EntityExporter } from "./entity-exporter";
import { CaPrefix } from "../../models/vpn/pki/CaPrefix";
import { SnapshotData } from "../snapshot-data";

export class CaPrefixExporter extends EntityExporter<CaPrefix> {
    public async exportEntity(): Promise<SnapshotData> {
        const result = new SnapshotData();

        result.data.CaPrefix = [this.exportToJSON()];

        return result;
    }
    
}