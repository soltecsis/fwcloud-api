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
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { IPObjGroup } from "../../../../src/models/ipobj/IPObjGroup";
import { Route } from "../../../../src/models/routing/route/route.model";
import { RouteService } from "../../../../src/models/routing/route/route.service";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import { RoutingTableService, AvailableDestinations, RouteItemDataForCompiler } from "../../../../src/models/routing/routing-table/routing-table.service";
import { OpenVPN } from "../../../../src/models/vpn/openvpn/OpenVPN";
import { OpenVPNPrefix } from "../../../../src/models/vpn/openvpn/OpenVPNPrefix";
import { Ca } from "../../../../src/models/vpn/pki/Ca";
import { Crt } from "../../../../src/models/vpn/pki/Crt";
import StringHelper from "../../../../src/utils/string.helper";
import { expect, testSuite } from "../../../mocha/global-setup";

describe.only('Routing table data fetch for compiler or grid', () => {
    let routeService: RouteService;
    let routingTableService: RoutingTableService;
    let compilerItem: RouteItemDataForCompiler;

    let fwCloud: FwCloud;
    let firewall: Firewall;
    let table: RoutingTable;
    let gateway: IPObj;
    let route1: Route;
    let route2: Route;
    let address: IPObj;
    let addressRange: IPObj;
    let network: IPObj;
    let host: IPObj;
    let dst: AvailableDestinations;

    before(async () => {
        const ipobjRepository = getRepository(IPObj);
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
            ipObjIds: [address.id, addressRange.id, network.id, host.id]
        });
    });

    describe('For compiler', () => {
        beforeEach(() => {
            dst = 'compiler';
            compilerItem = { 
                route_id: route1.id, 
                type: 0, 
                address: null, 
                netmask: null, 
                range_start: null, 
                range_end: null
            }
        });

        it('should include address data', async () => {
            const routes = await routingTableService.getRoutingTableData<RouteItemDataForCompiler>(dst,fwCloud.id,firewall.id,table.id);            
            compilerItem.type = 5; compilerItem.address = '10.20.30.40';
            expect(routes[0].items).to.deep.include(compilerItem);
        });

        it('should include address range data', async () => {
            const routes = await routingTableService.getRoutingTableData<RouteItemDataForCompiler>(dst,fwCloud.id,firewall.id,table.id);            
            compilerItem.type = 6; compilerItem.range_start = '10.10.10.50'; compilerItem.range_end = '10.10.10.80';
            expect(routes[0].items).to.deep.include(compilerItem);
        });

        it('should include lan data', async () => {
            const routes = await routingTableService.getRoutingTableData<RouteItemDataForCompiler>(dst,fwCloud.id,firewall.id,table.id);            
            compilerItem.type = 7; compilerItem.address = '10.20.30.0'; compilerItem.netmask = '/24';
            expect(routes[0].items).to.deep.include(compilerItem);
        });

        it('should include host data', async () => {
            const routes = await routingTableService.getRoutingTableData<RouteItemDataForCompiler>(dst,fwCloud.id,firewall.id,table.id);            
            compilerItem.type = 8;
            expect(routes[0].items).to.deep.include(compilerItem);
        });
    })
})