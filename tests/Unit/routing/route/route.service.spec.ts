import { attempt } from "joi";
import { getRepository } from "typeorm";
import db from "../../../../src/database/database-manager";
import { ValidationException } from "../../../../src/fonaments/exceptions/validation-exception";
import { Cluster } from "../../../../src/models/firewall/Cluster";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { fwcloudColors } from "../../../../src/models/fwcloud/FwCloud-colors";
import { Interface } from "../../../../src/models/interface/Interface";
import { InterfaceIPObj } from "../../../../src/models/interface/InterfaceIPObj";
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { IPObjGroup } from "../../../../src/models/ipobj/IPObjGroup";
import { IPObjToIPObjGroup } from "../../../../src/models/ipobj/IPObjToIPObjGroup";
import { Mark } from "../../../../src/models/ipobj/Mark";
import { Route } from "../../../../src/models/routing/route/route.model";
import { RouteService } from "../../../../src/models/routing/route/route.service";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import { OpenVPN } from "../../../../src/models/vpn/openvpn/OpenVPN";
import { OpenVPNPrefix } from "../../../../src/models/vpn/openvpn/OpenVPNPrefix";
import { Ca } from "../../../../src/models/vpn/pki/Ca";
import { Crt } from "../../../../src/models/vpn/pki/Crt";
import { Offset } from "../../../../src/offset";
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
    let ctr: Cluster;

    beforeEach(async () => {
        await testSuite.resetDatabaseData();
        fwcProduct = await (new FwCloudFactory()).make();

        service = await testSuite.app.getService<RouteService>(RouteService.name);

        fwCloud = fwcProduct.fwcloud;

        ctr = await getRepository(Cluster).save(getRepository(Cluster).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwCloud.id
        }))
        
        firewall = fwcProduct.firewall;
        firewall.clusterId = ctr.id;
        firewall.fwmaster = 1;

        await getRepository(Firewall).save(firewall)

        gateway = fwcProduct.ipobjs.get('gateway');
        table = fwcProduct.routingTable;

        route = fwcProduct.routes.get('route1');
    });

    describe('create', () => {

        it('should reset firewall compiled flag', async () => {
            await getRepository(Firewall).update(firewall.id, {
                status: 1
            });
            await firewall.reload();

            await service.create({
                routingTableId: table.id,
                gatewayId: gateway.id
            });

            await firewall.reload();

            expect(firewall.status).to.eq(3);
        });

        describe('route_order', () => {
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
                expect(route.route_order).to.eq(12);
            });

            it('should attach standard ipobj', async () => {
                const standards: IPObj[] = await getRepository(IPObj).find({
                    where: {
                        fwCloudId: null
                    }
                });

                route = await service.create({
                    routingTableId: table.id,
                    gatewayId: gateway.id,
                    ipObjIds: standards.map((item, index) => ({
                        id: item.id,
                        order: index +1
                    }))
                });

                route = await getRepository(Route).findOne(route.id, { relations: ['routeToIPObjs']});

                expect(route.routeToIPObjs).to.have.length(standards.length);
            })

        });
        describe('FirewallApplyToId', ()=>{
            it('should attach firewallApplyToId', async ()=>{
                route = await service.create({
                    routingTableId: table.id,
                    gatewayId: gateway.id,
                    firewallApplyToId: firewall.id
                })

                route = await getRepository(Route).findOne(route.id, {relations: ['firewallApplyTo']})
                expect(route.firewallApplyTo.id).to.eq(firewall.id)
            });

            it('should firewallApplyToId set null to default when does not have any firewall', async ()=>{
                route = await service.create({
                    routingTableId: table.id,
                    gatewayId: gateway.id,
                })

                route = await getRepository(Route).findOne(route.id, {relations: ['firewallApplyTo']})
                expect(route.firewallApplyToId).to.eq(null)
            })

            it('should throw exception if the attachment is a firewall that does not belong to the cluster', async () => {
                
                const fw1: Firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
                    name: StringHelper.randomize(10),
                    fwCloudId: fwCloud.id,   
                }));

                route = await service.create({
                    routingTableId: table.id,
                    firewallApplyToId: firewall.id,
                    gatewayId: gateway.id
                })
 
                await expect(service.create({
                    routingTableId: table.id,
                    firewallApplyToId: fw1.id, 
                    gatewayId: gateway.id
                })).to.rejectedWith(ValidationException);
            })
        })
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

        it('should reset firewall compiled flag', async () => {
            await getRepository(Firewall).update(firewall.id, {
                status: 1
            });
            await firewall.reload();

            await service.copy([routeOrder1.id, routeOrder2.id], routeOrder1.id, Offset.Above);
            await firewall.reload();

            expect(firewall.status).to.eq(3);
        });

        it('should copy routes', async () => {
            const copied: Route[] = await service.copy([routeOrder1.id, routeOrder2.id], routeOrder1.id, Offset.Above);
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

        it('should reset firewall compiled flag', async () => {
            await getRepository(Firewall).update(firewall.id, {
                status: 1
            });
            await firewall.reload();

            await service.update(route.id, {
                active: false
            });

            await firewall.reload();

            expect(firewall.status).to.eq(3);
        });

        describe('FirewallApplyToId', ()=>{
            it('should attach firewallApplyToId', async ()=>{
                await service.update(route.id, {
                    firewallApplyToId: firewall.id
                })

                expect((await getRepository(Route).findOne(route.id, {relations: ['firewallApplyTo']})).firewallApplyTo.id).to.eq(firewall.id)
            })

            it('should remove firewallApplyToId when remove a firewall attached', async ()=>{
                await service.update(route.id, {
                    firewallApplyToId: firewall.id, 
                });

                await service.update(route.id, {
                    firewallApplyToId: null,
                });
                
                
                expect((await getRepository(Route).findOne(route.id, {relations: ['firewallApplyTo']})).firewallApplyToId).to.eq(null)
            })

            it('should firewallApplyToId null default when does not have any firewall', async () =>{    
                await service.update(route.id, {   
                });
                

                expect((await getRepository(Route).findOne(route.id, {relations: ['firewallApplyTo']})).firewallApplyToId).to.eq(null)
            })

            it('should throw exception if the attachment is a firewall that does not belong to the cluster', async () => {

                const fw1: Firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
                    name: StringHelper.randomize(10),
                    fwCloudId: fwCloud.id,
                    
                }));

                await expect(service.update(route.id, {
                    firewallApplyToId: fw1.id, 
                    gatewayId: gateway.id
                })).to.rejectedWith(ValidationException);
            })
        })

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
                    ipObjIds: [
                        {id: ipobj1.id, order: 1}, 
                        {id: ipobj2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToIPObjs']})).routeToIPObjs.map(item => item.ipObjId)
                ).to.deep.eq([ipobj1.id, ipobj2.id])
            });

            it('should remove ipobjs attachment', async () => {
                await service.update(route.id, {
                    ipObjIds: [
                        {id: ipobj1.id, order: 1}, 
                        {id: ipobj2.id, order: 2}
                    ]
                });

                await service.update(route.id, {
                    ipObjIds: [
                        {id: ipobj2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToIPObjs']})).routeToIPObjs.map(item => item.ipObjId)
                ).to.deep.eq([ipobj2.id])
            });

            it('should remove all ipobjs attachment', async () => {
                await service.update(route.id, {
                    ipObjIds: [
                        {id: ipobj1.id, order: 1}, 
                        {id: ipobj2.id, order: 2}
                    ]
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
                    ipObjIds: [
                        {id: ipobj2.id, order: 2}
                    ]
                })).to.rejectedWith(ValidationException);
            });

            it('should throw exception if the attachment is a host and is empty', async () => {
                const host = await getRepository(IPObj).save({
                    name: 'host',
                    ipObjTypeId: 8,
                });

                await expect(service.update(route.id, {
                    ipObjIds: [
                        {id: host.id, order: 1}
                    ]
                })).to.rejectedWith(ValidationException);
            });
        });

        describe('IpObjGroups', () => {
            let group1: IPObjGroup;
            let group2: IPObjGroup;
            
            beforeEach(async () => {
                group1 = await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({
                    name: StringHelper.randomize(10),
                    type: 20,
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
                    type: 20,
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
                    ipObjGroupIds: [
                        {id: group1.id, order: 1},
                        {id: group2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToIPObjGroups']})).routeToIPObjGroups.map(item => item.ipObjGroupId)
                ).to.deep.eq([group1.id, group2.id])
            });

            it('should remove ipObjGroups attachment', async () => {
                await service.update(route.id, {
                    ipObjGroupIds: [
                        {id: group1.id, order: 1},
                        {id: group2.id, order: 2}
                    ]
                });

                await service.update(route.id, {
                    ipObjGroupIds: [
                        {id: group2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToIPObjGroups']})).routeToIPObjGroups.map(item => item.ipObjGroupId)
                ).to.deep.eq([group2.id])
            });

            it('should remove all ipObjGroups attachment', async () => {
                await service.update(route.id, {
                    ipObjGroupIds: [
                        {id: group1.id, order: 1},
                        {id: group2.id, order: 2}
                    ]
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
                    type: 20,
                    fwCloudId: fwCloud.id
                }));

                await expect(service.update(route.id, {
                    ipObjGroupIds: [
                        {id: group1.id, order: 1},
                        {id: group2.id, order: 2}
                    ]
                })).to.rejectedWith(ValidationException);
            });

            it('should not allow attach a service group', async () => {
                const _service = await getRepository(IPObj).findOneOrFail(10040);
                
                const group = await getRepository(IPObjGroup).save({
                    name: 'group',
                    type: 21,
                    fwCloudId: fwcProduct.fwcloud.id
                });

                await getRepository(IPObjToIPObjGroup).save({
                    ipObjGroupId: group.id,
                    ipObjId: _service.id
                });

                await expect(service.update(route.id, {
                    ipObjGroupIds: [
                        {id: group.id, order: 1}
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
                await service.update(route.id, {
                    openVPNIds: [
                        {id: openVPN1.id, order: 1},
                        {id: openVPN2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToOpenVPNs']})).routeToOpenVPNs.map(item => item.openVPNId)
                ).to.deep.eq([openVPN1.id, openVPN2.id])
            });

            it('should remove openVPNs attachment', async () => {
                await service.update(route.id, {
                    openVPNIds: [
                        {id: openVPN1.id, order: 1},
                        {id: openVPN2.id, order: 2}
                    ]
                });

                await service.update(route.id, {
                    openVPNIds: [
                        {id: openVPN2.id, order: 2}
                    ]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToOpenVPNs']})).routeToOpenVPNs.map(item => item.openVPNId)
                ).to.deep.eq([openVPN2.id])
            });

            it('should remove all openVPNs attachment', async () => {
                await service.update(route.id, {
                    openVPNIds: [
                        {id: openVPN1.id, order: 1},
                        {id: openVPN2.id, order: 2}
                    ]
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
                    openVPNPrefixIds: [
                        {id: openVPNPrefix.id, order: 1},
                        {id: openVPNPrefix2.id, order: 2 }
                    ]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToOpenVPNPrefixes']})).routeToOpenVPNPrefixes.map(item => item.openVPNPrefixId)
                ).to.deep.eq([openVPNPrefix.id, openVPNPrefix2.id])
            });

            it('should remove openVPNPrefixes attachment', async () => {
                await service.update(route.id, {
                    openVPNPrefixIds: [
                        {id: openVPNPrefix.id, order: 1},
                        {id: openVPNPrefix2.id, order: 2 }
                    ]
                });

                await service.update(route.id, {
                    openVPNPrefixIds: [
                        {id: openVPNPrefix2.id, order: 2 }
                    ]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['routeToOpenVPNPrefixes']})).routeToOpenVPNPrefixes.map(item => item.openVPNPrefixId)
                ).to.deep.eq([openVPNPrefix2.id])
            });

            it('should remove all openVPNPrefixes attachment', async () => {
                await service.update(route.id, {
                    openVPNPrefixIds: [
                        {id: openVPNPrefix.id, order: 1},
                        {id: openVPNPrefix2.id, order: 2 }
                    ]
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
                    interface_type: '11',
                    firewallId: firewall.id
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

            it('should not attach a host interface', async () => {
                _interface = await getRepository(Interface).save({
                    name: 'eth1',
                    type: '11',
                    interface_type: '11',
                });

                await expect(service.update(route.id, {
                    interfaceId: _interface.id
                })).to.be.rejectedWith(ValidationException);
            });
        })
    });

    describe('bulkUpdate', () => {

        it('should reset firewall compiled flag', async () => {
            await getRepository(Firewall).update(firewall.id, {
                status: 1
            });
            await firewall.reload();

            await service.bulkUpdate([route.id], {
                active: false
            });

            await firewall.reload();

            expect(firewall.status).to.eq(3);
        });
    });

    describe('move', () => {

        it('should reset firewall compiled flag', async () => {
            await getRepository(Firewall).update(firewall.id, {
                status: 1
            });
            await firewall.reload();

            await service.move([route.id], route.id, Offset.Above);

            await firewall.reload();

            expect(firewall.status).to.eq(3);
        });
    });

    describe('moveTo', () => {
        let route1: Route;
        let route2: Route;
        
        beforeEach(async () => {
            route1 = await service.create({
                gatewayId: gateway.id,
                routingTableId: fwcProduct.routingTable.id,
            });

            route2 = await service.create({
                routingTableId: fwcProduct.routingTable.id,
                gatewayId: gateway.id
            });
        });

        describe('ipObj', () => {
            it('should move ipObj', async () => {
                await service.update(route1.id, {
                    ipObjIds: [{
                        id: fwcProduct.ipobjs.get('address').id,
                        order: 1
                    }]
                });

                await service.moveTo(route1.id, route2.id, {
                    fromId: route1.id,
                    toId: route2.id,
                    ipObjId: fwcProduct.ipobjs.get('address').id
                });

                const refreshedRoute1: Route = await getRepository(Route).findOne(route1.id, { relations: ['routeToIPObjs']});
                const refreshedroute2: Route = await getRepository(Route).findOne(route2.id, { relations: ['routeToIPObjs']});

                expect(refreshedRoute1.routeToIPObjs).length(0);
                expect(refreshedroute2.routeToIPObjs).length(1);
            })
        });

        describe('ipObjGroups', () => {
            it('should move ipObjGroup', async () => {
                await service.update(route1.id, {
                    ipObjGroupIds: [{
                        id: fwcProduct.ipobjGroup.id,
                        order: 1
                    }]
                });

                await service.moveTo(route1.id, route2.id, {
                    fromId: route1.id,
                    toId: route2.id,
                    ipObjGroupId: fwcProduct.ipobjGroup.id,
                });

                const refreshedroute1: Route = await getRepository(Route).findOne(route1.id, { relations: ['routeToIPObjGroups']});
                const refreshedroute2: Route = await getRepository(Route).findOne(route2.id, { relations: ['routeToIPObjGroups']});

                expect(refreshedroute1.routeToIPObjGroups).length(0);
                expect(refreshedroute2.routeToIPObjGroups).length(1);
            })
        });

        describe('openVPN', () => {
            it('should move openVPN', async () => {
                await service.update(route1.id, {
                    openVPNIds: [{
                        id: fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
                        order: 1
                    }]
                });

                await service.moveTo(route1.id, route2.id, {
                    fromId: route1.id,
                    toId: route2.id,
                    openVPNId: fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
                });

                const refreshedroute1: Route = await getRepository(Route).findOne(route1.id, { relations: ['routeToOpenVPNs']});
                const refreshedroute2: Route = await getRepository(Route).findOne(route2.id, { relations: ['routeToOpenVPNs']});

                expect(refreshedroute1.routeToOpenVPNs).length(0);
                expect(refreshedroute2.routeToOpenVPNs).length(1);
            })
        })

        describe('openVPNPrefix', () => {
            it('should move openVPNPrefix', async () => {
                await service.update(route1.id, {
                    openVPNPrefixIds: [{
                        id: fwcProduct.openvpnPrefix.id,
                        order: 1
                    }]
                });

                await service.moveTo(route1.id, route2.id, {
                    fromId: route1.id,
                    toId: route2.id,
                    openVPNPrefixId: fwcProduct.openvpnPrefix.id,
                });

                const refreshedroute1: Route = await getRepository(Route).findOne(route1.id, { relations: ['routeToOpenVPNPrefixes']});
                const refreshedroute2: Route = await getRepository(Route).findOne(route2.id, { relations: ['routeToOpenVPNPrefixes']});

                expect(refreshedroute1.routeToOpenVPNPrefixes).length(0);
                expect(refreshedroute2.routeToOpenVPNPrefixes).length(1);
            })
        });
    });

    describe('moveToGateway', () => {
        let route1: Route;
        let route2: Route;
        let gateway2: IPObj;
        
        beforeEach(async () => {
            gateway2 = await getRepository(IPObj).save({
                name: 'gateway',
                address: '1.2.3.4',
                ipObjTypeId: 5,
                interfaceId: null,
                fwCloudId: fwcProduct.fwcloud.id
            });

            route1 = await service.create({
                gatewayId: gateway.id,
                routingTableId: fwcProduct.routingTable.id,
                ipObjIds: [{
                    id: gateway.id,
                    order: 1
                }]
            });

            route2 = await service.create({
                routingTableId: fwcProduct.routingTable.id,
                gatewayId: gateway2.id
            });
        });

        it('should move ipObj', async () => {
            await service.moveToGateway(route1.id, route2.id, {
                fromId: route1.id,
                toId: route2.id,
                ipObjId: gateway.id
            });

            const refreshedRoute1: Route = await getRepository(Route).findOne(route1.id, { relations: ['routeToIPObjs']});
            const refreshedroute2: Route = await getRepository(Route).findOne(route2.id);

            expect(refreshedRoute1.routeToIPObjs).length(0);
            expect(refreshedroute2.gatewayId).to.eq(gateway.id);
        });
    });

    describe('moveInterface', () => {
        let route1: Route;
        let route2: Route;
        
        beforeEach(async () => {
            route1 = await service.create({
                gatewayId: gateway.id,
                routingTableId: fwcProduct.routingTable.id,
                interfaceId: fwcProduct.interfaces.get('firewall-interface1').id
            });

            route2 = await service.create({
                routingTableId: fwcProduct.routingTable.id,
                gatewayId: gateway.id
            });
        });

        it('should move interface', async () => {
            await service.moveInterface(route1.id, route2.id, {
                fromId: route1.id,
                toId: route2.id,
                interfaceId: fwcProduct.interfaces.get('firewall-interface1').id
            });

            const refreshedRoute1: Route = await getRepository(Route).findOne(route1.id);
            const refreshedroute2: Route = await getRepository(Route).findOne(route2.id);

            expect(refreshedRoute1.interfaceId).to.be.null;
            expect(refreshedroute2.interfaceId).to.eq(fwcProduct.interfaces.get('firewall-interface1').id);
        });
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

        it('should reset firewall compiled flag', async () => {
            await getRepository(Firewall).update(firewall.id, {
                status: 1
            });
            await firewall.reload();

            await service.remove({
                id: route.id
            });

            await firewall.reload();

            expect(firewall.status).to.eq(3);
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

        it('should reset firewall compiled flag', async () => {
            await getRepository(Firewall).update(firewall.id, {
                status: 1
            });
            await firewall.reload();

            await service.bulkRemove([route.id]);

            await firewall.reload();

            expect(firewall.status).to.eq(3);
        });
    })
})