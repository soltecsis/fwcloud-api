import { EntityExporter } from "./entity-exporter";
import { SnapshotData } from "../snapshot-data";
import { Cluster } from "../../models/firewall/Cluster";

export class ClusterExporter extends EntityExporter<Cluster> {
    public async exportEntity(): Promise<SnapshotData> {
        const result = new SnapshotData();

        result.data.Cluster = [this.exportToJSON()];
        
        return result;
    }

}