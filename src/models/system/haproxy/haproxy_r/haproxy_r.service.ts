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

import { FindOneOptions, In, SelectQueryBuilder } from 'typeorm';
import { Service } from '../../../../fonaments/services/service';
import { Offset } from '../../../../offset';
import { HAProxyRuleRepository } from './haproxy.repository';
import { HAProxyRule } from './haproxy_r.model';
import { IPObjRepository } from '../../../ipobj/IPObj.repository';
import { Application } from '../../../../Application';
import { HAProxyGroup } from '../haproxy_g/haproxy_g.model';
import { HAProxyRuleToIPObj } from './haproxy_r-to_ipobj.model';
import { Firewall } from '../../../firewall/Firewall';
import { IPObj } from '../../../ipobj/IPObj';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ErrorBag } from '../../../../fonaments/validation/validator';
import { ValidationException } from '../../../../fonaments/exceptions/validation-exception';
import { HAProxyRuleItemForCompiler, HAProxyUtils, ItemForGrid } from '../shared';
import { HAProxyGroupService } from '../haproxy_g/haproxy_g.service';
import { IPObjGroup } from '../../../ipobj/IPObjGroup';
import { AvailableDestinations } from '../../haproxy/shared';
import db from '../../../../database/database-manager';
import { DatabaseService } from '../../../../database/database.service';

interface IFindManyHAProxyRPath {
  fwcloudId?: number;
  firewallId?: number;
}

interface IFindOneHAProxyRPath extends IFindManyHAProxyRPath {
  id: number;
}

export interface ICreateHAProxyRule {
  active?: boolean;
  group?: number;
  style?: string;
  rule_type?: number;
  firewallId?: number;
  frontendIpId?: number;
  frontendPortId?: number;
  backendIpsIds?: { id: number; order: number }[];
  backendPortId?: number;
  cfg_text?: string;
  comment?: string;
  rule_order?: number;
  to?: number;
  offset?: Offset;
}

export interface IUpdateHAProxyRule {
  active?: boolean;
  group?: number;
  style?: string;
  rule_type?: number;
  firewallId?: number;
  frontendIpId?: number;
  frontendPortId?: number;
  backendIpsIds?: { id: number; order: number }[];
  backendPortId?: number;
  cfg_text?: string;
  comment?: string;
  rule_order?: number;
  offset?: Offset;
}

export interface HAProxyRulesData<T extends ItemForGrid | HAProxyRuleItemForCompiler>
  extends HAProxyRule {
  items: (T & { _order: number })[];
}

interface IMoveFromHaProxyRule {
  fromId: number;
  toId: number;
  ipObjId?: number;
}

export class HAProxyRuleService extends Service {
  private _repository: HAProxyRuleRepository;
  private _ipobjRepository: IPObjRepository;
  private _groupService: HAProxyGroupService;
  private _databaseService: DatabaseService;

  constructor(app: Application) {
    super(app);

    this._groupService = new HAProxyGroupService(app);
  }

  public async build(): Promise<Service> {
    this._databaseService = await this._app.getService(DatabaseService.name);
    this._repository = new HAProxyRuleRepository(this._databaseService.dataSource.manager);
    this._ipobjRepository = new IPObjRepository(this._databaseService.dataSource.manager);

    return this;
  }

  async store(data: ICreateHAProxyRule): Promise<HAProxyRule> {
    const haProxyRule: Partial<HAProxyRule> = {
      active: data.active,
      style: data.style,
      rule_type: data.rule_type,
      cfg_text: data.cfg_text,
      comment: data.comment,
    };

    if (data.group) {
      haProxyRule.group = await db
        .getSource()
        .manager.getRepository(HAProxyGroup)
        .findOneOrFail({ where: { id: data.group } });
    }
    if (data.frontendIpId) {
      haProxyRule.frontendIp = await this._ipobjRepository.findOneOrFail({
        where: { id: data.frontendIpId },
      });
    }
    if (data.frontendPortId) {
      haProxyRule.frontendPort = await this._ipobjRepository.findOneOrFail({
        where: { id: data.frontendPortId },
      });
    }
    if (data.backendPortId) {
      haProxyRule.backendPort = await this._ipobjRepository.findOneOrFail({
        where: { id: data.backendPortId },
      });
    }
    if (data.firewallId) {
      haProxyRule.firewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOneOrFail({ where: { id: data.firewallId } });
    }
    if (data.backendIpsIds) {
      await this.validateBackendIps(haProxyRule.firewall, data);
      haProxyRule.backendIps = await Promise.all(
        data.backendIpsIds.map(
          async (item) =>
            ({
              haproxyRuleId: haProxyRule.id,
              ipObjId: item.id,
              order: item.order,
            }) as HAProxyRuleToIPObj,
        ),
      );
    }

    // Validate that the ip_version of haProxyRule.frontendIp matches any of the ip_versions in haProxyRule.backendIps
    if (haProxyRule.frontendIp && haProxyRule.backendIps && haProxyRule.backendIps.length > 0) {
      const frontendIpVersion = haProxyRule.frontendIp.ip_version;
      const backendIpVersions = await Promise.all(
        haProxyRule.backendIps.map(async (backendIp) => {
          const ipObj = await db
            .getSource()
            .manager.getRepository(IPObj)
            .findOneOrFail({ where: { id: backendIp.ipObjId } });
          return ipObj.ip_version;
        }),
      );

      const hasMatchingIpVersion = backendIpVersions.some(
        (version) => version === frontendIpVersion,
      );

      if (!hasMatchingIpVersion) {
        throw new Error('IP version mismatch');
      }
    }

    // Validate that the protocol of haProxyRule.frontendPort matches any of the protocols in haProxyRule.backendPort
    if (haProxyRule.frontendPort && haProxyRule.backendPort) {
      const frontendPortProtocol = haProxyRule.frontendPort.protocol;

      const backendPortProtocol = haProxyRule.backendPort.protocol;

      if (frontendPortProtocol !== backendPortProtocol) {
        throw new Error('Protocol mismatch');
      }
    }

    const lastHAProxy: HAProxyRule = (await this._repository.getLastHAProxyRuleInFirewall(
      data.firewallId,
    )) as HAProxyRule;
    haProxyRule.rule_order = lastHAProxy?.rule_order ? lastHAProxy.rule_order + 1 : 1;
    const persisted: HAProxyRule = await this._repository.save(haProxyRule);

    if (
      Object.prototype.hasOwnProperty.call(data, 'to') &&
      Object.prototype.hasOwnProperty.call(data, 'offset')
    ) {
      return (await this.move([persisted.id], data.to, data.offset))[0];
    }

    return persisted;
  }

  async copy(ids: number[], destRule: number, position: Offset): Promise<HAProxyRule[]> {
    const haproxy_rs: HAProxyRule[] = await this._repository.find({
      where: {
        id: In(ids),
      },
      relations: [
        'group',
        'firewall',
        'firewall.fwCloud',
        'frontendIp',
        'frontendPort',
        'backendIps',
        'backendPort',
      ],
    });

    const lastRule = await this._repository.getLastHAProxyRuleInFirewall(haproxy_rs[0].firewall.id);

    haproxy_rs.map((item, index) => {
      item.id = undefined;
      item.rule_order = lastRule.rule_order + index + 1;
    });

    const persisted = await this._repository.save(haproxy_rs);
    const persistedArray = Array.isArray(persisted) ? persisted : [persisted];

    return this.move(
      persistedArray.map((item) => item.id),
      destRule,
      position,
    );
  }

  async move(ids: number[], destRule: number, offset: Offset): Promise<HAProxyRule[]> {
    const destinatationRule: HAProxyRule = await this._repository.findOneOrFail({
      where: {
        id: destRule,
      },
      relations: ['group'],
    });

    const sourceRules: HAProxyRule[] = await this._repository.findBy({
      id: In(ids),
    });

    const movedRules = await this._repository.move(ids, destRule, offset);

    if (
      !destinatationRule.group &&
      sourceRules[0].group &&
      sourceRules[0].group.rules.length - ids.length < 1
    ) {
      await this._groupService.remove({ id: sourceRules[0].group.id });
    }

    return movedRules;
  }

  async moveFrom(
    fromId: number,
    toId: number,
    data: IMoveFromHaProxyRule,
  ): Promise<[HAProxyRule, HAProxyRule]> {
    const fromRule: HAProxyRule = await this._repository.findOneOrFail({
      where: {
        id: fromId,
      },
      relations: ['firewall', 'firewall.fwCloud', 'backendIps'],
    });

    const toRule: HAProxyRule = await this._repository.findOneOrFail({
      where: {
        id: toId,
      },
      relations: ['firewall', 'firewall.fwCloud', 'backendIps'],
    });

    let lastPosition = 0;

    [].concat(toRule.backendIps).forEach((ipobj) => {
      lastPosition < ipobj.order ? (lastPosition = ipobj.order) : null;
    });

    if (data.ipObjId !== undefined) {
      const index = fromRule.backendIps.findIndex((item) => item.ipObjId === data.ipObjId);
      if (index >= 0) {
        fromRule.backendIps.splice(index, 1);
        toRule.backendIps.push({
          haproxyRuleId: toRule.id,
          ipObjId: data.ipObjId,
          order: lastPosition + 1,
        } as HAProxyRuleToIPObj);
      }
    }

    return (await this._repository.save([fromRule, toRule])) as [HAProxyRule, HAProxyRule];
  }

  async update(id: number, data: Partial<ICreateHAProxyRule>): Promise<HAProxyRule> {
    const haProxyRule: HAProxyRule | undefined = await this._repository.findOneOrFail({
      where: {
        id,
      },
      relations: ['group', 'frontendIp', 'frontendPort', 'backendIps', 'backendPort', 'firewall'],
    });
    if (!haProxyRule) {
      throw new Error('HAProxy rule not found');
    }

    Object.assign(haProxyRule, {
      active: data.active === undefined ? data.active : haProxyRule.active,
      style: data.style === undefined ? haProxyRule.style : data.style,
      cfg_text: data.cfg_text === undefined ? haProxyRule.cfg_text : data.cfg_text,
      comment: data.comment === undefined ? haProxyRule.comment : data.comment,
      rule_order: data.rule_order === undefined ? haProxyRule.rule_order : data.rule_order,
    });

    if (data.group !== undefined) {
      if (haProxyRule.group && !data.group && haProxyRule.group.rules.length === 1) {
        await this._groupService.remove({ id: haProxyRule.group.id });
      }
      haProxyRule.group = data.group
        ? await db
            .getSource()
            .manager.getRepository(HAProxyGroup)
            .findOne({ where: { id: data.group } })
        : null;
    } else if (data.backendIpsIds) {
      await this.validateBackendIps(haProxyRule.firewall, data);
      haProxyRule.backendIps = data.backendIpsIds.map(
        (item) =>
          ({
            haproxyRuleId: haProxyRule.id,
            ipObjId: item.id,
            order: item.order,
          }) as HAProxyRuleToIPObj,
      );
    } else {
      const fieldsToUpdate: string[] = [
        'frontendIpId',
        'frontendPortId',
        'backendPortId',
        'firewallId',
      ];

      for (const field of fieldsToUpdate) {
        if (data[field] !== undefined) {
          haProxyRule[field.slice(0, -2)] = (await db
            .getSource()
            .manager.getRepository(field === 'firewallId' ? Firewall : IPObj)
            .findOneOrFail(data[field])) as Firewall | IPObj;
        }
      }
    }

    if (haProxyRule.frontendIp && haProxyRule.backendIps) {
      const frontendIpVersion = haProxyRule.frontendIp.ip_version;

      const backendIpVersions = await Promise.all(
        haProxyRule.backendIps.map(async (backEndIp) => {
          const ipObj = await db
            .getSource()
            .manager.getRepository(IPObj)
            .findOne({ where: { id: backEndIp.ipObjId } });
          return ipObj.ip_version;
        }),
      );

      const hasMatchingIpVersion = backendIpVersions.some(
        (version) => version === frontendIpVersion,
      );

      if (!hasMatchingIpVersion) {
        throw new Error('IP version mismatch');
      }
    }

    if (haProxyRule.frontendPort && haProxyRule.backendPort) {
      const frontendPortProtocol = haProxyRule.frontendPort.protocol;

      const backendPortProtocol = haProxyRule.backendPort.protocol;

      if (frontendPortProtocol !== backendPortProtocol) {
        throw new Error('Protocol mismatch');
      }
    }

    return await this._repository.save(haProxyRule);
  }

  async remove(path: IFindOneHAProxyRPath): Promise<HAProxyRule> {
    const haProxyRule: HAProxyRule = await this._repository.findOne({
      where: {
        id: path.id,
      },
      relations: ['group', 'firewall'],
    });

    haProxyRule.backendIps = [];

    await this._repository.save(haProxyRule);

    if (haProxyRule.group && haProxyRule.group.rules.length === 1) {
      await this._groupService.remove({ id: haProxyRule.group.id });
    }

    await this._repository.remove(haProxyRule);

    return haProxyRule;
  }

  findOneInPath(
    path: IFindOneHAProxyRPath,
    options?: FindOneOptions<HAProxyRule>,
  ): Promise<HAProxyRule> {
    return this.getFindInPathOptions(path, options).getOne();
  }

  protected getFindInPathOptions(
    path: Partial<IFindOneHAProxyRPath>,
    options: FindOneOptions<HAProxyRule> = {},
  ): SelectQueryBuilder<HAProxyRule> {
    const qb: SelectQueryBuilder<HAProxyRule> = db
      .getSource()
      .manager.getRepository(HAProxyRule)
      .createQueryBuilder('haproxy');
    qb.innerJoin('haproxy.firewall', 'firewall').innerJoin('firewall.fwCloud', 'fwcloud');

    if (path.fwcloudId) {
      qb.andWhere('firewall.fwCloudId = :fwcloudId', {
        fwcloudId: path.fwcloudId,
      });
    }
    if (path.firewallId) {
      qb.andWhere('firewall.id = :firewallId', { firewallId: path.firewallId });
    }
    if (path.id) {
      qb.andWhere('haproxy.id = :id', { id: path.id });
    }

    // Aplica las opciones adicionales que se pasaron a la función
    Object.entries(options).forEach(([key, value]) => {
      switch (key) {
        case 'where':
          qb.andWhere(value);
          break;
        case 'relations':
          qb.leftJoinAndSelect(`haproxy.${value}`, `${value}`);
          break;
        default:
      }
    });

    return qb;
  }

  public async getHAProxyRulesData<T extends ItemForGrid | HAProxyRuleItemForCompiler>(
    dst: AvailableDestinations,
    fwcloud: number,
    firewall: number,
    rules?: number[],
  ): Promise<HAProxyRulesData<T>[]> {
    let rulesData: HAProxyRulesData<T>[];

    switch (dst) {
      case 'haproxy_grid':
        rulesData = (await this._repository.getHAProxyRules(
          fwcloud,
          firewall,
          rules,
        )) as HAProxyRulesData<T>[];
        break;
      case 'compiler':
        rulesData = (await this._repository.getHAProxyRules(
          fwcloud,
          firewall,
          rules,
          true,
        )) as HAProxyRulesData<T>[];
        break;
    }

    const ItemsArrayMap: Map<number, T[]> = new Map<number, T[]>();
    for (let i = 0; i < rulesData.length; i++) {
      rulesData[i].items = [];
      ItemsArrayMap.set(rulesData[i].id, rulesData[i].items);
    }

    const sqls: SelectQueryBuilder<IPObj | IPObjGroup>[] =
      dst === 'compiler'
        ? this.buildHAProxyRulesCompilerSql(fwcloud, firewall)
        : this.getHAProxyRulesGridSql(fwcloud, firewall);

    await Promise.all(sqls.map((sql) => HAProxyUtils.mapEntityData<T>(sql, ItemsArrayMap)));

    return rulesData.map((rule) => {
      if (rule.items) {
        rule.items = rule.items.sort((a, b) => a._order - b._order);
      }
      return rule;
    });
  }

  public async bulkUpdate(ids: number[], data: IUpdateHAProxyRule): Promise<HAProxyRule[]> {
    if (data.group) {
      await this._repository.update(
        {
          id: In(ids),
        },
        { ...data, group: { id: data.group } },
      );
    } else {
      const group = (
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
        data as QueryDeepPartialEntity<HAProxyRule>,
      );
    }

    return this._repository.find({
      where: {
        id: In(ids),
      },
    });
  }

  public async bulkRemove(ids: number[]): Promise<HAProxyRule[]> {
    const rules: HAProxyRule[] = await this._repository.find({
      where: {
        id: In(ids),
      },
    });

    for (const rule of rules) {
      await this.remove({ id: rule.id });
    }

    return rules;
  }

  private getHAProxyRulesGridSql(
    fwcloud: number,
    firewall: number,
  ): SelectQueryBuilder<IPObj | IPObjGroup>[] {
    return [this._ipobjRepository.getIPObjsInHAProxy_ForGrid('rule', fwcloud, firewall)];
  }

  private buildHAProxyRulesCompilerSql(
    fwcloud: number,
    firewall: number,
  ): SelectQueryBuilder<IPObj | IPObjGroup>[] {
    return [this._ipobjRepository.getIPObjsInHAProxy_ForGrid('rule', fwcloud, firewall)];
  }

  async validateBackendIps(firewall: Firewall, data: IUpdateHAProxyRule): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.backendIpsIds || data.backendIpsIds.length === 0) {
      return;
    }

    const ipObjs: IPObj[] = await db
      .getSource()
      .manager.getRepository(IPObj)
      .find({
        where: {
          id: In(data.backendIpsIds.map((item) => item.id)),
          ipObjTypeId: 5,
        },
        relations: ['fwCloud'],
      });

    for (let i = 0; i < ipObjs.length; i++) {
      const ipObj: IPObj = ipObjs[i];

      if (ipObj.fwCloudId && ipObj.fwCloudId !== firewall.fwCloudId) {
        errors[`ipObjIds.${i}`] = ['ipObj id must exist'];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }
}
