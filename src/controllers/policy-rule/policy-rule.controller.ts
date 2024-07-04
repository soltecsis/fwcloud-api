import { NotFoundException } from './../../fonaments/exceptions/not-found-exception';
import { Validate } from '../../decorators/validate.decorator';
import { app } from '../../fonaments/abstract-application';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { Firewall } from '../../models/firewall/Firewall';
import { FwCloud } from '../../models/fwcloud/FwCloud';
import { PolicyRuleService } from '../../policy-rule/policy-rule.service';
import { Request } from 'express';
import { PolicyRulePolicy } from '../../policies/policy-rule.policy';
import db from '../../database/database-manager';

export class PolicyRuleController extends Controller {
  protected _PolicyRuleService: PolicyRuleService;
  protected _firewall: Firewall;
  protected _fwCloud: FwCloud;

  async make(req: Request): Promise<void> {
    this._PolicyRuleService = await app().getService<PolicyRuleService>(PolicyRuleService.name);

    const firewallQueryBuilder = db
      .getSource()
      .manager.getRepository(Firewall)
      .createQueryBuilder('firewall')
      .where('firewall.id = :id', { id: parseInt(req.params.firewall) });

    this._firewall = await firewallQueryBuilder.getOneOrFail();

    this._fwCloud = await db
      .getSource()
      .manager.getRepository(FwCloud)
      .createQueryBuilder('fwcloud')
      .innerJoin('fwcloud.firewalls', 'firewall', 'firewall.id = :firewallId', {
        firewallId: parseInt(req.params.firewall),
      })
      .where('fwcloud.id = :id', { id: parseInt(req.params.fwcloud) })
      .getOneOrFail();
  }

  @Validate()
  public async read(request: Request): Promise<ResponseBuilder> {
    (await PolicyRulePolicy.read(this._firewall, request.session.user)).authorize();
    try {
      const content: string = await this._PolicyRuleService.content(
        this._fwCloud.id,
        this._firewall.id,
      );
      return ResponseBuilder.buildResponse().status(200).body(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException('script not found');
      }
      throw error;
    }
  }
  @Validate()
  public async download(request: Request): Promise<ResponseBuilder> {
    (await PolicyRulePolicy.download(this._firewall, request.session.user)).authorize();

    const content: string = await this._PolicyRuleService.content(
      this._fwCloud.id,
      this._firewall.id,
    );

    return ResponseBuilder.buildResponse().status(200).downloadContent(content);
  }
}
