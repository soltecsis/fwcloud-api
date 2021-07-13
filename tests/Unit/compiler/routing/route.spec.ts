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
import { RoutingCompiled, RoutingCompiler } from "../../../../src/compiler/routing/RoutingCompiler";
import { RouteService } from "../../../../src/models/routing/route/route.service";
import { RoutingTableService, RouteData } from "../../../../src/models/routing/routing-table/routing-table.service";
import { RouteItemForCompiler } from "../../../../src/models/routing/shared";
import { expect, testSuite } from "../../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../../utils/fwcloud-factory";
import ip from 'ip';

describe('Routing route compiler', () => {
    let routeService: RouteService;
    let routingTableService: RoutingTableService;
    let fwc: FwCloudProduct;

    let routes: RouteData<RouteItemForCompiler>[];

    let compiler: RoutingCompiler = new RoutingCompiler;
    let compilation: RoutingCompiled[];
    let gw: string;
    let dev: string;
    let rtn: number; // Routing table number.

    let cs: string;
    const head = '$IP route add';
    let tail: string;

    before(async () => {
      await testSuite.resetDatabaseData();

      routeService = await testSuite.app.getService<RouteService>(RouteService.name);
      routingTableService = await testSuite.app.getService<RoutingTableService>(RoutingTableService.name);

      fwc = await (new FwCloudFactory()).make();
      gw = fwc.ipobjs.get('gateway').address;
      dev = fwc.interfaces.get('firewall-interface1').name;
      rtn = fwc.routingTable.number;

      await routeService.update(fwc.routes.get('route1').id, {
          ipObjIds: [fwc.ipobjs.get('address').id, 
                     fwc.ipobjs.get('addressRange').id, 
                     fwc.ipobjs.get('network').id, 
                     fwc.ipobjs.get('networkNoCIDR').id, 
                     fwc.ipobjs.get('host').id],
          openVPNIds: [fwc.openvpnClients.get('OpenVPN-Cli-3').id],
          openVPNPrefixIds: [fwc.openvpnPrefix.id]
      });

      await routeService.update(fwc.routes.get('route2').id, {
          ipObjGroupIds: [fwc.ipobjGroup.id]
      });

      routes = await routingTableService.getRoutingTableData<RouteItemForCompiler>('compiler',fwc.fwcloud.id, fwc.firewall.id, fwc.routingTable.id);            
      compilation = compiler.compile('Route',routes);
    });

    describe('Compilation of route with objects', () => {
        before(() => { 
            cs = compilation[0].cs;
            tail = `via ${gw} dev ${dev} table ${rtn}\n`; // The first route has interface.
        });

        it('should include address data', () => {
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('address').address} ${tail}`);
        });

        it('should include network data', () => {
            const net = ip.subnet(fwc.ipobjs.get('networkNoCIDR').address, fwc.ipobjs.get('networkNoCIDR').netmask);
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('network').address}${fwc.ipobjs.get('network').netmask} ${tail}`);
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('networkNoCIDR').address}/${net.subnetMaskLength} ${tail}`);
        });

        it('should include address range data', () => {
            const firstLong = ip.toLong(fwc.ipobjs.get('addressRange').range_start);
            const lastLong = ip.toLong(fwc.ipobjs.get('addressRange').range_end);
            for(let current=firstLong; current<=lastLong; current++)
                expect(cs).to.deep.include(`${head} ${ip.fromLong(current)} ${tail}`);
        });

        it('should include host data', () => {
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth2-addr1').address} ${tail}`);
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth3-addr1').address} ${tail}`);
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth3-addr2').address} ${tail}`);
        });

        it('should include OpenVPN data', () => {
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli1-addr').address} ${tail}`);
        });

        it('should include OpenVPN prefix data', () => {
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli1-addr').address} ${tail}`);
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli2-addr').address} ${tail}`);
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli3-addr').address} ${tail}`);
        });
    });


    describe('Compilation of route with objects group', () => {
        before(() => { 
            cs = compilation[1].cs;
            tail = `via ${gw} table ${rtn}\n`; // The second route has no interface.
        });

        it('should include address data', () => {
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('address').address} ${tail}`);
        });

        it('should include network data', () => {
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('network').address}${fwc.ipobjs.get('network').netmask} ${tail}`);
        });

        it('should include address range data', () => {
            const firstLong = ip.toLong(fwc.ipobjs.get('addressRange').range_start);
            const lastLong = ip.toLong(fwc.ipobjs.get('addressRange').range_end);
            for(let current=firstLong; current<=lastLong; current++)
                expect(cs).to.deep.include(`${head} ${ip.fromLong(current)} ${tail}`);
        });

        it('should include host data', () => {
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth2-addr1').address} ${tail}`);
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth3-addr1').address} ${tail}`);
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth3-addr2').address} ${tail}`);
        });

        it('should include OpenVPN data', () => {
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli1-addr').address} ${tail}`);
        });

        it('should include OpenVPN prefix data', () => {
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli1-addr').address} ${tail}`);
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli2-addr').address} ${tail}`);
            expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli3-addr').address} ${tail}`);
        });
    });
})
