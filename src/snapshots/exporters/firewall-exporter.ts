import { EntityExporter } from "./entity-exporter";
import { SnapshotData } from "../snapshot-data";
import { Firewall } from "../../models/firewall/Firewall";

export class FirewallExporter extends EntityExporter<Firewall> {
    public async exportEntity(): Promise<SnapshotData> {
        const result = new SnapshotData();
        
        result.data.Firewall = [this.exportToJSON()];

        return result;
    }

}