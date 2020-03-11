import { FwCloud } from "../../models/fwcloud/FwCloud";
import { EntityExporter } from "./entity-exporter";
import { CaExporter } from "./ca-exporter";
import { SnapshotData } from "../snapshot-data";
import { app } from "../../fonaments/abstract-application";
import { RepositoryService } from "../../database/repository.service";
import { ClusterExporter } from "./cluster-exporter";
import { FirewallExporter } from "./firewall-exporter";
import { FwcTreeExporter } from "./fwc-tree-exporter";
import { IPObjExporter } from "./ip-obj-exporter";
import { MarkExporter } from "./mark-exporter";

export class FwCloudExporter extends EntityExporter<FwCloud> {
    protected async exportEntity(): Promise<SnapshotData> {
        this._instance = await ( await app().getService<RepositoryService>(RepositoryService.name)).for(FwCloud).findOne(this._instance.id, {relations: [
            'cas', 'clusters', 'firewalls', 'fwcTrees', 'ipObjs', 'marks'
        ]});

        this._result.addItem(FwCloud, this.exportToJSON());
        
        for(let i = 0; i < this._instance.cas.length; i++) {
            this._result.merge(await new CaExporter(this._result, this._instance.cas[i]).exportEntity());
        }

        for(let i = 0; i < this._instance.clusters.length; i++) {
            this._result.merge(await new ClusterExporter(this._result, this._instance.clusters[i]).exportEntity());
        }

        for(let i = 0; i < this._instance.firewalls.length; i++) {
            this._result.merge(await new FirewallExporter(this._result, this._instance.firewalls[i]).exportEntity());
        }

        for(let i = 0; i < this._instance.fwcTrees.length; i++) {
            this._result.merge(await new FwcTreeExporter(this._result, this._instance.fwcTrees[i]).exportEntity());
        }

        for(let i = 0; i < this._instance.ipObjs.length; i++) {
            if(!this._instance.ipObjs[i].isStandard()) {
                this._result.merge(await new IPObjExporter(this._result, this._instance.ipObjs[i]).exportEntity());
            }
        }

        for(let i = 0; i < this._instance.marks.length; i++) {
            this._result.merge(await new MarkExporter(this._result, this._instance.marks[i]).exportEntity());
        }
            
        return this._result;
    }
    
}