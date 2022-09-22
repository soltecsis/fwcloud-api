import { getRepository, Repository } from 'typeorm';
import { Application } from './../cli/Application';
import { Service } from "../fonaments/services/service";
import { Ca } from '../models/vpn/pki/Ca';

interface IUpdateCa {
    comment?: string;
}

export class CaService extends Service {

    protected _repository: Repository<Ca>;
    
    constructor(app: Application) {
        super(app);
        this._repository = getRepository(Ca);
    }

    public async update(id:number, data: IUpdateCa): Promise<Ca> {

        let ca: Ca = await this._repository.preload(Object.assign({comment: data.comment}, {id}));
        
        ca = await this._repository.save(ca);

        return ca;
    }
}