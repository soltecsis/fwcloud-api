import { getRepository } from "typeorm";
import db from "../../../../src/database/database-manager";
import { ValidationException } from "../../../../src/fonaments/exceptions/validation-exception";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { fwcloudColors } from "../../../../src/models/fwcloud/FwCloud-colors";
import { Interface } from "../../../../src/models/interface/Interface";
import { InterfaceIPObj } from "../../../../src/models/interface/InterfaceIPObj";
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { IPObjGroup } from "../../../../src/models/ipobj/IPObjGroup";
import { IPObjToIPObjGroup } from "../../../../src/models/ipobj/IPObjToIPObjGroup";
import { Route } from "../../../../src/models/routing/route/route.model";
import { RouteService } from "../../../../src/models/routing/route/route.service";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import { OpenVPN } from "../../../../src/models/vpn/openvpn/OpenVPN";
import { OpenVPNPrefix } from "../../../../src/models/vpn/openvpn/OpenVPNPrefix";
import { Ca } from "../../../../src/models/vpn/pki/Ca";
import { Crt } from "../../../../src/models/vpn/pki/Crt";
import StringHelper from "../../../../src/utils/string.helper";
import { expect, testSuite } from "../../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../../utils/fwcloud-factory";

describe(RouteService.name, () => {
    let service: RouteService;

    let fwcProduct: FwCloudProduct;
    let fwCloud: FwCloud;
    let firewall: Firewall;
    let table: RoutingTable;
    let gateway: IPObj;
    let route: Route;

    beforeEach(async () => {
        await testSuite.resetDatabaseData();
        fwcProduct = await (new FwCloudFactory()).make();

        service = await testSuite.app.getService<RouteService>(RouteService.name);

        fwCloud = fwcProduct.fwcloud;
        firewall = fwcProduct.firewall;
        gateway = fwcProduct.ipobjs.get('gateway');
        table = fwcProduct.routingTable;

        route = fwcProduct.routes.get('route1');
    });

    describe('create', () => {
        describe('rule_order', () => {
            let routeOrder1: Route;
            let routeOrder2: Route;
            let routeOrder3: Route;
            let routeOrder4: Route;

            beforeEach(async () => {
                routeOrder1 = await service.create({
                    routingTableId: table.id,
                    gatewayId: gateway.id
                });
                routeOrder2 = await service.create({
                    routingTableId: table.id,
                    gatewayId: gateway.id
                });
                routeOrder3 = await service.create({
                    routingTableId: table.id,
                    gatewayId: gateway.id
                });
                routeOrder4 = await service.create({
                    routingTableId: table.id,
                    gatewayId: gateway.id
                });
            });

            it('should set last position if rule_order is not defined', async () => {
                route = await service.create({
                    routingTableId: table.id,
                    gatewayId: gateway.id
                });

                // Notice rules have been created in the factory
                expect(route.route_order).to.eq(9);
            });

            it('should attach standard ipobj', async () => {
                let standards: IPObj[] = await getRepository(IPObj).find({
                    where: {
                        fwCloudId: null
                    }
                });

                route = await service.create({
                    routingTableId: table.id,
                    gatewayId: gateway.id,
                    ipObjIds: standards.map(item => item.id)
                });

                route = await getRepository(Route).findOne(route.id, { relations: ['routeToIPObjs']});

                expect(route.routeToIPObjs).to.have.length(standards.length);
            })

        });
    });

    describe('copy', () => {
        let routeOrder1: Route;
        let routeOrder2: Route;
        
        beforeEach(async () => {
            routeOrder1 = await service.create({
                comment: 'comment1',
                routingTableId: table.id,
                gatewayId: gateway.id
            });
            routeOrder2 = await service.create({
                comment: 'comment2',
                routingTableId: table.id,
                gatewayId: gateway.id
            });
        });

        it('should copy routes', async () => {
            const copied: Route[] = await service.copy([routeOrder1.id, routeOrder2.id], routeOrder1.id, 'above');
            routeOrder1 = await service.findOneInPath({
                id: routeOrder1.id
            });
            expect(copied[0].comment).to.eq(routeOrder1.comment);
            expect(copied[0].route_order).to.eq(routeOrder1.route_order - 2);
            expect(copied[1].comment).to.eq(routeOrder2.comment);
            expect(copied[1].route_order).to.eq(routeOrder1.route_order - 1);
        });
    })

    describe('update', () => {
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
            })
            it('should attach ipbojs', async () => {
                await service.update(route.id, {
                    ipObjIds: [ipobj1.id, ipobj2.id]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToIPObjs']})).routeToIPObjs.map(item => item.ipObjId)
                ).to.deep.eq([ipobj1.id, ipobj2.id])
            });

            it('should remove ipobjs attachment', async () => {
                await service.update(route.id, {
                    ipObjIds: [ipobj1.id, ipobj2.id]
                });

                await service.update(route.id, {
                    ipObjIds: [ipobj2.id]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToIPObjs']})).routeToIPObjs.map(item => item.ipObjId)
                ).to.deep.eq([ipobj2.id])
            });

            it('should remove all ipobjs attachment', async () => {
                await service.update(route.id, {
                    ipObjIds: [ipobj1.id, ipobj2.id]
                });

                await service.update(route.id, {
                    ipObjIds: []
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToIPObjs']})).routeToIPObjs.map(item => item.ipObjId)
                ).to.deep.eq([])
            });

            it('should throw an exception if the ipobj is a host but does not have any address', async () => {
                ipobj2 = await getRepository(IPObj).save(getRepository(IPObj).create({
                    name: 'test',
                    ipObjTypeId: 8,
                    interfaceId: null,
                    fwCloudId: fwCloud.id
                }));

                await expect(service.update(route.id, {
                    ipObjIds: [ipobj2.id]
                })).to.rejectedWith(ValidationException);
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
                await service.update(route.id, {
                    ipObjGroupIds: [group1.id, group2.id]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToIPObjGroups']})).routeToIPObjGroups.map(item => item.ipObjGroupId)
                ).to.deep.eq([group1.id, group2.id])
            });

            it('should remove ipObjGroups attachment', async () => {
                await service.update(route.id, {
                    ipObjGroupIds: [group1.id, group2.id]
                });

                await service.update(route.id, {
                    ipObjGroupIds: [group2.id]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToIPObjGroups']})).routeToIPObjGroups.map(item => item.ipObjGroupId)
                ).to.deep.eq([group2.id])
            });

            it('should remove all ipObjGroups attachment', async () => {
                await service.update(route.id, {
                    ipObjGroupIds: [group1.id, group2.id]
                });

                await service.update(route.id, {
                    ipObjGroupIds: []
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToIPObjGroups']})).routeToIPObjGroups.map(item => item.ipObjGroupId)
                ).to.deep.eq([])
            });

            it('should throw an exception if the group is empty', async () => {
                group1 = await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({
                    name: StringHelper.randomize(10),
                    type: 1,
                    fwCloudId: fwCloud.id
                }));

                await expect(service.update(route.id, {
                    ipObjGroupIds: [group1.id, group2.id]
                })).to.rejectedWith(ValidationException);
            });
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
                await service.update(route.id, {
                    openVPNIds: [openVPN1.id, openVPN2.id]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToOpenVPNs']})).routeToOpenVPNs.map(item => item.openVPNId)
                ).to.deep.eq([openVPN1.id, openVPN2.id])
            });

            it('should remove openVPNs attachment', async () => {
                await service.update(route.id, {
                    openVPNIds: [openVPN1.id, openVPN2.id]
                });

                await service.update(route.id, {
                    openVPNIds: [openVPN2.id]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToOpenVPNs']})).routeToOpenVPNs.map(item => item.openVPNId)
                ).to.deep.eq([openVPN2.id])
            });

            it('should remove all openVPNs attachment', async () => {
                await service.update(route.id, {
                    openVPNIds: [openVPN1.id, openVPN2.id]
                });

                await service.update(route.id, {
                    openVPNIds: []
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToOpenVPNs']})).routeToOpenVPNs.map(item => item.openVPNId)
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
                await service.update(route.id, {
                    openVPNPrefixIds: [openVPNPrefix.id, openVPNPrefix2.id]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToOpenVPNPrefixes']})).routeToOpenVPNPrefixes.map(item => item.openVPNPrefixId)
                ).to.deep.eq([openVPNPrefix.id, openVPNPrefix2.id])
            });

            it('should remove openVPNPrefixes attachment', async () => {
                await service.update(route.id, {
                    openVPNPrefixIds: [openVPNPrefix.id, openVPNPrefix2.id]
                });

                await service.update(route.id, {
                    openVPNPrefixIds: [openVPNPrefix2.id]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToOpenVPNPrefixes']})).routeToOpenVPNPrefixes.map(item => item.openVPNPrefixId)
                ).to.deep.eq([openVPNPrefix2.id])
            });

            it('should remove all openVPNPrefixes attachment', async () => {
                await service.update(route.id, {
                    openVPNPrefixIds: [openVPNPrefix.id, openVPNPrefix2.id]
                });

                await service.update(route.id, {
                    openVPNPrefixIds: []
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToOpenVPNPrefixes']})).routeToOpenVPNPrefixes.map(item => item.openVPNPrefixId)
                ).to.deep.eq([])
            })
        });

        describe('interface', () => {
            let _interface: Interface;

            beforeEach(async () => {
                _interface = await getRepository(Interface).save(getRepository(Interface).create({
                    name: 'eth1',
                    type: '11',
                    interface_type: '11'
                }));

                route = await service.create({
                    routingTableId: table.id,
                    gatewayId: gateway.id,
                    interfaceId: _interface.id
                })
            });

            it('should remove interface relation', async () => {
                await service.update(route.id, {
                    interfaceId: null
                });

                expect((await service.findOneInPath({id: route.id})).interfaceId).to.be.null;
            });
        })
    });

    describe('remove', () => {
        it('should remove route', async () => {
            await service.remove({
                fwCloudId: fwCloud.id,
                firewallId: firewall.id,
                id: route.id
            });

            expect(await service.findOneInPath({
                firewallId: firewall.id,
                fwCloudId: fwCloud.id,
                id: route.id
            })).to.be.undefined;
        });
    });
    
    describe('bulkRemove', () => {
        it('should remove route', async () => {
            await service.bulkRemove([route.id]);

            expect(await service.findOneInPath({
                firewallId: firewall.id,
                fwCloudId: fwCloud.id,
                id: route.id
            })).to.be.undefined;
        });
    })
})