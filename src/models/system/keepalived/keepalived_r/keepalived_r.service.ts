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
import { Brackets, FindOneOptions, In, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
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
  virutalIpsIds?: { id: number; order: number }[];
  masterNodeId?: number;
  interfaceId?: number;
  cfg_text?: string;
  comment?: string;
  rule_order?: number;
  group?: number;
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
          (await db.getSource().manager.getRepository(IPObj).findOneOrFail(virtualIp.ipObj))
            .ip_version ===
          (
            await db
              .getSource()
              .manager.getRepository(IPObj)
              .findOneOrFail(persisted.virtualIps[0].ipObj)
          ).ip_version,
      );
      if (!hasMatchingIpVersion) {
        await this._repository.remove(persisted);
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
      relations: ['group', 'firewall', 'firewall.fwCloud', 'interface', 'virtualIps', 'masterNode'],
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
      relations: ['group', 'firewall', 'interface', 'virtualIps', 'masterNode'],
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
          (await db.getSource().manager.getRepository(IPObj).findOneOrFail(virtualIp.ipObj))
            .ip_version ===
          (
            await db
              .getSource()
              .manager.getRepository(IPObj)
              .findOneOrFail(keepalivedRule.virtualIps[0].ipObj)
          ).ip_version,
      );
      if (!hasMatchingIpVersion) {
        throw new Error('IP version mismatch');
      }
    } else {
      const fieldsToUpdate = ['masterNodeId', 'interfaceId', 'firewallId'];

      for (const field of fieldsToUpdate) {
        if (data[field]) {
          if (field === 'interfaceId') {
            const interfaceData = await db
              .getSource()
              .manager.getRepository(Interface)
              .findOneOrFail({ where: { id: data[field] } });
            if (!interfaceData.mac || interfaceData.mac === '') {
              throw new Error('Interface mac is not defined');
            }
            keepalivedRule[field.slice(0, -2)] = interfaceData;
          } else if (field === 'masterNodeId') {
            keepalivedRule[field.slice(0, -2)] = await db
              .getSource()
              .manager.getRepository(Firewall)
              .findOneOrFail({ where: { id: data[field] } });
          } else if (field === 'firewallId') {
            keepalivedRule[field.slice(0, -2)] = await db
              .getSource()
              .manager.getRepository(Firewall)
              .findOneOrFail({ where: { id: data[field] } });
          }
        }
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
      .leftJoinAndSelect('group.rules', 'rules');

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
          qb.andWhere(
            value as string | Brackets | ((qb: this) => string) | ObjectLiteral | ObjectLiteral[],
          );
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
    let rulesData: KeepalivedRulesData<T>[];
    switch (dst) {
      case 'keepalived_grid':
        rulesData = (await this._repository.getKeepalivedRules(
          fwcloud,
          firewall,
          rules,
        )) as KeepalivedRulesData<T>[];
        break;
      case 'compiler':
        rulesData = (await this._repository.getKeepalivedRules(
          fwcloud,
          firewall,
          rules,
        )) as KeepalivedRulesData<T>[];
        break;
    }

    const ItemsArrayMap = new Map<number, T[]>();
    for (let i = 0; i < rulesData.length; i++) {
      rulesData[i].items = [];

      ItemsArrayMap.set(rulesData[i].id, rulesData[i].items);
    }

    const sqls: SelectQueryBuilder<IPObj | IPObjGroup>[] =
      dst === 'compiler'
        ? this.buildKeepalivedRulesCompilerSql(fwcloud, firewall, rules)
        : this.getKeepalivedRulesGridSql(fwcloud, firewall, rules);

    await Promise.all(sqls.map((sql) => KeepalivedUtils.mapEntityData<T>(sql, ItemsArrayMap)));

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
        { ...data, group: { id: data.group } },
      );
    } else {
      const group: KeepalivedGroup = (
        await this._repository.findOne({
          where: {
            id: ids[0],
          },
          relations: ['group'],
        })
      ).group;
      if (data.group !== undefined && group && group.rules.length - ids.length < 1) {
        await this._groupService.remove({ id: group.id });
      }

      await this._repository.update(
        {
          id: In(ids),
        },
        { ...(data as QueryDeepPartialEntity<KeepalivedRule>) },
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
    firewall: number,
    rules?: number[],
  ): SelectQueryBuilder<IPObj | IPObjGroup>[] {
    return [this._ipobjRepository.getIpobjsInKeepalived_ForGrid('rule', fwcloud, firewall)];
  }

  private buildKeepalivedRulesCompilerSql(
    fwcloud: number,
    firewall: number,
    rules?: number[],
  ): SelectQueryBuilder<IPObj | IPObjGroup>[] {
    return [this._ipobjRepository.getIpobjsInKeepalived_ForGrid('rule', fwcloud, firewall)];
  }

  async validateVirtualIps(firewall: Firewall, data: IUpdateKeepalivedRule): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.virutalIpsIds || !data.virutalIpsIds.length) {
      return;
    }

    const virtualIps: IPObj[] = await this._ipobjRepository.find({
      where: {
        id: In(data.virutalIpsIds.map((item) => item.id)),
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
