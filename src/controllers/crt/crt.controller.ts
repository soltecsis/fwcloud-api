import { FwCloud } from './../../models/fwcloud/FwCloud';
import { ResponseBuilder } from './../../fonaments/http/response-builder';
import { Request } from 'express';
import { CrtService } from '../../crt/crt.service';
import { Controller } from '../../fonaments/http/controller';
import { Ca } from '../../models/vpn/pki/Ca';
import { Crt } from '../../models/vpn/pki/Crt';
import { Validate } from '../../decorators/validate.decorator';
import { CrtPolicy } from '../../policies/crt.policy';
import { CrtControllerUpdateDto } from './dtos/update.dto';
import db from '../../database/database-manager';

export class CrtController extends Controller {
  protected CrtService: CrtService;
  protected _crt: Crt;
  protected _ca: Ca;
  protected _fwCloud: FwCloud;

  public async make(request: Request): Promise<void> {
    this.CrtService = await this._app.getService<CrtService>(CrtService.name);
    if (request.params.crt) {
      this._crt = await db
        .getSource()
        .manager.getRepository(Crt)
        .findOneOrFail({ where: { id: parseInt(request.params.crt) } });
    }
    this._ca = await db
      .getSource()
      .manager.getRepository(Ca)
      .createQueryBuilder('ca')
      .where('ca.id = :id', { id: parseInt(request.params.ca) })
      .getOneOrFail();
    this._fwCloud = await db
      .getSource()
      .manager.getRepository(FwCloud)
      .createQueryBuilder('fwcloud')
      .innerJoin('fwcloud.cas', 'ca', 'ca.id = :caId', {
        caId: parseInt(request.params.ca),
      })
      .where('fwcloud.id = :id', { id: parseInt(request.params.fwcloud) })
      .getOneOrFail();
  }

  @Validate(CrtControllerUpdateDto)
  public async update(request: Request): Promise<ResponseBuilder> {
    (await CrtPolicy.update(this._crt, request.session.user)).authorize();

    const crt: Crt = await this.CrtService.update(this._crt.id, {
      comment: request.body.comment,
    });

    return ResponseBuilder.buildResponse().status(200).body(crt);
  }
}
