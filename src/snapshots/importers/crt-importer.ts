import { Ca } from "../../models/vpn/pki/Ca";
import { Repository, DeepPartial } from "typeorm";
import { ImportMapping } from "../import-mapping";
import { EntityImporter } from "./entity-importer";
import { Crt } from "../../models/vpn/pki/Crt";

export class CrtImporter extends EntityImporter {

    public caRepository: Repository<Crt>;

    public async import(data: DeepPartial<Crt>, mapper: ImportMapping): Promise<void> {
        this.caRepository = this.repositoryService.for(Crt);
        
        const old_id: number = data.id;
        delete data.id;

        data.ca.id = mapper.getItem(Ca, data.ca.id);

        

        let crt: Crt = this.caRepository.create(data);
        crt = await this.caRepository.save(crt);

        const new_id: number = crt.id;

        mapper.newItem(Crt, old_id, new_id);
    }
    
}