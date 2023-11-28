import { FindManyOptions, FindOneOptions, getCustomRepository } from "typeorm";
import { DHCPRule } from "../../../../src/models/system/dhcp/dhcp_r/dhcp_r.model";
import { DHCPRepository } from "../../../../src/models/system/dhcp/dhcp_r/dhcp.repository";
import { DHCPGroup } from "../../../../src/models/system/dhcp/dhcp_g/dhcp_g.model";
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { getRepository } from "typeorm";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { testSuite, expect } from "../../../mocha/global-setup";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import StringHelper from "../../../../src/utils/string.helper";
import sinon from "sinon";
import { Offset } from "../../../../src/offset";

describe(DHCPRepository.name, () => {
    let repository: DHCPRepository;
    let fwCloud: FwCloud;
    let firewall: Firewall;
    let gateway: IPObj;

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
    });

    describe('getFindInPathOptions', () => {
        it('should return the correct FindOneOptions object', () => {
            const path = {
                fwcloudId: 1,
                firewallId: 2,
                dhcGroupId: 3
            };

            const options: FindOneOptions<DHCPRule> = (repository as any).getFindInPathOptions(path);

            expect(options).to.deep.equal({
                join: {
                    alias: 'dhcp',
                    leftJoinAndSelect: {
                        //fwcloud: 'dhcp.fwcloud',
                        firewall: 'dhcp.firewall',
                        group: 'dhcp.group',
                    }
                },
                where: {
                    //fwcloud: path.fwcloudId,
                    firewall: path.firewallId,
                    group: path.dhcGroupId,
                }
            });
        });

        it('should return the correct FindManyOptions object', () => {
            const path = {
                fwcloudId: 1,
                firewallId: 2,
                dhcGroupId: 3
            };

            const options: FindManyOptions<DHCPRule> = (repository as any).getFindInPathOptions(path, { take: 10 });

            expect(options).to.deep.equal({
                join: {
                    alias: 'dhcp',
                    leftJoinAndSelect: {
                        //fwcloud: 'dhcp.fwcloud',
                        firewall: 'dhcp.firewall',
                        group: 'dhcp.group',
                    }
                },
                where: {
                    //fwcloud: path.fwcloudId,
                    firewall: path.firewallId,
                    group: path.dhcGroupId,
                },
                take: 10,
            });
        });
    });
    describe('remove', () => {
        let group: DHCPGroup;
        let dhcpRule: DHCPRule;
    
        beforeEach(async () => {
            
            group = await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                name: 'group',
                firewall: firewall,
            }));
    
            dhcpRule = await getRepository(DHCPRule).save(getRepository(DHCPRule).create({
                group: group,
                rule_order: 1,
                interface: null,
            }));
        });
    
        it('should remove a single DHCPRule entity', async () => {
            const result = await repository.remove(dhcpRule);
    
            expect(result).to.deep.equal(dhcpRule);
            expect(await repository.findOne(dhcpRule.id)).to.be.undefined;
        });
    
        it('should remove multiple DHCPRule entities', async () => {
            const dhcpRule2 = await getRepository(DHCPRule).save(getRepository(DHCPRule).create({
                group: group,
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
    });
    describe('move', () => {
        let group: DHCPGroup;
        let dhcpRule: DHCPRule;
    
        beforeEach(async () => {
            
            group = await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
                name: 'group',
                firewall: firewall,
            }));
    
            dhcpRule = await getRepository(DHCPRule).save(getRepository(DHCPRule).create({
                group: group,
                rule_order: 1,
                interface: null,
            }));
        });
    
        it('should move the rule to the specified position', async () => {
            await repository.move([dhcpRule.id], dhcpRule.id, 2 as unknown as Offset);

            expect(dhcpRule.rule_order).to.equal(2);
        });

        it('should refresh orders after move', async () => {
            const refreshOrdersSpy = sinon.spy(repository, 'refreshOrders' as keyof DHCPRepository);

            await repository.move([dhcpRule.id], dhcpRule.id, 2 as unknown as Offset);

            expect(refreshOrdersSpy.calledOnceWithExactly(group.id)).to.be.true;
        });
    });
});