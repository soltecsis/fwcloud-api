import { ResponseBuilder } from './../../fonaments/http/response-builder';
import { Request } from 'express';
import { getRepository } from 'typeorm';
import { CaService } from '../../ca/ca.service';
import { Controller } from '../../fonaments/http/controller';
import { FwCloud } from '../../models/fwcloud/FwCloud';
import { Ca } from '../../models/vpn/pki/Ca';
import { Validate } from '../../decorators/validate.decorator';
import { CaPolicy } from '../../policies/ca.policy';
import { CaControllerUpdateDto } from './dtos/update.dto';

export class CaController extends Controller {
    
    protected CaService: CaService;
    protected _ca: Ca;
    protected _fwCloud: FwCloud;
    

    public async make(request: Request): Promise<void> {

        this.CaService = await this._app.getService<CaService>(CaService.name);
        if(request.params.ca){
            this._ca = await getRepository(Ca).findOneOrFail(request.params.ca)
        }
        //Get the fwcloud wich contains the ca
        this._fwCloud = await getRepository(FwCloud).createQueryBuilder('fwcloud')
            .where('fwcloud.id = :id', {id: parseInt(request.params.fwcloud)})
            .getOneOrFail();
    }
    @Validate(CaControllerUpdateDto)
    public async update(request: Request): Promise<ResponseBuilder> {

        (await CaPolicy.update(this._ca, request.session.user)).authorize();
        
        const ca: Ca = await this.CaService.update(this._ca.id, {comment:request.body.comment}) 
        
        return ResponseBuilder.buildResponse().status(200).body(ca)
    }
    
}