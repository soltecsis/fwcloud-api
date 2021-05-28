/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { before } from "mocha";
import { getRepository } from "typeorm";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { Interface } from "../../../../src/models/interface/Interface";
import { InterfaceIPObj } from "../../../../src/models/interface/InterfaceIPObj";
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { IPObjGroup } from "../../../../src/models/ipobj/IPObjGroup";
import { IPObjToIPObjGroup } from "../../../../src/models/ipobj/IPObjToIPObjGroup";
import { Route } from "../../../../src/models/routing/route/route.model";
import { RouteService } from "../../../../src/models/routing/route/route.service";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import { RoutingTableService, AvailableDestinations, RouteItemDataForCompiler, RouteItemDataForGrid, RouteData } from "../../../../src/models/routing/routing-table/routing-table.service";
import { OpenVPN } from "../../../../src/models/vpn/openvpn/OpenVPN";
import { OpenVPNOption } from "../../../../src/models/vpn/openvpn/openvpn-option.model";
import { OpenVPNPrefix } from "../../../../src/models/vpn/openvpn/OpenVPNPrefix";
import { Ca } from "../../../../src/models/vpn/pki/Ca";
import { Crt } from "../../../../src/models/vpn/pki/Crt";
import StringHelper from "../../../../src/utils/string.helper";
import { expect, testSuite } from "../../../mocha/global-setup";

describe('Routing table data fetch for compiler or grid', () => {
    let routeService: RouteService;
    let routingTableService: RoutingTableService;

    let fwCloud: FwCloud;
    let firewall: Firewall;
    let interface1: Interface;
    let interface2: Interface;
    let interface3: Interface;
    let group: IPObjGroup;
    let ca: Ca;
    let crtServer: Crt;
    let crtCli1: Crt;
    let crtCli2: Crt;
    let crtCli3: Crt;
    let openvpnServer: OpenVPN;
    let openvpnCli1: OpenVPN;
    let openvpnCli2: OpenVPN;
    let openvpnCli3: OpenVPN;
    let openvpnCli1_addr: IPObj;
    let openvpnCli2_addr: IPObj;
    let openvpnCli3_addr: IPObj;
    let openvpnPrefix: OpenVPNPrefix;
    let table: RoutingTable;
    let gateway: IPObj;
    let route1: Route;
    let route2: Route;
    let address: IPObj;
    let addressRange: IPObj;
    let network: IPObj;
    let host: IPObj;
    let routes: RouteData<RouteItemDataForCompiler>[] | RouteData<RouteItemDataForGrid>[];
    let items: RouteItemDataForCompiler[] | RouteItemDataForGrid[];

    before(async () => {
        const ipobjRepository = getRepository(IPObj);
        const interfaceRepository = getRepository(Interface);
        const interfaceIPObjRepository = getRepository(InterfaceIPObj);
        const ipobjToGroupRepository = getRepository(IPObjToIPObjGroup);
        const caRepository= getRepository(Ca);
        const crtRepository = getRepository(Crt);
        const openvpnRepository = getRepository(OpenVPN);
        const openvpnOptRepository = getRepository(OpenVPNOption);

        await testSuite.resetDatabaseData();

        routeService = await testSuite.app.getService<RouteService>(RouteService.name);
        routingTableService = await testSuite.app.getService<RoutingTableService>(RoutingTableService.name);

        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
            name: StringHelper.randomize(10)
        }));

        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwCloud.id
        }));


        group = await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({
            name: 'ipobjs group',
            type: 20,
            fwCloudId: fwCloud.id
        }));


        gateway = await ipobjRepository.save(ipobjRepository.create({
            name: 'gateway',
            address: '1.2.3.4',
            ipObjTypeId: 5,
            interfaceId: null
        }));

        address = await ipobjRepository.save(ipobjRepository.create({
            name: 'address',
            address: '10.20.30.40',
            ipObjTypeId: 5,
            interfaceId: null
        }));

        addressRange = await ipobjRepository.save(ipobjRepository.create({
            name: 'addressRange',
            range_start: '10.10.10.50',
            range_end: '10.10.10.80',
            ipObjTypeId: 6,
            interfaceId: null
        }));

        network = await ipobjRepository.save(ipobjRepository.create({
            name: 'network',
            address: '10.20.30.0',
            netmask: '/24',
            ipObjTypeId: 7,
            interfaceId: null
        }));

        host = await ipobjRepository.save(ipobjRepository.create({
            name: 'host',
            ipObjTypeId: 8,
            interfaceId: null
        }));

        interface1 = await interfaceRepository.save(interfaceRepository.create({
            name: 'eth1',
            type: '11',
            interface_type: '11'
        }));

        interface2 = await interfaceRepository.save(interfaceRepository.create({
            name: 'eth2',
            type: '11',
            interface_type: '11'
        }));

        interface3 = await interfaceRepository.save(interfaceRepository.create({
            name: 'eth3',
            type: '11',
            interface_type: '11'
        }));

        await interfaceIPObjRepository.save(interfaceIPObjRepository.create({
            interfaceId: interface1.id,
            ipObjId: host.id,
            interface_order: '1'
        }));

        await interfaceIPObjRepository.save(interfaceIPObjRepository.create({
            interfaceId: interface2.id,
            ipObjId: host.id,
            interface_order: '2'
        }));

        await interfaceIPObjRepository.save(interfaceIPObjRepository.create({
            interfaceId: interface3.id,
            ipObjId: host.id,
            interface_order: '3'
        }));

        await ipobjRepository.save(ipobjRepository.create({
            name: 'host-eth2-addr1',
            address: '192.168.10.1',
            ipObjTypeId: 5,
            interfaceId: interface2.id
        }));

        ipobjRepository.save(ipobjRepository.create({
            name: 'host-eth3-addr1',
            address: '172.26.20.5',
            ipObjTypeId: 5,
            interfaceId: interface3.id
        }));

        await ipobjRepository.save(ipobjRepository.create({
            name: 'host-eth3-addr2',
            address: '172.26.20.6',
            ipObjTypeId: 5,
            interfaceId: interface3.id
        }));

        ca = await caRepository.save(caRepository.create({
            fwCloudId: fwCloud.id,
            cn: 'CA',
            days: 1000
        }));

        crtServer = await crtRepository.save(crtRepository.create({
            caId: ca.id,
            cn: 'OpenVPN-Server',
            days: 1000,
            type: 2
        }));

        crtCli1 = await crtRepository.save(crtRepository.create({
            caId: ca.id,
            cn: 'OpenVPN-Cli-1',
            days: 1000,
            type: 1
        }));
        crtCli2 = await crtRepository.save(crtRepository.create({
            caId: ca.id,
            cn: 'OpenVPN-Cli-2',
            days: 1000,
            type: 1
        }));
        crtCli3 = await crtRepository.save(crtRepository.create({
            caId: ca.id,
            cn: 'Other-OpenVPN-Client',
            days: 1000,
            type: 1
        }));

        openvpnServer = await openvpnRepository.save(openvpnRepository.create({
            parentId: null,
            firewallId: firewall.id,
            crtId: crtServer.id
        }));

        openvpnCli1 = await openvpnRepository.save(openvpnRepository.create({
            parentId: openvpnServer.id,
            firewallId: firewall.id,
            crtId: crtCli1.id
        }));
        openvpnCli2 = await openvpnRepository.save(openvpnRepository.create({
            parentId: openvpnServer.id,
            firewallId: firewall.id,
            crtId: crtCli2.id
        }));
        openvpnCli3 = await openvpnRepository.save(openvpnRepository.create({
            parentId: openvpnServer.id,
            firewallId: firewall.id,
            crtId: crtCli3.id,
            ipObjGroups: [group]
        }));

        openvpnCli1_addr = await ipobjRepository.save(ipobjRepository.create({
            name: 'OpenVPN Cli1 address',
            address: '10.200.47.5',
            ipObjTypeId: 5,
            interfaceId: null
        }));
        openvpnCli2_addr = await ipobjRepository.save(ipobjRepository.create({
            name: 'OpenVPN Cli2 address',
            address: '10.200.47.62',
            ipObjTypeId: 5,
            interfaceId: null
        }));
        openvpnCli3_addr = await ipobjRepository.save(ipobjRepository.create({
            name: 'OpenVPN Cli3 address',
            address: '10.200.201.78',
            ipObjTypeId: 5,
            interfaceId: null
        }));

        await openvpnOptRepository.save(openvpnOptRepository.create({
            openVPNId: openvpnCli1.id,
            ipObjId: openvpnCli1_addr.id,
            name: 'ifconfig-push',
            order: 1,
            scope: 0
        }));
        await openvpnOptRepository.save(openvpnOptRepository.create({
            openVPNId: openvpnCli2.id,
            ipObjId: openvpnCli2_addr.id,
            name: 'ifconfig-push',
            order: 1,
            scope: 0
        }));
        await openvpnOptRepository.save(openvpnOptRepository.create({
            openVPNId: openvpnCli3.id,
            ipObjId: openvpnCli3_addr.id,
            name: 'ifconfig-push',
            order: 1,
            scope: 0
        }));


        openvpnPrefix = await getRepository(OpenVPNPrefix).save(getRepository(OpenVPNPrefix).create({
            openVPNId: openvpnServer.id,
            name: 'OpenVPN-Cli-',
            ipObjGroups: [group]
        }));


        await ipobjToGroupRepository.save(ipobjToGroupRepository.create({
            ipObjGroupId: group.id,
            ipObjId: address.id
        }));
        await ipobjToGroupRepository.save(ipobjToGroupRepository.create({
            ipObjGroupId: group.id,
            ipObjId: addressRange.id
        }));
        await ipobjToGroupRepository.save(ipobjToGroupRepository.create({
            ipObjGroupId: group.id,
            ipObjId: network.id
        }));
        await ipobjToGroupRepository.save(ipobjToGroupRepository.create({
            ipObjGroupId: group.id,
            ipObjId: host.id
        }));


        table = await getRepository(RoutingTable).save({
            firewallId: firewall.id,
            number: 1,
            name: 'Routing table',
        });

        route1 = await routeService.create({
            routingTableId: table.id,
            gatewayId: gateway.id
        });

        route2 = await routeService.create({
            routingTableId: table.id,
            gatewayId: gateway.id
        });

        await routeService.update(route1.id, {
            ipObjIds: [address.id, addressRange.id, network.id, host.id],
            openVPNIds: [openvpnCli3.id],
            openVPNPrefixIds: [openvpnPrefix.id]
        });
        await routeService.update(route2.id, {
            ipObjGroupIds: [group.id]
        });
    });

    describe('For compiler', () => {
        let item: RouteItemDataForCompiler;

        before( async () => {
            routes = await routingTableService.getRoutingTableData<RouteItemDataForCompiler>('compiler',fwCloud.id,firewall.id,table.id);            
        });

        describe('Out of group', () => {
            beforeEach(() => {
                items = routes[0].items;
                item = { 
                    route_id: route1.id, 
                    type: 0, 
                    address: null, 
                    netmask: null, 
                    range_start: null, 
                    range_end: null
                }
            });

            it('should include address data', () => {
                item.type = 5; item.address = '10.20.30.40';
                expect(items).to.deep.include(item);
            });

            it('should include address range data', () => {
                item.type = 6; item.range_start = '10.10.10.50'; item.range_end = '10.10.10.80';
                expect(items).to.deep.include(item);
            });

            it('should include lan data', () => {
                item.type = 7; item.address = '10.20.30.0'; item.netmask = '/24';
                expect(items).to.deep.include(item);
            });

            it('should include host data', () => {
                item.type = 5; item.address = '192.168.10.1';
                expect(items).to.deep.include(item);
                item.address = '172.26.20.5';
                expect(items).to.deep.include(item);
                item.address = '172.26.20.6';
                expect(items).to.deep.include(item);
            });

            it('should include OpenVPN data', () => {
                item.type = 5; item.address = '10.200.201.78';
                expect(items).to.deep.include(item);
            });

            it('should include OpenVPN Prefix data', () => {
                item.type = 5; item.address = '10.200.47.5';
                expect(items).to.deep.include(item);
                item.address = '10.200.47.62';
                expect(items).to.deep.include(item);
            });
        })

        describe('Into group', () => {
            beforeEach(() => {
                items = routes[1].items; // This route has the group of objects.
                item = { 
                    route_id: route2.id, 
                    type: 0, 
                    address: null, 
                    netmask: null, 
                    range_start: null, 
                    range_end: null
                }
            });

            it('should include address data', () => {
                item.type = 5; item.address = '10.20.30.40';
                expect(items).to.deep.include(item);
            });

            it('should include address range data', () => {
                item.type = 6; item.range_start = '10.10.10.50'; item.range_end = '10.10.10.80';
                expect(items).to.deep.include(item);
            });

            it('should include lan data', () => {
                item.type = 7; item.address = '10.20.30.0'; item.netmask = '/24';
                expect(items).to.deep.include(item);
            });

            it('should include host data', () => {
                item.type = 5; item.address = '192.168.10.1';
                expect(items).to.deep.include(item);
                item.address = '172.26.20.5';
                expect(items).to.deep.include(item);
                item.address = '172.26.20.6';
                expect(items).to.deep.include(item);
            });

            it('should include OpenVPN data', () => {
                item.type = 5; item.address = '10.200.201.78';
                expect(items).to.deep.include(item);
            });

            it('should include OpenVPN Prefix data', () => {
                item.type = 5; item.address = '10.200.47.5';
                expect(items).to.deep.include(item);
                item.address = '10.200.47.62';
                expect(items).to.deep.include(item);
            });
        })
    })

    describe('For grid', () => {
        let item: RouteItemDataForGrid;

        before( async () => {
            routes = await routingTableService.getRoutingTableData<RouteItemDataForGrid>('grid',fwCloud.id,firewall.id,table.id);            
        });

        describe('Out of group', () => {
            beforeEach(() => {
                items = routes[0].items;
                item = { 
                    route_id: route1.id,
                    id: 0,
                    name: null,
                    type: 0,
                    firewall_id: firewall.id,
                    firewall_name: firewall.name,
                    cluster_id: null,
                    cluster_name: null
                };
            });

            it('should include address data', () => {
                item.id = address.id; item.type = 5; item.name = address.name;
                expect(items).to.deep.include(item);
            });

            it('should include address range data', () => {
                item.id = addressRange.id; item.type = 6; item.name = addressRange.name;
                expect(items).to.deep.include(item);
            });

            it('should include lan data', () => {
                item.id = network.id; item.type = 7; item.name = network.name;
                expect(items).to.deep.include(item);
            });

            it('should include host data', () => {
                item.id = host.id; item.type = 8; item.name = host.name;
                expect(items).to.deep.include(item);
            });

            it('should include OpenVPN data', () => {
                item.id = openvpnCli3.id; item.type = 311; item.name = crtCli3.cn;
                expect(items).to.deep.include(item);
            });

            it('should include OpenVPN Prefix data', () => {
                item.id = openvpnPrefix.id; item.type = 401; item.name = openvpnPrefix.name;
                expect(items).to.deep.include(item);
            });
        })

        describe('Into group', () => {
            beforeEach(() => {
                items = routes[1].items; // This route has the group of objects.
                item = { 
                    route_id: route2.id,
                    id: 0,
                    name: null,
                    type: 0,
                    firewall_id: firewall.id,
                    firewall_name: firewall.name,
                    cluster_id: null,
                    cluster_name: null
                };
            });

            it('should include group', () => {
                item.id = group.id; item.type = 20; item.name = group.name;
                expect(items).to.deep.include(item);
            });
        })
    })
})