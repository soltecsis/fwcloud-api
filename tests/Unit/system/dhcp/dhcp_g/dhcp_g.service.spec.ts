import { Firewall } from "../../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../../src/models/fwcloud/FwCloud";
import { DHCPGroupService } from "../../../../../src/models/system/dhcp/dhcp_g/dhcp_g.service";
import StringHelper from "../../../../../src/utils/string.helper";
import { testSuite } from "../../../../mocha/global-setup";
import sinon from "sinon";
import { expect } from "chai";
import { DHCPGroup } from "../../../../../src/models/system/dhcp/dhcp_g/dhcp_g.model";
import { IFindOneRoutingRulePath } from "../../../../../src/models/routing/routing-rule/routing-rule.repository";
import { EntityManager, Repository } from "typeorm";
import db from "../../../../../src/database/database-manager";

describe(DHCPGroupService.name, () => {
    let service: DHCPGroupService;
    let fwCloud: FwCloud;
    let firewall: Firewall;
    let manager: EntityManager;
    let repository: Repository<DHCPGroup>;

    beforeEach(async () => {
        manager = db.getSource().manager;
        await testSuite.resetDatabaseData();

        service = await testSuite.app.getService<DHCPGroupService>(DHCPGroupService.name);
        repository = manager.getRepository(DHCPGroup);
        fwCloud = await manager.getRepository(FwCloud).save(manager.getRepository(FwCloud).create({
            name: StringHelper.randomize(10)
        }));

        firewall = await manager.getRepository(Firewall).save(manager.getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwCloud.id
        }));
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('create', () => {
        //TODO: Falshy test?
        it('should create a new DHCPGroup', async () => {
            const data = {
                name: 'group',
                firewallId: firewall.id,
                style: 'default',
            };

            const findOneStub = sinon.stub(manager.getRepository(Firewall), 'findOne').resolves(firewall);
            const saveStub = sinon.stub(repository, 'save').resolves({ id: 1 } as DHCPGroup);
            const findOneStub2 = sinon.stub(repository, 'findOne').resolves({ id: 1 } as DHCPGroup);

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
            const saveStub = sinon.stub(repository, 'save').rejects(new Error('Failed to create DHCPGroup'));

            await expect(service.create(data)).to.be.rejectedWith('Failed to create DHCPGroup');

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
            const saveStub = sinon.stub(repository, 'save').resolves({ id: 1 } as DHCPGroup);
            const findOneStub2 = sinon.stub(repository, 'findOne').rejects(new Error('Failed to retrieve DHCPGroup'));

            await expect(service.create(data)).to.be.rejectedWith('Failed to retrieve DHCPGroup');

            expect(findOneStub.calledOnce).to.be.true;
            expect(saveStub.calledOnce).to.be.true;
            expect(findOneStub2.calledOnce).to.be.true;

        });
    });
    describe('update', () => {
        let group: DHCPGroup;

        beforeEach(async () => {
            group = await repository.save(repository.create({
                name: 'group',
                firewall: firewall,
                style: 'default',
            }));
        });

        it('should update a DHCPGroup', async () => {
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
            expect(result).to.deep.equal(await repository.findOne({ where: { id: id }}));

        });

        it('should throw an error if DHCPGroup is not found', async () => {
            const id = 1;
            const data = {
                name: 'updated group',
                firewallId: 2,
                style: 'default',
            };

            const findOneStub = sinon.stub(repository, 'findOne').resolves(undefined);

            await expect(service.update(id, data)).to.be.rejectedWith('DHCPGroup not found');

            expect(findOneStub.calledOnce).to.be.true;

        });

        it('should handle errors during the update process', async () => {
            const id = 1;
            const data = {
                name: 'updated group',
                firewallId: 2,
                style: 'default',
            };

            const findOneStub = sinon.stub(repository, 'findOne').resolves(group);
            const saveStub = sinon.stub(repository, 'save').rejects(new Error('Failed to update DHCPGroup'));

            await expect(service.update(id, data)).to.be.rejectedWith('Failed to update DHCPGroup');

            expect(findOneStub.calledOnce).to.be.true;
            expect(saveStub.calledOnce).to.be.true;

        });
    });
    describe('remove', () => {
        let group: DHCPGroup;
        let iFindOneDHCPGPath: IFindOneRoutingRulePath;

        beforeEach(async () => {
            group = await repository.save(repository.create({
                name: 'group',
                firewall: firewall,
                style: 'default',
            }));

            iFindOneDHCPGPath = { id: 1 };
        });

        it('should remove the DHCPGroup', async () => {
            sinon.stub(service, 'findOneInPath').resolves(group);
            const removeStub = sinon.stub(repository, 'remove').resolves(group);

            const result = await service.remove(iFindOneDHCPGPath);

            expect(removeStub.calledOnceWithExactly(group)).to.be.true;
            expect(result).to.deep.equal(group);

        });

        it('should handle errors when the DHCPGroup is not found', async () => {
            sinon.stub(service, 'findOneInPath').resolves(null);

            await expect(service.remove(iFindOneDHCPGPath)).to.be.rejectedWith('DHCPGroup not found');

        });

        it('should handle errors during rules update', async () => {
            sinon.stub(service, 'findOneInPath').resolves(group);
            sinon.stub(repository, 'remove').rejects(new Error('Failed to remove DHCPGroup'));

            await expect(service.remove(iFindOneDHCPGPath)).to.be.rejectedWith('Failed to remove DHCPGroup');

        });

        it('should handle errors during the group removal', async () => {
            sinon.stub(service, 'findOneInPath').rejects(new Error('Failed to find DHCPGroup'));
            sinon.stub(repository, 'remove').resolves(group);

            await expect(service.remove(iFindOneDHCPGPath)).to.be.rejectedWith('Failed to find DHCPGroup');

        });
    });
});