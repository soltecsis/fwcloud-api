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

import { describeName, expect } from '../../../mocha/global-setup';
import { PolicyGroup } from '../../../../src/models/policy/PolicyGroup';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import sinon from 'sinon';
import { EntityManager } from 'typeorm';
import db from '../../../../src/database/database-manager';

let manager: EntityManager;

describe(describeName('PolicyRule tests'), () => {
  before(() => {
    manager = db.getSource().manager;
  });

  describe('unassignPolicyRulesBeforeRemove()', () => {
    it('should unassign all policy rules which belongs to the group', async () => {
      const group: PolicyGroup = await PolicyGroup.save(
        PolicyGroup.create({
          name: 'test',
          firewall: await Firewall.save(Firewall.create({ name: 'test' })),
        }),
      );

      let rule: PolicyRule = await PolicyRule.save(
        PolicyRule.create({
          rule_order: 0,
          action: 1,
          policyGroup: group,
        }),
      );

      await group.unassignPolicyRulesBeforeRemove();

      rule = await PolicyRule.findOne({ where: { id: rule.id } });

      expect(rule.policyGroupId).to.be.null;
    });

    it('should be called before be removed', async () => {
      const spy = sinon.spy(PolicyGroup.prototype, 'unassignPolicyRulesBeforeRemove');

      let group: PolicyGroup = await PolicyGroup.save(
        PolicyGroup.create({
          name: 'test',
          firewall: await manager.getRepository(Firewall).save({ name: 'test' }),
        }),
      );

      group = await group.remove();

      expect(spy.calledOnce).to.be.true;
    });
  });
});
