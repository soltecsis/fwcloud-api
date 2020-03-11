import { EntityExporter } from "./entity-exporter";
import { CaPrefix } from "../../models/vpn/pki/CaPrefix";
import { SnapshotData } from "../snapshot-data";

export class CaPrefixExporter extends EntityExporter<CaPrefix> {
    constructor(caPrefix: CaPrefix) {
        super();
        this.setInstance(caPrefix);
    }

    public async export(): Promise<SnapshotData> {
        const result = new SnapshotData();

        result.data.CaPrefix = [this.exportedEntity()];

        return result;
    }
    
}