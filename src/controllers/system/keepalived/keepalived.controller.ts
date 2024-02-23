/*!
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/
import { Request } from 'express';
import { Controller } from '../../../fonaments/http/controller';
import { Validate, ValidateQuery } from "../../../decorators/validate.decorator";
import { KeepalivedPolicy } from '../../../policies/keepalived.policy';
import { KeepalivedRule } from '../../../models/system/keepalived/keepalived_r/keepalived_r.model';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { KeepalivedGroup } from '../../../models/system/keepalived/keepalived_g/keepalived_g.model';
import { Firewall } from '../../../models/firewall/Firewall';
import { FwCloud } from "../../../models/fwcloud/FwCloud";
import { getRepository, SelectQueryBuilder } from 'typeorm';
import { KeepalivedRuleService, KeepalivedRulesData, ICreateKeepalivedRule, IUpdateKeepalivedRule } from '../../../models/system/keepalived/keepalived_r/keepalived_r.service';
import { KeepalivedRuleCreateDto } from './dto/create.dto';
import { Offset } from '../../../offset';
import { KeepalivedRuleCopyDto } from './dto/copy.dto';
import { KeepalivedRuleUpdateDto } from './dto/update.dto';
import { KeepalivedRuleBulkUpdateDto } from './dto/bulk-update.dto';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';
import { KeepalivedRuleBulkRemoveDto } from './dto/bulk-remove.dto';
import { AvailableDestinations, KeepalivedRuleItemForCompiler } from '../../../models/system/keepalived/shared';
import { KeepalivedMoveFromDto } from './dto/move-from.dto';


export class KeepalivedController extends Controller {
  protected _keepalivedRuleService: KeepalivedRuleService;
  protected _keepalivedrule: KeepalivedRule;
  protected _keepalivedgroup: KeepalivedGroup;
  protected _firewall: Firewall;
  protected _fwCloud: FwCloud;

  public async make(req: Request): Promise<void> {
    this._keepalivedRuleService = await this._app.getService<KeepalivedRuleService>(KeepalivedRuleService.name);

    if (req.params.keepalived) {
      this._keepalivedrule = await getRepository(KeepalivedRule).findOneOrFail(req.params.keepalived);
    }
    if (req.params.keepalivedgroup) {
      this._keepalivedgroup = await getRepository(KeepalivedGroup).findOneOrFail(this._keepalivedrule.group.id);
    }
    this._firewall = await getRepository(Firewall).findOneOrFail(req.params.firewall);
    this._fwCloud = await getRepository(FwCloud).findOneOrFail(req.params.fwcloud);
  }


  @Validate()
  /**
   * Retrieves a list of keepalived configurations.
   * 
   * @param req - The request object.
   * @param res - The response object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  public async index(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.index(this._firewall, req.session.user)).authorize();

    const keepalivedG: KeepalivedRule[] = await this._keepalivedRuleService.getKeepalivedRulesData('compiler', this._fwCloud.id, this._firewall.id);

    return ResponseBuilder.buildResponse().status(200).body(keepalivedG);
  }

  @Validate()
  /**
   * Retrieves the grid data for keepalived.
   * 
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  public async grid(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.index(this._firewall, req.session.user)).authorize();

    const grid: KeepalivedRule[] = await this._keepalivedRuleService.getKeepalivedRulesData('keepalived_grid', this._fwCloud.id, this._firewall.id);

    return ResponseBuilder.buildResponse().status(200).body(grid);
  }

  @Validate(KeepalivedRuleCreateDto)
  /**
   * Creates a new Keepalived rule.
   * 
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  public async create(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.create(this._firewall, req.session.user)).authorize();

    const data: ICreateKeepalivedRule = Object.assign(req.inputs.all<KeepalivedRuleCreateDto>(), this._keepalivedgroup ? { group: this._keepalivedgroup.id } : null);
    const keepalivedRule: KeepalivedRule = await this._keepalivedRuleService.store(data);

    return ResponseBuilder.buildResponse().status(201).body(keepalivedRule);
  }

  @Validate(KeepalivedRuleCopyDto)
  /**
   * Copies the Keepalived rules specified by the given IDs.
   * 
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  public async copy(req: Request): Promise<ResponseBuilder> {
    const ids: number[] = req.inputs.get('rules');
    for (const id of ids) {
      const rule: KeepalivedRule = await getRepository(KeepalivedRule).findOneOrFail(id);
      (await KeepalivedPolicy.copy(rule, req.session.user)).authorize();
    }

    const created: KeepalivedRule[] = await this._keepalivedRuleService.copy(ids, req.inputs.get('to'), req.inputs.get<Offset>('offset'));
    return ResponseBuilder.buildResponse().status(201).body(created);
  }

  @Validate(KeepalivedRuleUpdateDto)
  /**
   * Updates the keepalived rule.
   * 
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  public async update(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.update(this._keepalivedrule, req.session.user)).authorize();

    const result: KeepalivedRule = await this._keepalivedRuleService.update(this._keepalivedrule.id, req.inputs.all<IUpdateKeepalivedRule>());

    return ResponseBuilder.buildResponse().status(200).body(result);
  }

  @Validate()
  /**
   * Removes a keepalived rule.
   * 
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  public async remove(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.delete(this._keepalivedrule, req.session.user)).authorize();

    await this._keepalivedRuleService.remove({
      fwcloudId: this._fwCloud.id,
      firewallId: this._firewall.id,
      id: parseInt(req.params.keepalived),
    });

    return ResponseBuilder.buildResponse().status(200).body(this._keepalivedrule);
  }

  @Validate()
  /**
   * Retrieves the keepalived rule and returns it as a response.
   * 
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  public async show(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.show(this._keepalivedrule, req.session.user)).authorize();

    return ResponseBuilder.buildResponse().status(200).body(this._keepalivedrule);
  }

  @Validate(KeepalivedRuleCopyDto)
  /**
   * Moves the Keepalived rules to a different location.
   * 
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  public async move(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.move(this._firewall, req.session.user)).authorize();

    const rules: KeepalivedRule[] = await getRepository(KeepalivedRule).find({
      join: {
        alias: 'rule',
        innerJoin: {
          firewall: 'rule.firewall',
          fwcloud: 'firewall.fwCloud'
        }
      },
      where: (qb: SelectQueryBuilder<KeepalivedRule>) => {
        qb.whereInIds(req.inputs.get('rules'))
          .andWhere('firewall.id = :firewall', { firewall: this._firewall.id })
          .andWhere('firewall.fwCloudId = :fwcloud', { fwcloud: this._fwCloud.id })
      }
    });

    const result: KeepalivedRule[] = await this._keepalivedRuleService.move(rules.map(item => item.id), req.inputs.get('to'), req.inputs.get<Offset>('offset'));

    return ResponseBuilder.buildResponse().status(200).body(result);
  }

  @Validate(KeepalivedMoveFromDto)
  async moveFrom(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.move(this._firewall, req.session.user)).authorize();

    const fromRule: KeepalivedRule = await getRepository(KeepalivedRule).findOneOrFail({
      join: {
        alias: 'rule',
        innerJoin: {
          firewall: 'rule.firewall',
          fwcloud: 'firewall.fwCloud'
        }
      },
      where: (qb: SelectQueryBuilder<KeepalivedRule>) => {
        qb.whereInIds(req.inputs.get('fromId'))
          .andWhere('firewall.id = :firewall', { firewall: this._firewall.id })
          .andWhere('firewall.fwCloudId = :fwcloud', { fwcloud: this._fwCloud.id })
      }
    });

    const toRule: KeepalivedRule = await getRepository(KeepalivedRule).findOneOrFail({
      join: {
        alias: 'rule',
        innerJoin: {
          firewall: 'rule.firewall',
          fwcloud: 'firewall.fwCloud'
        }
      },
      where: (qb: SelectQueryBuilder<KeepalivedRule>) => {
        qb.whereInIds(req.inputs.get('toId'))
          .andWhere('firewall.id = :firewall', { firewall: this._firewall.id })
          .andWhere('firewall.fwCloudId = :fwcloud', { fwcloud: this._fwCloud.id })
      }
    });

    const result: KeepalivedRule[] = await this._keepalivedRuleService.moveFrom(fromRule, toRule, req.inputs.get('ipObjId'));

    return ResponseBuilder.buildResponse().status(200).body(result);
  }

  @Validate()
  public async compile(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.create(this._firewall, req.session.user)).authorize();
    return ResponseBuilder.buildResponse().status(200);
  }

  //TODO: Install
  @Validate()
  public async install(req: Request): Promise<ResponseBuilder> {
    return ResponseBuilder.buildResponse().status(200);
  }

  @Validate(KeepalivedRuleBulkUpdateDto)
  /**
   * Updates multiple Keepalived rules in bulk.
   * 
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   * @throws HttpException if no rules are found.
   */
  public async bulkUpdate(req: Request): Promise<ResponseBuilder> {
    const rules: KeepalivedRule[] = [];

    const ids: string[] = req.query.rules as string[] || [];

    for (let id of ids) {
      const rule: KeepalivedRule = await this._keepalivedRuleService.findOneInPath({
        fwcloudId: this._fwCloud.id,
        firewallId: this._firewall.id,
        id: parseInt(id),
      });

      (await KeepalivedPolicy.update(rule, req.session.user)).authorize();

      rules.push(rule);
    }

    if (!rules.length) {
      throw new HttpException(`No rules found`, 400);
    }

    const result: KeepalivedRule[] = await this._keepalivedRuleService.bulkUpdate(rules.map(item => item.id), req.inputs.all<IUpdateKeepalivedRule>());

    return ResponseBuilder.buildResponse().status(200).body(result);
  }

  @Validate()
  @ValidateQuery(KeepalivedRuleBulkRemoveDto)
  /**
   * Removes multiple Keepalived rules in bulk.
   * 
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   * @throws HttpException if no rules are found to be removed.
   */
  public async bulkRemove(req: Request): Promise<ResponseBuilder> {
    const rules: KeepalivedRule[] = [];

    const ids: number[] = req.query.rules as unknown as number[] || [];

    for (let id of ids) {
      const rule: KeepalivedRule = await this._keepalivedRuleService.findOneInPath({
        fwcloudId: this._fwCloud.id,
        firewallId: this._firewall.id,
        id,
      });

      (await KeepalivedPolicy.delete(rule, req.session.user)).authorize();

      rules.push(rule);
    }

    if (!rules.length) {
      throw new HttpException(`No rules found to be removed`, 400);
    }

    const result: KeepalivedRule[] = await this._keepalivedRuleService.bulkRemove(rules.map(item => item.id));

    return ResponseBuilder.buildResponse().status(200).body(result);
  }
}
