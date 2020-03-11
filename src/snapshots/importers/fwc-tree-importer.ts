import { EntityImporter } from "./entity-importer";
import { Firewall } from "../../models/firewall/Firewall";
import { Repository, DeepPartial } from "typeorm";
import { ImportMapping } from "../import-mapping";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { FwcTree } from "../../models/tree/fwc-tree.model";

export class FwcTreeImporter extends EntityImporter {
    public repository: Repository<FwcTree>;

    public async import(data: DeepPartial<FwcTree>, mapper: ImportMapping): Promise<void> {
        this.repository = this.repositoryService.for(FwcTree);
        
        const old_id: number = data.id;
        delete data.id;

        data.fwCloud.id = mapper.getItem(FwCloud, data.fwCloud.id);

        let item: FwcTree = this.repository.create(data);
        item = await this.repository.save(item);

        const new_id: number = item.id;

        mapper.newItem(FwcTree, old_id, new_id);
    }
}