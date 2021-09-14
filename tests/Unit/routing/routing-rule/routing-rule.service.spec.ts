import { getRepository } from "typeorm";
import db from "../../../../src/database/database-manager";
import { ValidationException } from "../../../../src/fonaments/exceptions/validation-exception";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { Interface } from "../../../../src/models/interface/Interface";
import { InterfaceIPObj } from "../../../../src/models/interface/InterfaceIPObj";
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { IPObjGroup } from "../../../../src/models/ipobj/IPObjGroup";
import { IPObjToIPObjGroup } from "../../../../src/models/ipobj/IPObjToIPObjGroup";
import { Mark } from "../../../../src/models/ipobj/Mark";
import { RoutingRule } from "../../../../src/models/routing/routing-rule/routing-rule.model";
import { RoutingRuleService } from "../../../../src/models/routing/routing-rule/routing-rule.service";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import { OpenVPN } from "../../../../src/models/vpn/openvpn/OpenVPN";
import { OpenVPNPrefix } from "../../../../src/models/vpn/openvpn/OpenVPNPrefix";
import { Ca } from "../../../../src/models/vpn/pki/Ca";
import { Crt } from "../../../../src/models/vpn/pki/Crt";
import { Offset } from "../../../../src/offset";
import StringHelper from "../../../../src/utils/string.helper";
import { expect, testSuite } from "../../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../../utils/fwcloud-factory";

describe(RoutingRuleService.name, () => {
    let service: RoutingRuleService;
    let fwcProduct: FwCloudProduct;
    let fwCloud: FwCloud;
    let firewall: Firewall;
    let table: RoutingTable;
    let rule: RoutingRule;
    let mark: Mark;

    beforeEach(async () => {
        await testSuite.resetDatabaseData();
        fwcProduct = await new FwCloudFactory().make();

        service = await testSuite.app.getService<RoutingRuleService>(RoutingRuleService.name);

        fwCloud = fwcProduct.fwcloud;
        firewall = fwcProduct.firewall;
        table = fwcProduct.routingTable;
        
        mark = fwcProduct.mark;

        rule = await service.create({
            routingTableId: table.id,
            ipObjIds: [{
                id: fwcProduct.ipobjs.get('address').id,
                order: 1
            }],
            markIds: [{
                id: mark.id,
                order: 2
            }]
        });
    });

    describe('create', () => {

        it('should reset firewall compiled flag', async () => {
            await getRepository(Firewall).update(firewall.id, {
                status: 1
            });
            await firewall.reload();

            await service.create({
                routingTableId: table.id,
                markIds: [{
                    id: mark.id,
                    order: 0
                }]
            });

            await firewall.reload();

            expect(firewall.status).to.eq(3);
        });

        describe('rule_order', () => {
            let ruleOrder1: RoutingRule;
            let ruleOrder2: RoutingRule;
            let ruleOrder3: RoutingRule;
            let ruleOrder4: RoutingRule;
            let table2: RoutingTable;

            beforeEach(async () => {
                ruleOrder1 = await service.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: mark.id,
                        order:1
                    }]
                });
                ruleOrder2 = await service.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: mark.id,
                        order:1
                    }]
                });
                ruleOrder3 = await service.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: mark.id,
                        order:1
                    }]
                });
                ruleOrder4 = await service.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: mark.id,
                        order:1
                    }]
                });

                table2 = await getRepository(RoutingTable).save({
                    firewallId: firewall.id,
                    number: 2,
                    name: '2',
                });
            });

            it('should set last position if rule_order is not defined', async () => {
                rule = await service.create({
                    routingTableId: table2.id,
                    markIds: [{
                        id: mark.id,
                        order: 1
                    }]
                });

                // Notice rules have been created in the factory
                expect(rule.rule_order).to.eq(9);
            });
        });

        describe('IpObjs', () => {
            let ipobj1: IPObj;
            let ipobj2: IPObj;
            
            beforeEach(async () => {
                ipobj1 = await getRepository(IPObj).save(getRepository(IPObj).create({
                    name: 'test',
                    address: '0.0.0.0',
                    ipObjTypeId: 0,
                    interfaceId: null,
                    fwCloudId: fwCloud.id
                }));

                ipobj2 = await getRepository(IPObj).save(getRepository(IPObj).create({
                    name: 'test',
                    address: '0.0.0.0',
                    ipObjTypeId: 0,
                    interfaceId: null,
                    fwCloudId: fwCloud.id
                }));
            });


            it('should attach ipbojs', async () => {
                rule = await service.create({
                    routingTableId: table.id,
                    ipObjIds: [
                        {id: ipobj1.id, order: 1 },
                        {id: ipobj2.id, order: 2 }
                    ]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToIPObjs']})).routingRuleToIPObjs.map(item => item.ipObjId)
                ).to.deep.eq([ipobj1.id, ipobj2.id])
            });

            it('should attach standard ipobj', async () => {
                let standards: IPObj[] = await getRepository(IPObj).find({
                    where: {
                        fwCloudId: null
                    }
                });

                rule = await service.create({
                    routingTableId: table.id,
                    ipObjIds: standards.map((item, index) => ({
                        id: item.id,
                        order: index + 1
                    }))
                });

                rule = await getRepository(RoutingRule).findOne(rule.id, { relations: ['routingRuleToIPObjs']});

                expect(rule.routingRuleToIPObjs).to.have.length(standards.length);
            })
        });

        describe('IpObjGroups', () => {
            let group1: IPObjGroup;
            let group2: IPObjGroup;
            
            beforeEach(async () => {
                group1 = await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({
                    name: StringHelper.randomize(10),
                    type: 1,
                    fwCloudId: fwCloud.id
                }));

                const _interface: Interface = await getRepository(Interface).save(getRepository(Interface).create({
                    name: 'eth1',
                    type: '11',
                    interface_type: '11'
                }));

                const host = await getRepository(IPObj).save(getRepository(IPObj).create({
                    name: 'test',
                    address: '0.0.0.0',
                    ipObjTypeId: 8,
                    interfaceId: _interface.id
                }));

                await getRepository(InterfaceIPObj).save(getRepository(InterfaceIPObj).create({
                    interfaceId: _interface.id,
                    ipObjId: host.id,
                    interface_order: '1'
                }));

                await IPObjToIPObjGroup.insertIpobj__ipobjg({
                    dbCon: db.getQuery(),
                    body: {
                        ipobj: host.id,
                        ipobj_g: group1.id
                    }
                });

                group2 = await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({
                    name: StringHelper.randomize(10),
                    type: 1,
                    fwCloudId: fwCloud.id
                }));

                await IPObjToIPObjGroup.insertIpobj__ipobjg({
                    dbCon: db.getQuery(),
                    body: {
                        ipobj: host.id,
                        ipobj_g: group2.id
                    }
                });
            })
            it('should attach ipObjGroups', async () => {
                const rule: RoutingRule = await service.create({
                    routingTableId: table.id,
                    ipObjGroupIds: [
                        { id: group1.id, order: 1 },
                        { id: group2.id, order : 2}
                    ]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToIPObjGroups']})).routingRuleToIPObjGroups.map(item => item.ipObjGroupId)
                ).to.deep.eq([group1.id, group2.id])
            });
        });

        describe('OpenVPNs', () => {
            let openVPN1: OpenVPN;
            let openVPN2: OpenVPN;
            
            beforeEach(async () => {
                openVPN1 = await getRepository(OpenVPN).save(getRepository(OpenVPN).create({
                    firewallId: firewall.id,
                    parentId: fwcProduct.openvpnServer.id,
                    crt: await getRepository(Crt).save(getRepository(Crt).create({
                        cn: StringHelper.randomize(10),
                        days: 100,
                        type: 1,
                        ca: await getRepository(Ca).save(getRepository(Ca).create({
                            fwCloud: fwCloud,
                            cn: StringHelper.randomize(10),
                            days: 100,
                        }))
                    }))
                }));

                openVPN2 = await getRepository(OpenVPN).save(getRepository(OpenVPN).create({
                    firewallId: firewall.id,
                    parentId: fwcProduct.openvpnServer.id,
                    crt: await getRepository(Crt).save(getRepository(Crt).create({
                        cn: StringHelper.randomize(10),
                        days: 100,
                        type: 1,
                        ca: await getRepository(Ca).save(getRepository(Ca).create({
                            fwCloud: fwCloud,
                            cn: StringHelper.randomize(10),
                            days: 100,
                        }))
                    }))
                }));
            })
            it('should attach openVPNs', async () => {
                const rule: RoutingRule = await service.create({
                    routingTableId: table.id,
                    openVPNIds: [
                        {id: openVPN1.id, order: 1},
                        {id: openVPN2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToOpenVPNs']})).routingRuleToOpenVPNs.map(item => item.openVPNId)
                ).to.deep.eq([openVPN1.id, openVPN2.id])
            });
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
                const rule: RoutingRule = await service.create({
                    routingTableId: table.id,
                    openVPNPrefixIds: [
                        {id: openVPNPrefix.id, order: 1},
                        {id: openVPNPrefix2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToOpenVPNPrefixes']})).routingRuleToOpenVPNPrefixes.map(item => item.openVPNPrefixId)
                ).to.deep.eq([openVPNPrefix.id, openVPNPrefix2.id])
            });
        });

        describe('marks', () => {
            let mark1: Mark;
            let mark2: Mark;
            
            beforeEach(async () => {
                mark1 = await getRepository(Mark).save(getRepository(Mark).create({
                    fwCloudId: fwCloud.id,
                    code: 1,
                    name: '1',
                }));

                mark2 = await getRepository(Mark).save(getRepository(Mark).create({
                    fwCloudId: fwCloud.id,
                    code: 2,
                    name: '2',
                }));
            });

            it('should attach marks', async () => {
                const rule: RoutingRule = await service.create({
                    routingTableId: table.id,
                    markIds: [
                        {id: mark1.id, order: 1},
                        {id: mark2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToMarks']})).routingRuleToMarks.map(item => item.markId)
                ).to.deep.eq([mark1.id, mark2.id])
            });
        });
    });

    describe('copy', () => {
        let ruleOrder1: RoutingRule;
        let ruleOrder2: RoutingRule;
            
        beforeEach(async () => {
            ruleOrder1 = await service.create({
                comment: 'rule1',
                routingTableId: table.id,
                markIds: [{
                    id: mark.id,
                    order: 1
                }]
            });
            ruleOrder2 = await service.create({
                comment: 'rule2',
                routingTableId: table.id,
                markIds: [{
                    id: mark.id,
                    order: 2
                }]
            });
        });

        it('should copy routes', async () => {
            const copied: RoutingRule[] = await service.copy([ruleOrder1.id, ruleOrder2.id], ruleOrder1.id, Offset.Above);
            ruleOrder1 = await service.findOneInPath({
                id: ruleOrder1.id
            });

            expect(copied[0].comment).to.eq(ruleOrder1.comment);
            expect(copied[0].rule_order).to.eq(ruleOrder1.rule_order - 2);
            expect(copied[1].comment).to.eq(ruleOrder2.comment);
            expect(copied[1].rule_order).to.eq(ruleOrder1.rule_order - 1);
        });

        it('should reset firewall compiled flag', async () => {
            await getRepository(Firewall).update(firewall.id, {
                status: 1
            });
            await firewall.reload();

            await service.copy([ruleOrder1.id, ruleOrder2.id], ruleOrder1.id, Offset.Above);

            await firewall.reload();

            expect(firewall.status).to.eq(3);
        });
    })

    describe('update', () => {

        it('should reset firewall compiled flag', async () => {
            await getRepository(Firewall).update(firewall.id, {
                status: 1
            });
            await firewall.reload();

            await service.update(rule.id, {
                active: false
            });

            await firewall.reload();

            expect(firewall.status).to.eq(3);
        });

        it('should fail if from is empty', async () => {
            expect(service.update(rule.id, {
                ipObjIds: [],
                ipObjGroupIds: [],
                openVPNIds: [],
                openVPNPrefixIds: [],
                markIds: []
            })).rejectedWith(ValidationException);
        });


        describe('IpObjs', () => {
            let ipobj1: IPObj;
            let ipobj2: IPObj;
            
            beforeEach(async () => {
                ipobj1 = await getRepository(IPObj).save(getRepository(IPObj).create({
                    name: 'test',
                    address: '0.0.0.0',
                    ipObjTypeId: 0,
                    interfaceId: null,
                    fwCloudId: fwCloud.id
                }));

                ipobj2 = await getRepository(IPObj).save(getRepository(IPObj).create({
                    name: 'test',
                    address: '0.0.0.0',
                    ipObjTypeId: 0,
                    interfaceId: null,
                    fwCloudId: fwCloud.id
                }));
            });


            it('should attach ipbojs', async () => {
                await service.update(rule.id, {
                    ipObjIds: [
                        {id: ipobj1.id, order: 1},
                        {id: ipobj2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToIPObjs']})).routingRuleToIPObjs.map(item => item.ipObjId)
                ).to.deep.eq([ipobj1.id, ipobj2.id])
            });

            it('should remove ipobjs attachment', async () => {
                await service.update(rule.id, {
                    ipObjIds: [
                        {id: ipobj1.id, order: 1},
                        {id: ipobj2.id, order: 2}
                    ]
                });

                await service.update(rule.id, {
                    ipObjIds: [
                        {id: ipobj2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToIPObjs']})).routingRuleToIPObjs.map(item => item.ipObjId)
                ).to.deep.eq([ipobj2.id])
            });

            it('should remove all ipobjs attachment', async () => {
                await service.update(rule.id, {
                    ipObjIds: [
                        {id: ipobj1.id, order: 1},
                        {id: ipobj2.id, order: 2}
                    ]
                });

                await service.update(rule.id, {
                    ipObjIds: []
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToIPObjs']})).routingRuleToIPObjs.map(item => item.ipObjId)
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
                    fwCloudId: fwCloud.id
                }));

                const _interface: Interface = await getRepository(Interface).save(getRepository(Interface).create({
                    name: 'eth1',
                    type: '11',
                    interface_type: '11'
                }));

                const host = await getRepository(IPObj).save(getRepository(IPObj).create({
                    name: 'test',
                    address: '0.0.0.0',
                    ipObjTypeId: 8,
                    interfaceId: _interface.id
                }));

                await getRepository(InterfaceIPObj).save(getRepository(InterfaceIPObj).create({
                    interfaceId: _interface.id,
                    ipObjId: host.id,
                    interface_order: '1'
                }));

                await IPObjToIPObjGroup.insertIpobj__ipobjg({
                    dbCon: db.getQuery(),
                    body: {
                        ipobj: host.id,
                        ipobj_g: group1.id
                    }
                });

                group2 = await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({
                    name: StringHelper.randomize(10),
                    type: 1,
                    fwCloudId: fwCloud.id
                }));

                await IPObjToIPObjGroup.insertIpobj__ipobjg({
                    dbCon: db.getQuery(),
                    body: {
                        ipobj: host.id,
                        ipobj_g: group2.id
                    }
                });
            })
            it('should attach ipObjGroups', async () => {
                await service.update(rule.id, {
                    ipObjGroupIds: [
                        {id: group1.id, order: 1},
                        {id: group2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToIPObjGroups']})).routingRuleToIPObjGroups.map(item => item.ipObjGroupId)
                ).to.deep.eq([group1.id, group2.id])
            });

            it('should remove ipObjGroups attachment', async () => {
                await service.update(rule.id, {
                    ipObjGroupIds: [
                        {id: group1.id, order: 1},
                        {id: group2.id, order: 2}
                    ]
                });

                await service.update(rule.id, {
                    ipObjGroupIds: [
                        {id: group2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToIPObjGroups']})).routingRuleToIPObjGroups.map(item => item.ipObjGroupId)
                ).to.deep.eq([group2.id])
            });

            it('should remove all ipObjGroups attachment', async () => {
                await service.update(rule.id, {
                    ipObjGroupIds: [
                        {id: group1.id, order: 1},
                        {id: group2.id, order: 2}
                    ]
                });

                await service.update(rule.id, {
                    ipObjGroupIds: []
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToIPObjGroups']})).routingRuleToIPObjGroups.map(item => item.ipObjGroupId)
                ).to.deep.eq([])
            });

            it('should throw an exception if the group is empty', async () => {
                group1 = await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({
                    name: StringHelper.randomize(10),
                    type: 20,
                    fwCloudId: fwCloud.id
                }));

                await expect(service.update(rule.id, {
                    ipObjGroupIds: [
                        {id: group1.id, order: 1},
                        {id: group2.id, order: 2}
                    ]
                })).to.rejectedWith(ValidationException);
            });
        });

        describe('OpenVPNs', () => {
            let openVPN1: OpenVPN;
            let openVPN2: OpenVPN;
            
            beforeEach(async () => {
                openVPN1 = await getRepository(OpenVPN).save(getRepository(OpenVPN).create({
                    firewallId: firewall.id,
                    parentId: fwcProduct.openvpnServer.id,
                    crt: await getRepository(Crt).save(getRepository(Crt).create({
                        cn: StringHelper.randomize(10),
                        days: 100,
                        type: 1,
                        ca: await getRepository(Ca).save(getRepository(Ca).create({
                            fwCloud: fwCloud,
                            cn: StringHelper.randomize(10),
                            days: 100,
                        }))
                    }))
                }));

                openVPN2 = await getRepository(OpenVPN).save(getRepository(OpenVPN).create({
                    firewallId: firewall.id,
                    parentId: fwcProduct.openvpnServer.id,
                    crt: await getRepository(Crt).save(getRepository(Crt).create({
                        cn: StringHelper.randomize(10),
                        days: 100,
                        type: 1,
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
                    openVPNIds: [
                        {id: openVPN1.id, order: 1},
                        {id: openVPN2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToOpenVPNs']})).routingRuleToOpenVPNs.map(item => item.openVPNId)
                ).to.deep.eq([openVPN1.id, openVPN2.id])
            });

            it('should remove openVPNs attachment', async () => {
                await service.update(rule.id, {
                    openVPNIds: [
                        {id: openVPN1.id, order: 1},
                        {id: openVPN2.id, order: 2}
                    ]
                });

                await service.update(rule.id, {
                    openVPNIds: [
                        {id: openVPN2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToOpenVPNs']})).routingRuleToOpenVPNs.map(item => item.openVPNId)
                ).to.deep.eq([openVPN2.id])
            });

            it('should remove all openVPNs attachment', async () => {
                await service.update(rule.id, {
                    openVPNIds: [
                        {id: openVPN1.id, order: 1},
                        {id: openVPN2.id, order: 2}
                    ]
                });

                await service.update(rule.id, {
                    openVPNIds: []
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToOpenVPNs']})).routingRuleToOpenVPNs.map(item => item.openVPNId)
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
                    openVPNPrefixIds: [
                        {id: openVPNPrefix.id, order: 1},
                        {id: openVPNPrefix2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToOpenVPNPrefixes']})).routingRuleToOpenVPNPrefixes.map(item => item.openVPNPrefixId)
                ).to.deep.eq([openVPNPrefix.id, openVPNPrefix2.id])
            });

            it('should remove openVPNPrefixes attachment', async () => {
                await service.update(rule.id, {
                    openVPNPrefixIds: [
                        {id: openVPNPrefix.id, order: 1},
                        {id: openVPNPrefix2.id, order: 2}
                    ]
                });

                await service.update(rule.id, {
                    openVPNPrefixIds: [
                        {id: openVPNPrefix2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToOpenVPNPrefixes']})).routingRuleToOpenVPNPrefixes.map(item => item.openVPNPrefixId)
                ).to.deep.eq([openVPNPrefix2.id])
            });

            it('should remove all openVPNPrefixes attachment', async () => {
                await service.update(rule.id, {
                    openVPNPrefixIds: [
                        {id: openVPNPrefix.id, order: 1},
                        {id: openVPNPrefix2.id, order: 2}
                    ]
                });

                await service.update(rule.id, {
                    openVPNPrefixIds: []
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToOpenVPNPrefixes']})).routingRuleToOpenVPNPrefixes.map(item => item.openVPNPrefixId)
                ).to.deep.eq([])
            })
        });

        describe('marks', () => {
            let mark1: Mark;
            let mark2: Mark;
            
            beforeEach(async () => {
                mark1 = await getRepository(Mark).save(getRepository(Mark).create({
                    fwCloudId: fwCloud.id,
                    code: 1,
                    name: '1',
                }));

                mark2 = await getRepository(Mark).save(getRepository(Mark).create({
                    fwCloudId: fwCloud.id,
                    code: 2,
                    name: '2',
                }));
            });

            it('should attach marks', async () => {
                await service.update(rule.id, {
                    markIds: [
                        {id: mark1.id, order: 1},
                        {id: mark2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToMarks']})).routingRuleToMarks.map(item => item.markId)
                ).to.deep.eq([mark1.id, mark2.id])
            });

            it('should remove marks attachment', async () => {
                await service.update(rule.id, {
                    markIds: [
                        {id: mark1.id, order: 1},
                        {id: mark2.id, order: 2}
                    ]
                });

                await service.update(rule.id, {
                    markIds: [
                        {id: mark2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToMarks']})).routingRuleToMarks.map(item => item.markId)
                ).to.deep.eq([mark2.id])
            });

            it('should remove all marks attachment', async () => {
                await service.update(rule.id, {
                    markIds: [
                        {id: mark1.id, order: 1},
                        {id: mark2.id, order: 2}
                    ]
                });

                await service.update(rule.id, {
                    markIds: []
                });

                expect(
                    (await getRepository(RoutingRule).findOne(rule.id, {relations: ['routingRuleToMarks']})).routingRuleToMarks.map(item => item.markId)
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
                interfaceId: null,
                fwCloudId: fwCloud.id
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
                    type: 1,
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
                        type: 1,
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
                rule_order: 1
            });
        });

        it('should remove rule', async () => {
            const removedRule: RoutingRule = await service.remove({
                fwCloudId: fwCloud.id,
                firewallId: firewall.id,
                id: rule.id
            });

            expect(await getRepository(RoutingRule).findOne(rule.id)).to.be.undefined;
        });

        it('should reset firewall compiled flag', async () => {
            await getRepository(Firewall).update(firewall.id, {
                status: 1
            });
            await firewall.reload();

            await service.remove({id: rule.id});

            await firewall.reload();

            expect(firewall.status).to.eq(3);
        });
    });

    describe('bulkUpdate', () => {
        it('should reset firewall compiled flag', async () => {
            await getRepository(Firewall).update(firewall.id, {
                status: 1
            });
            await firewall.reload();

            await service.bulkUpdate([rule.id], {
                active: false
            });

            await firewall.reload();

            expect(firewall.status).to.eq(3);
        });
    })

    describe('move', () => {
        it('should reset firewall compiled flag', async () => {
            await getRepository(Firewall).update(firewall.id, {
                status: 1
            });
            await firewall.reload();

            await service.move([rule.id], rule.id, Offset.Above);

            await firewall.reload();

            expect(firewall.status).to.eq(3);
        });
    })

    describe('moveFrom', () => {
        let rule1: RoutingRule;
        let rule2: RoutingRule;
        let mark2: Mark;

        beforeEach(async () => {
            mark2 = await getRepository(Mark).save({
                code: 2,
                name: 'test',
                fwCloudId: fwcProduct.fwcloud.id
            });
            
            rule1 = await service.create({
                routingTableId: fwcProduct.routingTable.id,
                markIds: [{
                    id: mark.id,
                    order: 1
                }, {
                    id: mark2.id,
                    order: 2
                }]
            });

            rule2 = await service.create({
                routingTableId: fwcProduct.routingTable.id,
                markIds: [{
                    id: mark.id,
                    order: 1
                }]
            });
        });

        describe('ipObj', () => {
            it('should move ipObj', async () => {
                await service.update(rule1.id, {
                    ipObjIds: [{
                        id: fwcProduct.ipobjs.get('address').id,
                        order: 1
                    }]
                });

                await service.moveFrom(rule1.id, rule2.id, {
                    fromId: rule1.id,
                    toId: rule2.id,
                    ipObjId: fwcProduct.ipobjs.get('address').id
                });

                const refreshedRule1: RoutingRule = await getRepository(RoutingRule).findOne(rule1.id, { relations: ['routingRuleToIPObjs']});
                const refreshedRule2: RoutingRule = await getRepository(RoutingRule).findOne(rule2.id, { relations: ['routingRuleToIPObjs']});

                expect(refreshedRule1.routingRuleToIPObjs).length(0);
                expect(refreshedRule2.routingRuleToIPObjs).length(1);
            })
        });

        describe('ipObjGroups', () => {
            it('should move ipObjGroup', async () => {
                await service.update(rule1.id, {
                    ipObjGroupIds: [{
                        id: fwcProduct.ipobjGroup.id,
                        order: 1
                    }]
                });

                await service.moveFrom(rule1.id, rule2.id, {
                    fromId: rule1.id,
                    toId: rule2.id,
                    ipObjGroupId: fwcProduct.ipobjGroup.id,
                });

                const refreshedRule1: RoutingRule = await getRepository(RoutingRule).findOne(rule1.id, { relations: ['routingRuleToIPObjGroups']});
                const refreshedRule2: RoutingRule = await getRepository(RoutingRule).findOne(rule2.id, { relations: ['routingRuleToIPObjGroups']});

                expect(refreshedRule1.routingRuleToIPObjGroups).length(0);
                expect(refreshedRule2.routingRuleToIPObjGroups).length(1);
            })
        });

        describe('openVPN', () => {
            it('should move openVPN', async () => {
                await service.update(rule1.id, {
                    openVPNIds: [{
                        id: fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
                        order: 1
                    }]
                });

                await service.moveFrom(rule1.id, rule2.id, {
                    fromId: rule1.id,
                    toId: rule2.id,
                    openVPNId: fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
                });

                const refreshedRule1: RoutingRule = await getRepository(RoutingRule).findOne(rule1.id, { relations: ['routingRuleToOpenVPNs']});
                const refreshedRule2: RoutingRule = await getRepository(RoutingRule).findOne(rule2.id, { relations: ['routingRuleToOpenVPNs']});

                expect(refreshedRule1.routingRuleToOpenVPNs).length(0);
                expect(refreshedRule2.routingRuleToOpenVPNs).length(1);
            })
        })

        describe('openVPNPrefix', () => {
            it('should move openVPNPrefix', async () => {
                await service.update(rule1.id, {
                    openVPNPrefixIds: [{
                        id: fwcProduct.openvpnPrefix.id,
                        order: 1
                    }]
                });

                await service.moveFrom(rule1.id, rule2.id, {
                    fromId: rule1.id,
                    toId: rule2.id,
                    openVPNPrefixId: fwcProduct.openvpnPrefix.id,
                });

                const refreshedRule1: RoutingRule = await getRepository(RoutingRule).findOne(rule1.id, { relations: ['routingRuleToOpenVPNPrefixes']});
                const refreshedRule2: RoutingRule = await getRepository(RoutingRule).findOne(rule2.id, { relations: ['routingRuleToOpenVPNPrefixes']});

                expect(refreshedRule1.routingRuleToOpenVPNPrefixes).length(0);
                expect(refreshedRule2.routingRuleToOpenVPNPrefixes).length(1);
            })
        })

        describe('mark', () => {
            it('should move marks', async () => {
                await service.moveFrom(rule1.id, rule2.id, {
                    fromId: rule1.id,
                    toId: rule2.id,
                    markId: mark2.id
                });

                const refreshedRule1: RoutingRule = await getRepository(RoutingRule).findOne(rule1.id, { relations: ['routingRuleToMarks']});
                const refreshedRule2: RoutingRule = await getRepository(RoutingRule).findOne(rule2.id, { relations: ['routingRuleToMarks']});

                expect(refreshedRule1.routingRuleToMarks).length(1);
                expect(refreshedRule2.routingRuleToMarks).length(2);
            })
        })
    });
    
    describe('bulkRemove', () => {
        it('should remove route', async () => {
            await service.bulkRemove([rule.id]);

            expect(await service.findOneInPath({
                firewallId: firewall.id,
                fwCloudId: fwCloud.id,
                id: rule.id
            })).to.be.undefined;
        });

        it('should reset firewall compiled flag', async () => {
            await getRepository(Firewall).update(firewall.id, {
                status: 1
            });
            await firewall.reload();

            await service.bulkRemove([rule.id]);

            await firewall.reload();

            expect(firewall.status).to.eq(3);
        });
    })
})