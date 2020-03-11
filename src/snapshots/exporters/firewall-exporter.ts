import { EntityExporter } from "./entity-exporter";
import { SnapshotData } from "../snapshot-data";
import { Firewall } from "../../models/firewall/Firewall";

export class FirewallExporter extends EntityExporter<Firewall> {
    constructor(firewall: Firewall) {
        super();
        this.setInstance(firewall);
    }
    
    public async export(): Promise<SnapshotData> {
        const result = new SnapshotData();
        
        result.data.Firewall = [this.exportedEntity()];

        return result;
    }

}