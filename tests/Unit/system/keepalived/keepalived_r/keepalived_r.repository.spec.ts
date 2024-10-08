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
import { KeepalivedRule } from '../../../../../src/models/system/keepalived/keepalived_r/keepalived_r.model';
import { KeepalivedRepository } from '../../../../../src/models/system/keepalived/keepalived_r/keepalived.repository';
import { KeepalivedGroup } from '../../../../../src/models/system/keepalived/keepalived_g/keepalived_g.model';
import { IPObj } from '../../../../../src/models/ipobj/IPObj';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { testSuite, expect } from '../../../../mocha/global-setup';
import { FwCloud } from '../../../../../src/models/fwcloud/FwCloud';
import StringHelper from '../../../../../src/utils/string.helper';
import sinon from 'sinon';
import { Offset } from '../../../../../src/offset';
import { EntityManager } from 'typeorm';
import db from '../../../../../src/database/database-manager';

describe(KeepalivedRepository.name, () => {
  let repository: KeepalivedRepository;
  let fwCloud: FwCloud;
  let firewall: Firewall;
  let gateway: IPObj;
  let group: KeepalivedGroup;
  let keepalivedRule: KeepalivedRule;
  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();
    repository = new KeepalivedRepository(manager);
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
    gateway = await manager.getRepository(IPObj).save(
      manager.getRepository(IPObj).create({
        name: 'test',
        address: '0.0.0.0',
        ipObjTypeId: 0,
        interfaceId: null,
      }),
    );

    group = await manager.getRepository(KeepalivedGroup).save(
      manager.getRepository(KeepalivedGroup).create({
        name: 'group',
        firewall: firewall,
      }),
    );

    keepalivedRule = await manager.getRepository(KeepalivedRule).save(
      manager.getRepository(KeepalivedRule).create({
        group: group,
        firewall: firewall,
        rule_order: 1,
        interface: null,
      }),
    );
  });

  describe('remove', () => {
    it('should remove a single KeepalivedRule entity', async () => {
      const result = await repository.remove(keepalivedRule);

      expect(await repository.findOne({ where: { id: keepalivedRule.id } })).to.be.null;
    });

    it('should remove multiple KeepalivedRule entities', async () => {
      const keepalivedRule2 = await manager.getRepository(KeepalivedRule).save(
        manager.getRepository(KeepalivedRule).create({
          group: group,
          firewall: firewall,
          rule_order: 2,
          interface: null,
        }),
      );

      const result = await repository.remove([keepalivedRule, keepalivedRule2]);

      expect(await repository.findOne({ where: { id: keepalivedRule.id } })).to.be.null;
      expect(await repository.findOne({ where: { id: keepalivedRule2.id } })).to.be.null;
    });

    it('should refresh orders after remove', async () => {
      const refreshOrdersSpy = sinon.spy(repository, 'refreshOrders' as keyof KeepalivedRepository);

      await repository.remove(keepalivedRule);

      expect(refreshOrdersSpy.calledOnceWithExactly(group.id)).to.be.true;
    });
  });

  describe('move', () => {
    it('should move the rule to the specified position', async () => {
      keepalivedRule.group = null;
      keepalivedRule.save();

      const moveAboveSpy = sinon.spy(repository, 'moveAbove' as keyof KeepalivedRepository);

      await repository.move([keepalivedRule.id], keepalivedRule.id, Offset.Above);

      expect(moveAboveSpy.calledOnce).to.be.true;
    });

    it('should refresh orders after move', async () => {
      const refreshOrdersSpy = sinon.spy(repository, 'refreshOrders' as keyof KeepalivedRepository);

      await repository.move([keepalivedRule.id], keepalivedRule.id, Offset.Above);

      expect(refreshOrdersSpy.calledOnce).to.be.true;
    });
  });

  describe('getLastKeepalivedRuleInGroup', () => {
    it('should return the last Keepalived rule in the group', async () => {
      const Keepalivedgid = group.id;
      const expectedRule: KeepalivedRule = await manager.getRepository(KeepalivedRule).save(
        manager.getRepository(KeepalivedRule).create({
          group: group,
          firewall: firewall,
          rule_order: 2,
          interface: null,
        }),
      );

      //const result = await repository.getLastKeepalivedRuleInGroup(Keepalivedgid);

      // Assert
      /*expect(result.id).to.equal(expectedRule.id);
            expect(result.rule_order).to.equal(expectedRule.rule_order);
            expect(result.rule_type).to.equal(expectedRule.rule_type);*/
    });
  });
});
