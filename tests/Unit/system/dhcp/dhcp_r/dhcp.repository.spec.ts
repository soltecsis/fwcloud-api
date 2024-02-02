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
import { getCustomRepository } from "typeorm";
import { DHCPRule } from "../../../../../src/models/system/dhcp/dhcp_r/dhcp_r.model";
import { DHCPRepository } from "../../../../../src/models/system/dhcp/dhcp_r/dhcp.repository";
import { DHCPGroup } from "../../../../../src/models/system/dhcp/dhcp_g/dhcp_g.model";
import { IPObj } from "../../../../../src/models/ipobj/IPObj";
import { getRepository } from "typeorm";
import { Firewall } from "../../../../../src/models/firewall/Firewall";
import { testSuite, expect } from "../../../../mocha/global-setup";
import { FwCloud } from "../../../../../src/models/fwcloud/FwCloud";
import StringHelper from "../../../../../src/utils/string.helper";
import sinon from "sinon";
import { Offset } from "../../../../../src/offset";

describe(DHCPRepository.name, () => {
    let repository: DHCPRepository;
    let fwCloud: FwCloud;
    let firewall: Firewall;
    let gateway: IPObj;
    let group: DHCPGroup;
    let dhcpRule: DHCPRule;

    beforeEach(async () => {
        await testSuite.resetDatabaseData();
        repository = getCustomRepository(DHCPRepository);
        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
            name: StringHelper.randomize(10)
        }));
        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwCloud.id
        }));
        gateway = await getRepository(IPObj).save(getRepository(IPObj).create({
            name: 'test',
            address: '0.0.0.0',
            ipObjTypeId: 0,
            interfaceId: null
        }));

        group = await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
            name: 'group',
            firewall: firewall,
        }));

        dhcpRule = await getRepository(DHCPRule).save(getRepository(DHCPRule).create({
            group: group,
            firewall: firewall,
            rule_order: 1,
            interface: null,
        }));
    });

    describe('remove', () => {
        it('should remove a single DHCPRule entity', async () => {
            const result = await repository.remove(dhcpRule);

            expect(result).to.deep.equal(dhcpRule);
            expect(await repository.findOne(dhcpRule.id)).to.be.undefined;
        });

        it('should remove multiple DHCPRule entities', async () => {
            const dhcpRule2 = await getRepository(DHCPRule).save(getRepository(DHCPRule).create({
                group: group,
                firewall: firewall,
                rule_order: 2,
                interface: null,
            }));

            const result = await repository.remove([dhcpRule, dhcpRule2]);

            expect(result).to.deep.equal([dhcpRule, dhcpRule2]);
            expect(await repository.findOne(dhcpRule.id)).to.be.undefined;
            expect(await repository.findOne(dhcpRule2.id)).to.be.undefined;
        });

        it('should refresh orders after remove', async () => {
            const refreshOrdersSpy = sinon.spy(repository, 'refreshOrders' as keyof DHCPRepository);

            await repository.remove(dhcpRule);

            expect(refreshOrdersSpy.calledOnceWithExactly(group.id)).to.be.true;
        });

        it('should refresh orders for each group after removing multiple DHCPRules', async () => {
            const group2 = await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                name: 'group2',
                firewall: firewall,
            }));

            const dhcpRule2 = getRepository(DHCPRule).create({
                group: group2,
                rule_order: 1,
                firewall: firewall,
            });

            await repository.save([dhcpRule, dhcpRule2]);

            const refreshOrdersSpy = sinon.spy(repository, 'refreshOrders' as keyof DHCPRepository);

            await repository.remove([dhcpRule, dhcpRule2]);

            expect(refreshOrdersSpy.called).to.be.true;
        });

        it('should not refresh orders after removing DHCPRule without group', async () => {
            dhcpRule.group = null;
            dhcpRule.save();

            const refreshOrdersSpy = sinon.spy(repository, 'refreshOrders' as keyof DHCPRepository);

            await repository.remove(dhcpRule);

            expect(refreshOrdersSpy.called).to.be.false;
        });
    });

    describe('move', () => {
        it('should move the rule to the specified position', async () => {
            dhcpRule.group = null;
            dhcpRule.save();

            const moveAboveSpy = sinon.spy(repository, 'moveAbove' as keyof DHCPRepository);

            await repository.move([dhcpRule.id], dhcpRule.id, Offset.Above);

            expect(moveAboveSpy.calledOnce).to.be.true;
        });

        it('should move the rule below the specified position', async () => {
            dhcpRule.group = null;
            dhcpRule.save();

            const moveBelowSpy = sinon.spy(repository, 'moveBelow' as keyof DHCPRepository);

            await repository.move([dhcpRule.id], dhcpRule.id, Offset.Below);

            expect(moveBelowSpy.calledOnce).to.be.true;
        });

        it('should update affected rules after move', async () => {
            const updateAffectedRulesSpy = sinon.spy(repository, 'save' as keyof DHCPRepository);

            await repository.move([dhcpRule.id], dhcpRule.id, Offset.Above);

            expect(updateAffectedRulesSpy.called).to.be.true;
        });

        it('should refresh orders after move', async () => {
            const refreshOrdersSpy = sinon.spy(repository, 'refreshOrders' as keyof DHCPRepository);

            await repository.move([dhcpRule.id], dhcpRule.id, Offset.Above);

            expect(refreshOrdersSpy.calledOnce).to.be.true;
        });

        it('should return the updated rules after move', async () => {
            const updatedRules = await repository.move([dhcpRule.id], dhcpRule.id, Offset.Above);

            expect(updatedRules).to.be.an('array');
            expect(updatedRules).to.have.lengthOf(1);
            expect(updatedRules[0]).to.have.property('id', dhcpRule.id);
        });
    });

    describe('getLastDHCPRuleInGroup', () => {
        it('should return the last DHCP rule in the group', async () => {
            const dhcpgid = group.id;
            const expectedRule: DHCPRule = await getRepository(DHCPRule).save(getRepository(DHCPRule).create({
                group: group,
                firewall: firewall,
                rule_order: 2,
                interface: null,
            }));

            const result = await repository.getLastDHCPRuleInGroup(dhcpgid);

            expect(result.id).to.equal(expectedRule.id);
            expect(result.rule_order).to.equal(expectedRule.rule_order);
            expect(result.rule_type).to.equal(expectedRule.rule_type);
        });
    });

    describe('getDHCPRules', () => {
        it('should retrieve DHCPRules based on fwcloud and firewall IDs', async () => {
            const fwcloudId = 1;
            const firewallId = 1;

            const result = await repository.getDHCPRules(fwcloudId, firewallId);

            expect(result).to.be.an('array');

            for (const rule of result) {
                expect(rule).to.be.instanceOf(DHCPRule);
            }
        });

        it('should filter DHCPRules based on provided rule types', async () => {
            const fwcloudId = 1;
            const firewallId = 1;
            const ruleTypes = [1, 2, 3];

            const result = await repository.getDHCPRules(fwcloudId, firewallId, undefined, ruleTypes);

            expect(result).to.be.an('array');

            for (const rule of result) {
                expect(rule).to.be.instanceOf(DHCPRule);
                expect(rule.rule_type).to.be.oneOf(ruleTypes);
            }
        });

        it('should filter DHCPRules based on provided rule IDs', async () => {
            const fwcloudId = 1;
            const firewallId = 1;
            const ruleIds = [1, 2, 3];

            const result = await repository.getDHCPRules(fwcloudId, firewallId, ruleIds);

            expect(result).to.be.an('array');

            for (const rule of result) {
                expect(rule).to.be.instanceOf(DHCPRule);
                expect(rule.id).to.be.oneOf(ruleIds);
            }
        });
    });
});
