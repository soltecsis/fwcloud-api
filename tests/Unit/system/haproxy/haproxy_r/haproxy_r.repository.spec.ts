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

import { getCustomRepository, getRepository } from 'typeorm';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../../src/models/fwcloud/FwCloud';
import { HAProxyGroup } from '../../../../../src/models/system/haproxy/haproxy_g/haproxy_g.model';
import { HAProxyRuleRepository } from '../../../../../src/models/system/haproxy/haproxy_r/haproxy.repository';
import { HAProxyRule } from '../../../../../src/models/system/haproxy/haproxy_r/haproxy_r.model';
import { testSuite } from '../../../../mocha/global-setup';
import StringHelper from '../../../../../src/utils/string.helper';
import { expect } from 'chai';
import sinon from 'sinon';
import { Offset } from '../../../../../src/offset';

describe(HAProxyRuleRepository.name, () => {
  let repository: HAProxyRuleRepository;
  let fwCloud: FwCloud;
  let firewall: Firewall;
  let group: HAProxyGroup;
  let haproxyRule: HAProxyRule;

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    repository = getCustomRepository(HAProxyRuleRepository);
    fwCloud = await getRepository(FwCloud).save(
      getRepository(FwCloud).create({
        name: StringHelper.randomize(10),
      }),
    );
    firewall = await getRepository(Firewall).save(
      getRepository(Firewall).create({
        name: StringHelper.randomize(10),
        fwCloudId: fwCloud.id,
      }),
    );
    group = await getRepository(HAProxyGroup).save(
      getRepository(HAProxyGroup).create({
        name: StringHelper.randomize(10),
        firewall: firewall,
      }),
    );
    haproxyRule = await getRepository(HAProxyRule).save(
      getRepository(HAProxyRule).create({
        group: group,
        firewall: firewall,
        rule_order: 1,
      }),
    );
  });

  describe('remove', () => {
    it('should remove a single HAProxyRule', async () => {
      const result = await repository.remove(haproxyRule);

      expect(result).to.deep.equal(haproxyRule);
      expect(await repository.findOne(haproxyRule.id)).to.be.undefined;
    });

    it('should remove multiple HAProxyRules', async () => {
      const haproxyRule2 = await getRepository(HAProxyRule).save(
        getRepository(HAProxyRule).create({
          group: group,
          firewall: firewall,
          rule_order: 2,
        }),
      );

      const result = await repository.remove([haproxyRule, haproxyRule2]);

      expect(result).to.deep.equal([haproxyRule, haproxyRule2]);
      expect(await repository.findOne(haproxyRule.id)).to.be.undefined;
      expect(await repository.findOne(haproxyRule2.id)).to.be.undefined;
    });

    it('should refresh orders after remove', async () => {
      const refreshOrdersSpy = sinon.stub(
        repository,
        'refreshOrders' as keyof HAProxyRuleRepository,
      );

      await repository.remove(haproxyRule);

      expect(refreshOrdersSpy.calledOnceWithExactly(group.id)).to.be.true;
    });

    it('should refresh orders for each group after removing multiple Rules', async () => {
      const group2 = await getRepository(HAProxyGroup).save(
        getRepository(HAProxyGroup).create({
          name: 'group2',
          firewall: firewall,
        }),
      );

      const haproxyRule2 = await getRepository(HAProxyRule).save(
        getRepository(HAProxyRule).create({
          group: group2,
          firewall: firewall,
          rule_order: 1,
        }),
      );

      await repository.save([haproxyRule, haproxyRule2]);

      const refreshOrdersSpy = sinon.stub(
        repository,
        'refreshOrders' as keyof HAProxyRuleRepository,
      );

      await repository.remove([haproxyRule, haproxyRule2]);

      expect(refreshOrdersSpy.called).to.be.true;
    });

    it('should not refresh orders after removing rules withouth group', async () => {
      haproxyRule.group = null;
      haproxyRule.save();

      const refreshOrdersSpy = sinon.stub(
        repository,
        'refreshOrders' as keyof HAProxyRuleRepository,
      );

      await repository.remove(haproxyRule);

      expect(refreshOrdersSpy.called).to.be.false;
    });
  });

  describe('move', () => {
    let mockFind;

    beforeEach(() => {
      mockFind = sinon.stub(repository, 'find');
    });

    afterEach(() => {
      mockFind.restore();
    });

    it('should update affected rules after move', async () => {
      mockFind.resolves([haproxyRule]);
      const updateAffectedRulesSpy = sinon.stub(
        repository,
        'save' as keyof HAProxyRuleRepository,
      );

      await repository.move([haproxyRule.id], haproxyRule.id, Offset.Above);

      expect(updateAffectedRulesSpy.called).to.be.true;
    });

    it('should refresh orders after move', async () => {
      mockFind.resolves([haproxyRule]);
      const refreshOrdersSpy = sinon.stub(
        repository,
        'refreshOrders' as keyof HAProxyRuleRepository,
      );

      await repository.move([haproxyRule.id], haproxyRule.id, Offset.Above);

      expect(refreshOrdersSpy.calledOnceWithExactly(group.id)).to.be.true;
    });

    it('should return the updated rules', async () => {
      mockFind.resolves([haproxyRule]);
      const updatedRules = await repository.move(
        [haproxyRule.id],
        haproxyRule.id,
        Offset.Above,
      );

      expect(updatedRules).to.be.an('array');
      expect(updatedRules).to.have.lengthOf(1);
      expect(updatedRules[0]).to.have.property('id', haproxyRule.id);
    });
  });

  describe('getHAProxyRules', () => {
    it('should retrieve HAProxyRule based on fwcloud and firewall IDs', async () => {
      const fwcloudId = 1;
      const firewallId = 1;

      const result = await repository.getHAProxyRules(fwcloudId, firewallId);

      expect(result).to.be.an('array');

      for (const rule of result) {
        expect(rule).to.be.instanceOf(HAProxyRule);
      }
    });

    it('should filter HAProxyRule based on provided rule IDs', async () => {
      const fwcloudId = 1;
      const firewallId = 1;
      const ruleIds = [1, 2, 3];

      const result = await repository.getHAProxyRules(
        fwcloudId,
        firewallId,
        ruleIds,
      );

      expect(result).to.be.an('array');

      for (const rule of result) {
        expect(rule).to.be.instanceOf(HAProxyRule);
        expect(rule.id).to.be.oneOf(ruleIds);
      }
    });
  });
});
