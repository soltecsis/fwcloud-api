import { EntityImporter } from "./entity-importer";
import { Firewall } from "../../models/firewall/Firewall";
import { Repository, DeepPartial } from "typeorm";
import { ImportMapping } from "../import-mapping";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { FwcTree } from "../../models/tree/fwc-tree.model";
import { IPObj } from "../../models/ipobj/IPObj";

export class IPObjImporter extends EntityImporter {
    public repository: Repository<IPObj>;

    public async import(data: DeepPartial<IPObj>, mapper: ImportMapping): Promise<void> {
        this.repository = this.repositoryService.for(IPObj);
        
        const old_id: number = data.id;
        delete data.id;

        data.fwCloud.id = mapper.getItem(FwCloud, data.fwCloud.id);

        let item: IPObj = this.repository.create(data);
        item = await this.repository.save(item);

        const new_id: number = item.id;

        mapper.newItem(IPObj, old_id, new_id);
    }
}