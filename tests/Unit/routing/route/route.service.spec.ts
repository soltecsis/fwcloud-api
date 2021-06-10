import { getRepository } from "typeorm";
import db from "../../../../src/database/database-manager";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
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

describe(RouteService.name, () => {
    let service: RouteService;

    let fwCloud: FwCloud;
    let firewall: Firewall;
    let table: RoutingTable;
    let gateway: IPObj;
    let route: Route;

    beforeEach(async () => {
        await testSuite.resetDatabaseData();

        service = await testSuite.app.getService<RouteService>(RouteService.name);

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

        table = await getRepository(RoutingTable).save({
            firewallId: firewall.id,
            number: 1,
            name: 'name',
        });

        route = await service.create({
            routingTableId: table.id,
            gatewayId: gateway.id
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
                    (await getRepository(Route).findOne(route.id, {relations: ['ipObjs']})).ipObjs.map(item => item.id)
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
                    (await getRepository(Route).findOne(route.id, {relations: ['ipObjs']})).ipObjs.map(item => item.id)
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
                    (await getRepository(Route).findOne(route.id, {relations: ['ipObjs']})).ipObjs.map(item => item.id)
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

                await IPObjToIPObjGroup.insertIpobj__ipobjg({
                    dbCon: db.getQuery(),
                    body: {
                        ipobj: gateway.id,
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
                        ipobj: gateway.id,
                        ipobj_g: group2.id
                    }
                });
            })
            it('should attach ipObjGroups', async () => {
                await service.update(route.id, {
                    ipObjGroupIds: [group1.id, group2.id]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['ipObjGroups']})).ipObjGroups.map(item => item.id)
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
                    (await getRepository(Route).findOne(route.id, {relations: ['ipObjGroups']})).ipObjGroups.map(item => item.id)
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
                    (await getRepository(Route).findOne(route.id, {relations: ['ipObjGroups']})).ipObjGroups.map(item => item.id)
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
                await service.update(route.id, {
                    openVPNIds: [openVPN1.id, openVPN2.id]
                });

                expect(
                    (await getRepository(Route).findOne(route.id, {relations: ['openVPNs']})).openVPNs.map(item => item.id)
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
                    (await getRepository(Route).findOne(route.id, {relations: ['openVPNs']})).openVPNs.map(item => item.id)
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
                    (await getRepository(Route).findOne(route.id, {relations: ['openVPNs']})).openVPNs.map(item => item.id)
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
                    (await getRepository(Route).findOne(route.id, {relations: ['openVPNPrefixes']})).openVPNPrefixes.map(item => item.id)
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
                    (await getRepository(Route).findOne(route.id, {relations: ['openVPNPrefixes']})).openVPNPrefixes.map(item => item.id)
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
                    (await getRepository(Route).findOne(route.id, {relations: ['openVPNPrefixes']})).openVPNPrefixes.map(item => item.id)
                ).to.deep.eq([])
            })
        });
    })
})