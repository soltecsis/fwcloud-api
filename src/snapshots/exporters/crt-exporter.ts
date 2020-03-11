import { EntityExporter } from "./entity-exporter";
import { Crt } from "../../models/vpn/pki/Crt";
import { SnapshotData } from "../snapshot-data";

export class CrtExporter extends EntityExporter<Crt> {
    public async exportEntity(): Promise<SnapshotData> {
        const result = new SnapshotData();

        result.data.Crt = [this.exportToJSON()];

        return result;
    }

    
}