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
import { Validate, ValidateQuery } from '../../../decorators/validate.decorator';
import { KeepalivedPolicy } from '../../../policies/keepalived.policy';
import { KeepalivedRule } from '../../../models/system/keepalived/keepalived_r/keepalived_r.model';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { KeepalivedGroup } from '../../../models/system/keepalived/keepalived_g/keepalived_g.model';
import { Firewall } from '../../../models/firewall/Firewall';
import { FwCloud } from '../../../models/fwcloud/FwCloud';
import {
  KeepalivedRuleService,
  KeepalivedRulesData,
  ICreateKeepalivedRule,
  IUpdateKeepalivedRule,
} from '../../../models/system/keepalived/keepalived_r/keepalived_r.service';
import { KeepalivedRuleCreateDto } from './dto/create.dto';
import { Offset } from '../../../offset';
import { KeepalivedRuleCopyDto } from './dto/copy.dto';
import { KeepalivedRuleUpdateDto } from './dto/update.dto';
import { KeepalivedRuleBulkUpdateDto } from './dto/bulk-update.dto';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';
import { KeepalivedRuleBulkRemoveDto } from './dto/bulk-remove.dto';
import { KeepalivedRuleItemForCompiler } from '../../../models/system/keepalived/shared';
import { KeepalivedMoveFromDto } from './dto/move-from.dto';
import { KeepalivedCompiler } from '../../../compiler/system/keepalived/KeepalivedCompiler';
import { Channel } from '../../../sockets/channels/channel';
import { Communication } from '../../../communications/communication';
import { ProgressPayload } from '../../../sockets/messages/socket-message';
import db from '../../../database/database-manager';

export class KeepalivedController extends Controller {
  protected _keepalivedRuleService: KeepalivedRuleService;
  protected _keepalivedrule: KeepalivedRule;
  protected _keepalivedgroup: KeepalivedGroup;
  protected _firewall: Firewall;
  protected _fwCloud: FwCloud;

  public async make(req: Request): Promise<void> {
    this._keepalivedRuleService = await this._app.getService<KeepalivedRuleService>(
      KeepalivedRuleService.name,
    );

    if (req.params.keepalived) {
      this._keepalivedrule = await db
        .getSource()
        .manager.getRepository(KeepalivedRule)
        .findOneOrFail({ where: { id: parseInt(req.params.keepalived) } });
    }
    if (req.params.keepalivedgroup) {
      this._keepalivedgroup = await db
        .getSource()
        .manager.getRepository(KeepalivedGroup)
        .findOneOrFail({ where: { id: this._keepalivedrule.group.id } });
    }
    this._firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({ where: { id: parseInt(req.params.firewall) } });
    this._fwCloud = await db
      .getSource()
      .manager.getRepository(FwCloud)
      .findOneOrFail({ where: { id: parseInt(req.params.fwcloud) } });
  }

  @Validate()
  public async index(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.index(this._firewall, req.session.user)).authorize();

    const keepalivedRules: KeepalivedRule[] =
      await this._keepalivedRuleService.getKeepalivedRulesData(
        'compiler',
        this._fwCloud.id,
        this._firewall.id,
      );

    return ResponseBuilder.buildResponse().status(200).body(keepalivedRules);
  }

  @Validate()
  public async grid(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.index(this._firewall, req.session.user)).authorize();

    const grid: KeepalivedRule[] = await this._keepalivedRuleService.getKeepalivedRulesData(
      'keepalived_grid',
      this._fwCloud.id,
      this._firewall.id,
    );

    return ResponseBuilder.buildResponse().status(200).body(grid);
  }

  @Validate(KeepalivedRuleCreateDto)
  public async create(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.create(this._firewall, req.session.user)).authorize();

    const data: ICreateKeepalivedRule = Object.assign(
      req.inputs.all<KeepalivedRuleCreateDto>(),
      this._keepalivedgroup ? { group: this._keepalivedgroup.id } : null,
    );
    try {
      const keepalivedRule: KeepalivedRule = await this._keepalivedRuleService.store(data);

      return ResponseBuilder.buildResponse().status(201).body(keepalivedRule);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(422).body({ message: error.message });
    }
  }

  @Validate(KeepalivedRuleCopyDto)
  public async copy(req: Request): Promise<ResponseBuilder> {
    const ids: number[] = req.inputs.get('rules');
    for (const id of ids) {
      const rule: KeepalivedRule = await db
        .getSource()
        .manager.getRepository(KeepalivedRule)
        .findOneOrFail({ where: { id: id } });
      (await KeepalivedPolicy.copy(rule, req.session.user)).authorize();
    }

    const created: KeepalivedRule[] = await this._keepalivedRuleService.copy(
      ids,
      req.inputs.get('to'),
      req.inputs.get<Offset>('offset'),
    );
    return ResponseBuilder.buildResponse().status(201).body(created);
  }

  @Validate(KeepalivedRuleUpdateDto)
  public async update(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.update(this._keepalivedrule, req.session.user)).authorize();
    try {
      const result: KeepalivedRule = await this._keepalivedRuleService.update(
        this._keepalivedrule.id,
        req.inputs.all<IUpdateKeepalivedRule>(),
      );

      return ResponseBuilder.buildResponse().status(200).body(result);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(422).body({ message: error.message });
    }
  }

  @Validate()
  public async remove(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.delete(this._keepalivedrule, req.session.user)).authorize();

    try {
      await this._keepalivedRuleService.remove({
        fwcloudId: this._fwCloud.id,
        firewallId: this._firewall.id,
        id: parseInt(req.params.keepalived),
      });
    } catch (e) {
      console.error(e);
    }

    return ResponseBuilder.buildResponse().status(200).body(this._keepalivedrule);
  }

  @Validate()
  public async show(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.show(this._keepalivedrule, req.session.user)).authorize();

    return ResponseBuilder.buildResponse().status(200).body(this._keepalivedrule);
  }

  @Validate(KeepalivedRuleCopyDto)
  public async move(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.move(this._firewall, req.session.user)).authorize();

    const rules: KeepalivedRule[] = await db
      .getSource()
      .manager.getRepository(KeepalivedRule)
      .createQueryBuilder('rule')
      .innerJoin('rule.firewall', 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .where('rule.id IN(:...ids)', { ids: req.inputs.get('rules') })
      .andWhere('firewall.id = :firewall', { firewall: this._firewall.id })
      .andWhere('firewall.fwCloudId = :fwcloud', { fwcloud: this._fwCloud.id })
      .getMany();

    const result: KeepalivedRule[] = await this._keepalivedRuleService.move(
      rules.map((item) => item.id),
      req.inputs.get('to'),
      req.inputs.get<Offset>('offset'),
    );

    return ResponseBuilder.buildResponse().status(200).body(result);
  }

  @Validate(KeepalivedMoveFromDto)
  async moveFrom(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.move(this._firewall, req.session.user)).authorize();

    const result: KeepalivedRule[] = await this._keepalivedRuleService.moveFrom(
      req.inputs.get('fromId'),
      req.inputs.get('toId'),
      req.inputs.all(),
    );

    return ResponseBuilder.buildResponse().status(200).body(result);
  }

  @Validate()
  public async compile(req: Request): Promise<ResponseBuilder> {
    (await KeepalivedPolicy.create(this._firewall, req.session.user)).authorize();

    const rules: KeepalivedRulesData<KeepalivedRuleItemForCompiler>[] =
      await this._keepalivedRuleService.getKeepalivedRulesData(
        'compiler',
        this._fwCloud.id,
        this._firewall.id,
      );

    new KeepalivedCompiler().compile(rules);

    return ResponseBuilder.buildResponse().status(200).body(null);
  }

  @Validate()
  public async install(req: Request): Promise<ResponseBuilder> {
    const channel: Channel = await Channel.fromRequest(req);
    let firewallId: number;

    const firewall: Firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({ where: { id: this._firewall.id } });
    if (firewall.clusterId) {
      firewallId = (
        await db
          .getSource()
          .manager.getRepository(Firewall)
          .createQueryBuilder('firewall')
          .where('firewall.clusterId = :clusterId', {
            clusterId: firewall.clusterId,
          })
          .andWhere('firewall.fwmaster = 1')
          .getOneOrFail()
      ).id;
    }

    const rules: KeepalivedRulesData<KeepalivedRuleItemForCompiler>[] =
      await this._keepalivedRuleService.getKeepalivedRulesData(
        'compiler',
        this._fwCloud.id,
        firewallId,
      );

    const content: string = new KeepalivedCompiler()
      .compile(rules, channel)
      .map((item) => item.cs)
      .join('\n');

    const communication: Communication<unknown> = await firewall.getCommunication();

    channel.emit(
      'message',
      new ProgressPayload('start', false, `Installing Keepalived configuration`),
    );

    await communication.installKeepalivedConfigs(
      '/etc/keepalived',
      [{ name: 'keepalived.conf', content: content }],
      channel,
    );

    channel.emit(
      'message',
      new ProgressPayload('end', false, `Keepalived configuration installed`),
    );

    return ResponseBuilder.buildResponse().status(200).body(null);
  }

  @Validate(KeepalivedRuleBulkUpdateDto)
  public async bulkUpdate(req: Request): Promise<ResponseBuilder> {
    const rules: KeepalivedRule[] = [];

    const ids: string[] = (req.query.rules as string[]) || [];

    for (const id of ids) {
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

    const result: KeepalivedRule[] = await this._keepalivedRuleService.bulkUpdate(
      rules.map((item) => item.id),
      req.inputs.all<IUpdateKeepalivedRule>(),
    );

    return ResponseBuilder.buildResponse().status(200).body(result);
  }

  @Validate()
  @ValidateQuery(KeepalivedRuleBulkRemoveDto)
  public async bulkRemove(req: Request): Promise<ResponseBuilder> {
    const rules: KeepalivedRule[] = [];

    const ids: number[] = (req.query.rules as unknown as number[]) || [];

    for (const id of ids) {
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

    const result: KeepalivedRule[] = await this._keepalivedRuleService.bulkRemove(
      rules.map((item) => item.id),
    );

    return ResponseBuilder.buildResponse().status(200).body(result);
  }
}
