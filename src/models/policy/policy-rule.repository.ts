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

import { EntityManager, In, IsNull, MoreThanOrEqual } from 'typeorm';
import { PolicyRule, SpecialPolicyRules } from './PolicyRule';
import { PolicyGroup } from './PolicyGroup';
import { PolicyRuleToIPObj } from './PolicyRuleToIPObj';
import { PolicyRuleToInterface } from './PolicyRuleToInterface';
import Query from '../../database/Query';
import { Repository } from '../../database/repository';
import { isArray } from 'class-validator';
const fwcError = require('../../utils/error_table');

export class PolicyRuleRepository extends Repository<PolicyRule> {
  constructor(manager?: EntityManager) {
    super(PolicyRule, manager);
  }

  public async copyRules(
    firewallId: number,
    ruleIds: number[],
    destinationId: number,
    pasteOffset: number,
  ): Promise<void> {
    if (!ruleIds.length) return;

    await this.manager.transaction(async (manager) => {
      // Serialize copies even when their selections and destination rules are different.
      await manager.query('SELECT id FROM firewall WHERE id = ? FOR UPDATE', [firewallId]);

      const repository = manager.getRepository(PolicyRule);
      const selectedRules = await repository.find({
        where: { firewallId, id: In([...ruleIds, destinationId]) },
        lock: { mode: 'pessimistic_write' },
      });
      const rulesById = new Map(selectedRules.map((rule) => [rule.id, rule]));
      const destination = rulesById.get(destinationId);
      const sources = ruleIds.map((id) => rulesById.get(id));
      if (!destination || sources.some((source) => !source)) throw fwcError.NOT_FOUND;

      const pasteBelow = pasteOffset === 1;
      const catchAll: number = SpecialPolicyRules.CATCHALL;
      if (
        (pasteBelow && destination.special === catchAll) ||
        sources.some(
          (source) =>
            source.special === catchAll || source.policyTypeId !== destination.policyTypeId,
        )
      ) {
        throw fwcError.NOT_ALLOWED;
      }

      sources.sort((a, b) => a.rule_order - b.rule_order || a.id - b.id);
      const policy = { firewallId, policyTypeId: destination.policyTypeId ?? IsNull() };
      const destinationOrder = { ...policy, rule_order: destination.rule_order };
      const rulesAtDestinationOrder = await repository.find({
        select: { id: true },
        where: destinationOrder,
        lock: { mode: 'pessimistic_write' },
      });
      const startsAfterDestinationOrder =
        pasteBelow || rulesAtDestinationOrder.some((rule) => rule.id < destinationId);
      let nextOrder = destination.rule_order + Number(startsAfterDestinationOrder);
      const suffix = { ...policy, rule_order: MoreThanOrEqual(nextOrder) };

      // When the insertion splits a tied position, move its suffix to a new order as well.
      const firstShiftedId = destinationId + Number(pasteBelow);
      const splitsOrder =
        startsAfterDestinationOrder &&
        rulesAtDestinationOrder.some((rule) => rule.id >= firstShiftedId);
      const shift = sources.length + Number(splitsOrder);
      await repository.increment(suffix, 'rule_order', shift);
      if (splitsOrder) {
        await repository.increment(
          { ...destinationOrder, id: MoreThanOrEqual(firstShiftedId) },
          'rule_order',
          shift,
        );
      }

      const dbCon = new Query(manager.queryRunner);
      for (const source of sources) {
        const { identifiers } = await repository.insert({
          ...source,
          id: undefined,
          policyGroupId: destination.policyGroupId,
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
