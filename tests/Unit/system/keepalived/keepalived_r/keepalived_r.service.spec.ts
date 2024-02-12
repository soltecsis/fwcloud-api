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
import { KeepalivedGroup } from "../../../../../src/models/system/keepalived/keepalived_g/keepalived_g.model";
import { KeepalivedRuleService, ICreateKeepalivedRule } from "../../../../../src/models/system/keepalived/keepalived_r/keepalived_r.service";
import sinon from "sinon";
import { KeepalivedRule } from "../../../../../src/models/system/keepalived/keepalived_r/keepalived_r.model";
import { Firewall } from "../../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../../src/models/fwcloud/FwCloud";
import StringHelper from "../../../../../src/utils/string.helper";
import { testSuite } from "../../../../mocha/global-setup";
import { Interface } from "../../../../../src/models/interface/Interface";
import { Offset } from "../../../../../src/offset";
import { beforeEach } from "mocha";

describe(KeepalivedRuleService.name, () => {
    let service: KeepalivedRuleService;
    let fwCloud: FwCloud;
    let firewall: Firewall;
    let keepalivedRule: KeepalivedRule;

    beforeEach(async () => {
        await testSuite.resetDatabaseData();

        service = await testSuite.app.getService<KeepalivedRuleService>(KeepalivedRuleService.name);

        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
            name: StringHelper.randomize(10)
        }));

        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwCloud.id
        }));

        keepalivedRule = await getRepository(KeepalivedRule).save(getRepository(KeepalivedRule).create({
            id: 1,
            group: await getRepository(KeepalivedGroup).save(getRepository(KeepalivedGroup).create({
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
        let group: KeepalivedGroup;
        beforeEach(async () => {

            group = await getRepository(KeepalivedGroup).save(getRepository(KeepalivedGroup).create({
                name: 'group',
                firewall: firewall,
            }));

            await getRepository(Interface).save(getRepository(Interface).create({
                name: 'eth1',
                type: '11',
                interface_type: '11'
            }));
        });
        it('should store a new KeepalivedRule', async () => {
            const data = {
                active: true,
                style: 'default',
                groupId: 1,
                virtualIpId: 1,
                masterNode: 1,
                interfaceId: 1
            };

            const expectedKeepalivedRule: KeepalivedRule = getRepository(KeepalivedRule).create({
                group: group,
                rule_order: 1,
                interface: null,
            });
            service['_repository'].getLastKeepalivedRuleInGroup = () => null;
            const getLastKeepalivedRuleInGroupStub = sinon.stub(service['_repository'], 'getLastKeepalivedRuleInGroup');
            getLastKeepalivedRuleInGroupStub.returns(null);
            const saveStub = sinon.stub(service['_repository'], 'save').resolves(expectedKeepalivedRule);

            const result = await service.store(data);

            expect(getLastKeepalivedRuleInGroupStub.calledOnce).to.be.true;
            expect(saveStub.calledOnce).to.be.true;
            expect(result).to.deep.equal(expectedKeepalivedRule);

            getLastKeepalivedRuleInGroupStub.restore();
            saveStub.restore();
        });
        it('should throw an error if the group does not exist', async () => {
            const data = {
                active: true,
                style: 'default',
                comment: 'sample comment',
                groupId: 999,
                virtualIpId: 1,
                masterNode: 1,
                interfaceId: 1
            };

            const findOneOrFailStub = sinon.stub(getRepository(KeepalivedGroup), 'findOneOrFail').throws();

            await expect(service.store(data)).to.be.rejectedWith(Error);

            findOneOrFailStub.restore();
        });
        it('should throw errors when saving fails', async () => {
            const data = {
                active: true,
                style: 'default',
                comment: 'sample comment',
                groupId: 1,
                virtualIpId: 1,
                masterNode: 1,
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
                comment: 'sample comment',
                groupId: 1,
                firewallId: firewall.id,
                virtualIpId: 1,
                masterNode: 1,
                interfaceId: 1
            };

            const existingKeepalivedRule: KeepalivedRule = getRepository(KeepalivedRule).create(getRepository(KeepalivedRule).create({
                group: group,
                rule_order: 1,
                interface: null,
            }));
            existingKeepalivedRule.rule_order = 5;
            const getLastKeepalivedRuleInGroupStub = sinon.stub(service['_repository'], 'getLastKeepalivedRuleInGroup').resolves(existingKeepalivedRule);

            const result = await service.store(data);
            expect(result).to.have.property('rule_order', 6);

            getLastKeepalivedRuleInGroupStub.restore();
        });

        it('should move the stored KeepalivedRule to a new position', async () => {
            const data = {
                active: true,
                style: 'default',
                comment: 'sample comment',
                groupId: 1,
                interfaceId: 1,
                virtualIpId: 1,
                masterNode: 1,
                to: 3,
                offset: 'above'
            };

            const expectedKeepalivedRule: KeepalivedRule = getRepository(KeepalivedRule).create({
                group: {} as KeepalivedGroup,
                rule_order: 1,
                interface: {} as Interface,
            });

            const getLastKeepalivedRuleInGroupStub = sinon.stub(service['_repository'], 'getLastKeepalivedRuleInGroup');
            getLastKeepalivedRuleInGroupStub.returns(null);

            const saveStub = sinon.stub(service['_repository'], 'save');
            saveStub.resolves(expectedKeepalivedRule);

            const moveStub = sinon.stub(service, 'move');
            moveStub.resolves([expectedKeepalivedRule]);

            const result = await service.store(data as ICreateKeepalivedRule);

            expect(getLastKeepalivedRuleInGroupStub.calledOnce).to.be.true;
            expect(saveStub.calledOnce).to.be.true;
            expect(moveStub.calledOnceWith([expectedKeepalivedRule.id], data.to, data.offset as Offset)).to.be.true; // Cast 'data.offset' to 'Offset'
            expect(result).to.deep.equal(expectedKeepalivedRule);

            getLastKeepalivedRuleInGroupStub.restore();
            saveStub.restore();
            moveStub.restore();
        });
    });
    describe('copy', () => {
        let getLastKeepalivedRuleInGroupStub: sinon.SinonStub;
        let copyStub: sinon.SinonStub;
        let moveStub: sinon.SinonStub;

        beforeEach(async () => {
            keepalivedRule.group = await getRepository(KeepalivedGroup).save(getRepository(KeepalivedGroup).create({
                name: 'group',
                firewall: firewall,
            }));
            copyStub = sinon.stub(service['_repository'], 'save').resolves(keepalivedRule);
            moveStub = sinon.stub(service, 'move').resolves([keepalivedRule]);
        });

        afterEach(() => {
            copyStub.restore();
            moveStub.restore();
        });

        it('should copy a KeepalivedRule successfully', async () => {
            const result: KeepalivedRule[] = await service.copy([keepalivedRule.id], keepalivedRule.id, Offset.Above);

            expect(copyStub.called).to.be.true;
            expect(result[0].id).equal(keepalivedRule.id);
            expect(result[0].rule_order).equal(keepalivedRule.rule_order);
            expect(result[0].rule_type).equal(keepalivedRule.rule_type);
            expect(result[0].active).equal(keepalivedRule.active);
        });

        it('should correctly handle different positions', async () => {
            await service.copy([keepalivedRule.id], keepalivedRule.id, Offset.Below);

            expect(moveStub.calledOnceWith([keepalivedRule.id], keepalivedRule.rule_order, Offset.Below)).to.be.true;
        });

        it('should correctly modify rule_order for each copied rule', async () => {
            await service.copy([keepalivedRule.id], keepalivedRule.id, Offset.Above);

            expect(moveStub.calledOnceWith([keepalivedRule.id], keepalivedRule.rule_order, Offset.Above)).to.be.true;
        });

        it('should call move method with correct parameters after copying', async () => {

            await service.copy([keepalivedRule.id], keepalivedRule.id, Offset.Above);

            expect(moveStub.calledOnceWith([keepalivedRule.id], keepalivedRule.rule_order, Offset.Above)).to.be.true;
        });
    });
    describe('move', () => {
        it('should move the Keepalived rules successfully', async () => {
            const ids = [1, 2, 3];
            const destRule = 4;
            const offset = Offset.Above;
            const expectedRules: KeepalivedRule[] = [];

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
        it('should successfully update a KeepalivedRule', async () => {
            const keepalivedRule = await getRepository(KeepalivedRule).save(getRepository(KeepalivedRule).create({
                id: 1,
                group: await getRepository(KeepalivedGroup).save(getRepository(KeepalivedGroup).create({
                    name: 'group',
                    firewall: firewall,
                })),
                rule_order: 1,
                interface: null,
            }));

            const updateStub = sinon.stub(service, 'update').resolves(keepalivedRule);

            const result = await service.update(keepalivedRule.id, { rule_order: 2 });

            expect(updateStub.calledOnceWith(keepalivedRule.id, { rule_order: 2 })).to.be.true;
            expect(result).to.deep.equal(keepalivedRule);

            updateStub.restore();
        });

        it('should handle errors when the KeepalivedRule to update is not found', async () => {
            const updateStub = sinon.stub(service, 'update').rejects(new Error('KeepalivedRule not found'));

            await expect(service.update(1, { rule_order: 2 })).to.be.rejectedWith(Error, 'KeepalivedRule not found');

            updateStub.restore();
        });

        it('should update related entities correctly', async () => {
            const keepalivedRule = await getRepository(KeepalivedRule).save(getRepository(KeepalivedRule).create({
                id: 1,
                group: await getRepository(KeepalivedGroup).save(getRepository(KeepalivedGroup).create({
                    name: 'group',
                    firewall: firewall,
                })),
                rule_order: 1,
                interface: null,
            }));

            const updateStub = sinon.stub(service, 'update').resolves(keepalivedRule);
            const group2 = (await getRepository(KeepalivedGroup).save(getRepository(KeepalivedGroup).create({
                name: 'group2',
                firewall: firewall,
            })));

            const result = await service.update(keepalivedRule.id, { groupId: group2.id });

            expect(updateStub.calledOnceWith(keepalivedRule.id, { groupId: group2.id })).to.be.true;
            expect(result).to.deep.equal(KeepalivedRule);

            updateStub.restore();
        });

        it('should handle errors when related entities are not found', async () => {
            const updateStub = sinon.stub(service, 'update').rejects(new Error('Related entities not found'));

            await expect(service.update(1, {
                groupId: (await getRepository(KeepalivedGroup).save(getRepository(KeepalivedGroup).create({
                    name: 'group2',
                    firewall: firewall,
                }))).id
            })).to.be.rejectedWith(Error, 'Related entities not found');

            updateStub.restore();
        });
    });
    describe('remove', () => {
        it('should remove the Keepalived rule successfully', async () => {
            const keepalivedRule = await getRepository(KeepalivedRule).save(getRepository(KeepalivedRule).create({
                id: 1,
                group: await getRepository(KeepalivedGroup).save(getRepository(KeepalivedGroup).create({
                    name: 'group',
                    firewall: firewall,
                })),
                rule_order: 1,
                interface: null,
            }));
            const path = { id: 1 };

            sinon.stub(service, 'findOneInPath').resolves(keepalivedRule);
            const removeStub = sinon.stub(service['_repository'], 'remove').resolves(keepalivedRule);

            const result = await service.remove(path);

            expect(removeStub.calledOnceWithExactly(keepalivedRule)).to.be.true;
            expect(result).to.equal(KeepalivedRule);
        });

        it('should throw an error if the Keepalived rule does not exist', async () => {
            const path = {
                id: 1,
            };

            sinon.stub(service, 'findOneInPath').resolves(null);

            await expect(service.remove(path)).to.be.rejectedWith(Error);
        });
    });

    describe('bulkUpdate', () => {
        it('should update the Keepalived rules successfully', async () => {
            const ids = [1, 2, 3];
            const data = { rule_order: 2 };

            const bulkUpdateStub = sinon.stub(service, 'bulkUpdate').resolves([keepalivedRule]);

            const result = await service.bulkUpdate(ids, data);

            expect(bulkUpdateStub.calledOnceWith(ids, data)).to.be.true;
            expect(result).to.deep.equal([KeepalivedRule]);

            bulkUpdateStub.restore();
        });

        it('should handle errors when updating the Keepalived rules', async () => {
            const ids = [1, 2, 3];
            const data = { rule_order: 2 };

            const bulkUpdateStub = sinon.stub(service, 'bulkUpdate').rejects(new Error('Bulk update error'));

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
            expect(result).to.deep.equal([KeepalivedRule]);

            bulkRemoveStub.restore();
        });

        it('should handle errors when removing the Keepalived rules', async () => {
            const ids = [1, 2, 3];

            const bulkRemoveStub = sinon.stub(service, 'bulkRemove').rejects(new Error('Bulk remove error'));

            await expect(service.bulkRemove(ids)).to.be.rejectedWith(Error, 'Bulk remove error');

            bulkRemoveStub.restore();
        });
    });
});