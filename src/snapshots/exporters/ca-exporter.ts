import { EntityExporter } from "./entity-exporter";
import { Ca } from "../../models/vpn/pki/Ca";
import { SnapshotData } from "../snapshot-data";
import { RepositoryService } from "../../database/repository.service";
import { CrtExporter } from "./crt-exporter";
import { app } from "../../fonaments/abstract-application";

export class CaExporter extends EntityExporter<Ca> {
    public async exportEntity(): Promise<SnapshotData> {
        this._instance = await ( await app().getService<RepositoryService>(RepositoryService.name)).for(Ca).findOne(this._instance.id, {relations: [
            'crts'
        ]});
        
        this._result.addItem(Ca, this.exportToJSON());
        
        for(let i = 0; i < this._instance.crts.length; i++) {
            this._result.merge(await new CrtExporter(this._result, this._instance.crts[i]).exportEntity());
        }
    
        return this._result;
    }
}