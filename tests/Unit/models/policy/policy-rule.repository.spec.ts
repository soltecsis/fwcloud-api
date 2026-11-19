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

import { describeName, testSuite, expect } from '../../../mocha/global-setup';
import { PolicyRuleRepository } from '../../../../src/models/policy/policy-rule.repository';
import { AbstractApplication } from '../../../../src/fonaments/abstract-application';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { PolicyGroup } from '../../../../src/models/policy/PolicyGroup';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { EntityManager } from 'typeorm';
import db from '../../../../src/database/database-manager';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';
import fwcError from '../../../../src/utils/error_table';

let policyRuleRepository: PolicyRuleRepository;
let app: AbstractApplication;
let manager: EntityManager;

describe(describeName('PolicyRuleRepository Unit tests'), () => {
  before(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    policyRuleRepository = new PolicyRuleRepository(manager);
  });

  describe('updateActive()', () => {
    it('should update the policyRule active flag', async () => {
      let policyRule: PolicyRule = await PolicyRule.save(
        PolicyRule.create({
          rule_order: 1,
          action: 1,
          active: 0,
          special: 0,
        }),
      );

      const result: PolicyRule = await policyRuleRepository.updateActive(policyRule, 1);

      policyRule = await PolicyRule.findOne({ where: { id: policyRule.id } });

      expect(result.active).to.be.deep.eq(1);
      expect(policyRule.active).to.be.deep.eq(1);
    });

    it('should update multiple policyRule active flag', async () => {
      const policyRules: Array<PolicyRule> = [
        await PolicyRule.save(
          PolicyRule.create({
            rule_order: 1,
            action: 1,
            active: 0,
            special: 0,
          }),
        ),
        await PolicyRule.save(
          PolicyRule.create({
            rule_order: 1,
            action: 1,
            active: 0,
            special: 0,
          }),
        ),
      ];

      const result: Array<PolicyRule> = await policyRuleRepository.updateActive(policyRules, 1);

      expect(result[0].active).to.be.deep.eq(1);
      expect(result[1].active).to.be.deep.eq(1);
    });

    it('should not update a policyRule active flag if is an special rule', async () => {
      const policyRule: PolicyRule = await PolicyRule.save(
        PolicyRule.create({
          rule_order: 1,
          action: 1,
          active: 0,
          special: 1,
        }),
      );

      const result: Array<PolicyRule> = await policyRuleRepository.updateActive([policyRule], 1);

      expect(result[0].active).to.be.deep.eq(0);
    });
  });

  describe('assignGroup()', () => {
    it('should change the policy rule group', async () => {
      const policyGroupOld: PolicyGroup = await PolicyGroup.save(
        PolicyGroup.create({
          name: 'groupOld',
          firewall: await Firewall.save(
            Firewall.create({
              name: 'firewall',
            }),
          ),
        }),
      );
      const policyGroupNew: PolicyGroup = await PolicyGroup.save(
        PolicyGroup.create({
          name: 'groupNew',
          firewall: policyGroupOld.firewall,
        }),
      );

      let policyRule: PolicyRule = await PolicyRule.save(
        PolicyRule.create({
          rule_order: 1,
          policyGroupId: policyGroupOld.id,
          action: 1,
          firewall: policyGroupOld.firewall,
        }),
      );

      policyRule = await PolicyRule.findOne({ where: { id: policyRule.id } });

      const result = await policyRuleRepository.assignToGroup(policyRule, policyGroupNew);

      policyRule = await PolicyRule.findOne({ where: { id: policyRule.id } });

      expect(result).to.be.instanceOf(PolicyRule);
      expect(policyRule.policyGroupId).to.be.deep.eq(policyGroupNew.id);
    });

    it('should change multiple policy rule group', async () => {
      const policyGroupOld: PolicyGroup = await PolicyGroup.save(
        PolicyGroup.create({
          name: 'groupOld',
          firewall: await Firewall.save(
            Firewall.create({
              name: 'firewall',
            }),
          ),
        }),
      );
      const policyGroupNew: PolicyGroup = await PolicyGroup.save(
        PolicyGroup.create({
          name: 'groupNew',
          firewall: policyGroupOld.firewall,
        }),
      );

      let policyRule: PolicyRule = await PolicyRule.save(
        PolicyRule.create({
          rule_order: 1,
          policyGroupId: policyGroupOld.id,
          action: 1,
          firewall: policyGroupOld.firewall,
        }),
      );
      let policyRule2: PolicyRule = await PolicyRule.save(
        PolicyRule.create({
          rule_order: 1,
          policyGroupId: policyGroupOld.id,
          action: 1,
          firewall: policyGroupOld.firewall,
        }),
      );

      const result = await policyRuleRepository.assignToGroup(
        [policyRule, policyRule2],
        policyGroupNew,
      );

      policyRule = await PolicyRule.findOne({ where: { id: policyRule.id } });
      policyRule2 = await PolicyRule.findOne({ where: { id: policyRule2.id } });

      expect(result).to.have.length(2);
      expect(policyRule.policyGroupId).to.be.deep.eq(policyGroupNew.id);
      expect(policyRule2.policyGroupId).to.be.deep.eq(policyGroupNew.id);
    });

    it('should not change a group if the rule firewall is not the same as the group firewall', async () => {
      const policyGroupOld: PolicyGroup = await PolicyGroup.save(
        PolicyGroup.create({
          name: 'groupOld',
          firewall: await Firewall.save(
            Firewall.create({
              name: 'firewall',
            }),
          ),
        }),
      );

      const policyGroupNew: PolicyGroup = await PolicyGroup.save(
        PolicyGroup.create({
          name: 'groupNew',
          firewall: await Firewall.save(
            Firewall.create({
              name: 'firewall',
            }),
          ),
        }),
      );

      let policyRule: PolicyRule = await PolicyRule.save(
        PolicyRule.create({
          rule_order: 1,
          policyGroup: policyGroupOld,
          action: 1,
          firewall: policyGroupOld.firewall,
        }),
      );

      await policyRuleRepository.assignToGroup([policyRule], policyGroupNew);

      policyRule = await PolicyRule.findOne({ where: { id: policyRule.id } });

      expect(policyRule.policyGroupId).to.be.deep.eq(policyGroupOld.id);
    });

    it('should unassign the group if is called with null', async () => {
      const policyGroupOld: PolicyGroup = await PolicyGroup.save(
        PolicyGroup.create({
          name: 'groupOld',
          firewall: await Firewall.save(
            Firewall.create({
              name: 'firewall',
            }),
          ),
        }),
      );

      const policyRule: PolicyRule = await PolicyRule.save(
        PolicyRule.create({
          rule_order: 1,
          policyGroupId: policyGroupOld.id,
          action: 1,
        }),
      );

      await policyRuleRepository.assignToGroup([policyRule], null);

      await policyRule.reload();

      expect(policyRule.policyGroupId).to.be.deep.eq(null);
    });
  });

  describe('moveRules()', () => {
    const type = PolicyTypesMap.get('IPv4:FORWARD');
    let firewall: Firewall;

    beforeEach(async () => {
      firewall = await manager.save(Firewall, { name: 'firewall' });
    });

    // Saved one at a time, so that rules sharing a position are ordered by creation.
    async function createRules(...orders: number[]): Promise<PolicyRule[]> {
      const rules: PolicyRule[] = [];
      for (const rule_order of orders) {
        rules.push(
          await manager.save(PolicyRule, {
            rule_order,
            action: 1,
            firewallId: firewall.id,
            policyTypeId: type,
          }),
        );
      }
      return rules;
    }

    async function policy(): Promise<PolicyRule[]> {
      return manager.find(PolicyRule, {
        where: { firewallId: firewall.id },
        order: { rule_order: 'ASC', id: 'ASC' },
      });
    }

    const ids = (rules: PolicyRule[]) => rules.map((rule) => rule.id);
    const groupIds = (rules: PolicyRule[]) => rules.map((rule) => rule.policyGroupId);

    it('moves rules next to a destination that shares their position', async () => {
      const [moved, destination, next] = await createRules(5, 5, 6);

      await policyRuleRepository.moveRules(firewall.id, [moved.id], destination.id, 1);
      expect(ids(await policy())).to.deep.equal(ids([destination, moved, next]));

      await policyRuleRepository.moveRules(firewall.id, [moved.id], destination.id, -1);
      expect(ids(await policy())).to.deep.equal(ids([moved, destination, next]));
    });

    it('moves each selected rule once', async () => {
      const [a, b, destination] = await createRules(1, 2, 3);

      await policyRuleRepository.moveRules(firewall.id, [b.id, a.id, b.id], destination.id, 1);

      const persisted = await policy();
      expect(ids(persisted)).to.deep.equal(ids([destination, a, b]));
      expect(persisted.map((rule) => rule.rule_order)).to.deep.equal([3, 4, 5]);
    });

    it('rejects destinations among the moved rules and rules of other policies', async () => {
      const [rule, destination] = await createRules(1, 2);
      await manager.update(PolicyRule, rule.id, { policyTypeId: PolicyTypesMap.get('IPv4:INPUT') });
      const before = await policy();

      await expect(
        policyRuleRepository.moveRules(firewall.id, [rule.id, destination.id], destination.id, 1),
      ).to.be.rejected.and.eventually.have.property('fwcErr', 999999);
      await expect(
        policyRuleRepository.moveRules(firewall.id, [rule.id], destination.id, 1),
      ).to.be.rejected.and.eventually.deep.equal(fwcError.NOT_ALLOWED);
      expect(await policy()).to.deep.equal(before);
    });

    it('keeps positions with offset 0 and removes the groups left empty', async () => {
      const [rule, destination] = await createRules(1, 2);
      const group = await manager.save(PolicyGroup, { name: 'group', firewallId: firewall.id });
      await manager.update(PolicyRule, rule.id, { policyGroupId: group.id });

      await policyRuleRepository.moveRules(firewall.id, [rule.id], destination.id, 0);

      const persisted = await policy();
      expect(ids(persisted)).to.deep.equal(ids([rule, destination]));
      expect(groupIds(persisted)).to.deep.equal([null, null]);
      expect(await manager.findOneBy(PolicyGroup, { id: group.id })).to.equal(null);
    });

    it('joins the group beyond the insertion point, ignoring the moved rules', async () => {
      const [destination, moved, next] = await createRules(1, 2, 3);
      const group = await manager.save(PolicyGroup, { name: 'group', firewallId: firewall.id });
      await manager.update(PolicyRule, next.id, { policyGroupId: group.id });

      await policyRuleRepository.moveRules(firewall.id, [moved.id], destination.id, 1, group.id);

      const persisted = await policy();
      expect(ids(persisted)).to.deep.equal(ids([destination, moved, next]));
      expect(groupIds(persisted)).to.deep.equal([null, group.id, group.id]);
    });
  });

  describe('updateStyle()', () => {
    it('should update the style', async () => {
      const policyRule: PolicyRule = await PolicyRule.save(
        PolicyRule.create({
          rule_order: 1,
          action: 1,
          style: 'oldStyle',
        }),
      );

      const result = await policyRuleRepository.updateStyle(policyRule, 'newStyle');

      await policyRule.reload();

      expect(result).to.be.instanceOf(PolicyRule);
      expect(policyRule.style).to.be.deep.eq('newStyle');
    });

    it('should update multiple policyRule styles', async () => {
      const policyRules: Array<PolicyRule> = [
        await PolicyRule.save(
          PolicyRule.create({
            rule_order: 1,
            action: 1,
            style: 'oldStyle',
          }),
          { reload: true },
        ),
        await PolicyRule.save(
          PolicyRule.create({
            rule_order: 1,
            action: 1,
            style: 'oldStyle',
          }),
          { reload: true },
        ),
      ];

      const result = await policyRuleRepository.updateStyle(policyRules, 'newStyle');

      expect(result).to.have.length(2);
      expect(result[0].style).to.be.deep.eq('newStyle');
      expect(result[1].style).to.be.deep.eq('newStyle');
    });
  });
});
