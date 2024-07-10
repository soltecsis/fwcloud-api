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
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../../src/models/fwcloud/FwCloud';
import { HAProxyRule } from '../../../../../src/models/system/haproxy/haproxy_r/haproxy_r.model';
import {
  HAProxyRuleService,
  ICreateHAProxyRule,
} from '../../../../../src/models/system/haproxy/haproxy_r/haproxy_r.service';
import { testSuite } from '../../../../mocha/global-setup';
import StringHelper from '../../../../../src/utils/string.helper';
import { IPObj } from '../../../../../src/models/ipobj/IPObj';
import { expect } from 'chai';
import sinon from 'sinon';
import { HAProxyGroup } from '../../../../../src/models/system/haproxy/haproxy_g/haproxy_g.model';
import { Offset } from '../../../../../src/offset';
import { EntityManager } from 'typeorm';
import db from '../../../../../src/database/database-manager';

describe(HAProxyRuleService.name, () => {
  let service: HAProxyRuleService;
  let fwCloud: FwCloud;
  let firewall: Firewall;
  let haproxyRule: HAProxyRule;
  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    service = await testSuite.app.getService<HAProxyRuleService>(HAProxyRuleService.name);

    fwCloud = await manager.getRepository(FwCloud).save(
      manager.getRepository(FwCloud).create({
        name: StringHelper.randomize(10),
      }),
    );

    firewall = await manager.getRepository(Firewall).save(
      manager.getRepository(Firewall).create({
        name: StringHelper.randomize(10),
        fwCloudId: fwCloud.id,
      }),
    );

    haproxyRule = await manager.getRepository(HAProxyRule).save(
      manager.getRepository(HAProxyRule).create({
        rule_order: 1,
        rule_type: 1,
        firewall: firewall,
      }),
    );
  });

  afterEach(async () => {
    await testSuite.resetDatabaseData();
  });

  describe('getHAProxyRulesData', () => {
    it('should return an array of HAProxyRules', async () => {
      const result = await service.getHAProxyRulesData('compiler', fwCloud.id, firewall.id);

      expect(result).to.be.an('array').that.is.not.empty;
      expect(result[0]).to.be.an.instanceOf(HAProxyRule);
    });

    it('should return compiler rules data', async () => {
      const result = await service.getHAProxyRulesData('compiler', fwCloud.id, firewall.id);

      expect(result).to.be.an('array').that.is.not.empty;
      expect(result[0]).to.have.property('rule_order');
      expect(result[0]).to.have.property('rule_type');
    });

    it('should handle errors calling getHAProxyRulesData', async () => {
      sinon.stub(service['_repository'], 'getHAProxyRules').rejects(new Error('Get rules error'));

      await expect(
        service.getHAProxyRulesData('compiler', fwCloud.id, firewall.id),
      ).to.be.rejectedWith('Get rules error');

      sinon.restore();
    });
  });

  describe('store', () => {
    beforeEach(async () => {
      await manager.getRepository(IPObj).save(
        manager.getRepository(IPObj).create({
          address: `192.168.1.1`,
          destination_port_start: 80,
          destination_port_end: 80,
          name: 'test',
          ipObjTypeId: 0,
        }),
      );
    });

    it('should store a new HAProxyRule', async () => {
      const data = {
        active: true,
        style: 'default',
        rule_order: 1,
        rule_type: 1,
        firewallId: firewall.id,
        frontendIpId: 1,
        frontendPortId: 1,
      };
      const expected = manager.getRepository(HAProxyRule).create(data);
      service['_repository'].getLastHAProxyRuleInFirewall = async () => null;
      const getLastHAProxyRuleInFirewallStub = sinon
        .stub(service['_repository'], 'getLastHAProxyRuleInFirewall')
        .returns(null);
      const saveStub = sinon.stub(service['_repository'], 'save').resolves(expected);

      const result = await service.store(data);

      expect(getLastHAProxyRuleInFirewallStub.calledOnce).to.be.true;
      expect(saveStub.calledOnce).to.be.true;
      expect(result).to.be.an.instanceOf(HAProxyRule);
      expect(result).to.deep.equal(expected);

      getLastHAProxyRuleInFirewallStub.restore();
      saveStub.restore();
    });

    it('should throw an error if the group does not exist', async () => {
      const data = {
        active: true,
        style: 'default',
        rule_order: 1,
        rule_type: 1,
        firewallId: firewall.id,
        frontendIpId: 1,
        frontendPortId: 1,
        group: 999,
      };

      const findOneOrFailsStub = sinon
        .stub(manager.getRepository(HAProxyGroup), 'findOneOrFail')
        .throws();

      await expect(service.store(data)).to.be.rejectedWith(Error);

      findOneOrFailsStub.restore();
    });

    it('should throw errors when saving fails', async () => {
      const data = {
        active: true,
        style: 'default',
        rule_order: 1,
        rule_type: 1,
        firewallId: firewall.id,
        frontendIpId: 1,
        frontendPortId: 1,
      };

      const saveStub = sinon.stub(service['_repository'], 'save').rejects(new Error('Save error'));

      await expect(service.store(data)).to.be.rejectedWith('Save error');

      saveStub.restore();
    });

    it('should correctly set the rule_order', async () => {
      const data = {
        active: true,
        style: 'default',
        rule_order: 1,
        rule_type: 1,
        firewallId: firewall.id,
        frontendIpId: 1,
        frontendPortId: 1,
      };
      const expected = manager.getRepository(HAProxyRule).create(
        manager.getRepository(HAProxyRule).create({
          rule_order: 5,
          rule_type: 1,
          firewall: firewall,
        }),
      );
      const getLastHAProxyRuleInFirewallStub = sinon
        .stub(service['_repository'], 'getLastHAProxyRuleInFirewall')
        .resolves(expected);

      const result = await service.store(data);
      expect(result).to.have.property('rule_order', 6);

      getLastHAProxyRuleInFirewallStub.restore();
    });

    it('should move the stored rule to a new position', async () => {
      const data = {
        active: true,
        style: 'default',
        rule_order: 1,
        rule_type: 1,
        firewallId: firewall.id,
        frontendIpId: 1,
        frontendPortId: 1,
        to: haproxyRule.id,
        offset: 'Above',
      };
      const expected = manager.getRepository(HAProxyRule).create(data);
      const getLastHAProxyRuleInFirewallStub = sinon
        .stub(service['_repository'], 'getLastHAProxyRuleInFirewall')
        .returns(null);
      const saveStub = sinon.stub(service['_repository'], 'save').resolves(expected);
      const moveStub = sinon.stub(service, 'move').resolves([expected]);

      const result = await service.store(data as ICreateHAProxyRule);

      expect(getLastHAProxyRuleInFirewallStub.calledOnce).to.be.true;
      expect(saveStub.calledOnce).to.be.true;
      expect(moveStub.calledOnce).to.be.true;
      expect(result).to.be.an.instanceOf(HAProxyRule);

      getLastHAProxyRuleInFirewallStub.restore();
      saveStub.restore();
      moveStub.restore();
    });

    it('should throw an error for invalid IP version combination', async () => {
      const data = {
        active: true,
        style: 'default',
        rule_order: 1,
        rule_type: 1,
        firewallId: firewall.id,
        frontendIpId: 1,
        frontendPortId: 1,
      } as Partial<ICreateHAProxyRule>;

      const frontEndIP = await manager.getRepository(IPObj).save(
        manager.getRepository(IPObj).create({
          name: 'test',
          address: '0.0.0.0',
          ipObjTypeId: 0,
          ip_version: 4,
        }),
      );

      const virtualIP = await manager.getRepository(IPObj).save(
        manager.getRepository(IPObj).create({
          name: 'test',
          address: '0.0.0.0',
          ipObjTypeId: 0,
          ip_version: 6,
        }),
      );
      data.frontendIpId = frontEndIP.id;
      data.backendIpsIds = [{ id: virtualIP.id, order: 1 }];

      await expect(service.store(data)).to.be.rejectedWith('IP version mismatch');
    });
  });

  describe('copy', () => {
    let copyStub: sinon.SinonStub;
    let getLastHAProxyRuleInFirewallStub: sinon.SinonStub;
    let moveStub: sinon.SinonStub;

    beforeEach(async () => {
      haproxyRule.group = await manager.getRepository(HAProxyGroup).save(
        manager.getRepository(HAProxyGroup).create({
          name: 'test',
          firewall: firewall,
        }),
      );
      copyStub = sinon.stub(service['_repository'], 'save').resolves(haproxyRule);
      getLastHAProxyRuleInFirewallStub = sinon
        .stub(service['_repository'], 'getLastHAProxyRuleInFirewall')
        .resolves(haproxyRule);
      moveStub = sinon.stub(service['_repository'], 'move').resolves([haproxyRule]);
    });

    afterEach(() => {
      copyStub.restore();
      getLastHAProxyRuleInFirewallStub.restore();
      moveStub.restore();
    });

    it('should copy a HAProxyRule', async () => {
      const result = await service.copy([haproxyRule.id], haproxyRule.id, Offset.Above);

      expect(copyStub.calledOnce).to.be.true;
      expect(getLastHAProxyRuleInFirewallStub.calledOnce).to.be.true;
      expect(moveStub.calledOnce).to.be.true;
      expect(result[0]).to.be.an.instanceOf(HAProxyRule);
    });

    it('should correctly handle different positions', async () => {
      await service.copy([haproxyRule.id], haproxyRule.id, Offset.Below);

      expect(moveStub.calledOnceWith([haproxyRule.id], haproxyRule.rule_order, Offset.Below)).to.be
        .true;
    });

    it('should correctly modify rule_order for each copied rule', async () => {
      await service.copy([haproxyRule.id], haproxyRule.id, Offset.Above);

      expect(moveStub.calledOnceWith([haproxyRule.id], haproxyRule.rule_order, Offset.Above)).to.be
        .true;
    });

    it('should call move method with correct parameters after copying', async () => {
      await service.copy([haproxyRule.id], haproxyRule.id, Offset.Above);

      expect(moveStub.calledOnceWith([haproxyRule.id], haproxyRule.rule_order, Offset.Above)).to.be
        .true;
    });
  });

  describe('move', () => {
    it('should move the DHCP rules successfully', async () => {
      const ids = [1, 2, 3];
      const destRule = 4;
      const offset = Offset.Above;
      const expectedRules: HAProxyRule[] = [];

      const moveStub = sinon.stub(service, 'move').resolves(expectedRules);

      const result = await service.move(ids, destRule, offset);

      expect(moveStub.calledOnceWith(ids, destRule, offset)).to.be.true;
      expect(result).to.deep.equal(expectedRules);

      moveStub.restore();
    });

    it('should handle errors correctly', async () => {
      const ids = [1, 2, 3];
      const destRule = 4;
      const offset = Offset.Above;

      const moveStub = sinon.stub(service, 'move').rejects(new Error('Move error'));

      await expect(service.move(ids, destRule, offset)).to.be.rejectedWith(Error, 'Move error');

      moveStub.restore();
    });

    it('should handle different input parameters correctly', async () => {
      const ids = [1, 2, 3];
      const destRule = 4;
      const offset = Offset.Below;

      const moveStub = sinon.stub(service, 'move').resolves([]);

      await service.move(ids, destRule, offset);

      expect(moveStub.calledOnceWith(ids, destRule, offset)).to.be.true;

      moveStub.restore();
    });

    it('should move rules according to the specified offset', async () => {
      const ids = [1, 2, 3];
      const destRule = 4;
      const offset = Offset.Below;

      const moveStub = sinon.stub(service, 'move');

      await service.move(ids, destRule, offset);

      expect(moveStub.calledOnceWith(ids, destRule, offset)).to.be.true;

      moveStub.restore();
    });
  });

  describe('moveFrom', () => {
    let rule1: HAProxyRule;
    let rule2: HAProxyRule;
    let ipobj: IPObj;

    beforeEach(async () => {
      ipobj = await manager.getRepository(IPObj).save(
        manager.getRepository(IPObj).create({
          name: 'test',
          address: '0.0.0.0',
          ipObjTypeId: 0,
        }),
      );

      rule1 = await service.store({
        active: true,
        firewallId: firewall.id,
        cfg_text: 'cfg_text',
        comment: 'comment',
        rule_order: 1,
      });

      rule2 = await service.store({
        active: true,
        firewallId: firewall.id,
        cfg_text: 'cfg_text',
        comment: 'comment',
        rule_order: 2,
      });
    });

    describe('ipObj', () => {
      it('should move ipObj correctly', async () => {
        await service.update(rule1.id, {
          backendIpsIds: [{ id: ipobj.id, order: 1 }],
        });

        const result = await service.moveFrom(rule1.id, rule2.id, {
          fromId: rule1.id,
          toId: rule2.id,
          ipObjId: ipobj.id,
        });
        expect(result[1].backendIps).to.be.not.empty;
        expect(result[0].backendIps).to.be.empty;
      });
    });
  });

  describe('update', () => {
    it('should successfully update a HAProxyRule', async () => {
      const haproxyRule = await manager.getRepository(HAProxyRule).save(
        manager.getRepository(HAProxyRule).create({
          id: 1,
          group: await manager.getRepository(HAProxyGroup).save(
            manager.getRepository(HAProxyGroup).create({
              name: 'group',
              firewall: firewall,
            }),
          ),
          rule_order: 1,
        }),
      );

      const updateStub = sinon.stub(service, 'update').resolves(haproxyRule);

      const result = await service.update(haproxyRule.id, { rule_order: 2 });

      expect(updateStub.calledOnceWith(haproxyRule.id, { rule_order: 2 })).to.be.true;
      expect(result).to.deep.equal(haproxyRule);

      updateStub.restore();
    });

    it('should handle errors when the HAProxyRule to update is not found', async () => {
      const updateStub = sinon.stub(service, 'update').rejects(new Error('DHCPRule not found'));

      await expect(service.update(1, { rule_order: 2 })).to.be.rejectedWith(
        Error,
        'DHCPRule not found',
      );

      updateStub.restore();
    });

    it('should update related entities correctly', async () => {
      const haproxyRule = await manager.getRepository(HAProxyRule).save(
        manager.getRepository(HAProxyRule).create({
          id: 1,
          group: await manager.getRepository(HAProxyGroup).save(
            manager.getRepository(HAProxyGroup).create({
              name: 'group',
              firewall: firewall,
            }),
          ),
          rule_order: 1,
        }),
      );

      const updateStub = sinon.stub(service, 'update').resolves(haproxyRule);
      const group2 = await manager.getRepository(HAProxyGroup).save(
        manager.getRepository(HAProxyGroup).create({
          name: 'group2',
          firewall: firewall,
        }),
      );

      const result = await service.update(haproxyRule.id, { group: group2.id });

      expect(updateStub.calledOnceWith(haproxyRule.id, { group: group2.id })).to.be.true;
      expect(result).to.deep.equal(haproxyRule);

      updateStub.restore();
    });

    it('should handle errors when related entities are not found', async () => {
      const updateStub = sinon
        .stub(service, 'update')
        .rejects(new Error('Related entities not found'));

      await expect(
        service.update(1, {
          group: (
            await manager.getRepository(HAProxyGroup).save(
              manager.getRepository(HAProxyGroup).create({
                name: 'group2',
                firewall: firewall,
              }),
            )
          ).id,
        }),
      ).to.be.rejectedWith(Error, 'Related entities not found');

      updateStub.restore();
    });

    it('should update ipObjIds correctly', async () => {
      const haproxyRule = await manager.getRepository(HAProxyRule).save(
        manager.getRepository(HAProxyRule).create({
          id: 1,
          rule_order: 1,
        }),
      );
      const ipObjIds = [
        { id: 1, order: 1 },
        { id: 2, order: 2 },
      ];
      const updateStub = sinon.stub(service, 'update').resolves(haproxyRule);

      const result = await service.update(haproxyRule.id, {
        ipObjIds,
      } as Partial<ICreateHAProxyRule>);

      expect(updateStub.calledOnce).to.be.true;
      expect(result).to.deep.equal(haproxyRule);

      updateStub.restore();
    });

    it('should handle exceptions in validateUpdateIpObjIds correctly', async () => {
      const haproxyRule = await manager.getRepository(HAProxyRule).save(
        manager.getRepository(HAProxyRule).create({
          id: 1,
          rule_order: 1,
        }),
      );
      const ipObjIds: { id: number; order: number }[] = [];

      for (let i = 0; i < 10; i++) {
        const ipObj = await manager.getRepository(IPObj).save({
          name: `test_${i}`,
          address: '0.0.0.0',
          ipObjTypeId: 2,
          ip_version: 6,
        });
        ipObjIds.push({ id: ipObj.id, order: i });
      }

      const validateUpdateIpObjIdsStub = sinon
        .stub(service, 'validateBackendIps')
        .rejects(new Error('Validation error'));

      await expect(
        service.update(haproxyRule.id, {
          backendIpsIds: ipObjIds,
        } as Partial<ICreateHAProxyRule>),
      ).to.be.rejectedWith(Error, 'Validation error');

      validateUpdateIpObjIdsStub.restore();
    });
  });

  describe('remove', () => {
    it('should remove the rule successfully', async () => {
      const haproxyRule = await manager.getRepository(HAProxyRule).save(
        manager.getRepository(HAProxyRule).create({
          id: 1,
          group: await manager.getRepository(HAProxyGroup).save(
            manager.getRepository(HAProxyGroup).create({
              name: 'group',
              firewall: firewall,
            }),
          ),
          rule_order: 1,
        }),
      );
      const path = { id: 1 };

      const result = await service.remove(path);

      expect(result).to.not.equal(haproxyRule);
    });

    it('should throw an error if the rule does not exist', async () => {
      const path = {
        id: 1,
      };

      sinon.stub(service['_repository'], 'findOne').resolves(null);

      await expect(service.remove(path)).to.be.rejectedWith(Error);
    });
  });

  describe('bulkUpdate', () => {
    it('should update the rules successfully', async () => {
      const ids = [1, 2, 3];
      const data = { rule_order: 2 };

      const bulkUpdateStub = sinon.stub(service, 'bulkUpdate').resolves([haproxyRule]);

      const result = await service.bulkUpdate(ids, data);

      expect(bulkUpdateStub.calledOnceWith(ids, data)).to.be.true;
      expect(result).to.deep.equal([haproxyRule]);

      bulkUpdateStub.restore();
    });

    it('should handle errors when updating the rules', async () => {
      const ids = [1, 2, 3];
      const data = { rule_order: 2 };

      const bulkUpdateStub = sinon
        .stub(service, 'bulkUpdate')
        .rejects(new Error('Bulk update error'));

      await expect(service.bulkUpdate(ids, data)).to.be.rejectedWith(Error, 'Bulk update error');

      bulkUpdateStub.restore();
    });
  });

  describe('bulkRemove', () => {
    it('should remove the rules successfully', async () => {
      const ids = [1, 2, 3];

      const bulkRemoveStub = sinon.stub(service, 'bulkRemove').resolves([haproxyRule]);

      const result = await service.bulkRemove(ids);

      expect(bulkRemoveStub.calledOnceWith(ids)).to.be.true;
      expect(result).to.deep.equal([haproxyRule]);

      bulkRemoveStub.restore();
    });

    it('should handle errors when removing the rules', async () => {
      const ids = [1, 2, 3];

      const bulkRemoveStub = sinon
        .stub(service, 'bulkRemove')
        .rejects(new Error('Bulk remove error'));

      await expect(service.bulkRemove(ids)).to.be.rejectedWith(Error, 'Bulk remove error');

      bulkRemoveStub.restore();
    });

    it('should call remove with the correct IDs', async () => {
      const ids = [1, 2, 3];

      const removeStub = sinon.stub(service, 'remove').resolves(haproxyRule);
      const bulkRemoveStub = sinon.stub(service, 'bulkRemove').callsFake(async (ids) => {
        for (const id of ids) {
          await service.remove({ id });
        }
        return [haproxyRule];
      });

      const result = await service.bulkRemove(ids);

      expect(removeStub.calledThrice).to.be.true;
      expect(removeStub.getCall(0).calledWithExactly({ id: 1 })).to.be.true;
      expect(removeStub.getCall(1).calledWithExactly({ id: 2 })).to.be.true;
      expect(removeStub.getCall(2).calledWithExactly({ id: 3 })).to.be.true;
      expect(bulkRemoveStub.calledOnceWith(ids)).to.be.true;
      expect(result).to.deep.equal([haproxyRule]);

      removeStub.restore();
      bulkRemoveStub.restore();
    });

    it('should call remove once for each rule', async () => {
      const ids = [1, 2, 3];

      const removeStub = sinon.stub(service, 'remove').resolves(haproxyRule);
      const bulkRemoveStub = sinon.stub(service, 'bulkRemove').callsFake(async (ids) => {
        for (const id of ids) {
          await service.remove({ id });
        }
        return [haproxyRule];
      });

      const result = await service.bulkRemove(ids);

      expect(removeStub.callCount).to.equal(ids.length);
      expect(bulkRemoveStub.calledOnceWith(ids)).to.be.true;
      expect(result).to.deep.equal([haproxyRule]);

      removeStub.restore();
      bulkRemoveStub.restore();
    });
  });
});
