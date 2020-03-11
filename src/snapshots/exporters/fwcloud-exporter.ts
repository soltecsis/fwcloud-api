import { FwCloud } from "../../models/fwcloud/FwCloud";
import { EntityExporter } from "./entity-exporter";
import { CaExporter } from "./ca-exporter";
import { ExportResult } from "./export-result";
import { app } from "../../fonaments/abstract-application";
import { RepositoryService } from "../../database/repository.service";
import { ClusterExporter } from "./cluster-exporter";
import { FirewallExporter } from "./firewall-exporter";

export class FwCloudExporter extends EntityExporter<FwCloud> {
    constructor(fwCloud: FwCloud) {
        super();
        this.setInstance(fwCloud);
    }

    public async export(): Promise<ExportResult> {
        this._instance = await ( await app().getService<RepositoryService>(RepositoryService.name)).for(FwCloud).findOne(this._instance.id, {relations: [
            'cas', 'clusters', 'firewalls'
        ]});

        const result = new ExportResult();
        result.fwclouds.push(this.exportedEntity());
        
        for(let i = 0; i < this._instance.cas.length; i++) {
            result.merge(await new CaExporter(this._instance.cas[i]).export());
        }

        for(let i = 0; i < this._instance.clusters.length; i++) {
            result.merge(await new ClusterExporter(this._instance.clusters[i]).export());
        }

        for(let i = 0; i < this._instance.firewalls.length; i++) {
            result.merge(await new FirewallExporter(this._instance.firewalls[i]).export());
        }
        
        return result;
    }
    
}