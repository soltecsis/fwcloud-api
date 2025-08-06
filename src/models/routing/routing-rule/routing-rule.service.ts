/*!
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { Application } from '../../../Application';
import db from '../../../database/database-manager';
import { ValidationException } from '../../../fonaments/exceptions/validation-exception';
import { Service } from '../../../fonaments/services/service';
import { ErrorBag } from '../../../fonaments/validation/validator';
import { Offset } from '../../../offset';
import { Firewall } from '../../firewall/Firewall';
import { FirewallService } from '../../firewall/firewall.service';
import { Interface } from '../../interface/Interface';
import { IPObj } from '../../ipobj/IPObj';
import { IPObjRepository } from '../../ipobj/IPObj.repository';
import { IPObjGroup } from '../../ipobj/IPObjGroup';
import { IPObjGroupRepository } from '../../ipobj/IPObjGroup.repository';
import { Mark } from '../../ipobj/Mark';
import { MarkRepository } from '../../ipobj/Mark.repository';
import { PolicyRuleToIPObj } from '../../policy/PolicyRuleToIPObj';
import { OpenVPN } from '../../vpn/openvpn/OpenVPN';
import { OpenVPNRepository } from '../../vpn/openvpn/openvpn-repository';
import { OpenVPNPrefix } from '../../vpn/openvpn/OpenVPNPrefix';
import { OpenVPNPrefixRepository } from '../../vpn/openvpn/OpenVPNPrefix.repository';
import { RoutingTable } from '../routing-table/routing-table.model';
import {
  AvailableDestinations,
  ItemForGrid,
  RoutingRuleItemForCompiler,
  RoutingUtils,
} from '../shared';
import { RoutingRuleToIPObjGroup } from './routing-rule-to-ipobj-group.model';
import { RoutingRuleToIPObj } from './routing-rule-to-ipobj.model';
import { RoutingRuleToMark } from './routing-rule-to-mark.model';
import { RoutingRuleToOpenVPNPrefix } from './routing-rule-to-openvpn-prefix.model';
import { RoutingRuleToOpenVPN } from './routing-rule-to-openvpn.model';
import { RoutingRule } from './routing-rule.model';
import {
  IFindManyRoutingRulePath,
  IFindOneRoutingRulePath,
  RoutingRuleRepository,
} from './routing-rule.repository';
import { RoutingGroup } from '../routing-group/routing-group.model';
import { RoutingGroupService } from '../routing-group/routing-group.service';
import { DatabaseService } from '../../../database/database.service';
import { WireGuardRepository } from '../../vpn/wireguard/wireguard-repository';
import { WireGuardPrefixRepository } from '../../vpn/wireguard/WireGuardPrefix.repository';
import { RoutingRuleToWireGuard } from './routing-rule-to-wireguard.model';
import { RoutingRuleToWireGuardPrefix } from './routing-rule-to-wireguard-prefix.model';
import { WireGuardPrefix } from '../../vpn/wireguard/WireGuardPrefix';
import { WireGuard } from '../../vpn/wireguard/WireGuard';
import { IPSecRepository } from '../../vpn/ipsec/ipsec-repository';
import { IPSecPrefixRepository } from '../../vpn/ipsec/IPSecPrefix.repository';
import { RoutingRuleToIPSecPrefix } from './routing-rule-to-ipsec-prefix.model';
import { RoutingRuleToIPSec } from './routing-rule-to-ipsec.model';
import { IPSec } from '../../vpn/ipsec/IPSec';
import { IPSecPrefix } from '../../vpn/ipsec/IPSecPrefix';

export interface ICreateRoutingRule {
  routingTableId: number;
  active?: boolean;
  comment?: string;
  style?: string;
  firewallApplyToId?: number;
  ipObjIds?: { id: number; order: number }[];
  ipObjGroupIds?: { id: number; order: number }[];
  openVPNIds?: { id: number; order: number }[];
  openVPNPrefixIds?: { id: number; order: number }[];
  wireGuardIds?: { id: number; order: number }[];
  wireGuardPrefixIds?: { id: number; order: number }[];
  ipSecIds?: { id: number; order: number }[];
  ipSecPrefixIds?: { id: number; order: number }[];
  markIds?: { id: number; order: number }[];
  to?: number; //Reference where create the rule
  offset?: Offset;
}

interface IUpdateRoutingRule {
  routingTableId?: number;
  active?: boolean;
  comment?: string;
  rule_order?: number;
  style?: string;
  firewallApplyToId?: number;
  ipObjIds?: { id: number; order: number }[];
  ipObjGroupIds?: { id: number; order: number }[];
  openVPNIds?: { id: number; order: number }[];
  openVPNPrefixIds?: { id: number; order: number }[];
  wireGuardIds?: { id: number; order: number }[];
  wireGuardPrefixIds?: { id: number; order: number }[];
  ipSecIds?: { id: number; order: number }[];
  ipSecPrefixIds?: { id: number; order: number }[];
  markIds?: { id: number; order: number }[];
}

interface IBulkUpdateRoutingRule {
  routingGroupId?: number;
  style?: string;
  active?: boolean;
}

export interface RoutingRulesData<T extends ItemForGrid | RoutingRuleItemForCompiler>
  extends RoutingRule {
  items: (T & { _order: number })[];
}

interface IMoveFromRoutingRule {
  fromId: number;
  toId: number;
  ipObjId?: number;
  ipObjGroupId?: number;
  openVPNId?: number;
  openVPNPrefixId?: number;
  wireguardId?: number;
  wireguardPrefixId?: number;
  ipsecId?: number;
  ipsecPrefixId?: number;
  markId?: number;
}

export class RoutingRuleService extends Service {
  protected _repository: RoutingRuleRepository;
  private _ipobjRepository: IPObjRepository;
  private _ipobjGroupRepository: IPObjGroupRepository;
  private _openvpnRepository: OpenVPNRepository;
  private _openvpnPrefixRepository: OpenVPNPrefixRepository;
  private _markRepository: MarkRepository;
  private _routingTableRepository: Repository<RoutingTable>;
  protected _firewallService: FirewallService;
  private _groupService: RoutingGroupService;
  private _databaseService: DatabaseService;
  private _wireguardRepository: WireGuardRepository;
  private _wireguardPrefixRepository: WireGuardPrefixRepository;
  private _ipsecRepository: IPSecRepository;
  private _ipsecPrefixRepository: IPSecPrefixRepository;

  constructor(app: Application) {
    super(app);
    this._groupService = new RoutingGroupService(app);
  }

  public async build(): Promise<Service> {
    this._databaseService = await this._app.getService(DatabaseService.name);
    this._repository = new RoutingRuleRepository(this._databaseService.dataSource.manager);
    this._ipobjRepository = new IPObjRepository(this._databaseService.dataSource.manager);
    this._ipobjGroupRepository = new IPObjGroupRepository(this._databaseService.dataSource.manager);
    this._openvpnRepository = new OpenVPNRepository(this._databaseService.dataSource.manager);
    this._openvpnPrefixRepository = new OpenVPNPrefixRepository(
      this._databaseService.dataSource.manager,
    );
    this._wireguardRepository = new WireGuardRepository(this._databaseService.dataSource.manager);
    this._wireguardPrefixRepository = new WireGuardPrefixRepository(
      this._databaseService.dataSource.manager,
    );
    this._ipsecRepository = new IPSecRepository(this._databaseService.dataSource.manager);
    this._ipsecPrefixRepository = new IPSecPrefixRepository(
      this._databaseService.dataSource.manager,
    );
    this._markRepository = new MarkRepository(this._databaseService.dataSource.manager);
    this._routingTableRepository =
      this._databaseService.dataSource.manager.getRepository(RoutingTable);
    this._firewallService = await this._app.getService(FirewallService.name);
    return this;
  }

  findManyInPath(path: IFindManyRoutingRulePath): Promise<RoutingRule[]> {
    return this._repository.findManyInPath(path);
  }

  findOneInPath(path: IFindOneRoutingRulePath): Promise<RoutingRule | undefined> {
    return this._repository.findOneInPath(path);
  }

  findOneInPathOrFail(path: IFindOneRoutingRulePath): Promise<RoutingRule> {
    return this._repository.findOneInPathOrFail(path);
  }

  async create(data: ICreateRoutingRule): Promise<RoutingRule> {
    const routingTable: RoutingTable = await this._routingTableRepository.findOneOrFail({
      where: {
        id: data.routingTableId,
      },
      relations: ['firewall'],
    });
    const firewall: Firewall = routingTable.firewall;

    const routingRuleData: Partial<RoutingRule> = {
      routingTableId: data.routingTableId,
      active: data.active,
      comment: data.comment,
      style: data.style,
    };

    const lastRule: RoutingRule = await this._repository.getLastRoutingRuleInFirewall(
      routingTable.firewallId,
    );
    const rule_order: number = lastRule?.rule_order ? lastRule.rule_order + 1 : 1;
    routingRuleData.rule_order = rule_order;

    let persisted: RoutingRule = await this._repository.save(routingRuleData);
    try {
      persisted = await this.update(persisted.id, {
        ipObjIds: data.ipObjIds,
        ipObjGroupIds: data.ipObjGroupIds,
        openVPNIds: data.openVPNIds,
        openVPNPrefixIds: data.openVPNPrefixIds,
        wireGuardIds: data.wireGuardIds,
        wireGuardPrefixIds: data.wireGuardPrefixIds,
        ipSecIds: data.ipSecIds,
        ipSecPrefixIds: data.ipSecPrefixIds,
        firewallApplyToId: data.firewallApplyToId,
        markIds: data.markIds,
      });
    } catch (e) {
      await this.remove({
        id: persisted.id,
      });

      throw e;
    }

    if (
      Object.prototype.hasOwnProperty.call(data, 'to') &&
      Object.prototype.hasOwnProperty.call(data, 'offset')
    ) {
      return (await this.move([persisted.id], data.to, data.offset))[0];
    }

    // There is no need to update compilation status as it is done during update()
    //await this._firewallService.markAsUncompiled(firewall.id);

    return persisted;
  }

  async copy(ids: number[], destRule: number, offset: Offset): Promise<RoutingRule[]> {
    const routes: RoutingRule[] = await this._repository.find({
      where: {
        id: In(ids),
      },
      relations: [
        'routingTable',
        'routingRuleToMarks',
        'routingRuleToIPObjs',
        'routingRuleToIPObjGroups',
        'routingRuleToOpenVPNs',
        'routingRuleToOpenVPNPrefixes',
        'routingRuleToWireGuards',
        'routingRuleToWireGuardPrefixes',
        'routingRuleToIPSecs',
        'routingRuleToIPSecPrefixes',
      ],
    });

    const lastRule: RoutingRule = await this._repository.getLastRoutingRuleInFirewall(
      routes[0].routingTable.firewallId,
    );
    routes.map((item, index) => {
      item.id = undefined;
      item.rule_order = lastRule.rule_order + index + 1;
    });

    const persisted: RoutingRule[] = await this._repository.save(routes);

    await this._firewallService.markAsUncompiled(
      persisted.map((route) => route.routingTable.firewallId),
    );

    return this.move(
      persisted.map((item) => item.id),
      destRule,
      offset,
    );
  }

  async update(id: number, data: IUpdateRoutingRule): Promise<RoutingRule> {
    let rule: RoutingRule = await this._repository.preload(
      Object.assign(
        {
          routingTableId: data.routingTableId,
          active: data.active,
          comment: data.comment,
        },
        { id },
      ),
    );

    const firewall: Firewall = (
      await this._repository.findOne({
        where: { id: rule.id },
        relations: ['routingTable', 'routingTable.firewall'],
      })
    ).routingTable.firewall;
    await this.validateFromRestriction(rule.id, data);

    if (data.ipObjIds) {
      await this.validateUpdateIPObjs(firewall, data);
      rule.routingRuleToIPObjs = data.ipObjIds.map(
        (item) =>
          ({
            ipObjId: item.id,
            routingRuleId: rule.id,
            order: item.order,
          }) as RoutingRuleToIPObj,
      );
    }

    if (data.ipObjGroupIds) {
      await this.validateUpdateIPObjGroups(firewall, data);
      rule.routingRuleToIPObjGroups = data.ipObjGroupIds.map(
        (item) =>
          ({
            routingRuleId: rule.id,
            ipObjGroupId: item.id,
            order: item.order,
          }) as RoutingRuleToIPObjGroup,
      );
    }

    if (data.openVPNIds) {
      await this.validateOpenVPNs(firewall, data);

      rule.routingRuleToOpenVPNs = data.openVPNIds.map(
        (item) =>
          ({
            routingRuleId: rule.id,
            openVPNId: item.id,
            order: item.order,
          }) as RoutingRuleToOpenVPN,
      );
    }

    if (data.openVPNPrefixIds) {
      await this.validateOpenVPNPrefixes(firewall, data);

      rule.routingRuleToOpenVPNPrefixes = data.openVPNPrefixIds.map(
        (item) =>
          ({
            routingRuleId: rule.id,
            openVPNPrefixId: item.id,
            order: item.order,
          }) as RoutingRuleToOpenVPNPrefix,
      );
    }

    if (data.wireGuardIds) {
      await this.validateWireGuards(firewall, data);
      rule.routingRuleToWireGuards = data.wireGuardIds.map(
        (item) =>
          ({
            routingRuleId: rule.id,
            wireGuardId: item.id,
            order: item.order,
          }) as RoutingRuleToWireGuard,
      );
    }

    if (data.wireGuardPrefixIds) {
      await this.validateWireGuardPrefixes(firewall, data);
      rule.routingRuleToWireGuardPrefixes = data.wireGuardPrefixIds.map(
        (item) =>
          ({
            routingRuleId: rule.id,
            wireGuardPrefixId: item.id,
            order: item.order,
          }) as RoutingRuleToWireGuardPrefix,
      );
    }

    if (data.ipSecIds) {
      await this.validateIPSecs(firewall, data);
      rule.routingRuleToIPSecs = data.ipSecIds.map(
        (item) =>
          ({
            routingRuleId: rule.id,
            ipsecId: item.id,
            order: item.order,
          }) as RoutingRuleToIPSec,
      );
    }

    if (data.ipSecPrefixIds) {
      await this.validateIPSecPrefixes(firewall, data);
      rule.routingRuleToIPSecPrefixes = data.ipSecPrefixIds.map(
        (item) =>
          ({
            routingRuleId: rule.id,
            ipsecPrefixId: item.id,
            order: item.order,
          }) as RoutingRuleToIPSecPrefix,
      );
    }

    await this.validateFirewallApplyToId(firewall, data);
    rule.firewallApplyToId = data.firewallApplyToId;

    if (data.markIds) {
      await this.validateMarks(firewall, data);

      rule.routingRuleToMarks = data.markIds.map(
        (item) =>
          ({
            markId: item.id,
            routingRuleId: rule.id,
            order: item.order,
          }) as RoutingRuleToMark,
      );
    }

    rule = await this._repository.save(rule);

    await this.reorderFrom(rule.id);

    await this._firewallService.markAsUncompiled(firewall.id);

    return rule;
  }

  protected async reorderFrom(ruleId: number): Promise<void> {
    const rule: RoutingRule = await this._repository.findOneOrFail({
      where: { id: ruleId },
      relations: [
        'routingRuleToMarks',
        'routingRuleToIPObjs',
        'routingRuleToIPObjGroups',
        'routingRuleToOpenVPNs',
        'routingRuleToOpenVPNPrefixes',
        'routingRuleToWireGuards',
        'routingRuleToWireGuardPrefixes',
      ],
    });

    const items: { order: number }[] = [].concat(
      rule.routingRuleToIPObjs,
      rule.routingRuleToIPObjGroups,
      rule.routingRuleToMarks,
      rule.routingRuleToOpenVPNPrefixes,
      rule.routingRuleToOpenVPNs,
      rule.routingRuleToWireGuards,
      rule.routingRuleToWireGuardPrefixes,
    );

    items
      .sort((a, b) => a.order - b.order)
      .map((item, index) => {
        item.order = index + 1;
        return item;
      });

    await this._repository.save(rule);
  }

  async bulkUpdate(ids: number[], data: IBulkUpdateRoutingRule): Promise<RoutingRule[]> {
    if (data.routingGroupId) {
      await this._repository.update(
        {
          id: In(ids),
        },
        { ...data, routingGroupId: data.routingGroupId },
      );
    } else {
      const group: RoutingGroup = (
        await this._repository.findOneOrFail({
          where: { id: ids[0] },
          relations: ['routingGroup'],
        })
      ).routingGroup;
      if (
        data.routingGroupId !== undefined &&
        group &&
        group.routingRules.length - ids.length < 1
      ) {
        await this._groupService.remove({ id: group.id });
      }

      await this._repository.update(
        {
          id: In(ids),
        },
        data,
      );
    }

    const firewallIds: number[] = (
      await this._repository
        .createQueryBuilder('rule')
        .innerJoinAndSelect('rule.routingTable', 'table')
        .where('rule.id IN (:...ids)', { ids })
        .getMany()
    ).map((rule) => rule.routingTable.firewallId);

    await this._firewallService.markAsUncompiled(firewallIds);

    return this._repository.find({
      where: {
        id: In(ids),
      },
    });
  }

  async move(ids: number[], destRule: number, offset: Offset): Promise<RoutingRule[]> {
    const destinationRule: RoutingRule = await this._repository.findOneOrFail({
      where: {
        id: destRule,
      },
      relations: ['routingGroup'],
    });

    const sourceRules: RoutingRule[] = await this._repository.findBy({
      id: In(ids),
    });

    const rules: RoutingRule[] = await this._repository.move(ids, destRule, offset);

    const firewallIds: number[] = (
      await this._repository
        .createQueryBuilder('rule')
        .innerJoinAndSelect('rule.routingTable', 'table')
        .where('rule.id IN (:...ids)', { ids })
        .getMany()
    ).map((rule) => rule.routingTable.firewallId);

    await this._firewallService.markAsUncompiled(firewallIds);

    if (
      !destinationRule.routingGroup &&
      sourceRules[0].routingGroup &&
      sourceRules[0].routingGroup.routingRules.length - ids.length < 1
    ) {
      await this._groupService.remove({ id: sourceRules[0].routingGroup.id });
    }

    return rules;
  }

  async moveFrom(
    fromId: number,
    toId: number,
    data: IMoveFromRoutingRule,
  ): Promise<[RoutingRule, RoutingRule]> {
    const fromRule: RoutingRule = await db
      .getSource()
      .manager.getRepository(RoutingRule)
      .findOneOrFail({
        where: { id: fromId },
        relations: [
          'routingRuleToMarks',
          'routingRuleToIPObjs',
          'routingRuleToIPObjGroups',
          'routingRuleToOpenVPNs',
          'routingRuleToOpenVPNPrefixes',
          'routingRuleToWireGuards',
          'routingRuleToWireGuardPrefixes',
          'routingRuleToIPSecs',
          'routingRuleToIPSecPrefixes',
        ],
      });
    const toRule: RoutingRule = await db
      .getSource()
      .manager.getRepository(RoutingRule)
      .findOneOrFail({
        where: { id: toId },
        relations: [
          'routingRuleToMarks',
          'routingRuleToIPObjs',
          'routingRuleToIPObjGroups',
          'routingRuleToOpenVPNs',
          'routingRuleToOpenVPNPrefixes',
          'routingRuleToWireGuards',
          'routingRuleToWireGuardPrefixes',
          'routingRuleToIPSecs',
          'routingRuleToIPSecPrefixes',
        ],
      });

    let lastPosition: number = 0;

    []
      .concat(
        toRule.routingRuleToIPObjs,
        toRule.routingRuleToIPObjGroups,
        toRule.routingRuleToOpenVPNs,
        toRule.routingRuleToOpenVPNPrefixes,
        toRule.routingRuleToMarks,
        toRule.routingRuleToWireGuards,
        toRule.routingRuleToWireGuardPrefixes,
        toRule.routingRuleToIPSecs,
        toRule.routingRuleToIPSecPrefixes,
      )
      .forEach((item) => {
        lastPosition < item.order ? (lastPosition = item.order) : null;
      });

    if (data.ipObjId !== undefined) {
      const index: number = fromRule.routingRuleToIPObjs.findIndex(
        (item) => item.ipObjId === data.ipObjId,
      );
      if (index >= 0) {
        fromRule.routingRuleToIPObjs.splice(index, 1);
        toRule.routingRuleToIPObjs.push({
          routingRuleId: toRule.id,
          ipObjId: data.ipObjId,
          order: lastPosition + 1,
        } as RoutingRuleToIPObj);
      }
    }

    if (data.ipObjGroupId !== undefined) {
      const index: number = fromRule.routingRuleToIPObjGroups.findIndex(
        (item) => item.ipObjGroupId === data.ipObjGroupId,
      );
      if (index >= 0) {
        fromRule.routingRuleToIPObjGroups.splice(index, 1);
        toRule.routingRuleToIPObjGroups.push({
          routingRuleId: toRule.id,
          ipObjGroupId: data.ipObjGroupId,
          order: lastPosition + 1,
        } as RoutingRuleToIPObjGroup);
      }
    }

    if (data.openVPNId !== undefined) {
      const index: number = fromRule.routingRuleToOpenVPNs.findIndex(
        (item) => item.openVPNId === data.openVPNId,
      );
      if (index >= 0) {
        fromRule.routingRuleToOpenVPNs.splice(index, 1);
        toRule.routingRuleToOpenVPNs.push({
          routingRuleId: toRule.id,
          openVPNId: data.openVPNId,
          order: lastPosition + 1,
        } as RoutingRuleToOpenVPN);
      }
    }

    if (data.openVPNPrefixId !== undefined) {
      const index: number = fromRule.routingRuleToOpenVPNPrefixes.findIndex(
        (item) => item.openVPNPrefixId === data.openVPNPrefixId,
      );
      if (index >= 0) {
        fromRule.routingRuleToOpenVPNPrefixes.splice(index, 1);
        toRule.routingRuleToOpenVPNPrefixes.push({
          routingRuleId: toRule.id,
          openVPNPrefixId: data.openVPNPrefixId,
          order: lastPosition + 1,
        } as RoutingRuleToOpenVPNPrefix);
      }
    }

    if (data.wireguardId !== undefined) {
      const index: number = fromRule.routingRuleToWireGuards.findIndex(
        (item) => item.wireGuardId === data.wireguardId,
      );
      if (index >= 0) {
        fromRule.routingRuleToWireGuards.splice(index, 1);
        toRule.routingRuleToWireGuards.push({
          routingRuleId: toRule.id,
          wireGuardId: data.wireguardId,
          order: lastPosition + 1,
        } as RoutingRuleToWireGuard);
      }
    }

    if (data.wireguardPrefixId !== undefined) {
      const index: number = fromRule.routingRuleToWireGuardPrefixes.findIndex(
        (item) => item.wireGuardPrefixId === data.wireguardPrefixId,
      );
      if (index >= 0) {
        fromRule.routingRuleToWireGuardPrefixes.splice(index, 1);
        toRule.routingRuleToWireGuardPrefixes.push({
          routingRuleId: toRule.id,
          wireGuardPrefixId: data.wireguardPrefixId,
          order: lastPosition + 1,
        } as RoutingRuleToWireGuardPrefix);
      }
    }

    if (data.ipsecId !== undefined) {
      const index: number = fromRule.routingRuleToIPSecs.findIndex(
        (item) => item.ipsecId === data.ipsecId,
      );
      if (index >= 0) {
        fromRule.routingRuleToIPSecs.splice(index, 1);
        toRule.routingRuleToIPSecs.push({
          routingRuleId: toRule.id,
          ipsecId: data.ipsecId,
          order: lastPosition + 1,
        } as RoutingRuleToIPSec);
      }
    }

    if (data.ipsecPrefixId !== undefined) {
      const index: number = fromRule.routingRuleToIPSecPrefixes.findIndex(
        (item) => item.ipsecPrefixId === data.ipsecPrefixId,
      );
      if (index >= 0) {
        fromRule.routingRuleToIPSecPrefixes.splice(index, 1);
        toRule.routingRuleToIPSecPrefixes.push({
          routingRuleId: toRule.id,
          ipsecPrefixId: data.ipsecPrefixId,
          order: lastPosition + 1,
        } as RoutingRuleToIPSecPrefix);
      }
    }

    if (data.markId !== undefined) {
      const index: number = fromRule.routingRuleToMarks.findIndex(
        (item) => item.markId === data.markId,
      );
      if (index >= 0) {
        fromRule.routingRuleToMarks.splice(index, 1);
        toRule.routingRuleToMarks.push({
          routingRuleId: toRule.id,
          markId: data.markId,
          order: lastPosition + 1,
        } as RoutingRuleToMark);
      }
    }

    return (await this._repository.save([fromRule, toRule])) as [RoutingRule, RoutingRule];
  }

  async remove(path: IFindOneRoutingRulePath): Promise<RoutingRule> {
    const rule: RoutingRule = await this.findOneInPath(path);
    const firewall: Firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .createQueryBuilder('firewall')
      .innerJoin('firewall.routingTables', 'table')
      .innerJoin('table.routingRules', 'rule', 'rule.id = :id', { id: rule.id })
      .getOne();

    rule.routingRuleToOpenVPNs = [];
    rule.routingRuleToOpenVPNPrefixes = [];
    rule.routingRuleToIPObjGroups = [];
    rule.routingRuleToIPObjs = [];
    rule.routingRuleToMarks = [];
    rule.routingRuleToWireGuards = [];
    rule.routingRuleToWireGuardPrefixes = [];
    rule.routingRuleToIPSecs = [];
    rule.routingRuleToIPSecPrefixes = [];

    await this._repository.save(rule);

    await this._repository.remove(rule);

    await this._firewallService.markAsUncompiled(firewall.id);

    return rule;
  }

  async bulkRemove(ids: number[]): Promise<RoutingRule[]> {
    const rules: RoutingRule[] = await this._repository.find({
      where: {
        id: In(ids),
      },
    });

    // For unknown reason, this._repository.remove(routes) is not working
    for (const rule of rules) {
      await this.remove({
        id: rule.id,
      });
    }

    return rules;
  }

  /**
   * Returns an array of routing rules and in each rule an array of items containing the information
   * required for compile the routing rules of the indicated firewall or for show the routing rules
   * items in the FWCloud-UI.
   * @param dst
   * @param fwcloud
   * @param firewall
   * @param routingTable
   * @param route
   * @returns
   */
  public async getRoutingRulesData<T extends ItemForGrid | RoutingRuleItemForCompiler>(
    dst: AvailableDestinations,
    fwcloud: number,
    firewall: number,
    rules?: number[],
  ): Promise<RoutingRulesData<T>[]> {
    const rulesData: RoutingRulesData<T>[] = (await this._repository.getRoutingRules(
      fwcloud,
      firewall,
      rules,
    )) as RoutingRulesData<T>[];

    // Init the map for access the objects array for each route.
    const ItemsArrayMap = new Map<number, T[]>();
    for (let i = 0; i < rulesData.length; i++) {
      rulesData[i].items = [];

      // Map each route with it's corresponding items array.
      // These items array will be filled with objects data in the Promise.all()
      ItemsArrayMap.set(rulesData[i].id, rulesData[i].items);
    }

    const sqls =
      dst === 'grid'
        ? this.buildSQLsForGrid(fwcloud, firewall)
        : this.buildSQLsForCompiler(fwcloud, firewall, rules);
    await Promise.all(sqls.map((sql) => RoutingUtils.mapEntityData<T>(sql, ItemsArrayMap)));

    return rulesData.map((data) => {
      data.items = data.items.sort((a, b) => a._order - b._order);
      return data;
    });
  }

  /**
   * Checks IPObj are valid to be attached to the route. It will check:
   *  - IPObj belongs to the same FWCloud
   *  - IPObj contains at least one addres if its type is host
   *
   */
  protected async validateUpdateIPObjs(
    firewall: Firewall,
    data: IUpdateRoutingRule,
  ): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.ipObjIds || data.ipObjIds.length === 0) {
      return;
    }

    const ipObjs: IPObj[] = await db
      .getSource()
      .manager.getRepository(IPObj)
      .find({
        where: {
          id: In(data.ipObjIds.map((item) => item.id)),
          ipObjTypeId: In([
            5, // ADDRESS
            6, // ADDRESS RANGE
            7, // NETWORK
            8, // HOST
            9, // DNS
          ]),
        },
        relations: ['fwCloud'],
      });

    for (let i = 0; i < ipObjs.length; i++) {
      const ipObj: IPObj = ipObjs[i];

      if (ipObj.fwCloudId && ipObj.fwCloudId !== firewall.fwCloudId) {
        errors[`ipObjIds.${i}`] = ['ipObj id must exist'];
      }

      if (ipObj.ipObjTypeId === 8) {
        // 8 = HOST
        const addrs: any = await Interface.getHostAddr(db.getQuery(), ipObj.id);
        if (addrs.length === 0) {
          errors[`ipObjIds.${i}`] = ['ipObj must contain at least one address'];
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }

  /**
   * Validates FROM won't be empty after update
   *
   * @param ruleId
   * @param data
   * @returns
   */
  protected async validateFromRestriction(ruleId: number, data: IUpdateRoutingRule): Promise<void> {
    const rule = await this._repository.findOneOrFail({
      where: { id: ruleId },
      relations: [
        'routingRuleToMarks',
        'routingRuleToIPObjs',
        'routingRuleToIPObjGroups',
        'routingRuleToOpenVPNs',
        'routingRuleToOpenVPNPrefixes',
        'routingRuleToWireGuards',
        'routingRuleToWireGuardPrefixes',
        'routingRuleToIPSecs',
        'routingRuleToIPSecPrefixes',
      ],
    });

    const errors: ErrorBag = {};
    const marks: number = data.markIds ? data.markIds.length : rule.routingRuleToMarks.length;
    const ipObjs: number = data.ipObjIds ? data.ipObjIds.length : rule.routingRuleToIPObjs.length;
    const ipObjGroups: number = data.ipObjGroupIds
      ? data.ipObjGroupIds.length
      : rule.routingRuleToIPObjGroups.length;
    const openVPNs: number = data.openVPNIds
      ? data.openVPNIds.length
      : rule.routingRuleToOpenVPNs.length;
    const openVPNPrefixes: number = data.openVPNPrefixIds
      ? data.openVPNPrefixIds.length
      : rule.routingRuleToOpenVPNPrefixes.length;
    const wireguards: number = data.wireGuardIds
      ? data.wireGuardIds.length
      : rule.routingRuleToWireGuards.length;
    const wireguardPrefixes: number = data.wireGuardPrefixIds
      ? data.wireGuardPrefixIds.length
      : rule.routingRuleToWireGuardPrefixes.length;
    const ipsecs: number = data.ipSecIds
      ? data.ipSecIds.length
      : rule.routingRuleToWireGuards.length;
    const ipsecPrefixes: number = data.ipSecPrefixIds
      ? data.ipSecPrefixIds.length
      : rule.routingRuleToWireGuardPrefixes.length;
    if (
      marks +
        ipObjs +
        ipObjGroups +
        (openVPNs + openVPNPrefixes || wireguards + wireguardPrefixes || ipsecs + ipsecPrefixes) >
      0
    ) {
      return;
    }

    if (data.markIds && data.markIds.length === 0) {
      errors['markIds'] = ['From should contain at least one item'];
    }

    if (data.ipObjIds && data.ipObjIds.length === 0) {
      errors['ipObjIds'] = ['From should contain at least one item'];
    }

    if (data.openVPNIds && data.openVPNIds.length === 0) {
      errors['ipObjGroupIds'] = ['From should contain at least one item'];
    }

    if (data.openVPNPrefixIds && data.openVPNPrefixIds.length === 0) {
      errors['markIds'] = ['From should contain at least one item'];
    }

    if (data.wireGuardIds && data.wireGuardIds.length === 0) {
      errors['wireGuardIds'] = ['From should contain at least one item'];
    }

    if (data.wireGuardPrefixIds && data.wireGuardPrefixIds.length === 0) {
      errors['wireGuardPrefixIds'] = ['From should contain at least one item'];
    }

    if (data.ipSecIds && data.ipSecIds.length === 0) {
      errors['ipSecIds'] = ['From should contain at least one item'];
    }

    if (data.ipSecPrefixIds && data.ipSecPrefixIds.length === 0) {
      errors['ipSecPrefixIds'] = ['From should contain at least one item'];
    }

    throw new ValidationException('The given data was invalid', errors);
  }

  /**
   * Checks IPObjGroups are valid to be attached to the route. It will check:
   *  - IPObjGroup belongs to the same FWCloud
   *  - IPObjGroup is not empty
   *
   */
  protected async validateUpdateIPObjGroups(
    firewall: Firewall,
    data: IUpdateRoutingRule,
  ): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.ipObjGroupIds || data.ipObjGroupIds.length === 0) {
      return;
    }

    const ipObjGroups: IPObjGroup[] = await db
      .getSource()
      .manager.getRepository(IPObjGroup)
      .find({
        where: {
          id: In(data.ipObjGroupIds.map((item) => item.id)),
        },
        relations: ['fwCloud', 'ipObjToIPObjGroups', 'ipObjToIPObjGroups.ipObj'],
      });

    for (let i = 0; i < ipObjGroups.length; i++) {
      const ipObjGroup: IPObjGroup = ipObjGroups[i];

      if (ipObjGroup.type !== 20) {
        errors[`ipObjGroupIds.${i}`] = ['ipObjGroupId not valid'];
      } else if (ipObjGroup.fwCloudId && ipObjGroup.fwCloudId !== firewall.fwCloudId) {
        errors[`ipObjGroupIds.${i}`] = ['ipObjGroupId must exist'];
      } else if (await PolicyRuleToIPObj.isGroupEmpty(db.getQuery(), ipObjGroup.id)) {
        errors[`ipObjGroupIds.${i}`] = ['ipObjGroupId must not be empty'];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }

  protected async validateOpenVPNs(firewall: Firewall, data: IUpdateRoutingRule): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.openVPNIds || data.openVPNIds.length === 0) {
      return;
    }

    const openvpns: OpenVPN[] = await db
      .getSource()
      .manager.getRepository(OpenVPN)
      .createQueryBuilder('openvpn')
      .innerJoin('openvpn.crt', 'crt')
      .innerJoin('openvpn.firewall', 'firewall')
      .whereInIds(data.openVPNIds.map((item) => item.id))
      .andWhere('firewall.fwCloudId = :fwcloud', {
        fwcloud: firewall.fwCloudId,
      })
      .andWhere('openvpn.parentId IS NOT null')
      .andWhere('crt.type = 1')
      .getMany();

    for (let i = 0; i < data.openVPNIds.length; i++) {
      if (openvpns.findIndex((item) => item.id === data.openVPNIds[i].id) < 0) {
        errors[`openVPNIds.${i}.id`] = ['openVPN does not exists or is not a client'];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }

  protected async validateIPSecs(firewall: Firewall, data: IUpdateRoutingRule): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.ipSecIds || data.ipSecIds.length === 0) {
      return;
    }

    const ipsecs: IPSec[] = await db
      .getSource()
      .manager.getRepository(IPSec)
      .createQueryBuilder('wireguard')
      .innerJoin('wireguard.firewall', 'firewall')
      .whereInIds(data.ipSecIds.map((item) => item.id))
      .andWhere('firewall.fwCloudId = :fwcloud', {
        fwcloud: firewall.fwCloudId,
      })
      .getMany();

    for (let i = 0; i < data.ipSecIds.length; i++) {
      if (ipsecs.findIndex((item) => item.id === data.ipSecIds[i].id) < 0) {
        errors[`ipSecIds.${i}.id`] = ['ipsec does not exists'];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }

  protected async validateWireGuards(firewall: Firewall, data: IUpdateRoutingRule): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.wireGuardIds || data.wireGuardIds.length === 0) {
      return;
    }

    const wireguards: WireGuard[] = await db
      .getSource()
      .manager.getRepository(WireGuard)
      .createQueryBuilder('wireguard')
      .innerJoin('wireguard.firewall', 'firewall')
      .whereInIds(data.wireGuardIds.map((item) => item.id))
      .andWhere('firewall.fwCloudId = :fwcloud', {
        fwcloud: firewall.fwCloudId,
      })
      .getMany();

    for (let i = 0; i < data.wireGuardIds.length; i++) {
      if (wireguards.findIndex((item) => item.id === data.wireGuardIds[i].id) < 0) {
        errors[`wireGuardIds.${i}.id`] = ['wireguard does not exists'];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }

  protected async validateOpenVPNPrefixes(
    firewall: Firewall,
    data: IUpdateRoutingRule,
  ): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.openVPNPrefixIds || data.openVPNPrefixIds.length === 0) {
      return;
    }

    const openvpnprefixes: OpenVPNPrefix[] = await db
      .getSource()
      .manager.getRepository(OpenVPNPrefix)
      .createQueryBuilder('prefix')
      .innerJoin('prefix.openVPN', 'openvpn')
      .innerJoin('openvpn.firewall', 'firewall')
      .whereInIds(data.openVPNPrefixIds.map((item) => item.id))
      .andWhere('firewall.fwCloudId = :fwcloud', {
        fwcloud: firewall.fwCloudId,
      })
      .getMany();

    for (let i = 0; i < data.openVPNPrefixIds.length; i++) {
      if (openvpnprefixes.findIndex((item) => item.id === data.openVPNPrefixIds[i].id) < 0) {
        errors[`openVPNPrefixIds.${i}.id`] = ['openVPNPrefix does not exists'];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }

  protected async validateWireGuardPrefixes(
    firewall: Firewall,
    data: IUpdateRoutingRule,
  ): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.wireGuardPrefixIds || data.wireGuardPrefixIds.length === 0) {
      return;
    }

    const wireguardprefixes: WireGuardPrefix[] = await db
      .getSource()
      .manager.getRepository(WireGuardPrefix)
      .createQueryBuilder('prefix')
      .innerJoin('prefix.wireGuard', 'wireguard')
      .innerJoin('wireguard.firewall', 'firewall')
      .whereInIds(data.wireGuardPrefixIds.map((item) => item.id))
      .andWhere('firewall.fwCloudId = :fwcloud', {
        fwcloud: firewall.fwCloudId,
      })
      .getMany();

    for (let i = 0; i < data.wireGuardPrefixIds.length; i++) {
      if (wireguardprefixes.findIndex((item) => item.id === data.wireGuardPrefixIds[i].id) < 0) {
        errors[`wireGuardPrefixIds.${i}.id`] = ['wireguardPrefix does not exists'];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }

  protected async validateIPSecPrefixes(
    firewall: Firewall,
    data: IUpdateRoutingRule,
  ): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.ipSecPrefixIds || data.ipSecPrefixIds.length === 0) {
      return;
    }

    const ipsecprefixes: IPSecPrefix[] = await db
      .getSource()
      .manager.getRepository(IPSecPrefix)
      .createQueryBuilder('prefix')
      .innerJoin('prefix.ipSec', 'ipsec')
      .innerJoin('ipsec.firewall', 'firewall')
      .whereInIds(data.ipSecPrefixIds.map((item) => item.id))
      .andWhere('firewall.fwCloudId = :fwcloud', {
        fwcloud: firewall.fwCloudId,
      })
      .getMany();

    for (let i = 0; i < data.ipSecPrefixIds.length; i++) {
      if (ipsecprefixes.findIndex((item) => item.id === data.ipSecPrefixIds[i].id) < 0) {
        errors[`ipSecPrefixIds.${i}.id`] = ['ipsecPrefix does not exists'];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }

  protected async validateFirewallApplyToId(
    firewall: Firewall,
    data: IUpdateRoutingRule,
  ): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.firewallApplyToId) {
      return;
    }

    const firewallApplyToId: Firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .createQueryBuilder('firewall')
      .where('firewall.id = :id', { id: data.firewallApplyToId })
      .getOne();

    if (firewallApplyToId.clusterId !== firewall.clusterId) {
      errors[`firewallApplyToId`] = ['This firewall does not belong to cluster'];
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }

  protected async validateMarks(firewall: Firewall, data: IUpdateRoutingRule): Promise<void> {
    const errors: ErrorBag = {};

    if (!data.markIds || data.markIds.length === 0) {
      return;
    }

    const marks: Mark[] = await db
      .getSource()
      .manager.getRepository(Mark)
      .createQueryBuilder('mark')
      .innerJoin('mark.fwCloud', 'fwcloud')
      .innerJoin('fwcloud.firewalls', 'firewall')
      .whereInIds(data.markIds.map((item) => item.id))
      .andWhere('firewall.id = :firewall', { firewall: firewall.id })
      .getMany();

    for (let i = 0; i < data.markIds.length; i++) {
      if (marks.findIndex((item) => item.id === data.markIds[i].id) < 0) {
        errors[`markIds.${i}.id`] = ['mark does not exists'];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data was invalid', errors);
    }
  }

  private buildSQLsForCompiler(
    fwcloud: number,
    firewall: number,
    rules?: number[],
  ): SelectQueryBuilder<IPObj | Mark>[] {
    return [
      this._ipobjRepository.getIpobjsInRouting_excludeHosts('rule', fwcloud, firewall, null, rules),
      this._ipobjRepository.getIpobjsInRouting_onlyHosts('rule', fwcloud, firewall, null, rules),
      this._ipobjRepository.getIpobjsInGroupsInRouting_excludeHosts(
        'rule',
        fwcloud,
        firewall,
        null,
        rules,
      ),
      this._ipobjRepository.getIpobjsInGroupsInRouting_onlyHosts(
        'rule',
        fwcloud,
        firewall,
        null,
        rules,
      ),
      this._ipobjRepository.getIpobjsInOpenVPNInRouting('rule', fwcloud, firewall, null, rules),
      this._ipobjRepository.getIpobjsInOpenVPNInGroupsInRouting(
        'rule',
        fwcloud,
        firewall,
        null,
        rules,
      ),
      this._ipobjRepository.getIpobjsInOpenVPNPrefixesInRouting(
        'rule',
        fwcloud,
        firewall,
        null,
        rules,
      ),
      this._ipobjRepository.getIpobjsInOpenVPNPrefixesInGroupsInRouting(
        'rule',
        fwcloud,
        firewall,
        null,
        rules,
      ),
      /*this._ipobjRepository.getIpobjsInWireGuardInRouting('rule', fwcloud, firewall, null, rules),
      this._ipobjRepository.getIpobjsInWireGuardPrefixesInRouting(
        'rule',
        fwcloud,
        firewall,
        null,
        rules,
      ),
      this._ipobjRepository.getIpobjGroupsInWireGuardInRouting(
        'rule',
        fwcloud,
        firewall,
        null,
        rules,
      ),
      this._ipobjRepository.getIpobjGroupsInWireGuardPrefixesInRouting(
        'rule',
        fwcloud,
        firewall,
        null,
        rules,
      ),*/
      this._markRepository.getMarksInRoutingRules(fwcloud, firewall, rules),
    ];
  }

  private buildSQLsForGrid(
    fwcloud: number,
    firewall: number,
  ): SelectQueryBuilder<
    | IPObj
    | IPObjGroup
    | OpenVPN
    | OpenVPNPrefix
    | Mark
    | WireGuard
    | WireGuardPrefix
    | IPSec
    | IPSecPrefix
  >[] {
    return [
      this._ipobjRepository.getIpobjsInRouting_ForGrid('rule', fwcloud, firewall),
      this._ipobjGroupRepository.getIpobjGroupsInRouting_ForGrid('rule', fwcloud, firewall),
      this._openvpnRepository.getOpenVPNInRouting_ForGrid('rule', fwcloud, firewall),
      this._openvpnPrefixRepository.getOpenVPNPrefixInRouting_ForGrid('rule', fwcloud, firewall),
      this._markRepository.getMarksInRoutingRules_ForGrid(fwcloud, firewall),
      this._wireguardRepository.getWireGuardInRouting_ForGrid('rule', fwcloud, firewall),
      this._wireguardPrefixRepository.getWireGuardPrefixInRouting_ForGrid(
        'rule',
        fwcloud,
        firewall,
      ),
      this._ipsecRepository.getIPSecInRouting_ForGrid('rule', fwcloud, firewall),
      this._ipsecPrefixRepository.getIPSecPrefixInRouting_ForGrid('rule', fwcloud, firewall),
    ] as SelectQueryBuilder<
      | IPObj
      | IPObjGroup
      | OpenVPN
      | OpenVPNPrefix
      | Mark
      | WireGuard
      | WireGuardPrefix
      | IPSec
      | IPSecPrefix
    >[];
  }
}
