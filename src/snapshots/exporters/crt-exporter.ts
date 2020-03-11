import { EntityExporter } from "./entity-exporter";
import { Crt } from "../../models/vpn/pki/Crt";
import { SnapshotData } from "../snapshot-data";

export class CrtExporter extends EntityExporter<Crt> {
    constructor(crt: Crt) {
        super();
        this.setInstance(crt);
    }

    public async export(): Promise<SnapshotData> {
        const result = new SnapshotData();

        result.data.Crt = [this.exportedEntity()];

        return result;
    }

    
}