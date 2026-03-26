/*!
    Copyright 2023 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import {
  FindOneOptions,
  FindOptionsOrder,
  FindOptionsRelations,
  FindOptionsSelect,
  In,
  SelectQueryBuilder,
} from 'typeorm';
import { KeepalivedRule } from './keepalived_r.model';
import { KeepalivedRepository } from './keepalived.repository';
import { IPObj } from '../../../ipobj/IPObj';
import { KeepalivedGroup } from '../keepalived_g/keepalived_g.model';
import { Interface } from '../../../interface/Interface';
import { Offset } from '../../../../offset';
import { Application } from '../../../../Application';
import { Service } from '../../../../fonaments/services/service';
import { IPObjRepository } from '../../../ipobj/IPObj.repository';
import {
  AvailableDestinations,
  KeepalivedRuleItemForCompiler,
  KeepalivedUtils,
  ItemForGrid,
} from '../shared';
import { Firewall } from '../../../firewall/Firewall';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { KeepalivedToIPObj } from './keepalived_r-to-ipobj';
import { ErrorBag } from '../../../../fonaments/validation/validator';
import { ValidationException } from '../../../../fonaments/exceptions/validation-exception';
import { KeepalivedGroupService } from '../keepalived_g/keepalived_g.service';
import { IPObjGroup } from '../../../ipobj/IPObjGroup';
import db from '../../../../database/database-manager';
import { DatabaseService } from '../../../../database/database.service';

interface IFindManyKeepalivedRulePath {
  fwcloudId?: number;
  firewallId?: number;
}

interface IFindOneKeepalivedRulePath extends IFindManyKeepalivedRulePath {
  id: number;
}

export interface ICreateKeepalivedRule {
  active?: boolean;
  group?: number;
  style?: string;
  firewallId?: number;
  firewallApplyToId?: number;
  fw_apply_to?: number;
  interfaceId?: number;
  virtualIpsIds?: { id: number; order: number }[];
  masterNodeId?: number;
  cfg_text?: string;
  comment?: string;
  rule_order?: number;
  rule_type?: number;
  to?: number;
  offset?: Offset;
}

export interface IUpdateKeepalivedRule {
  active?: boolean;
  style?: string;
  virtualIpsIds?: { id: number; order: number }[];
  masterNodeId?: number;
  interfaceId?: number;
  cfg_text?: string;
  comment?: string;
  rule_order?: number;
  group?: number;
  firewallId?: number;
  firewallApplyToId?: number;
  fw_apply_to?: number;
}

export interface KeepalivedRulesData<T extends ItemForGrid | KeepalivedRuleItemForCompiler>
  extends KeepalivedRule {
  items: (T & { _order: number })[];
}

export interface IMoveFromKeepalivedRule {
  fromId: number;
  toId: number;
  ipObjId?: number;
}

export class KeepalivedRuleService extends Service {
  private _repository: KeepalivedRepository;
  private _ipobjRepository: IPObjRepository;
  private _groupService: KeepalivedGroupService;
  private _databaseService: DatabaseService;

  constructor(app: Application) {
    super(app);
    this._groupService = new KeepalivedGroupService(app);
  }

  public async build(): Promise<Service> {
    this._databaseService = await this._app.getService(DatabaseService.name);
    this._repository = new KeepalivedRepository(this._databaseService.dataSource.manager);
    this._ipobjRepository = new IPObjRepository(this._databaseService.dataSource.manager);

    return this;
  }

  async store(data: ICreateKeepalivedRule): Promise<KeepalivedRule> {
    const keepalivedRuleData: Partial<KeepalivedRule> = {
      active: data.active,
      style: data.style,
      rule_type: data.rule_type,
      cfg_text: data.cfg_text,
      comment: data.comment,
    };

    if (data.group) {
      keepalivedRuleData.group = await db
        .getSource()
        .manager.getRepository(KeepalivedGroup)
        .findOneOrFail({ where: { id: data.group } });
    }
    if (data.interfaceId) {
      const interfaceData = await db
        .getSource()
        .manager.getRepository(Interface)
        .findOneOrFail({ where: { id: data.interfaceId } });
      if (!interfaceData.mac || interfaceData.mac === '') {
        throw new Error('Interface mac is not defined');
      }
      keepalivedRuleData.interface = interfaceData;
    }
    if (data.masterNodeId) {
      keepalivedRuleData.masterNode = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOneOrFail({ where: { id: data.masterNodeId } });
    }
    if (data.firewallId) {
      keepalivedRuleData.firewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOneOrFail({ where: { id: data.firewallId } });
    }

    const firewallApplyToId = data.firewallApplyToId ?? data.fw_apply_to;
    await this.validateFirewallApplyTo(keepalivedRuleData.firewall, firewallApplyToId);
    if (firewallApplyToId !== undefined && firewallApplyToId !== null) {
      keepalivedRuleData.firewallApplyTo = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOneOrFail({ where: { id: firewallApplyToId } });
      keepalivedRuleData.firewallApplyToId = firewallApplyToId;
    }

    const lastKeepalivedRule = await this._repository.getLastKeepalivedRuleInFirewall(
      data.firewallId,
    );
    keepalivedRuleData.rule_order = lastKeepalivedRule?.rule_order
      ? lastKeepalivedRule.rule_order + 1
      : 1;
    const persisted: Partial<KeepalivedRule> & KeepalivedRule =
      await this._repository.save(keepalivedRuleData);

    if (data.virtualIpsIds && data.virtualIpsIds.length > 0) {
      persisted.virtualIps = data.virtualIpsIds.map(
        (item) =>
          ({
            keepalivedId: persisted.id,
            ipObjId: item.id,
            order: item.order,
          }) as unknown as KeepalivedToIPObj,
      );

      const hasMatchingIpVersion = persisted.virtualIps.some(
        async (virtualIp) =>
          (
            await db
              .getSource()
              .manager.getRepository(IPObj)
              .findOneOrFail({ where: { id: virtualIp.ipObjId } })
          ).ip_version ===
          (
            await db
              .getSource()
              .manager.getRepository(IPObj)
              .findOneOrFail({ where: { id: persisted.virtualIps[0].ipObjId } })
          ).ip_version,
      );
      if (!hasMatchingIpVersion) {
        this._repository.remove(persisted);
        throw new Error('IP version mismatch');
      }

      await this._repository.save(persisted);
    }

    if (
      Object.prototype.hasOwnProperty.call(data, 'to') &&
      Object.prototype.hasOwnProperty.call(data, 'offset')
    ) {
      return (await this.move([persisted.id], data.to, data.offset))[0];
    }

    return persisted;
  }

  async copy(ids: number[], destRule: number, offset: Offset): Promise<KeepalivedRule[]> {
    const keepalived_rs: KeepalivedRule[] = await this._repository.find({
      where: {
        id: In(ids),
      },
      relations: [
        'group',
        'firewall',
        'firewall.fwCloud',
        'firewallApplyTo',
        'interface',
        'virtualIps',
        'masterNode',
      ],
    });

    const lastRule: KeepalivedRule = await this._repository.getLastKeepalivedRuleInFirewall(
      keepalived_rs[0].firewallId,
    );

    keepalived_rs.map((item, index) => {
      item.id = undefined;
      item.rule_order = lastRule.rule_order + index + 1;
    });

    const persisted = await this._repository.save(keepalived_rs);
    const persistedArray = Array.isArray(persisted) ? persisted : [persisted];

    return this.move(
      persistedArray.map((item) => item.id),
      destRule,
      offset,
    );
  }

  async move(ids: number[], destRule: number, offset: Offset): Promise<KeepalivedRule[]> {
    return await this._repository.move(ids, destRule, offset);
  }

  async moveFrom(
    fromId: number,
    toId: number,
    data: IMoveFromKeepalivedRule,
  ): Promise<[KeepalivedRule, KeepalivedRule]> {
    const fromRule: KeepalivedRule = await this._repository
      .createQueryBuilder('keepalived')
      .innerJoin('keepalived.firewall', 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .leftJoinAndSelect('keepalived.group', 'group')
      .leftJoinAndSelect('group.rules', 'rules')
      .leftJoinAndSelect('keepalived.virtualIps', 'virtualIps')
      .where('keepalived.id = :id', { id: fromId })
      .getOneOrFail();

    const toRule: KeepalivedRule = await this._repository
      .createQueryBuilder('keepalived')
      .innerJoin('keepalived.firewall', 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .leftJoinAndSelect('keepalived.group', 'group')
      .leftJoinAndSelect('group.rules', 'rules')
      .leftJoinAndSelect('keepalived.virtualIps', 'virtualIps')
      .where('keepalived.id = :id', { id: toId })
      .getOneOrFail();

    let lastPosition = 0;
    [].concat(toRule.virtualIps).forEach((item) => {
      lastPosition < item.order ? (lastPosition = item.order) : null;
    });

    if (data.ipObjId !== undefined) {
      const index: number = fromRule.virtualIps.findIndex((item) => item.ipObjId === data.ipObjId);
      if (index >= 0) {
        fromRule.virtualIps.splice(index, 1);
        toRule.virtualIps.push({
          keepalivedRuleId: toRule.id,
          ipObjId: data.ipObjId,
          order: lastPosition + 1,
        } as KeepalivedToIPObj);
      }
    }

    return [await this._repository.save(fromRule), await this._repository.save(toRule)];
  }

  async update(id: number, data: Partial<ICreateKeepalivedRule>): Promise<KeepalivedRule> {
    const keepalivedRule: KeepalivedRule | undefined = await this._repository.findOne({
      where: {
        id: id,
      },
      relations: ['group', 'firewall', 'firewallApplyTo', 'interface', 'virtualIps', 'masterNode'],
    });

    if (!keepalivedRule) {
      throw new Error('keepalivedRule not found');
    }

    Object.assign(keepalivedRule, {
      active: data.active !== undefined ? data.active : keepalivedRule.active,
      comment: data.comment !== undefined ? data.comment : keepalivedRule.comment,
      style: data.style !== undefined ? data.style : keepalivedRule.style,
      cfg_text: data.cfg_text !== undefined ? data.cfg_text : keepalivedRule.cfg_text,
      rule_order: data.rule_order !== undefined ? data.rule_order : keepalivedRule.rule_order,
    });

    if (data.group !== undefined) {
      keepalivedRule.group = data.group
        ? await db
            .getSource()
            .manager.getRepository(KeepalivedGroup)
            .findOne({ where: { id: data.group } })
        : null;
    } else if (data.virtualIpsIds) {
      await this.validateVirtualIps(keepalivedRule.firewall, data);
      keepalivedRule.virtualIps = data.virtualIpsIds.map(
        (item) =>
          ({
            keepalivedRuleId: keepalivedRule.id,
            ipObjId: item.id,
            order: item.order,
          }) as KeepalivedToIPObj,
      );
      const hasMatchingIpVersion = keepalivedRule.virtualIps.some(
        async (virtualIp) =>
          (
            await db
              .getSource()
              .manager.getRepository(IPObj)
              .findOneOrFail({ where: { id: virtualIp.ipObjId } })
          ).ip_version ===
          (
            await db
              .getSource()
              .manager.getRepository(IPObj)
              .findOneOrFail({ where: { id: keepalivedRule.virtualIps[0].ipObjId } })
          ).ip_version,
      );
      if (!hasMatchingIpVersion) {
        throw new Error('IP version mismatch');
      }
    } else {
      const fieldHandlers: Array<{
        payloadKey: keyof (ICreateKeepalivedRule & IUpdateKeepalivedRule);
        apply: (value: unknown) => Promise<void>;
      }> = [
        {
          payloadKey: 'interfaceId',
          apply: async (value) => {
            if (value === undefined) {
              return;
            }
            if (value === null || value === '') {
              keepalivedRule.interface = null;
              keepalivedRule.interfaceId = null;
              return;
            }
            const interfaceData = await db
              .getSource()
              .manager.getRepository(Interface)
              .findOneOrFail({ where: { id: Number(value) } });
            if (!interfaceData.mac || interfaceData.mac === '') {
              throw new Error('Interface mac is not defined');
            }
            keepalivedRule.interface = interfaceData;
            keepalivedRule.interfaceId = interfaceData.id;
          },
        },
        {
          payloadKey: 'masterNodeId',
          apply: async (value) => {
            if (value === undefined) {
              return;
            }
            if (value === null || value === '') {
              keepalivedRule.masterNode = null;
              keepalivedRule.masterNodeId = null;
              return;
            }
            keepalivedRule.masterNode = await db
              .getSource()
              .manager.getRepository(Firewall)
              .findOneOrFail({ where: { id: Number(value) } });
            keepalivedRule.masterNodeId = keepalivedRule.masterNode.id;
          },
        },
        {
          payloadKey: 'firewallId',
          apply: async (value) => {
            if (value === undefined) {
              return;
            }
            if (value === null || value === '') {
              throw new ValidationException('The given data was invalid', {
                firewallId: ['Firewall is required'],
              });
            }
            keepalivedRule.firewall = await db
              .getSource()
              .manager.getRepository(Firewall)
              .findOneOrFail({ where: { id: Number(value) } });
            keepalivedRule.firewallId = keepalivedRule.firewall.id;
          },
        },
        {
          payloadKey: 'firewallApplyToId',
          apply: async (value) => {
            if (!Object.prototype.hasOwnProperty.call(data, 'firewallApplyToId')) {
              return;
            }
            if (value === null || value === undefined || value === '') {
              keepalivedRule.firewallApplyTo = null;
              keepalivedRule.firewallApplyToId = null;
              return;
            }
            await this.validateFirewallApplyTo(keepalivedRule.firewall, Number(value));
            keepalivedRule.firewallApplyTo = await db
              .getSource()
              .manager.getRepository(Firewall)
              .findOneOrFail({ where: { id: Number(value) } });
            keepalivedRule.firewallApplyToId = keepalivedRule.firewallApplyTo.id;
          },
        },
        {
          payloadKey: 'fw_apply_to',
          apply: async (value) => {
            if (!Object.prototype.hasOwnProperty.call(data, 'fw_apply_to')) {
              return;
            }
            if (value === null || value === undefined || value === '') {
              keepalivedRule.firewallApplyTo = null;
              keepalivedRule.firewallApplyToId = null;
              return;
            }
            await this.validateFirewallApplyTo(keepalivedRule.firewall, Number(value));
            keepalivedRule.firewallApplyTo = await db
              .getSource()
              .manager.getRepository(Firewall)
              .findOneOrFail({ where: { id: Number(value) } });
            keepalivedRule.firewallApplyToId = keepalivedRule.firewallApplyTo.id;
          },
        },
      ];

      for (const { payloadKey, apply } of fieldHandlers) {
        await apply((data as Record<string, unknown>)[payloadKey as string]);
      }
    }

    await this._repository.save(keepalivedRule);

    return keepalivedRule;
  }

  async remove(path: IFindOneKeepalivedRulePath): Promise<KeepalivedRule> {
    const keepalivedRule: KeepalivedRule = await this.findOneInPath(
      path /**{ relations: ['group'] } */,
    );

    keepalivedRule.virtualIps = [];

    await this._repository.save(keepalivedRule);
    if (keepalivedRule.group && keepalivedRule.group.rules.length === 1) {
      await this._groupService.remove({ id: keepalivedRule.group.id });
    }

    await this._repository.remove(keepalivedRule);

    return keepalivedRule;
  }

  findOneInPath(
    path: IFindOneKeepalivedRulePath,
    options?: FindOneOptions<KeepalivedRule>,
  ): Promise<KeepalivedRule | undefined> {
    return this.getFindInPathOptions(path, options).getOneOrFail();
  }

  protected getFindInPathOptions(
    path: Partial<IFindOneKeepalivedRulePath>,
    options: FindOneOptions<KeepalivedRule> = {},
  ): SelectQueryBuilder<KeepalivedRule> {
    const qb: SelectQueryBuilder<KeepalivedRule> =
      this._repository.createQueryBuilder('keepalived');
    qb.innerJoin('keepalived.firewall', 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .leftJoinAndSelect('keepalived.group', 'group')
      .leftJoinAndSelect('group.rules', 'rules')
      .leftJoinAndSelect('keepalived.firewallApplyTo', 'firewallApplyTo');

    if (path.firewallId) {
      qb.andWhere('firewall.id = :firewallId', { firewallId: path.firewallId });
    }
    if (path.fwcloudId) {
      qb.andWhere('fwcloud.id = :fwcloudId', { fwcloudId: path.fwcloudId });
    }
    if (path.id) {
      qb.andWhere('keepalived.id = :id', { id: path.id });
    }

    // Aplica las opciones adicionales que se pasaron a la función
    Object.entries(options).forEach(([key, value]) => {
      switch (key) {
        case 'where':
          qb.andWhere(value);
          break;
        case 'relations':
          qb.leftJoinAndSelect(`keepalived.${value}`, `${value}`);
          break;
        default:
      }
    });

    return qb;
  }

  public async getKeepalivedRulesData<T extends ItemForGrid | KeepalivedRuleItemForCompiler>(
    dst: AvailableDestinations,
    fwcloud: number,
    firewall: number,
    rules?: number[],
  ): Promise<KeepalivedRulesData<T>[]> {
    const { queryFirewallIds, targetFirewallId } = await this.resolveFirewallsForQuery(firewall);
    const firewallsForQuery: number | number[] =
      queryFirewallIds.length === 1 ? queryFirewallIds[0] : queryFirewallIds;
    const shouldFilterByApplyTo = Array.isArray(firewallsForQuery);
    let rulesData: KeepalivedRulesData<T>[];
    switch (dst) {
      case 'keepalived_grid':
        rulesData = (await this._repository.getKeepalivedRules(
          fwcloud,
          firewallsForQuery,
          rules,
        )) as KeepalivedRulesData<T>[];
        break;
      case 'compiler':
        rulesData = (await this._repository.getKeepalivedRules(
          fwcloud,
          firewallsForQuery,
          rules,
        )) as KeepalivedRulesData<T>[];
        break;
    }

    if (shouldFilterByApplyTo) {
      rulesData = rulesData.filter(
        (rule) => !rule.firewallApplyToId || rule.firewallApplyToId === targetFirewallId,
      );
    }

    const ItemsArrayMap = new Map<number, T[]>();
    for (let i = 0; i < rulesData.length; i++) {
      rulesData[i].items = [];

      ItemsArrayMap.set(rulesData[i].id, rulesData[i].items);
    }

    const sqls: SelectQueryBuilder<IPObj | IPObjGroup>[] =
      dst === 'compiler'
        ? this.buildKeepalivedRulesCompilerSql(fwcloud, firewallsForQuery, rules)
        : this.getKeepalivedRulesGridSql(fwcloud, firewallsForQuery, rules);

    const result = await Promise.all(
      sqls.map((sql) => KeepalivedUtils.mapEntityData<T>(sql, ItemsArrayMap)),
    );

    return rulesData.map((rule) => {
      if (rule.items) {
        rule.items = rule.items.sort((a, b) => a._order - b._order);
      }
      return rule;
    });
  }

  public async bulkUpdate(ids: number[], data: IUpdateKeepalivedRule): Promise<KeepalivedRule[]> {
    if (data.group) {
      await this._repository.update(
        {
          id: In(ids),
        },
        { ...data, interfaceId: data.interfaceId, group: { id: data.group } },
      );
    } else {
      const firstRule = await this._repository.findOne({
        where: {
          id: ids[0],
        },
        relations: ['group', 'firewall'],
      });

      if (!firstRule) {
        throw new Error('Keepalived rule not found');
      }

      const group: KeepalivedGroup = firstRule.group;
      let targetFirewall: Firewall = firstRule.firewall;

      if (data.group !== undefined && group && group.rules.length - ids.length < 1) {
        await this._groupService.remove({ id: group.id });
      }

      const hasFirewallApplyToId = Object.prototype.hasOwnProperty.call(data, 'firewallApplyToId');
      const hasFwApplyTo = Object.prototype.hasOwnProperty.call(data, 'fw_apply_to');

      if (hasFirewallApplyToId) {
        const value = data.firewallApplyToId;
        const isEmptyValue =
          value === null || value === undefined || (typeof value === 'string' && value === '');
        data.fw_apply_to = isEmptyValue ? null : Number(value);
        delete (data as Record<string, unknown>).firewallApplyToId;
      }

      if (hasFwApplyTo && !hasFirewallApplyToId) {
        const value = data.fw_apply_to;
        const isEmptyValue =
          value === null || value === undefined || (typeof value === 'string' && value === '');
        data.fw_apply_to = isEmptyValue ? null : Number(value);
      }

      if (typeof data.firewallId !== 'undefined') {
        data.firewallId = Number(data.firewallId);
        targetFirewall = await db
          .getSource()
          .manager.getRepository(Firewall)
          .findOneOrFail({ where: { id: data.firewallId } });
      }

      if (Object.prototype.hasOwnProperty.call(data, 'fw_apply_to')) {
        await this.validateFirewallApplyTo(targetFirewall, data.fw_apply_to as number);
      }

      await this._repository.update(
        {
          id: In(ids),
        },
        { ...(data as unknown as QueryDeepPartialEntity<KeepalivedRule>) },
      );
    }

    return this._repository.find({
      where: {
        id: In(ids),
      },
    });
  }

  public async bulkRemove(ids: number[]): Promise<KeepalivedRule[]> {
    const rules: KeepalivedRule[] = await this._repository.find({
      where: {
        id: In(ids),
      },
    });

    for (const rule of rules) {
      await this.remove({ id: rule.id });
    }

    return rules;
  }

  private getKeepalivedRulesGridSql(
    fwcloud: number,
    firewall: number | number[],
    rules?: number[],
  ): SelectQueryBuilder<IPObj | IPObjGroup>[] {
    return [this._ipobjRepository.getIpobjsInKeepalived_ForGrid('rule', fwcloud, firewall)];
  }

  private buildKeepalivedRulesCompilerSql(
    fwcloud: number,
    firewall: number | number[],
    rules?: number[],
  ): SelectQueryBuilder<IPObj | IPObjGroup>[] {
    return [this._ipobjRepository.getIpobjsInKeepalived_ForGrid('rule', fwcloud, firewall)];
  }

  protected async resolveFirewallsForQuery(
    firewallId: number,
  ): Promise<{ queryFirewallIds: number[]; targetFirewallId: number }> {
    const firewallRepository = db.getSource().manager.getRepository(Firewall);
    const firewall = await firewallRepository.findOne({ where: { id: firewallId } });

    if (!firewall) {
      return {
        queryFirewallIds: [firewallId],
        targetFirewallId: firewallId,
      };
    }

    const firewalls = new Set<number>([firewall.id]);

    if (firewall.clusterId) {
      const master = await firewallRepository
        .createQueryBuilder('firewall')
        .where('firewall.clusterId = :clusterId', { clusterId: firewall.clusterId })
        .andWhere('firewall.fwmaster = 1')
        .getOne();

      if (master) {
        firewalls.add(master.id);
      }
    }

    return {
      queryFirewallIds: Array.from(firewalls),
      targetFirewallId: firewall.id,
    };
  }

  protected async validateFirewallApplyTo(
    firewall: Firewall,
    firewallApplyToId?: number,
  ): Promise<void> {
    if (!firewallApplyToId) {
      return;
    }

    const targetFirewall: Firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOne({ where: { id: firewallApplyToId } });

    if (!targetFirewall) {
      throw new ValidationException('The given data was invalid', {
        firewallApplyToId: ['Firewall not found'],
      });
    }

    if (!firewall) {
      return;
    }

    const sameFirewall = firewall.id === targetFirewall.id;
    const sameCluster =
      firewall.clusterId !== null &&
      firewall.clusterId !== undefined &&
      firewall.clusterId === targetFirewall.clusterId;

    if (!sameFirewall && !sameCluster) {
      throw new ValidationException('The given data was invalid', {
        firewallApplyToId: ['This firewall does not belong to cluster'],
      });
    }
  }

  async validateVirtualIps(firewall: Firewall, data: IUpdateKeepalivedRule): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.virtualIpsIds || !data.virtualIpsIds.length) {
      return;
    }

    const virtualIps: IPObj[] = await this._ipobjRepository.find({
      where: {
        id: In(data.virtualIpsIds.map((item) => item.id)),
        ipObjTypeId: 5, //ADDRESS
      },
      relations: ['fwCloud'],
    });

    for (let i = 0; i < virtualIps.length; i++) {
      const ipObj: IPObj = virtualIps[i];

      if (ipObj.fwCloud.id && ipObj.fwCloud.id !== firewall.fwCloudId) {
        errors[`virtualIpsIds.${i}`] = ['ipObj id must exist'];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }
}
