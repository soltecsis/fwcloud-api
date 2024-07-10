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

import { Brackets, EntityManager, In, ObjectLiteral } from 'typeorm';
import { PolicyRule, SpecialPolicyRules } from './PolicyRule';
import { PolicyGroup } from './PolicyGroup';
import { Repository } from '../../database/repository';
import { isArray } from 'class-validator';

export class PolicyRuleRepository extends Repository<PolicyRule> {
  constructor(manager?: EntityManager) {
    super(PolicyRule, manager);
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

    const criterias: string | ((qb: this) => string) | Brackets | ObjectLiteral | ObjectLiteral[] =
      {
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
