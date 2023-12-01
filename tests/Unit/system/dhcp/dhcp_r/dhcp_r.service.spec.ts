import { expect } from "chai";
import { DeepPartial, Repository, getRepository } from "typeorm";
import { DHCPGroup } from "../../../../../src/models/system/dhcp/dhcp_g/dhcp_g.model";
import { IPObj } from "../../../../../src/models/ipobj/IPObj";
import { DHCPRuleService, ICreateDHCPRule } from "../../../../../src/models/system/dhcp/dhcp_r/dhcp_r.service";
import sinon from "sinon";
import { DHCPRule } from "../../../../../src/models/system/dhcp/dhcp_r/dhcp_r.model";
import { Firewall } from "../../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../../src/models/fwcloud/FwCloud";
import StringHelper from "../../../../../src/utils/string.helper";
import { testSuite } from "../../../../mocha/global-setup";
import { Interface } from "../../../../../src/models/interface/Interface";
import { Offset } from "../../../../../src/offset";

describe(DHCPRuleService.name, () => {
    let service: DHCPRuleService;
    let fwCloud: FwCloud;
    let firewall: Firewall;

    beforeEach(async () => {
        await testSuite.resetDatabaseData();

        service = await testSuite.app.getService<DHCPRuleService>(DHCPRuleService.name);
        
        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
            name: StringHelper.randomize(10)
        }));

        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwCloud.id
        }));
    });

    afterEach(() => {
        sinon.restore();
    })

    describe('store', () => {
        let group: DHCPGroup;
        beforeEach(async () => {
            
            group = await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                name: 'group',
                firewall: firewall,
            }));

            await getRepository(Interface).save(getRepository(Interface).create({
                name: 'eth1',
                type: '11',
                interface_type: '11'
            }));
        });
        it('should store a new DHCPRule', async () => {
            const data = {
                active: true,
                style: 'default',
                max_lease: 3600,
                cfg_text: 'sample cfg text',
                comment: 'sample comment',
                groupId: 1,
                networkId: 1,
                rangeId: 1,
                routerId: 1,
                interfaceId: 1
            };

            const expectedDHCPRule: DHCPRule = getRepository(DHCPRule).create({
                group: group,
                rule_order: 1,
                interface: null,
            });
            service['_repository'].getLastDHCPRuleInGroup = () => null;
            const getLastDHCPRuleInGroupStub = sinon.stub(service['_repository'], 'getLastDHCPRuleInGroup');
            getLastDHCPRuleInGroupStub.returns(null);
            const saveStub = sinon.stub(service['_repository'], 'save').resolves(expectedDHCPRule);
            
            const result = await service.store(data);

            expect(getLastDHCPRuleInGroupStub.calledOnce).to.be.true;
            expect(saveStub.calledOnce).to.be.true;
            expect(result).to.deep.equal(expectedDHCPRule);

            getLastDHCPRuleInGroupStub.restore();
            saveStub.restore();
        });
        it('should throw an error if the group does not exist', async () => {
            const data = {
                active: true,
                style: 'default',
                max_lease: 3600,
                cfg_text: 'sample cfg text',
                comment: 'sample comment',
                groupId: 999,
                networkId: 1,
                rangeId: 1,
                routerId: 1,
                interfaceId: 1
            };

            const findOneOrFailStub = sinon.stub(getRepository(DHCPGroup), 'findOneOrFail').throws();

            await expect(service.store(data)).to.be.rejectedWith(Error);

            findOneOrFailStub.restore();
        });
        it('should throw errors when saving fails', async () => {
            const data = {
                active: true,
                style: 'default',
                max_lease: 3600,
                cfg_text: 'sample cfg text',
                comment: 'sample comment',
                groupId: 1,
                networkId: 1,
                rangeId: 1,
                routerId: 1,
                interfaceId: 1
            };

            const expectedError = new Error('test error');
            const saveStub = sinon.stub(service['_repository'], 'save').throws(expectedError);

            await expect(service.store(data)).to.be.rejectedWith(expectedError);

            saveStub.restore();
        });
        it('should correctly set the rule_order', async () => {
            const data = {
                active: true,
                style: 'default',
                max_lease: 3600,
                cfg_text: 'sample cfg text',
                comment: 'sample comment',
                groupId: 1,
                networkId: 1,
                rangeId: 1,
                routerId: 1,
                interfaceId: 1
            };

            const existingDHCPRule = await getRepository(DHCPRule).create(getRepository(DHCPRule).create({
                group: group,
                rule_order: 1,
                interface: null,
            }));
            existingDHCPRule.rule_order = 5;
            const getLastDHCPRuleInGroupStub = sinon.stub(service['_repository'], 'getLastDHCPRuleInGroup').resolves(existingDHCPRule);

            const result = await service.store(data);
            expect(result).to.have.property('rule_order', 6);

            getLastDHCPRuleInGroupStub.restore();
        });
    });
    describe('copy',()=>{
        it('should copy a DHCPRule successfully', async () => {
            const dhcpRule = await getRepository(DHCPRule).save(getRepository(DHCPRule).create({
                id: 1,
                group: await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                    name: 'group',
                    firewall: firewall,
                })),
                rule_order: 1,
                interface: null,
            }));

            const getLastDHCPRuleInGroupStub = sinon.stub(service['_repository'], 'getLastDHCPRuleInGroup').resolves(dhcpRule);
            const copyStub = sinon.stub(service['_repository'], 'save').resolves(dhcpRule);

            const result = await service.copy([dhcpRule.id], dhcpRule.id, Offset.Above);

            expect(getLastDHCPRuleInGroupStub.calledOnce).to.be.true;
            expect(copyStub.called).to.be.true;
            expect(result[0].id).equal(dhcpRule.id);
            expect(result[0].rule_order).equal(dhcpRule.rule_order);
            expect(result[0].rule_type).equal(dhcpRule.rule_type);
            expect(result[0].max_lease).equal(dhcpRule.max_lease);
            expect(result[0].active).equal(dhcpRule.active);

            getLastDHCPRuleInGroupStub.restore();
            copyStub.restore();
        });
        it('should handle errors when no rules found to copy', async () => {
            const dhcpRule = await getRepository(DHCPRule).save(getRepository(DHCPRule).create({
                id: 1,
                group: await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                    name: 'group',
                    firewall: firewall,
                })),
                rule_order: 1,
                interface: null,
            }));

            const getLastDHCPRuleInGroupStub = sinon.stub(service['_repository'], 'getLastDHCPRuleInGroup').resolves(null);
            const copyStub = sinon.stub(service['_repository'], 'save').resolves(dhcpRule);

            await expect(service.copy([dhcpRule.id], dhcpRule.id, Offset.Above)).to.be.rejectedWith(Error);

            expect(getLastDHCPRuleInGroupStub.calledOnce).to.be.true;
            expect(copyStub.called).to.be.false;

            getLastDHCPRuleInGroupStub.restore();
            copyStub.restore();
        });
        it('should correctly handle different positions', async () => {
            const dhcpRule = await getRepository(DHCPRule).save(getRepository(DHCPRule).create({
                id: 1,
                group: await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                    name: 'group',
                    firewall: firewall,
                })),
                rule_order: 1,
                interface: null,
            }));
            
            const getLastDHCPRuleInGroupStub = sinon.stub(service['_repository'], 'getLastDHCPRuleInGroup').resolves(dhcpRule);
            const copyStub = sinon.stub(service['_repository'], 'save').resolves(dhcpRule);
            const moveStub = sinon.stub(service, 'move');

            await service.copy([dhcpRule.id], dhcpRule.id, Offset.Above);
            
            expect(moveStub.calledOnceWith([dhcpRule.id], dhcpRule.rule_order, Offset.Above)).to.be.true;

            moveStub.restore();
            getLastDHCPRuleInGroupStub.restore();
            copyStub.restore();
        });
        it('should correctly modify rule_order for each copied rule', async () => {
            const dhcpRule = await getRepository(DHCPRule).save(getRepository(DHCPRule).create({
                id: 1,
                group: await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                    name: 'group',
                    firewall: firewall,
                })),
                rule_order: 1,
                interface: null,
            }));

            const getLastDHCPRuleInGroupStub = sinon.stub(service['_repository'], 'getLastDHCPRuleInGroup').resolves(dhcpRule);
            const copyStub = sinon.stub(service['_repository'], 'save').resolves(dhcpRule);
            const moveStub = sinon.stub(service, 'move');

            await service.copy([dhcpRule.id], dhcpRule.id, Offset.Above);

            expect(moveStub.calledOnceWith([dhcpRule.id], dhcpRule.rule_order, Offset.Above)).to.be.true;

            moveStub.restore();
            getLastDHCPRuleInGroupStub.restore();
            copyStub.restore();  
        });
        it('should call move method with correct parameters after copying', async () => {
            const dhcpRule = await getRepository(DHCPRule).save(getRepository(DHCPRule).create({
                id: 1,
                group: await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                    name: 'group',
                    firewall: firewall,
                })),
                rule_order: 1,
                interface: null,
            }));

            const getLastDHCPRuleInGroupStub = sinon.stub(service['_repository'], 'getLastDHCPRuleInGroup').resolves(dhcpRule);
            const copyStub = sinon.stub(service['_repository'], 'save').resolves(dhcpRule);
            const moveStub = sinon.stub(service, 'move');

            await service.copy([dhcpRule.id], dhcpRule.id, Offset.Above);

            expect(moveStub.calledOnceWith([dhcpRule.id], dhcpRule.rule_order, Offset.Above)).to.be.true;

            moveStub.restore();
            getLastDHCPRuleInGroupStub.restore();
            copyStub.restore();  
        });
    });
    describe('move', () => {
        it('should move the DHCP rules successfully', async () => {
            const ids = [1, 2, 3];
            const destRule = 4;
            const offset = Offset.Above;
            const expectedRules: DHCPRule[] = [];

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
    describe('update', () => {
        it('should successfully update a DHCPRule', async () => {
            const dhcpRule = await getRepository(DHCPRule).save(getRepository(DHCPRule).create({
                id: 1,
                group: await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                    name: 'group',
                    firewall: firewall,
                })),
                rule_order: 1,
                interface: null,
            }));

            const updateStub = sinon.stub(service, 'update').resolves(dhcpRule);

            const result = await service.update(dhcpRule.id, { rule_order: 2 });

            expect(updateStub.calledOnceWith(dhcpRule.id, { rule_order: 2 })).to.be.true;
            expect(result).to.deep.equal(dhcpRule);

            updateStub.restore();
        });
        it('should handle errors when the DHCPRule to update is not found', async () => {
            const updateStub = sinon.stub(service, 'update').rejects(new Error('DHCPRule not found'));

            await expect(service.update(1, { rule_order: 2 })).to.be.rejectedWith(Error, 'DHCPRule not found');

            updateStub.restore();
        });
        it('should update related entities correctly', async () => {
            const dhcpRule = await getRepository(DHCPRule).save(getRepository(DHCPRule).create({
                id: 1,
                group: await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                    name: 'group',
                    firewall: firewall,
                })),
                rule_order: 1,
                interface: null,
            }));

            const updateStub = sinon.stub(service, 'update').resolves(dhcpRule);
            const group2 = (await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                name: 'group2',
                firewall: firewall,
            })));

            const result = await service.update(dhcpRule.id, { groupId: group2.id});

            expect(updateStub.calledOnceWith(dhcpRule.id, { groupId: group2.id })).to.be.true;
            expect(result).to.deep.equal(dhcpRule);

            updateStub.restore();
        });
        it('should handle errors when related entities are not found', async () => {
            const updateStub = sinon.stub(service, 'update').rejects(new Error('Related entities not found'));

            await expect(service.update(1, { groupId: (await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                name: 'group2',
                firewall: firewall,
            }))).id})).to.be.rejectedWith(Error, 'Related entities not found');

            updateStub.restore();
        });
    });
    describe('remove', () => {
        it('should remove the DHCP rule successfully', async () => {
            const dhcpRule = await getRepository(DHCPRule).save(getRepository(DHCPRule).create({
                id: 1,
                group: await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                    name: 'group',
                    firewall: firewall,
                })),
                rule_order: 1,
                interface: null,
            }));
            const path = { id: 1 };

            sinon.stub(service, 'findOneInPath').resolves(dhcpRule);
            const removeStub = sinon.stub(service['_repository'], 'remove').resolves(dhcpRule);

            const result = await service.remove(path);

            expect(removeStub.calledOnceWithExactly(dhcpRule)).to.be.true;
            expect(result).to.equal(dhcpRule);
        });
    
        it('should throw an error if the DHCP rule does not exist', async () => {
            const path = {
                id: 1,
            };
    
            sinon.stub(service, 'findOneInPath').resolves(null);
    
            await expect(service.remove(path)).to.be.rejectedWith(Error);
        });
    });
});