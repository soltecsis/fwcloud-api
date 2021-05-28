import { getRepository } from "typeorm";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { IPObjGroup } from "../../../../src/models/ipobj/IPObjGroup";
import { RoutingRule } from "../../../../src/models/routing/routing-rule/routing-rule.model";
import { RoutingRuleService } from "../../../../src/models/routing/routing-rule/routing-rule.service";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import { OpenVPN } from "../../../../src/models/vpn/openvpn/OpenVPN";
import { OpenVPNPrefix } from "../../../../src/models/vpn/openvpn/OpenVPNPrefix";
import { Ca } from "../../../../src/models/vpn/pki/Ca";
import { Crt } from "../../../../src/models/vpn/pki/Crt";
import StringHelper from "../../../../src/utils/string.helper";
import { expect, testSuite } from "../../../mocha/global-setup";

describe(RoutingRuleService.name, () => {
    let service: RoutingRuleService;

    let fwCloud: FwCloud;
    let firewall: Firewall;
    let table: RoutingTable;
    let rule: RoutingRule;

    beforeEach(async () => {
        await testSuite.resetDatabaseData();

        service = await testSuite.app.getService<RoutingRuleService>(RoutingRuleService.name);

        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
            name: StringHelper.randomize(10)
        }));

        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwCloud.id
        }));

        table = await getRepository(RoutingTable).save({
            firewallId: firewall.id,
            number: 1,
            name: 'name',
        });

        rule = await service.create({
            routingTableId: table.id,
        });
    });

    describe('update', () => {
        describe('IpObjs', () => {
            let ipobj1: IPObj;
            let ipobj2: IPObj;
            
            beforeEach(async () => {
                ipobj1 = await getRepository(IPObj).save(getRepository(IPObj).create({
                    name: 'test',
                    address: '0.0.0.0',
                    ipObjTypeId: 0,
                    interfaceId: null
                }));

                ipobj2 = await getRepository(IPObj).save(getRepository(IPObj).create({
                    name: 'test',
                    address: '0.0.0.0',
                    ipObjTypeId: 0,
                    interfaceId: null
                }));
            })
            it('should attach ipbojs', async () => {
                await service.update(rule.id, {
                    ipObjIds: [ipobj1.id, ipobj2.id]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['ipObjs']})).ipObjs.map(item => item.id)
                ).to.deep.eq([ipobj1.id, ipobj2.id])
            });

            it('should remove ipobjs attachment', async () => {
                await service.update(rule.id, {
                    ipObjIds: [ipobj1.id, ipobj2.id]
                });

                await service.update(rule.id, {
                    ipObjIds: [ipobj2.id]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['ipObjs']})).ipObjs.map(item => item.id)
                ).to.deep.eq([ipobj2.id])
            });

            it('should remove all ipobjs attachment', async () => {
                await service.update(rule.id, {
                    ipObjIds: [ipobj1.id, ipobj2.id]
                });

                await service.update(rule.id, {
                    ipObjIds: []
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['ipObjs']})).ipObjs.map(item => item.id)
                ).to.deep.eq([])
            })
        });

        describe('IpObjGroups', () => {
            let group1: IPObjGroup;
            let group2: IPObjGroup;
            
            beforeEach(async () => {
                group1 = await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({
                    name: StringHelper.randomize(10),
                    type: 1,
                }));

                group2 = await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({
                    name: StringHelper.randomize(10),
                    type: 1,
                }));
            })
            it('should attach ipObjGroups', async () => {
                await service.update(rule.id, {
                    ipObjGroupIds: [group1.id, group2.id]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['ipObjGroups']})).ipObjGroups.map(item => item.id)
                ).to.deep.eq([group1.id, group2.id])
            });

            it('should remove ipObjGroups attachment', async () => {
                await service.update(rule.id, {
                    ipObjGroupIds: [group1.id, group2.id]
                });

                await service.update(rule.id, {
                    ipObjGroupIds: [group2.id]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['ipObjGroups']})).ipObjGroups.map(item => item.id)
                ).to.deep.eq([group2.id])
            });

            it('should remove all ipObjGroups attachment', async () => {
                await service.update(rule.id, {
                    ipObjGroupIds: [group1.id, group2.id]
                });

                await service.update(rule.id, {
                    ipObjGroupIds: []
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['ipObjGroups']})).ipObjGroups.map(item => item.id)
                ).to.deep.eq([])
            })
        });

        describe('OpenVPNs', () => {
            let openVPN1: OpenVPN;
            let openVPN2: OpenVPN;
            
            beforeEach(async () => {
                openVPN1 = await getRepository(OpenVPN).save(getRepository(OpenVPN).create({
                    firewallId: firewall.id,
                    crt: await getRepository(Crt).save(getRepository(Crt).create({
                        cn: StringHelper.randomize(10),
                        days: 100,
                        type: 0,
                        ca: await getRepository(Ca).save(getRepository(Ca).create({
                            fwCloud: fwCloud,
                            cn: StringHelper.randomize(10),
                            days: 100,
                        }))
                    }))
                }));

                openVPN2 = await getRepository(OpenVPN).save(getRepository(OpenVPN).create({
                    firewallId: firewall.id,
                    crt: await getRepository(Crt).save(getRepository(Crt).create({
                        cn: StringHelper.randomize(10),
                        days: 100,
                        type: 0,
                        ca: await getRepository(Ca).save(getRepository(Ca).create({
                            fwCloud: fwCloud,
                            cn: StringHelper.randomize(10),
                            days: 100,
                        }))
                    }))
                }));
            })
            it('should attach openVPNs', async () => {
                await service.update(rule.id, {
                    openVPNIds: [openVPN1.id, openVPN2.id]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['openVPNs']})).openVPNs.map(item => item.id)
                ).to.deep.eq([openVPN1.id, openVPN2.id])
            });

            it('should remove openVPNs attachment', async () => {
                await service.update(rule.id, {
                    openVPNIds: [openVPN1.id, openVPN2.id]
                });

                await service.update(rule.id, {
                    openVPNIds: [openVPN2.id]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['openVPNs']})).openVPNs.map(item => item.id)
                ).to.deep.eq([openVPN2.id])
            });

            it('should remove all openVPNs attachment', async () => {
                await service.update(rule.id, {
                    openVPNIds: [openVPN1.id, openVPN2.id]
                });

                await service.update(rule.id, {
                    openVPNIds: []
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['openVPNs']})).openVPNs.map(item => item.id)
                ).to.deep.eq([])
            })
        });

        describe('OpenVPNPrefixes', () => {
            let openVPNPrefix: OpenVPNPrefix;
            let openVPNPrefix2: OpenVPNPrefix;
            
            beforeEach(async () => {
                openVPNPrefix = await getRepository(OpenVPNPrefix).save(getRepository(OpenVPNPrefix).create({
                    name: StringHelper.randomize(10),
                    openVPN: await getRepository(OpenVPN).save(getRepository(OpenVPN).create({
                        firewallId: firewall.id,
                        crt: await getRepository(Crt).save(getRepository(Crt).create({
                            cn: StringHelper.randomize(10),
                            days: 100,
                            type: 0,
                            ca: await getRepository(Ca).save(getRepository(Ca).create({
                                fwCloud: fwCloud,
                                cn: StringHelper.randomize(10),
                                days: 100,
                            }))
                        }))
                    }))
                }));

                openVPNPrefix2 = await getRepository(OpenVPNPrefix).save(getRepository(OpenVPNPrefix).create({
                    name: StringHelper.randomize(10),
                    openVPN: await getRepository(OpenVPN).save(getRepository(OpenVPN).create({
                        firewallId: firewall.id,
                        crt: await getRepository(Crt).save(getRepository(Crt).create({
                            cn: StringHelper.randomize(10),
                            days: 100,
                            type: 0,
                            ca: await getRepository(Ca).save(getRepository(Ca).create({
                                fwCloud: fwCloud,
                                cn: StringHelper.randomize(10),
                                days: 100,
                            }))
                        }))
                    }))
                }));
            })
            it('should attach openVPNPrefixes', async () => {
                await service.update(rule.id, {
                    openVPNPrefixIds: [openVPNPrefix.id, openVPNPrefix2.id]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['openVPNPrefixes']})).openVPNPrefixes.map(item => item.id)
                ).to.deep.eq([openVPNPrefix.id, openVPNPrefix2.id])
            });

            it('should remove openVPNPrefixes attachment', async () => {
                await service.update(rule.id, {
                    openVPNPrefixIds: [openVPNPrefix.id, openVPNPrefix2.id]
                });

                await service.update(rule.id, {
                    openVPNPrefixIds: [openVPNPrefix2.id]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['openVPNPrefixes']})).openVPNPrefixes.map(item => item.id)
                ).to.deep.eq([openVPNPrefix2.id])
            });

            it('should remove all openVPNPrefixes attachment', async () => {
                await service.update(rule.id, {
                    openVPNPrefixIds: [openVPNPrefix.id, openVPNPrefix2.id]
                });

                await service.update(rule.id, {
                    openVPNPrefixIds: []
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['openVPNPrefixes']})).openVPNPrefixes.map(item => item.id)
                ).to.deep.eq([])
            })
        });
    });

    describe('remove', () => {
        let ipobj1: IPObj;
        let group1: IPObjGroup;
        let openVPN1: OpenVPN;
        let openVPNPrefix2: OpenVPNPrefix;

        beforeEach(async () => {
            ipobj1 = await getRepository(IPObj).save(getRepository(IPObj).create({
                name: 'test',
                address: '0.0.0.0',
                ipObjTypeId: 0,
                interfaceId: null
            }));

            group1 = await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({
                name: StringHelper.randomize(10),
                type: 1,
            }));

            openVPN1 = await getRepository(OpenVPN).save(getRepository(OpenVPN).create({
                firewallId: firewall.id,
                crt: await getRepository(Crt).save(getRepository(Crt).create({
                    cn: StringHelper.randomize(10),
                    days: 100,
                    type: 0,
                    ca: await getRepository(Ca).save(getRepository(Ca).create({
                        fwCloud: fwCloud,
                        cn: StringHelper.randomize(10),
                        days: 100,
                    }))
                }))
            }));

            openVPNPrefix2 = await getRepository(OpenVPNPrefix).save(getRepository(OpenVPNPrefix).create({
                name: StringHelper.randomize(10),
                openVPN: await getRepository(OpenVPN).save(getRepository(OpenVPN).create({
                    firewallId: firewall.id,
                    crt: await getRepository(Crt).save(getRepository(Crt).create({
                        cn: StringHelper.randomize(10),
                        days: 100,
                        type: 0,
                        ca: await getRepository(Ca).save(getRepository(Ca).create({
                            fwCloud: fwCloud,
                            cn: StringHelper.randomize(10),
                            days: 100,
                        }))
                    }))
                }))
            }));

            rule = await getRepository(RoutingRule).save({
                routingTableId: table.id,
                openVPNPrefixes: [{id: openVPNPrefix2.id}],
                openVPNs: [{id: openVPN1.id}],
                ipObjs: [{id: ipobj1.id}],
                ipObjGroups: [{id: group1.id}],
                position: 1
            });
        });

        it('should remove rule', async () => {
            const removedRule: RoutingRule = await service.remove({
                fwCloudId: fwCloud.id,
                firewallId: firewall.id,
                id: rule.id
            });

            expect(await getRepository(RoutingRule).findOne(rule.id)).to.be.undefined;
        })
    })
})