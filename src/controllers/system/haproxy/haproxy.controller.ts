
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
import { SelectQueryBuilder, getRepository } from "typeorm";
import { Validate, ValidateQuery } from "../../../decorators/validate.decorator";
import { Controller } from "../../../fonaments/http/controller";
import { Firewall } from "../../../models/firewall/Firewall";
import { FwCloud } from "../../../models/fwcloud/FwCloud";
import { HAProxyGroup } from "../../../models/system/haproxy/haproxy_g/haproxy_g.model";
import { HAProxyRule } from "../../../models/system/haproxy/haproxy_r/haproxy_r.model";
import { HAProxyRuleService, ICreateHAProxyRule, IUpdateHAProxyRule } from "../../../models/system/haproxy/haproxy_r/haproxy_r.service";
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { HAProxyPolicy } from '../../../policies/haproxy.policy';
import rule from '../../../middleware/joi_schemas/policy/rule';
import { Offset } from '../../../offset';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';
import { HAProxyRuleBulkRemoveDto } from './dto/bulk-remove.dto';
import { HAProxyRuleCopyDto } from './dto/copy.dto';
import { HAProxyRuleCreateDto } from './dto/create.dto';
import { HAProxyRuleUpdateDto } from './dto/update.dto';
import { HAProxyRuleBulkUpdateDto } from './dto/bulk-update.dto';
import { HAProxyMoveFromDto } from './dto/move-from.dto';

export class HaproxyController extends Controller {
    protected _haproxyRuleService: HAProxyRuleService;
    protected _haproxyRule: HAProxyRule;
    protected _haproxyGroup: HAProxyGroup;
    protected _firewall: Firewall;
    protected _fwCloud: FwCloud;

    public async make(request: Request): Promise<void> {
        this._haproxyRuleService = await this._app.getService<HAProxyRuleService>(HAProxyRuleService.name);
        if (request.params.haproxy) {
            this._haproxyRule = await this._haproxyRuleService.findOneInPath({ id: parseInt(request.params.haproxy) });
        }
        if (request.params.haproxygroup) {
            this._haproxyGroup = await getRepository(HAProxyGroup).findOneOrFail(request.params.haproxygroup);
        }
        this._firewall = await getRepository(Firewall).findOneOrFail(request.params.firewall);
        this._fwCloud = await getRepository(FwCloud).findOneOrFail(request.params.fwcloud);
    }

    @Validate()
    public async index(request: Request): Promise<ResponseBuilder> {
        (await HAProxyPolicy.create(this._firewall, request.session.user)).authorize();

        const rules: HAProxyRule[] = await this._haproxyRuleService.getHAProxyRulesData(this._fwCloud.id, this._firewall.id);

        return ResponseBuilder.buildResponse().status(200).body(rules);
    }

    @Validate()
    public async grid(request: Request): Promise<ResponseBuilder> {
        (await HAProxyPolicy.create(this._firewall, request.session.user)).authorize();

        const rules: HAProxyRule[] = await this._haproxyRuleService.getHAProxyRulesData(this._fwCloud.id, this._firewall.id);

        return ResponseBuilder.buildResponse().status(200).body(rules);
    }

    @Validate(HAProxyRuleCreateDto)
    public async create(request: Request): Promise<ResponseBuilder> {
        (await HAProxyPolicy.create(this._firewall, request.session.user)).authorize();

        const data: ICreateHAProxyRule = Object.assign(request.inputs.all<HAProxyRuleCreateDto>(), this._haproxyGroup ? { group: this._haproxyGroup.id } : null);
        const rule: HAProxyRule = await this._haproxyRuleService.store(data);

        return ResponseBuilder.buildResponse().status(201).body(rule);
    }

    @Validate(HAProxyRuleCopyDto)
    public async copy(request: Request): Promise<ResponseBuilder> {
        const ids: number[] = request.inputs.get<number[]>('rules');
        for (const id of ids) {
            const rule: HAProxyRule = await this._haproxyRuleService.findOneInPath({ id });
            (await HAProxyPolicy.show(rule, request.session.user)).authorize();
        }

        const copied: HAProxyRule[] = await this._haproxyRuleService.copy(ids, request.inputs.get('to'), request.inputs.get<Offset>('offset'));

        return ResponseBuilder.buildResponse().status(201).body(copied);
    }

    @Validate(HAProxyRuleUpdateDto)
    public async update(request: Request): Promise<ResponseBuilder> {
        (await HAProxyPolicy.show(this._haproxyRule, request.session.user)).authorize();

        const result: HAProxyRule = await this._haproxyRuleService.update(this._haproxyRule.id, request.inputs.all<IUpdateHAProxyRule>());

        return ResponseBuilder.buildResponse().status(200).body(result);
    }

    @Validate()
    public async remove(request: Request): Promise<ResponseBuilder> {
        (await HAProxyPolicy.show(this._haproxyRule, request.session.user)).authorize();

        await this._haproxyRuleService.remove({ id: this._haproxyRule.id });

        return ResponseBuilder.buildResponse().status(200).body(this._haproxyRule);
    }

    @Validate()
    public async show(request: Request): Promise<ResponseBuilder> {
        (await HAProxyPolicy.show(this._haproxyRule, request.session.user)).authorize();

        return ResponseBuilder.buildResponse().status(200).body(this._haproxyRule);
    }

    @Validate(HAProxyRuleCopyDto)
    public async move(request: Request): Promise<ResponseBuilder> {
        (await HAProxyPolicy.create(this._firewall, request.session.user)).authorize();

        const rules: HAProxyRule[] = await getRepository(HAProxyRule).find({
            join: {
                alias: 'haproxy',
                innerJoin: {
                    firewall: 'rule.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb) => {
                qb.whereInIds(request.inputs.get('rules'))
                    .andWhere('firewall.id = :firewall', { firewall: this._firewall.id })
                    .andWhere('firewall.fwCloudId = :fwcloud', { fwcloud: this._fwCloud.id })
            }
        });

        const result: HAProxyRule[] = await this._haproxyRuleService.move(rules.map(item => item.id), request.inputs.get('to'), request.inputs.get<Offset>('offset'));

        return ResponseBuilder.buildResponse().status(200).body(result);
    }

    @ValidateQuery(HAProxyMoveFromDto)
    async moveFrom(request: Request): Promise<ResponseBuilder> {
        (await HAProxyPolicy.create(this._firewall, request.session.user)).authorize();

        const fromRule: HAProxyRule = await getRepository(HAProxyRule).findOneOrFail({
            join: {
              alias: 'rule',
              innerJoin: {
                firewall: 'rule.firewall',
                fwcloud: 'firewall.fwCloud'
              }
            },
            where: (qb: SelectQueryBuilder<HAProxyRule>): void => {
              qb.whereInIds(request.inputs.get('fromId'))
                .andWhere('firewall.id = :firewall', { firewall: this._firewall.id })
                .andWhere('firewall.fwCloudId = :fwcloud', { fwcloud: this._fwCloud.id })
            }
          });
      
          const toRule: HAProxyRule = await getRepository(HAProxyRule).findOneOrFail({
            join: {
              alias: 'rule',
              innerJoin: {
                firewall: 'rule.firewall',
                fwcloud: 'firewall.fwCloud'
              }
            },
            where: (qb: SelectQueryBuilder<HAProxyRule>): void => {
              qb.whereInIds(request.inputs.get('toId'))
                .andWhere('firewall.id = :firewall', { firewall: this._firewall.id })
                .andWhere('firewall.fwCloudId = :fwcloud', { fwcloud: this._fwCloud.id })
            }
          });
      
          const result: HAProxyRule[] = await this._haproxyRuleService.moveFrom(fromRule.id, toRule.id, request.inputs.all());
      
          return ResponseBuilder.buildResponse().status(200).body(result);
    }

    @Validate()
  public async compile(req: Request): Promise<ResponseBuilder> {
    //TODO: Implement this method

    return ResponseBuilder.buildResponse().status(200).body(null);
  }

  @Validate()
  public async install(req: Request): Promise<ResponseBuilder> {
    //TODO: Implement this method
    return ResponseBuilder.buildResponse().status(200).body(null);
  }

  @Validate(HAProxyRuleBulkUpdateDto)
  public async bulkUpdate(req: Request): Promise<ResponseBuilder> {
    const rules: HAProxyRule[] = [];

    const ids: string[] = req.query.rules as string[] || [];

    for (let id of ids) {
      const rule: HAProxyRule = await this._haproxyRuleService.findOneInPath({
        fwcloudId: this._fwCloud.id,
        firewallId: this._firewall.id,
        id: parseInt(id),
      });

      (await HAProxyPolicy.show(rule, req.session.user)).authorize();

      rules.push(rule);
    }

    if (!rules.length) {
      throw new HttpException(`No rules found`, 400);
    }

    const result: HAProxyRule[] = await this._haproxyRuleService.bulkUpdate(rules.map(item => item.id), req.inputs.all<IUpdateHAProxyRule>());

    return ResponseBuilder.buildResponse().status(200).body(result);
  }

  @Validate()
  @ValidateQuery(HAProxyRuleBulkRemoveDto)
  public async bulkRemove(req: Request): Promise<ResponseBuilder> {
    const rules: HAProxyRule[] = [];

    const ids: number[] = req.query.rules as unknown as number[] || [];

    for (let id of ids) {
      const rule: HAProxyRule = await this._haproxyRuleService.findOneInPath({
        fwcloudId: this._fwCloud.id,
        firewallId: this._firewall.id,
        id,
      });

      (await HAProxyPolicy.show(rule, req.session.user)).authorize();

      rules.push(rule);
    }

    if (!rules.length) {
      throw new HttpException(`No rules found to be removed`, 400);
    }

    const result: HAProxyRule[] = await this._haproxyRuleService.bulkRemove(rules.map(item => item.id));

    return ResponseBuilder.buildResponse().status(200).body(result);
  }
}