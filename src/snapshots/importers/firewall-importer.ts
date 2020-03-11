import { EntityImporter } from "./entity-importer";
import { Firewall } from "../../models/firewall/Firewall";
import { Repository, DeepPartial } from "typeorm";
import { ImportMapping } from "../import-mapping";
import { FwCloud } from "../../models/fwcloud/FwCloud";

export class FirewallImporter extends EntityImporter {
    public repository: Repository<Firewall>;

    public async import(data: DeepPartial<Firewall>, mapper: ImportMapping): Promise<void> {
        this.repository = this.repositoryService.for(Firewall);
        
        const old_id: number = data.id;
        delete data.id;
        data.status = 0;

        data.fwcloud.id = mapper.getItem(FwCloud, data.fwcloud.id);

        let item: Firewall = this.repository.create(data);
        item = await this.repository.save(item);

        const new_id: number = item.id;

        mapper.newItem(Firewall, old_id, new_id);
    }
}