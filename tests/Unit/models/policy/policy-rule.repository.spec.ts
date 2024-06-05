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
import { getCustomRepository } from 'typeorm';

let policyRuleRepository: PolicyRuleRepository;
let app: AbstractApplication;

describe(describeName('PolicyRuleRepository Unit tests'), () => {
  before(async () => {
    app = testSuite.app;
    policyRuleRepository = getCustomRepository(PolicyRuleRepository);
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

      const result: PolicyRule = await policyRuleRepository.updateActive(
        policyRule,
        1,
      );

      policyRule = await PolicyRule.findOne(policyRule.id);

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

      const result: Array<PolicyRule> = await policyRuleRepository.updateActive(
        policyRules,
        1,
      );

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

      const result: Array<PolicyRule> = await policyRuleRepository.updateActive(
        [policyRule],
        1,
      );

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

      policyRule = await PolicyRule.findOne(policyRule.id);

      const result = await policyRuleRepository.assignToGroup(
        policyRule,
        policyGroupNew,
      );

      policyRule = await PolicyRule.findOne(policyRule.id);

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

      policyRule = await PolicyRule.findOne(policyRule.id);
      policyRule2 = await PolicyRule.findOne(policyRule2.id);

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

      policyRule = await PolicyRule.findOne(policyRule.id);

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

  describe('updateStyle()', () => {
    it('should update the style', async () => {
      const policyRule: PolicyRule = await PolicyRule.save(
        PolicyRule.create({
          rule_order: 1,
          action: 1,
          style: 'oldStyle',
        }),
      );

      const result = await policyRuleRepository.updateStyle(
        policyRule,
        'newStyle',
      );

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

      const result = await policyRuleRepository.updateStyle(
        policyRules,
        'newStyle',
      );

      expect(result).to.have.length(2);
      expect(result[0].style).to.be.deep.eq('newStyle');
      expect(result[1].style).to.be.deep.eq('newStyle');
    });
  });
});
