/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { And, EntityManager, In, IsNull, LessThan, MoreThan, MoreThanOrEqual, Not } from 'typeorm';
import { PolicyRule, SpecialPolicyRules } from './PolicyRule';
import { PolicyGroup } from './PolicyGroup';
import { PolicyRuleToIPObj } from './PolicyRuleToIPObj';
import { PolicyRuleToInterface } from './PolicyRuleToInterface';
import Query from '../../database/Query';
import { Repository } from '../../database/repository';
import { PolicyGroupRepository } from '../../repositories/PolicyGroupRepository';
import { isArray } from 'class-validator';
const fwcError = require('../../utils/error_table');

export class PolicyRuleRepository extends Repository<PolicyRule> {
  constructor(manager?: EntityManager) {
    super(PolicyRule, manager);
  }

  /**
   * Copies rules, in policy order, next to the destination rule: above it for offsets -1 and 0,
   * below it for offset 1. The copies join the destination rule's group unless `groupId` is
   * given: `null` places them outside any group, at a group boundary, and a number must be the
   * group of a rule next to the insertion point.
   */
  public async copyRules(
    firewallId: number,
    ruleIds: number[],
    destinationId: number,
    pasteOffset: number,
    groupId?: number | null,
  ): Promise<void> {
    if (!ruleIds.length) return;

    await this.manager.transaction(async (manager) => {
      const { destination, sources } = await lockPaste(
        manager,
        firewallId,
        ruleIds,
        destinationId,
        pasteOffset,
      );
      const pasteBelow = pasteOffset === 1;
      const policyGroupId = await resolvePasteGroup(manager, destination, groupId, pasteBelow);
      let nextOrder = await openOrderGap(manager, destination, pasteBelow, sources.length);

      const dbCon = new Query(manager.queryRunner);
      for (const source of sources) {
        const { identifiers } = await manager.insert(PolicyRule, {
          ...source,
          id: undefined,
          policyGroupId,
          rule_order: nextOrder++,
          created_at: undefined,
          updated_at: undefined,
          created_by: undefined,
          updated_by: undefined,
        });
        const copyId = identifiers[0].id;
        await PolicyRuleToIPObj.duplicatePolicy_r__ipobj(dbCon, source.id, copyId);
        await PolicyRuleToInterface.duplicatePolicy_r__interface(dbCon, source.id, copyId);
        await PolicyRule.duplicateVpnPositions(dbCon, source.id, copyId);
      }
    });
  }

  /**
   * Moves rules, as one block in policy order, above (offset -1) or below (offset 1) the
   * destination rule. Offset 0 keeps their positions and only changes their group. `groupId`
   * works as in copyRules(). Groups left empty by the move are removed.
   */
  public async moveRules(
    firewallId: number,
    ruleIds: number[],
    destinationId: number,
    pasteOffset: number,
    groupId?: number | null,
  ): Promise<void> {
    if (!ruleIds.length) return;
    if (ruleIds.includes(destinationId))
      throw fwcError.other('Paste on rule can not be part of the set of pasted rules.');

    await this.manager.transaction(async (manager) => {
      const { destination, sources } = await lockPaste(
        manager,
        firewallId,
        [...new Set(ruleIds)],
        destinationId,
        pasteOffset,
      );
      const movedIds = sources.map((source) => source.id);
      const pasteBelow = pasteOffset === 0 ? null : pasteOffset === 1;
      const policyGroupId = await resolvePasteGroup(
        manager,
        destination,
        groupId,
        pasteBelow,
        movedIds,
      );

      if (pasteBelow === null) {
        await manager.update(PolicyRule, movedIds, { policyGroupId });
      } else {
        let nextOrder = await openOrderGap(
          manager,
          destination,
          pasteBelow,
          sources.length,
          movedIds,
        );
        for (const id of movedIds)
          await manager.update(PolicyRule, id, { policyGroupId, rule_order: nextOrder++ });
      }

      const leftGroupIds = new Set(
        sources
          .map((source) => source.policyGroupId)
          .filter((id) => id !== null && id !== policyGroupId),
      );
      if (leftGroupIds.size) {
        const groupRepository = new PolicyGroupRepository(manager);
        for (const group of await manager.findBy(PolicyGroup, { id: In([...leftGroupIds]) }))
          await groupRepository.deleteIfEmpty(group);
      }
    });
  }

  /**
   * Updates one or multiple PolicyRule styles
   *
   * @param policyRule
   * @param style
   */
  public async updateStyle(policyRule: PolicyRule, style: string): Promise<PolicyRule>;
  public async updateStyle(policyRules: Array<PolicyRule>, style: string): Promise<PolicyRule>;
  public async updateStyle(
    oneOrMany: PolicyRule | Array<PolicyRule>,
    style: string,
  ): Promise<PolicyRule | Array<PolicyRule>> {
    const entities: Array<PolicyRule> = isArray(oneOrMany) ? oneOrMany : [oneOrMany];

    await this.createQueryBuilder()
      .update(PolicyRule)
      .set({ style: style })
      .whereInIds(this.getIdsFromEntityCollection(entities))
      .execute();

    return await this.reloadEntities(oneOrMany);
  }

  /**
   * Assign one or multiple policyRule to a PolicyGroup. If policyGroup is null, then policyRule is unassigned.
   *
   * @param policyRule
   * @param newPolicyGroup
   */
  public async assignToGroup(
    policyRule: PolicyRule,
    newPolicyGroup: PolicyGroup,
  ): Promise<PolicyRule>;
  public async assignToGroup(
    policyRules: Array<PolicyRule>,
    newPolicyGroup: PolicyGroup,
  ): Promise<Array<PolicyRule>>;
  public async assignToGroup(
    oneOrMany: PolicyRule | Array<PolicyRule>,
    newPolicyGroup: PolicyGroup = null,
  ): Promise<PolicyRule | Array<PolicyRule>> {
    const entities: Array<PolicyRule> = isArray(oneOrMany) ? oneOrMany : [oneOrMany];

    const criterias: any = {
      id: In(this.getIdsFromEntityCollection(entities)),
    };

    if (newPolicyGroup && newPolicyGroup.firewall) {
      criterias.firewall = newPolicyGroup.firewall;
    }

    await this.createQueryBuilder()
      .update(PolicyRule)
      .set({ policyGroup: newPolicyGroup })
      .where(criterias)
      .execute();

    return await this.reloadEntities(oneOrMany);
  }

  /**
   * Updates one or array of policyRule active flag
   *
   * @param policyRule
   * @param active
   */
  public async updateActive(policyRule: PolicyRule, active: 0 | 1): Promise<PolicyRule>;
  public async updateActive(
    policyRules: Array<PolicyRule>,
    active: 0 | 1,
  ): Promise<Array<PolicyRule>>;
  public async updateActive(
    oneOrMany: PolicyRule | Array<PolicyRule>,
    active: 0 | 1,
  ): Promise<PolicyRule | Array<PolicyRule>> {
    const entities: Array<PolicyRule> = isArray(oneOrMany) ? oneOrMany : [oneOrMany];

    await this.createQueryBuilder()
      .update(PolicyRule)
      .set({ active: active })
      .where({
        id: In(this.getIdsFromEntityCollection(entities)),
      })
      .andWhere(
        `(special=0 or special=${SpecialPolicyRules.HOOKSCRIPT} or special=${SpecialPolicyRules.FAIL2BAN})`,
      )
      .execute();

    return await this.reloadEntities(oneOrMany);
  }
}

function policyOf(rule: PolicyRule) {
  return { firewallId: rule.firewallId, policyTypeId: rule.policyTypeId ?? IsNull() };
}

/**
 * Locks the firewall and the rules of a copy or move, checks that they can be pasted at the
 * destination, and returns the pasted rules in policy order.
 */
async function lockPaste(
  manager: EntityManager,
  firewallId: number,
  ruleIds: number[],
  destinationId: number,
  pasteOffset: number,
): Promise<{ destination: PolicyRule; sources: PolicyRule[] }> {
  // Serialize pastes even when their selections and destination rules are different.
  await manager.query('SELECT id FROM firewall WHERE id = ? FOR UPDATE', [firewallId]);

  const selectedRules = await manager.find(PolicyRule, {
    where: { firewallId, id: In([...ruleIds, destinationId]) },
    lock: { mode: 'pessimistic_write' },
  });
  const rulesById = new Map(selectedRules.map((rule) => [rule.id, rule]));
  const destination = rulesById.get(destinationId);
  const sources = ruleIds.map((id) => rulesById.get(id));
  if (!destination || sources.some((source) => !source)) throw fwcError.NOT_FOUND;

  const catchAll: number = SpecialPolicyRules.CATCHALL;
  if (
    (pasteOffset === 1 && destination.special === catchAll) ||
    sources.some(
      (source) => source.special === catchAll || source.policyTypeId !== destination.policyTypeId,
    )
  ) {
    throw fwcError.NOT_ALLOWED;
  }

  sources.sort((a, b) => a.rule_order - b.rule_order || a.id - b.id);
  return { destination, sources };
}

/**
 * Returns the group of the pasted rules: the destination rule's group when `groupId` is
 * omitted. Otherwise it must keep every group contiguous: it can be the group of either rule
 * around the insertion point, or none when that point is at a group boundary. `pasteBelow` is
 * null when the rules keep their positions, which only allows the destination rule's group.
 * `movedIds` are rules leaving their positions.
 */
async function resolvePasteGroup(
  manager: EntityManager,
  destination: PolicyRule,
  groupId: number | null | undefined,
  pasteBelow: boolean | null,
  movedIds: number[] = [],
): Promise<number | null> {
  const destinationGroupId = destination.policyGroupId;
  if (groupId === undefined || groupId === destinationGroupId) return destinationGroupId;

  if (pasteBelow !== null) {
    const beyond = pasteBelow ? MoreThan : LessThan;
    const direction = pasteBelow ? 'ASC' : 'DESC';
    // The destination never borders itself; listing it keeps the exclusion list non-empty.
    const notMoved = Not(In([destination.id, ...movedIds]));
    const policy = policyOf(destination);
    const neighbor = await manager.findOne(PolicyRule, {
      select: { id: true, policyGroupId: true },
      where: [
        { ...policy, rule_order: beyond(destination.rule_order), id: notMoved },
        {
          ...policy,
          rule_order: destination.rule_order,
          id: And(beyond(destination.id), notMoved),
        },
      ],
      order: { rule_order: direction, id: direction },
    });
    const neighborGroupId = neighbor?.policyGroupId ?? null;
    if (groupId === neighborGroupId || (groupId === null && neighborGroupId !== destinationGroupId))
      return groupId;
  }

  if (
    groupId !== null &&
    !(await manager.existsBy(PolicyGroup, { id: groupId, firewallId: destination.firewallId }))
  )
    throw fwcError.NOT_FOUND;
  throw fwcError.NOT_ALLOWED;
}

/**
 * Shifts the rules after the insertion point to free `size` consecutive orders next to the
 * destination rule, and returns the first one. `movedIds` are rules leaving their positions.
 */
async function openOrderGap(
  manager: EntityManager,
  destination: PolicyRule,
  pasteBelow: boolean,
  size: number,
  movedIds: number[] = [],
): Promise<number> {
  const policy = policyOf(destination);
  const destinationOrder = { ...policy, rule_order: destination.rule_order };
  const rulesAtDestinationOrder = (
    await manager.find(PolicyRule, {
      select: { id: true },
      where: destinationOrder,
      lock: { mode: 'pessimistic_write' },
    })
  ).filter((rule) => !movedIds.includes(rule.id));
  const startsAfterDestinationOrder =
    pasteBelow || rulesAtDestinationOrder.some((rule) => rule.id < destination.id);
  const firstOrder = destination.rule_order + Number(startsAfterDestinationOrder);

  // When the insertion splits a tied position, move its suffix to a new order as well.
  const firstShiftedId = destination.id + Number(pasteBelow);
  const splitsOrder =
    startsAfterDestinationOrder &&
    rulesAtDestinationOrder.some((rule) => rule.id >= firstShiftedId);
  const shift = size + Number(splitsOrder);
  await manager.increment(
    PolicyRule,
    { ...policy, rule_order: MoreThanOrEqual(firstOrder) },
    'rule_order',
    shift,
  );
  if (splitsOrder) {
    await manager.increment(
      PolicyRule,
      { ...destinationOrder, id: MoreThanOrEqual(firstShiftedId) },
      'rule_order',
      shift,
    );
  }
  return firstOrder;
}
