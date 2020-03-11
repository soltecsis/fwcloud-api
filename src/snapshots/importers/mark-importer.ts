import { EntityImporter } from "./entity-importer";
import { Repository, DeepPartial } from "typeorm";
import { ImportMapping } from "../import-mapping";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { Mark } from "../../models/ipobj/Mark";

export class MarkImporter extends EntityImporter {
    public repository: Repository<Mark>;

    public async import(data: DeepPartial<Mark>, mapper: ImportMapping): Promise<void> {
        this.repository = this.repositoryService.for(Mark);
        
        const old_id: number = data.id;
        delete data.id;

        data.fwCloud.id = mapper.getItem(FwCloud, data.fwCloud.id);

        let item: Mark = this.repository.create(data);
        item = await this.repository.save(item);

        const new_id: number = item.id;

        mapper.newItem(Mark, old_id, new_id);
    }
}