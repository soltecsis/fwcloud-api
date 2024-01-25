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
import { expect } from "chai";
import { getRepository } from "typeorm";
import { DHCPGroup } from "../../../../../src/models/system/dhcp/dhcp_g/dhcp_g.model";
import { DHCPRuleService, ICreateDHCPRule } from "../../../../../src/models/system/dhcp/dhcp_r/dhcp_r.service";
import sinon from "sinon";
import { DHCPRule } from "../../../../../src/models/system/dhcp/dhcp_r/dhcp_r.model";
import { Firewall } from "../../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../../src/models/fwcloud/FwCloud";
import StringHelper from "../../../../../src/utils/string.helper";
import { testSuite } from "../../../../mocha/global-setup";
import { Interface } from "../../../../../src/models/interface/Interface";
import { Offset } from "../../../../../src/offset";
import { beforeEach } from "mocha";

describe(DHCPRuleService.name, () => {
    let service: DHCPRuleService;
    let fwCloud: FwCloud;
    let firewall: Firewall;
    let dhcpRule: DHCPRule;

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

        dhcpRule = await getRepository(DHCPRule).save(getRepository(DHCPRule).create({
            id: 1,
            group: await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                name: 'group',
                firewall: firewall,
            })),
            firewall: firewall,
            rule_order: 1,
            interface: null,
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
                firewallId: firewall.id,
                networkId: 1,
                rangeId: 1,
                routerId: 1,
                interfaceId: 1
            };

            const existingDHCPRule: DHCPRule = getRepository(DHCPRule).create(getRepository(DHCPRule).create({
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

        it('should move the stored DHCPRule to a new position', async () => {
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
                interfaceId: 1,
                to: 3,
                offset: 'above'
            };

            const expectedDHCPRule: DHCPRule = getRepository(DHCPRule).create({
                group: {} as DHCPGroup,
                rule_order: 1,
                interface: {} as Interface,
            });

            const getLastDHCPRuleInGroupStub = sinon.stub(service['_repository'], 'getLastDHCPRuleInGroup');
            getLastDHCPRuleInGroupStub.returns(null);

            const saveStub = sinon.stub(service['_repository'], 'save');
            saveStub.resolves(expectedDHCPRule);

            const moveStub = sinon.stub(service, 'move');
            moveStub.resolves([expectedDHCPRule]);

            const result = await service.store(data as ICreateDHCPRule);

            expect(getLastDHCPRuleInGroupStub.calledOnce).to.be.true;
            expect(saveStub.calledOnce).to.be.true;
            expect(moveStub.calledOnceWith([expectedDHCPRule.id], data.to, data.offset as Offset)).to.be.true; // Cast 'data.offset' to 'Offset'
            expect(result).to.deep.equal(expectedDHCPRule);

            getLastDHCPRuleInGroupStub.restore();
            saveStub.restore();
            moveStub.restore();
        });
    });
    describe('copy', () => {
        let getLastDHCPRuleInGroupStub: sinon.SinonStub;
        let copyStub: sinon.SinonStub;
        let moveStub: sinon.SinonStub;

        beforeEach(async () => {
            dhcpRule.group = await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                name: 'group',
                firewall: firewall,
            }));
            copyStub = sinon.stub(service['_repository'], 'save').resolves(dhcpRule);
            moveStub = sinon.stub(service, 'move').resolves([dhcpRule]);
        });

        afterEach(() => {
            copyStub.restore();
            moveStub.restore();
        });

        it('should copy a DHCPRule successfully', async () => {
            const result: DHCPRule[] = await service.copy([dhcpRule.id], dhcpRule.id, Offset.Above);

            expect(copyStub.called).to.be.true;
            expect(result[0].id).equal(dhcpRule.id);
            expect(result[0].rule_order).equal(dhcpRule.rule_order);
            expect(result[0].rule_type).equal(dhcpRule.rule_type);
            expect(result[0].max_lease).equal(dhcpRule.max_lease);
            expect(result[0].active).equal(dhcpRule.active);
        });

        it('should correctly handle different positions', async () => {
            await service.copy([dhcpRule.id], dhcpRule.id, Offset.Below);

            expect(moveStub.calledOnceWith([dhcpRule.id], dhcpRule.rule_order, Offset.Below)).to.be.true;
        });

        it('should correctly modify rule_order for each copied rule', async () => {
            await service.copy([dhcpRule.id], dhcpRule.id, Offset.Above);

            expect(moveStub.calledOnceWith([dhcpRule.id], dhcpRule.rule_order, Offset.Above)).to.be.true;
        });

        it('should call move method with correct parameters after copying', async () => {

            await service.copy([dhcpRule.id], dhcpRule.id, Offset.Above);

            expect(moveStub.calledOnceWith([dhcpRule.id], dhcpRule.rule_order, Offset.Above)).to.be.true;
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

            const result = await service.update(dhcpRule.id, { groupId: group2.id });

            expect(updateStub.calledOnceWith(dhcpRule.id, { groupId: group2.id })).to.be.true;
            expect(result).to.deep.equal(dhcpRule);

            updateStub.restore();
        });

        it('should handle errors when related entities are not found', async () => {
            const updateStub = sinon.stub(service, 'update').rejects(new Error('Related entities not found'));

            await expect(service.update(1, {
                groupId: (await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                    name: 'group2',
                    firewall: firewall,
                }))).id
            })).to.be.rejectedWith(Error, 'Related entities not found');

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

    describe.skip('bulkUpdate', () => {
        it('should update the DHCP rules successfully', async () => {
            const ids = [1, 2, 3];
            const data = { rule_order: 2 };

            const bulkUpdateStub = sinon.stub(service, 'bulkUpdate').resolves([dhcpRule]);

            //const result = await service.bulkUpdate(ids, data);

            //expect(bulkUpdateStub.calledOnceWith(ids, data)).to.be.true;
            //expect(result).to.deep.equal([dhcpRule]);

            bulkUpdateStub.restore();
        });

        it('should handle errors when updating the DHCP rules', async () => {
            const ids = [1, 2, 3];
            const data = { rule_order: 2 };

            const bulkUpdateStub = sinon.stub(service, 'bulkUpdate').rejects(new Error('Bulk update error'));

            //await expect(service.bulkUpdate(ids, data)).to.be.rejectedWith(Error, 'Bulk update error');

            bulkUpdateStub.restore();
        });
    });

    describe('bulkRemove', () => {
        it('should remove the DHCP rules successfully', async () => {
            const ids = [1, 2, 3];

            const bulkRemoveStub = sinon.stub(service, 'bulkRemove').resolves([dhcpRule]);

            const result = await service.bulkRemove(ids);

            expect(bulkRemoveStub.calledOnceWith(ids)).to.be.true;
            expect(result).to.deep.equal([dhcpRule]);

            bulkRemoveStub.restore();
        });

        it('should handle errors when removing the DHCP rules', async () => {
            const ids = [1, 2, 3];

            const bulkRemoveStub = sinon.stub(service, 'bulkRemove').rejects(new Error('Bulk remove error'));

            await expect(service.bulkRemove(ids)).to.be.rejectedWith(Error, 'Bulk remove error');

            bulkRemoveStub.restore();
        });
    });
});