import { Ca } from "../../models/vpn/pki/Ca";
import { Repository, DeepPartial } from "typeorm";
import { ImportMapping } from "../import-mapping";
import { EntityImporter } from "./entity-importer";
import { FwCloud } from "../../models/fwcloud/FwCloud";

export class CaImporter extends EntityImporter {

    public caRepository: Repository<Ca>;

    public async import(data: DeepPartial<Ca>, mapper: ImportMapping): Promise<void> {
        this.caRepository = this.repositoryService.for(Ca);
        
        const old_id: number = data.id;
        delete data.id;

        data.fwcloud.id = mapper.getItem(FwCloud, data.fwcloud.id);

        

        let ca: Ca = this.caRepository.create(data);
        ca = await this.caRepository.save(ca);

        const new_id: number = ca.id;

        mapper.newItem(Ca, old_id, new_id);
    }
    
}