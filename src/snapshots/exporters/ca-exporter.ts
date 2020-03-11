import { EntityExporter } from "./entity-exporter";
import { Ca } from "../../models/vpn/pki/Ca";
import { SnapshotData } from "../snapshot-data";

export class CaExporter extends EntityExporter<Ca> {
    constructor(ca: Ca) {
        super();
        this.setInstance(ca);
    }

    public async export(): Promise<SnapshotData> {
        const result = new SnapshotData();
        
        result.data.Ca = [this.exportedEntity()];
    
        return result;
    }
    
}