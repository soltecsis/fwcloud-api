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
import { ItemForGrid, RouteItemForCompiler } from "../../../../src/models/routing/shared";
import { expect, testSuite } from "../../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../../utils/fwcloud-factory";

describe.only('Routing route compiler', () => {
    let routeService: RouteService;
    let routingTableService: RoutingTableService;
    let fwc: FwCloudProduct;

    let routes: RouteData<RouteItemForCompiler>[];
    let items: RouteItemForCompiler[];
    let item: RouteItemForCompiler;

    let compiler: RoutingCompiler = new RoutingCompiler;

    before(async () => {
      await testSuite.resetDatabaseData();

      routeService = await testSuite.app.getService<RouteService>(RouteService.name);
      routingTableService = await testSuite.app.getService<RoutingTableService>(RoutingTableService.name);

      fwc = await (new FwCloudFactory()).make();

      await routeService.update(fwc.routes.get('route1').id, {
          ipObjIds: [fwc.ipobjs.get('address').id, fwc.ipobjs.get('addressRange').id, fwc.ipobjs.get('network').id, fwc.ipobjs.get('host').id],
          openVPNIds: [fwc.openvpnClients.get('OpenVPN-Cli-3').id],
          openVPNPrefixIds: [fwc.openvpnPrefix.id]
      });
      await routeService.update(fwc.routes.get('route2').id, {
          ipObjGroupIds: [fwc.ipobjGroup.id]
      });

      routes = await routingTableService.getRoutingTableData<RouteItemForCompiler>('compiler',fwc.fwcloud.id,fwc.firewall.id,fwc.routingTable.id);            
      let compilation: RoutingCompiled[] = await compiler.compile('Route',routes);
    });

    it('should compile address data', () => {
        expect(items).to.deep.include(fwc.ipobjs.get('address').address);
    });
})
