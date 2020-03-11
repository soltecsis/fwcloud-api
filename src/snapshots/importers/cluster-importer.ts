import { Repository, DeepPartial } from "typeorm";
import { ImportMapping } from "../import-mapping";
import { EntityImporter } from "./entity-importer";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { Cluster } from "../../models/firewall/Cluster";

export class ClusterImporter extends EntityImporter {

    public repository: Repository<Cluster>;

    public async import(data: DeepPartial<Cluster>, mapper: ImportMapping): Promise<void> {
        this.repository = this.repositoryService.for(Cluster);
        
        const old_id: number = data.id;
        delete data.id;

        data.fwcloud.id = mapper.getItem(FwCloud, data.fwcloud.id);

        

        let item: Cluster = this.repository.create(data);
        item = await this.repository.save(item);

        const new_id: number = item.id;

        mapper.newItem(Cluster, old_id, new_id);
    }
    
}