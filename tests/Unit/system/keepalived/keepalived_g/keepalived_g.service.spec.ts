import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../../src/models/fwcloud/FwCloud';
import { KeepalivedGroupService } from '../../../../../src/models/system/keepalived/keepalived_g/keepalived_g.service';
import StringHelper from '../../../../../src/utils/string.helper';
import { testSuite } from '../../../../mocha/global-setup';
import sinon from 'sinon';
import { expect } from 'chai';
import { KeepalivedGroup } from '../../../../../src/models/system/keepalived/keepalived_g/keepalived_g.model';
import { IFindOneRoutingRulePath } from '../../../../../src/models/routing/routing-rule/routing-rule.repository';
import { EntityManager, Repository } from 'typeorm';
import db from '../../../../../src/database/database-manager';

describe(KeepalivedGroupService.name, () => {
  let service: KeepalivedGroupService;
  let fwCloud: FwCloud;
  let firewall: Firewall;
  let manager: EntityManager;
  let repository: Repository<KeepalivedGroup>;

  beforeEach(async () => {
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    service = await testSuite.app.getService<KeepalivedGroupService>(KeepalivedGroupService.name);
    repository = manager.getRepository(KeepalivedGroup);
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
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('create', () => {
    it('should create a new KeepalivedGroup', async () => {
      const data = {
        name: 'group',
        firewallId: firewall.id,
        style: 'default',
      };

      const findOneStub = sinon.stub(manager.getRepository(Firewall), 'findOne').resolves(firewall);
      const saveStub = sinon.stub(repository, 'save').resolves({ id: 1 } as KeepalivedGroup);
      const findOneStub2 = sinon.stub(repository, 'findOne').resolves({ id: 1 } as KeepalivedGroup);

      const result = await service.create(data);

      expect(findOneStub.calledOnce).to.be.true;
      expect(saveStub.calledOnce).to.be.true;
      expect(findOneStub2.calledOnce).to.be.true;
      expect(result).to.deep.equal({ id: 1 });
    });

    it('should handle errors during the creation process', async () => {
      const data = {
        name: 'group',
        firewallId: firewall.id,
        style: 'default',
      };

      const findOneStub = sinon.stub(manager.getRepository(Firewall), 'findOne').resolves(firewall);
      const saveStub = sinon
        .stub(repository, 'save')
        .rejects(new Error('Failed to create KeepalivedGroup'));

      await expect(service.create(data)).to.be.rejectedWith('Failed to create KeepalivedGroup');

      expect(findOneStub.calledOnce).to.be.true;
      expect(saveStub.calledOnce).to.be.true;
    });

    it('should handle errors during the retrieval of the created group', async () => {
      const data = {
        name: 'group',
        firewallId: firewall.id,
        style: 'default',
      };

      const findOneStub = sinon.stub(manager.getRepository(Firewall), 'findOne').resolves(firewall);
      const saveStub = sinon.stub(repository, 'save').resolves({ id: 1 } as KeepalivedGroup);
      const findOneStub2 = sinon
        .stub(repository, 'findOne')
        .rejects(new Error('Failed to retrieve KeepalivedGroup'));

      await expect(service.create(data)).to.be.rejectedWith('Failed to retrieve KeepalivedGroup');

      expect(findOneStub.calledOnce).to.be.true;
      expect(saveStub.calledOnce).to.be.true;
      expect(findOneStub2.calledOnce).to.be.true;
    });
  });
  describe('update', () => {
    let group: KeepalivedGroup;

    beforeEach(async () => {
      group = await repository.save(
        repository.create({
          name: 'group',
          firewall: firewall,
          style: 'default',
        }),
      );
    });

    it('should update a KeepalivedGroup', async () => {
      const id = 1;
      const data = {
        name: 'updated group',
        firewallId: 2,
        style: 'default',
      };

      const saveStub = sinon.stub(repository, 'save').resolves(group);
      const findOneStub2 = sinon.stub(repository, 'findOne').resolves(group);

      const result = await service.update(id, data);

      expect(saveStub.calledOnce).to.be.true;
      expect(findOneStub2.calledOnce).to.be.true;
      expect(result).to.deep.equal(await repository.findOne({ where: { id: id } }));
    });

    it('should throw an error if KeepalivedGroup is not found', async () => {
      const id = 1;
      const data = {
        name: 'updated group',
        firewallId: 2,
        style: 'default',
      };

      const findOneStub = sinon.stub(repository, 'findOne').resolves(group);
      const saveStub = sinon
        .stub(repository, 'save')
        .rejects(new Error('KeepalivedGroup not found'));

      await expect(service.update(id, data)).to.be.rejectedWith('KeepalivedGroup not found');

      expect(findOneStub.calledOnce).to.be.true;
      expect(saveStub.calledOnce).to.be.true;
    });

    it('should handle errors during the update process', async () => {
      const id = 1;
      const data = {
        name: 'updated group',
        firewallId: 2,
        style: 'default',
      };

      const findOneStub = sinon.stub(repository, 'findOne').resolves(group);
      const saveStub = sinon
        .stub(repository, 'save')
        .rejects(new Error('Failed to update KeepalivedGroup'));

      await expect(service.update(id, data)).to.be.rejectedWith('Failed to update KeepalivedGroup');

      expect(findOneStub.calledOnce).to.be.true;
      expect(saveStub.calledOnce).to.be.true;
    });
  });
  describe('remove', () => {
    let group: KeepalivedGroup;
    let iFindOneKeepalivedGPath: IFindOneRoutingRulePath;

    beforeEach(async () => {
      group = await repository.save(
        repository.create({
          name: 'group',
          firewall: firewall,
          style: 'default',
        }),
      );

      iFindOneKeepalivedGPath = { id: 1 };
    });

    it('should remove the KeepalivedGroup', async () => {
      sinon.stub(service, 'findOneInPath').resolves(group);
      const removeStub = sinon.stub(repository, 'remove').resolves(group);

      const result = await service.remove(iFindOneKeepalivedGPath);

      expect(removeStub.calledOnceWithExactly(group)).to.be.true;
      expect(result).to.deep.equal(group);
    });

    it('should handle errors when the KeepalivedGroup is not found', async () => {
      sinon.stub(service, 'findOneInPath').resolves(null);

      await expect(service.remove(iFindOneKeepalivedGPath)).to.be.rejectedWith(
        'KeepalivedGroup not found',
      );
    });

    it('should handle errors during rules update', async () => {
      sinon.stub(service, 'findOneInPath').resolves(group);
      sinon.stub(repository, 'remove').rejects(new Error('Failed to remove KeepalivedGroup'));

      await expect(service.remove(iFindOneKeepalivedGPath)).to.be.rejectedWith(
        'Failed to remove KeepalivedGroup',
      );
    });

    it('should handle errors during the group removal', async () => {
      sinon.stub(service, 'findOneInPath').rejects(new Error('Failed to find KeepalivedGroup'));
      sinon.stub(repository, 'remove').resolves(group);

      await expect(service.remove(iFindOneKeepalivedGPath)).to.be.rejectedWith(
        'Failed to find KeepalivedGroup',
      );
    });
  });
});
