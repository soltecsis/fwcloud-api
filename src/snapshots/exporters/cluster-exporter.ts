import { EntityExporter } from "./entity-exporter";
import { SnapshotData } from "../snapshot-data";
import { Cluster } from "../../models/firewall/Cluster";

export class ClusterExporter extends EntityExporter<Cluster> {
    constructor(cluster: Cluster) {
        super();
        this.setInstance(cluster);
    }

    public async export(): Promise<SnapshotData> {
        const result = new SnapshotData();

        result.data.Cluster = [this.exportedEntity()];
        
        return result;
    }

}