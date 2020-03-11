import { DeepPartial, Repository } from "typeorm";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { EntityImporter } from "./entity-importer";
import { ImportMapping } from "../import-mapping";
import { User } from "../../models/user/User";

export class FwCloudImporter extends EntityImporter {

    public fwcloudRepository: Repository<FwCloud>;

    public async import(data: DeepPartial<FwCloud>, mapper: ImportMapping, user: User): Promise<void> {
        this.fwcloudRepository = this.repositoryService.for(FwCloud);
        const old_id: number = data.id;
        delete data.id;

        let fwcloud: FwCloud = this.fwcloudRepository.create(data);
        fwcloud.users = [user];
        fwcloud = await this.fwcloudRepository.save(fwcloud);

        const new_id: number = fwcloud.id;

        mapper.newItem(FwCloud, old_id, new_id);
    }
}