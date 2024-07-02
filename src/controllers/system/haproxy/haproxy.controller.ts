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
import {
  Validate,
  ValidateQuery,
} from '../../../decorators/validate.decorator';
import { Controller } from '../../../fonaments/http/controller';
import { Firewall } from '../../../models/firewall/Firewall';
import { FwCloud } from '../../../models/fwcloud/FwCloud';
import { HAProxyGroup } from '../../../models/system/haproxy/haproxy_g/haproxy_g.model';
import { HAProxyRule } from '../../../models/system/haproxy/haproxy_r/haproxy_r.model';
import {
  HAProxyRuleService,
  HAProxyRulesData,
  ICreateHAProxyRule,
  IUpdateHAProxyRule,
} from '../../../models/system/haproxy/haproxy_r/haproxy_r.service';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { HAProxyPolicy } from '../../../policies/haproxy.policy';
import { Offset } from '../../../offset';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';
import { HAProxyRuleBulkRemoveDto } from './dto/bulk-remove.dto';
import { HAProxyRuleCopyDto } from './dto/copy.dto';
import { HAProxyRuleCreateDto } from './dto/create.dto';
import { HAProxyRuleUpdateDto } from './dto/update.dto';
import { HAProxyRuleBulkUpdateDto } from './dto/bulk-update.dto';
import { HAProxyMoveFromDto } from './dto/move-from.dto';
import { HAProxyRuleItemForCompiler } from '../../../models/system/haproxy/shared';
import { HAProxyCompiler } from '../../../compiler/system/haproxy/HAProxyCompiler';
import { Channel } from '../../../sockets/channels/channel';
import { Communication } from '../../../communications/communication';
import { ProgressPayload } from '../../../sockets/messages/socket-message';
import db from '../../../database/database-manager';

export class HAProxyController extends Controller {
  protected _haproxyRuleService: HAProxyRuleService;
  protected _haproxyRule: HAProxyRule;
  protected _haproxyGroup: HAProxyGroup;
  protected _firewall: Firewall;
  protected _fwCloud: FwCloud;

  public async make(request: Request): Promise<void> {
    this._haproxyRuleService = await this._app.getService<HAProxyRuleService>(
      HAProxyRuleService.name,
    );
    if (request.params.haproxy) {
      this._haproxyRule = await await db
        .getSource()
        .manager.getRepository(HAProxyRule)
        .findOneOrFail({ where: { id: parseInt(request.params.haproxy) } });
    }
    if (request.params.haproxygroup) {
      this._haproxyGroup = await await db
        .getSource()
        .manager.getRepository(HAProxyGroup)
        .findOneOrFail({
          where: { id: parseInt(request.params.haproxygroup) },
        });
    }
    this._firewall = await await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({ where: { id: parseInt(request.params.firewall) } });
    this._fwCloud = await await db
      .getSource()
      .manager.getRepository(FwCloud)
      .findOneOrFail({ where: { id: parseInt(request.params.fwcloud) } });
  }

  @Validate()
  public async index(request: Request): Promise<ResponseBuilder> {
    (
      await HAProxyPolicy.create(this._firewall, request.session.user)
    ).authorize();

    const rules: HAProxyRule[] =
      await this._haproxyRuleService.getHAProxyRulesData(
        'compiler',
        this._fwCloud.id,
        this._firewall.id,
      );

    return ResponseBuilder.buildResponse().status(200).body(rules);
  }

  @Validate()
  public async grid(request: Request): Promise<ResponseBuilder> {
    (
      await HAProxyPolicy.create(this._firewall, request.session.user)
    ).authorize();

    const rules: HAProxyRule[] =
      await this._haproxyRuleService.getHAProxyRulesData(
        'haproxy_grid',
        this._fwCloud.id,
        this._firewall.id,
      );

    return ResponseBuilder.buildResponse().status(200).body(rules);
  }

  @Validate(HAProxyRuleCreateDto)
  public async create(request: Request): Promise<ResponseBuilder> {
    (
      await HAProxyPolicy.create(this._firewall, request.session.user)
    ).authorize();

    const data: ICreateHAProxyRule = Object.assign(
      request.inputs.all<HAProxyRuleCreateDto>(),
      this._haproxyGroup ? { group: this._haproxyGroup.id } : null,
    );
    try {
      const rule: HAProxyRule = await this._haproxyRuleService.store(data);

      return ResponseBuilder.buildResponse().status(201).body(rule);
    } catch (err) {
      return ResponseBuilder.buildResponse()
        .status(422)
        .body({ message: err.message });
    }
  }

  @Validate(HAProxyRuleCopyDto)
  public async copy(request: Request): Promise<ResponseBuilder> {
    const ids: number[] = request.inputs.get<number[]>('rules');
    for (const id of ids) {
      const rule: HAProxyRule = await await db
        .getSource()
        .manager.getRepository(HAProxyRule)
        .findOneOrFail({ where: { id: id } });
      (await HAProxyPolicy.show(rule, request.session.user)).authorize();
    }

    const copied: HAProxyRule[] = await this._haproxyRuleService.copy(
      ids,
      request.inputs.get('to'),
      request.inputs.get<Offset>('offset'),
    );

    return ResponseBuilder.buildResponse().status(201).body(copied);
  }

  @Validate(HAProxyRuleUpdateDto)
  public async update(request: Request): Promise<ResponseBuilder> {
    (
      await HAProxyPolicy.show(this._haproxyRule, request.session.user)
    ).authorize();
    try {
      const result: HAProxyRule = await this._haproxyRuleService.update(
        this._haproxyRule.id,
        request.inputs.all<IUpdateHAProxyRule>(),
      );

      return ResponseBuilder.buildResponse().status(200).body(result);
    } catch (err) {
      return ResponseBuilder.buildResponse()
        .status(422)
        .body({ message: err.message });
    }
  }

  @Validate()
  public async remove(request: Request): Promise<ResponseBuilder> {
    (
      await HAProxyPolicy.show(this._haproxyRule, request.session.user)
    ).authorize();

    await this._haproxyRuleService.remove({
      fwcloudId: this._fwCloud.id,
      firewallId: this._firewall.id,
      id: parseInt(request.params.haproxy),
    });

    return ResponseBuilder.buildResponse().status(200).body(this._haproxyRule);
  }

  @Validate()
  public async show(request: Request): Promise<ResponseBuilder> {
    (
      await HAProxyPolicy.show(this._haproxyRule, request.session.user)
    ).authorize();

    return ResponseBuilder.buildResponse().status(200).body(this._haproxyRule);
  }

  @Validate(HAProxyRuleCopyDto)
  public async move(request: Request): Promise<ResponseBuilder> {
    (
      await HAProxyPolicy.create(this._firewall, request.session.user)
    ).authorize();

    const rules: HAProxyRule[] = await await db
      .getSource()
      .manager.getRepository(HAProxyRule)
      .find({
        where: {
          firewall: {
            id: this._firewall.id,
            fwCloudId: this._fwCloud.id,
          },
        },
      });

    const result: HAProxyRule[] = await this._haproxyRuleService.move(
      rules.map((item) => item.id),
      request.inputs.get('to'),
      request.inputs.get<Offset>('offset'),
    );

    return ResponseBuilder.buildResponse().status(200).body(result);
  }

  @Validate(HAProxyMoveFromDto)
  async moveFrom(request: Request): Promise<ResponseBuilder> {
    (
      await HAProxyPolicy.create(this._firewall, request.session.user)
    ).authorize();

    const result: HAProxyRule[] = await this._haproxyRuleService.moveFrom(
      request.inputs.get('fromId'),
      request.inputs.get('toId'),
      request.inputs.all(),
    );

    return ResponseBuilder.buildResponse().status(200).body(result);
  }

  @Validate()
  public async compile(req: Request): Promise<ResponseBuilder> {
    (await HAProxyPolicy.create(this._firewall, req.session.user)).authorize();

    const rules: HAProxyRulesData<HAProxyRuleItemForCompiler>[] =
      await this._haproxyRuleService.getHAProxyRulesData(
        'compiler',
        this._fwCloud.id,
        this._firewall.id,
        [this._haproxyRule.id],
      );

    new HAProxyCompiler().compile(rules);

    return ResponseBuilder.buildResponse().status(200).body(null);
  }

  @Validate()
  public async install(req: Request): Promise<ResponseBuilder> {
    const channel: Channel = await Channel.fromRequest(req);
    let firewallId: number;

    const firewall: Firewall = await await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({ where: { id: this._firewall.id } });
    if (firewall.clusterId) {
      firewallId = (
        await await db
          .getSource()
          .manager.getRepository(Firewall)
          .createQueryBuilder('firewall')
          .where('firewall.clusterId = :clusterId', {
            clusterId: firewall.clusterId,
          })
          .andWhere('firewall.fwmaster = 1')
          .getOneOrFail()
      ).id;
    } else {
      firewallId = firewall.id;
    }

    const rules: HAProxyRulesData<HAProxyRuleItemForCompiler>[] =
      await this._haproxyRuleService.getHAProxyRulesData(
        'compiler',
        this._fwCloud.id,
        firewallId,
      );

    const content: string = new HAProxyCompiler()
      .compile(rules, channel)
      .map((item) => item.cs)
      .join('\n');

    const communication: Communication<unknown> =
      await firewall.getCommunication();

    channel.emit(
      'message',
      new ProgressPayload('start', false, 'Installing HAProxy rules'),
    );

    await communication.installHAPRoxyConfigs(
      '/etc/haproxy',
      [{ name: 'haproxy.cfg', content: content }],
      channel,
    );

    channel.emit(
      'message',
      new ProgressPayload('end', false, 'Installing HAProxy rules'),
    );

    return ResponseBuilder.buildResponse().status(200).body(null);
  }

  @Validate(HAProxyRuleBulkUpdateDto)
  public async bulkUpdate(req: Request): Promise<ResponseBuilder> {
    const rules: HAProxyRule[] = [];

    const ids: string[] = (req.query.rules as string[]) || [];

    for (const id of ids) {
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

    const result: HAProxyRule[] = await this._haproxyRuleService.bulkUpdate(
      rules.map((item) => item.id),
      req.inputs.all<IUpdateHAProxyRule>(),
    );

    return ResponseBuilder.buildResponse().status(200).body(result);
  }

  @Validate()
  @ValidateQuery(HAProxyRuleBulkRemoveDto)
  public async bulkRemove(req: Request): Promise<ResponseBuilder> {
    const rules: HAProxyRule[] = [];

    const ids: number[] = (req.query.rules as unknown as number[]) || [];

    for (const id of ids) {
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

    const result: HAProxyRule[] = await this._haproxyRuleService.bulkRemove(
      rules.map((item) => item.id),
    );

    return ResponseBuilder.buildResponse().status(200).body(result);
  }
}
