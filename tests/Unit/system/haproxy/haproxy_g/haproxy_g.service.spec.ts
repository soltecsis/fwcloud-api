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

import { getRepository } from 'typeorm';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../../src/models/fwcloud/FwCloud';
import { HAProxyGroupService } from '../../../../../src/models/system/haproxy/haproxy_g/haproxy_g.service';
import StringHelper from '../../../../../src/utils/string.helper';
import { expect, testSuite } from '../../../../mocha/global-setup';
import sinon from 'sinon';
import { HAProxyGroup } from '../../../../../src/models/system/haproxy/haproxy_g/haproxy_g.model';
import { IFindOneRoutingRulePath } from '../../../../../src/models/routing/routing-rule/routing-rule.repository';

describe(HAProxyGroupService.name, () => {
  let service: HAProxyGroupService;
  let fwCloud: FwCloud;
  let firewall: Firewall;

  beforeEach(async () => {
    await testSuite.resetDatabaseData();

    service = await testSuite.app.getService<HAProxyGroupService>(
      HAProxyGroupService.name,
    );

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
  });

  describe('create', () => {
    it('should create a new HAProxyGroup', async () => {
      const data = {
        firewallId: firewall.id,
        name: 'test',
        style: 'default',
      };

      const findOneStub = sinon
        .stub(getRepository(Firewall), 'findOne')
        .resolves(firewall);
      const saveStub = sinon
        .stub(service['_repository'], 'save')
        .resolves({ id: 1 } as HAProxyGroup);
      const findOneStub2 = sinon
        .stub(service['_repository'], 'findOne')
        .resolves({ id: 1 } as HAProxyGroup);

      const result = await service.create(data);

      expect(findOneStub.calledOnce).to.be.true;
      expect(saveStub.calledOnce).to.be.true;
      expect(findOneStub2.calledOnce).to.be.true;
      expect(result).to.deep.equal({ id: 1 });

      findOneStub.restore();
      saveStub.restore();
      findOneStub2.restore();
    });

    it('should handle errors during the creation process', async () => {
      const data = {
        name: 'group',
        firewallId: firewall.id,
        style: 'default',
      };

      const findOneStub = sinon
        .stub(getRepository(Firewall), 'findOne')
        .resolves(firewall);
      const saveStub = sinon
        .stub(service['_repository'], 'save')
        .rejects(new Error('Failed to create DHCPGroup'));

      await expect(service.create(data)).to.be.rejectedWith(
        'Failed to create DHCPGroup',
      );

      expect(findOneStub.calledOnce).to.be.true;
      expect(saveStub.calledOnce).to.be.true;

      findOneStub.restore();
      saveStub.restore();
    });

    it('should handle errors during the retrieval of the created group', async () => {
      const data = {
        name: 'group',
        firewallId: firewall.id,
        style: 'default',
      };

      const findOneStub = sinon
        .stub(getRepository(Firewall), 'findOne')
        .resolves(firewall);
      const saveStub = sinon
        .stub(service['_repository'], 'save')
        .resolves({ id: 1 } as HAProxyGroup);
      const findOneStub2 = sinon
        .stub(service['_repository'], 'findOne')
        .rejects(new Error('Failed to retrieve DHCPGroup'));

      await expect(service.create(data)).to.be.rejectedWith(
        'Failed to retrieve DHCPGroup',
      );

      expect(findOneStub.calledOnce).to.be.true;
      expect(saveStub.calledOnce).to.be.true;
      expect(findOneStub2.calledOnce).to.be.true;

      findOneStub.restore();
      saveStub.restore();
      findOneStub2.restore();
    });
  });
  describe('update', () => {
    let group: HAProxyGroup;

    beforeEach(async () => {
      group = await getRepository(HAProxyGroup).save(
        getRepository(HAProxyGroup).create({
          name: 'test',
          firewall: firewall,
          style: 'default',
        }),
      );
    });

    it('should update an existing HAProxyGroup', async () => {
      const id = 1;
      const data = {
        name: 'updated group',
        firewallId: 2,
        style: 'default',
      };

      const saveStub = sinon
        .stub(service['_repository'], 'save')
        .resolves(group);
      const findOneStub2 = sinon
        .stub(service['_repository'], 'findOne')
        .resolves(group);

      const result = await service.update(id, data);

      expect(saveStub.calledOnce).to.be.true;
      expect(findOneStub2.calledOnce).to.be.true;
      expect(result).to.deep.equal(
        await getRepository(HAProxyGroup).findOne(id),
      );

      saveStub.restore();
      findOneStub2.restore();
    });

    it('should throw an error if group is not found', async () => {
      const id = 1;
      const data = {
        name: 'updated group',
        firewallId: 2,
        style: 'default',
      };

      const findOneStub = sinon
        .stub(service['_repository'], 'findOne')
        .resolves(undefined);

      await expect(service.update(id, data)).to.be.rejectedWith(
        'HAProxyGroup not found',
      );

      expect(findOneStub.calledOnce).to.be.true;

      findOneStub.restore();
    });

    it('should handle errors during the update process', async () => {
      const id = 1;
      const data = {
        name: 'updated group',
        firewallId: 2,
        style: 'default',
      };

      const findOneStub = sinon
        .stub(service['_repository'], 'findOne')
        .resolves(group);
      const saveStub = sinon
        .stub(service['_repository'], 'save')
        .rejects(new Error('Failed to update HAProxyGroup'));

      await expect(service.update(id, data)).to.be.rejectedWith(
        'Failed to update HAProxyGroup',
      );

      expect(findOneStub.calledOnce).to.be.true;
      expect(saveStub.calledOnce).to.be.true;

      findOneStub.restore();
      saveStub.restore();
    });
  });
  describe('remove', () => {
    let group: HAProxyGroup;
    let IFindOneHAProxyGPath: IFindOneRoutingRulePath;

    beforeEach(async () => {
      group = await getRepository(HAProxyGroup).save(
        getRepository(HAProxyGroup).create({
          name: 'group',
          firewall: firewall,
          style: 'default',
        }),
      );

      IFindOneHAProxyGPath = { id: 1 };
    });

    it('should remove the DHCPGroup', async () => {
      sinon.stub(service, 'findOneInPath').resolves(group);
      const removeStub = sinon
        .stub(service['_repository'], 'remove')
        .resolves(group);

      const result = await service.remove(IFindOneHAProxyGPath);

      expect(removeStub.calledOnceWithExactly(group)).to.be.true;
      expect(result).to.deep.equal(group);

      sinon.restore();
    });

    it('should handle errors when the DHCPGroup is not found', async () => {
      sinon.stub(service, 'findOneInPath').resolves(null);

      await expect(service.remove(IFindOneHAProxyGPath)).to.be.rejectedWith(
        'HAProxyGroup not found',
      );

      sinon.restore();
    });

    it('should handle errors during rules update', async () => {
      sinon.stub(service, 'findOneInPath').resolves(group);
      sinon
        .stub(service['_repository'], 'remove')
        .rejects(new Error('Failed to remove HAProxyGroup'));

      await expect(service.remove(IFindOneHAProxyGPath)).to.be.rejectedWith(
        'Failed to remove HAProxyGroup',
      );

      sinon.restore();
    });

    it('should handle errors during the group removal', async () => {
      sinon
        .stub(service, 'findOneInPath')
        .rejects(new Error('Failed to find HAProxyGroup'));
      sinon.stub(service['_repository'], 'remove').resolves(group);

      await expect(service.remove(IFindOneHAProxyGPath)).to.be.rejectedWith(
        'Failed to find HAProxyGroup',
      );

      sinon.restore();
    });
  });
});
