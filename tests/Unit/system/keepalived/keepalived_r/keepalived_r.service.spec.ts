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
import { expect } from 'chai';
import { KeepalivedGroup } from '../../../../../src/models/system/keepalived/keepalived_g/keepalived_g.model';
import {
  KeepalivedRuleService,
  ICreateKeepalivedRule,
  IMoveFromKeepalivedRule,
} from '../../../../../src/models/system/keepalived/keepalived_r/keepalived_r.service';
import sinon from 'sinon';
import { KeepalivedRule } from '../../../../../src/models/system/keepalived/keepalived_r/keepalived_r.model';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../../src/models/fwcloud/FwCloud';
import StringHelper from '../../../../../src/utils/string.helper';
import { testSuite } from '../../../../mocha/global-setup';
import { Interface } from '../../../../../src/models/interface/Interface';
import { Offset } from '../../../../../src/offset';
import { beforeEach } from 'mocha';
import { IPObj } from '../../../../../src/models/ipobj/IPObj';
import { EntityManager } from 'typeorm';
import db from '../../../../../src/database/database-manager';

describe(KeepalivedRuleService.name, () => {
  let service: KeepalivedRuleService;
  let fwCloud: FwCloud;
  let firewall: Firewall;
  let keepalivedRule: KeepalivedRule;
  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    service = await testSuite.app.getService<KeepalivedRuleService>(KeepalivedRuleService.name);

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

    keepalivedRule = await manager.getRepository(KeepalivedRule).save(
      manager.getRepository(KeepalivedRule).create({
        id: 1,
        group: await manager.getRepository(KeepalivedGroup).save(
          manager.getRepository(KeepalivedGroup).create({
            name: 'group',
            firewall: firewall,
          }),
        ),
        firewall: firewall,
        rule_order: 1,
        interface: null,
      }),
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getKeepalivedRulesData', () => {
    const fwcloud = 1;
    const firewall = 2;

    let repositoryStub: sinon.SinonStub;

    beforeEach(() => {
      repositoryStub = sinon
        .stub(service['_repository'], 'getKeepalivedRules')
        .resolves([keepalivedRule]);
    });

    afterEach(() => {
      repositoryStub.restore();
    });

    it('should return grid rules data', async () => {
      const rules: number[] = [1, 2, 3];

      const result = await service.getKeepalivedRulesData(
        'keepalived_grid',
        fwcloud,
        firewall,
        rules,
      );

      expect(repositoryStub.calledOnce).to.be.true;
      expect(result).to.be.an('array').that.is.not.empty;
    });

    it('should return compiler rules data', async () => {
      const rules: number[] = [1, 2, 3];

      const result = await service.getKeepalivedRulesData('compiler', fwcloud, firewall, rules);

      expect(repositoryStub.calledOnce).to.be.true;
      expect(result).to.be.an('array').that.is.not.empty;
    });

    it('should handle errors when calling getKeepalivedRules', async () => {
      const rules: number[] = [1, 2, 3];
      repositoryStub.rejects(new Error('Get rules error'));

      await expect(service.getKeepalivedRulesData('keepalived_grid', fwcloud, firewall, rules)).to
        .be.rejected;
    });
  });

  describe('store', () => {
    let group: KeepalivedGroup;

    beforeEach(async () => {
      group = await manager.getRepository(KeepalivedGroup).save(
        manager.getRepository(KeepalivedGroup).create({
          name: 'group',
          firewall: firewall,
        }),
      );

      await manager.getRepository(Interface).save(
        manager.getRepository(Interface).create({
          name: 'eth1',
          type: '11',
          interface_type: '11',
          mac: '00:00:00:00:00:00',
        }),
      );
    });

    it('should store a new KeepalivedRule', async () => {
      const data: ICreateKeepalivedRule = {
        group: group.id,
        firewallId: firewall.id,
        rule_order: 1,
        interfaceId: 1,
        virtualIpsIds: [],
      };

      const result = await service.store(data);

      expect(result).to.be.an('object').that.is.not.empty;
    });

    it('should throw an error if the group does not exist', async () => {
      const data: ICreateKeepalivedRule = {
        group: 0,
        firewallId: firewall.id,
        rule_order: 1,
        interfaceId: 1,
        virtualIpsIds: [],
      };

      const expectedError = new Error('test error');
      const saveStub = sinon.stub(service['_repository'], 'save').throws(expectedError);

      await expect(service.store(data)).to.be.rejectedWith(expectedError);

      saveStub.restore();
    });

    it('should correctly set the rule order', async () => {
      const data: ICreateKeepalivedRule = {
        group: group.id,
        firewallId: firewall.id,
        interfaceId: 1,
        virtualIpsIds: [],
      };

      const existingRule: KeepalivedRule = manager.getRepository(KeepalivedRule).create({
        group: group,
        firewall: firewall,
        rule_order: 1,
        interface: null,
      });
      existingRule.rule_order = 5;
      const getLastKeepalivedRuleInFirewallStub = sinon
        .stub(service['_repository'], 'getLastKeepalivedRuleInFirewall')
        .resolves(existingRule);

      const result = await service.store(data);

      expect(result.rule_order).to.be.equal(6);
      getLastKeepalivedRuleInFirewallStub.restore();
    });

    it('should move the stored rule to a new position', async () => {
      const data: ICreateKeepalivedRule = {
        group: group.id,
        firewallId: firewall.id,
        rule_order: 1,
        interfaceId: 1,
        virtualIpsIds: [],
        to: 3,
        offset: Offset.Above,
      };

      const expectedRule = manager.getRepository(KeepalivedRule).create({
        group: {} as KeepalivedGroup,
        rule_order: 1,
        interface: {} as Interface,
      });

      const getLastKeepalivedRuleInFirewallStub = sinon
        .stub(service['_repository'], 'getLastKeepalivedRuleInFirewall')
        .resolves(null);

      const saveStub = sinon.stub(service['_repository'], 'save').resolves(expectedRule);

      const moveRuleStub = sinon.stub(service, 'move').resolves([expectedRule]);

      const result = await service.store(data);

      expect(getLastKeepalivedRuleInFirewallStub.calledOnce).to.be.true;
      expect(saveStub.calledOnce).to.be.true;
      expect(moveRuleStub.calledOnceWith([expectedRule.id], data.to, data.offset as Offset)).to.be
        .true;
      expect(result).to.deep.equal(expectedRule);

      getLastKeepalivedRuleInFirewallStub.restore();
      saveStub.restore();
      moveRuleStub.restore();
    });

    it('should throw an error for invalid IP version', async () => {
      const virtualIp1 = await manager.getRepository(IPObj).save(
        manager.getRepository(IPObj).create({
          name: 'vip1',
          address: '0.0.0.0',
          ipObjTypeId: 0,
          ip_version: 4,
        }),
      );

      const virtualIp2 = await manager.getRepository(IPObj).save(
        manager.getRepository(IPObj).create({
          name: 'vip2',
          address: '0.0.0.0',
          ipObjTypeId: 0,
          ip_version: 6,
        }),
      );

      const data: ICreateKeepalivedRule = {
        group: group.id,
        firewallId: firewall.id,
        rule_order: 1,
        interfaceId: 1,
        virtualIpsIds: [
          { id: virtualIp1.id, order: 1 },
          { id: virtualIp2.id, order: 2 },
        ],
        to: 3,
        offset: Offset.Above,
      };

      expect(service.store(data)).to.be.rejectedWith('IP version mismatch');
    });
  });

  describe('copy', () => {
    let copyStub: sinon.SinonStub;
    let getLastKeepalivedRuleInFirewallStub: sinon.SinonStub;
    let moveRuleStub: sinon.SinonStub;

    beforeEach(() => {
      copyStub = sinon.stub(service['_repository'], 'save').resolves(keepalivedRule);
      getLastKeepalivedRuleInFirewallStub = sinon
        .stub(service['_repository'], 'getLastKeepalivedRuleInFirewall')
        .resolves(keepalivedRule);
      moveRuleStub = sinon.stub(service, 'move').resolves([keepalivedRule]);
    });

    afterEach(() => {
      copyStub.restore();
      getLastKeepalivedRuleInFirewallStub.restore();
      moveRuleStub.restore();
    });

    it('should copy a KeepalivedRule', async () => {
      const result = await service.copy([keepalivedRule.id], keepalivedRule.id, Offset.Above);

      expect(copyStub.calledOnce).to.be.true;
      expect(getLastKeepalivedRuleInFirewallStub.calledOnce).to.be.true;
      expect(moveRuleStub.calledOnce).to.be.true;
      expect(result).to.be.an('array').that.is.not.empty;
    });

    it('should correctly handle different positions', async () => {
      await service.copy([keepalivedRule.id], keepalivedRule.id, Offset.Below);

      expect(
        moveRuleStub.calledOnceWith([keepalivedRule.id], keepalivedRule.rule_order, Offset.Below),
      ).to.be.true;
    });

    it('should correctly modify rule_order for each copied rule', async () => {
      await service.copy([keepalivedRule.id], keepalivedRule.id, Offset.Above);

      expect(
        moveRuleStub.calledOnceWith([keepalivedRule.id], keepalivedRule.rule_order, Offset.Above),
      ).to.be.true;
    });

    it('should call move method with correct parameters after copying', async () => {
      await service.copy([keepalivedRule.id], keepalivedRule.id, Offset.Above);

      expect(
        moveRuleStub.calledOnceWith([keepalivedRule.id], keepalivedRule.rule_order, Offset.Above),
      ).to.be.true;
    });
  });

  describe('move', () => {
    let moveStub: sinon.SinonStub;

    beforeEach(() => {
      moveStub = sinon.stub(service['_repository'], 'move').resolves([keepalivedRule]);
    });

    afterEach(() => {
      moveStub.restore();
    });

    it('should move a KeepalivedRule', async () => {
      const result = await service.move([keepalivedRule.id], 1, Offset.Above);

      expect(moveStub.calledOnce).to.be.true;
      expect(result).to.be.an('array').that.is.not.empty;
    });

    it('should correctly handle different positions', async () => {
      await service.move([keepalivedRule.id], 1, Offset.Below);

      expect(moveStub.calledOnceWith([keepalivedRule.id], 1, Offset.Below)).to.be.true;
    });

    it('should correctly modify rule_order for each moved rule', async () => {
      await service.move([keepalivedRule.id], 1, Offset.Above);

      expect(moveStub.calledOnceWith([keepalivedRule.id], 1, Offset.Above)).to.be.true;
    });
  });

  describe('moveFrom', () => {
    let fromRule: KeepalivedRule;
    let toRule: KeepalivedRule;
    let data: IMoveFromKeepalivedRule;
    let group: KeepalivedGroup;
    beforeEach(async () => {
      group = await manager.getRepository(KeepalivedGroup).save(
        manager.getRepository(KeepalivedGroup).create({
          name: 'group',
          firewall: firewall,
        }),
      );
      fromRule = await manager.getRepository(KeepalivedRule).save(
        manager.getRepository(KeepalivedRule).create({
          id: 1,
          group: group,
          firewall: firewall,
          rule_order: 1,
          interface: null,
          virtualIps: [
            { ipObjId: 1, order: 1 },
            { ipObjId: 2, order: 2 },
          ],
        }),
      );
      toRule = await manager.getRepository(KeepalivedRule).save(
        manager.getRepository(KeepalivedRule).create({
          id: 2,
          group: group,
          firewall: firewall,
          rule_order: 1,
          interface: null,
          virtualIps: [
            { ipObjId: 3, order: 3 },
            { ipObjId: 4, order: 4 },
          ],
        }),
      );

      data = {
        fromId: fromRule.id,
        toId: toRule.id,
        ipObjId: 1,
      };

      sinon
        .stub(service['_repository'], 'findOneOrFail')
        .withArgs(sinon.match(1))
        .resolves(fromRule)
        .withArgs(sinon.match(2))
        .resolves(toRule);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should move virtual IP from one rule to another', async () => {
      const expectedFromRule: KeepalivedRule = manager.getRepository(KeepalivedRule).create({
        id: 1,
        firewall: {} as Firewall,
        virtualIps: [{ ipObjId: 2, order: 2 }],
      });

      const expectedToRule: KeepalivedRule = manager.getRepository(KeepalivedRule).create({
        id: 2,
        firewall: {} as Firewall,
        virtualIps: [
          { ipObjId: 3, order: 3 },
          { ipObjId: 4, order: 4 },
          { ipObjId: 1, order: 5 },
        ],
      });

      const saveStub = sinon
        .stub(service['_repository'], 'save')
        .onFirstCall()
        .resolves(expectedFromRule)
        .onSecondCall()
        .resolves(expectedToRule);

      const result = await service.moveFrom(fromRule.id, toRule.id, data);
      expect(result).to.deep.equal([expectedFromRule, expectedToRule]);
      expect(saveStub.calledTwice).to.be.true;
    });

    it('should not move virtual IP if it does not exist in the "from" rule', async () => {
      data.ipObjId = 5;

      sinon.stub(service['_repository'], 'save');

      const result = await service.moveFrom(1, 2, data);

      expect(result).to.deep.equal([undefined, undefined]);
    });
  });

  describe('update', () => {
    let keepalivedRule;
    let repositoryStub;

    beforeEach(() => {
      keepalivedRule = {
        id: 1,
        rule_order: 1,
        group: { id: 1 },
      };

      repositoryStub = sinon.stub(service['_repository'], 'findOne').resolves(keepalivedRule);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should update a KeepalivedRule', async () => {
      const data = { rule_order: 2 };

      const result = await service.update(keepalivedRule.id, data);

      expect(repositoryStub.called).to.be.true;
      expect(result).to.be.an('object').that.is.not.empty;
    });

    it('should handle errors when updating a KeepalivedRule', async () => {
      repositoryStub.restore();
      repositoryStub = sinon
        .stub(service['_repository'], 'findOne')
        .rejects(new Error('Update error'));

      await expect(service.update(keepalivedRule.id, {})).to.be.rejectedWith('Update error');
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      sinon.restore();

      sinon.stub(service, 'remove').resolves(keepalivedRule);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should remove a KeepalivedRule', async () => {
      const result = await service.remove({ id: keepalivedRule.id });

      expect(result).to.be.an('object').that.is.not.empty;
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple KeepalivedRules', async () => {
      const ids = [1, 2, 3];
      const data = { rule_order: 2 };

      const bulkUpdateStub = sinon.stub(service, 'bulkUpdate').resolves([keepalivedRule]);

      const result = await service.bulkUpdate(ids, data);

      expect(bulkUpdateStub.calledOnceWith(ids, data)).to.be.true;
      expect(result).to.deep.equal([keepalivedRule]);

      bulkUpdateStub.restore();
    });

    it('should handle errors when updating the KeepalivedRules', async () => {
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
    it('should remove the Keepalived rules successfully', async () => {
      const ids = [1, 2, 3];

      const bulkRemoveStub = sinon.stub(service, 'bulkRemove').resolves([keepalivedRule]);

      const result = await service.bulkRemove(ids);

      expect(bulkRemoveStub.calledOnceWith(ids)).to.be.true;
      expect(result).to.deep.equal([keepalivedRule]);

      bulkRemoveStub.restore();
    });

    it('should handle errors when removing the keepalivedRule', async () => {
      const ids = [1, 2, 3];

      const bulkRemoveStub = sinon
        .stub(service, 'bulkRemove')
        .rejects(new Error('Bulk remove error'));

      await expect(service.bulkRemove(ids)).to.be.rejectedWith(Error, 'Bulk remove error');

      bulkRemoveStub.restore();
    });

    it('should call remove with the correct IDs', async () => {
      const ids = [1, 2, 3];

      const removeStub = sinon.stub(service, 'remove').resolves(keepalivedRule);
      const bulkRemoveStub = sinon.stub(service, 'bulkRemove').callsFake(async (ids) => {
        for (const id of ids) {
          await service.remove({ id });
        }
        return [keepalivedRule];
      });

      const result = await service.bulkRemove(ids);

      expect(removeStub.calledThrice).to.be.true;
      expect(removeStub.getCall(0).calledWithExactly({ id: 1 })).to.be.true;
      expect(removeStub.getCall(1).calledWithExactly({ id: 2 })).to.be.true;
      expect(removeStub.getCall(2).calledWithExactly({ id: 3 })).to.be.true;
      expect(bulkRemoveStub.calledOnceWith(ids)).to.be.true;
      expect(result).to.deep.equal([keepalivedRule]);

      removeStub.restore();
      bulkRemoveStub.restore();
    });

    it('should call remove once for each rule', async () => {
      const ids = [1, 2, 3];

      const removeStub = sinon.stub(service, 'remove').resolves(keepalivedRule);
      const bulkRemoveStub = sinon.stub(service, 'bulkRemove').callsFake(async (ids) => {
        for (const id of ids) {
          await service.remove({ id });
        }
        return [keepalivedRule];
      });

      const result = await service.bulkRemove(ids);

      expect(removeStub.callCount).to.equal(ids.length);
      expect(bulkRemoveStub.calledOnceWith(ids)).to.be.true;
      expect(result).to.deep.equal([keepalivedRule]);

      removeStub.restore();
      bulkRemoveStub.restore();
    });
  });
});
