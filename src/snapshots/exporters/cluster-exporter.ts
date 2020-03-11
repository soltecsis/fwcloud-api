import { EntityExporter } from "./entity-exporter";
import { ExportResult } from "./export-result";
import { Cluster } from "../../models/firewall/Cluster";

export class ClusterExporter extends EntityExporter<Cluster> {
    constructor(cluster: Cluster) {
        super();
        this.setInstance(cluster);
    }

    public async export(): Promise<ExportResult> {
        const result = new ExportResult();
        result.clusters.push(this.exportedEntity())
        
        return result;
    }

}