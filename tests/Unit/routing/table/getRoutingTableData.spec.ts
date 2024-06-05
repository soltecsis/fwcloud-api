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

import { before } from 'mocha';
import { getRepository } from 'typeorm';
import { RouteToIPObjGroup } from '../../../../src/models/routing/route/route-to-ipobj-group.model';
import { RouteToIPObj } from '../../../../src/models/routing/route/route-to-ipobj.model';
import { RouteToOpenVPNPrefix } from '../../../../src/models/routing/route/route-to-openvpn-prefix.model';
import { RouteToOpenVPN } from '../../../../src/models/routing/route/route-to-openvpn.model';
import { RouteService } from '../../../../src/models/routing/route/route.service';
import {
  RoutingTableService,
  RouteData,
} from '../../../../src/models/routing/routing-table/routing-table.service';
import {
  ItemForGrid,
  RouteItemForCompiler,
} from '../../../../src/models/routing/shared';
import { expect, testSuite } from '../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';

describe('Routing table data fetch for compiler or grid', () => {
  let routeService: RouteService;
  let routingTableService: RoutingTableService;
  let fwc: FwCloudProduct;

  let routes: RouteData<RouteItemForCompiler>[] | RouteData<ItemForGrid>[];
  let items: RouteItemForCompiler[] | ItemForGrid[];

  before(async () => {
    await testSuite.resetDatabaseData();

    fwc = await new FwCloudFactory().make();

    routeService = await testSuite.app.getService<RouteService>(
      RouteService.name,
    );
    routingTableService = await testSuite.app.getService<RoutingTableService>(
      RoutingTableService.name,
    );
  });

  describe('For compiler', () => {
    let item: RouteItemForCompiler;

    before(async () => {
      routes =
        await routingTableService.getRoutingTableData<RouteItemForCompiler>(
          'compiler',
          fwc.fwcloud.id,
          fwc.firewall.id,
          fwc.routingTable.id,
        );
    });

    describe('Out of group', () => {
      beforeEach(() => {
        items = routes[0].items;
        item = {
          entityId: fwc.routes.get('route1').id,
          type: 0,
          address: null,
          netmask: null,
          range_start: null,
          range_end: null,
        };
      });

      it('should include address data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('address').address;
        expect(items).to.deep.include(item);
      });

      it('should include address range data', () => {
        item.type = 6;
        item.range_start = fwc.ipobjs.get('addressRange').range_start;
        item.range_end = fwc.ipobjs.get('addressRange').range_end;
        expect(items).to.deep.include(item);
      });

      it('should include lan data', () => {
        item.type = 7;
        item.address = fwc.ipobjs.get('network').address;
        item.netmask = fwc.ipobjs.get('network').netmask;
        expect(items).to.deep.include(item);
      });

      it('should include host data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('host-eth2-addr1').address;
        expect(items).to.deep.include(item);
        item.address = fwc.ipobjs.get('host-eth3-addr1').address;
        expect(items).to.deep.include(item);
        item.address = fwc.ipobjs.get('host-eth3-addr2').address;
        expect(items).to.deep.include(item);
      });

      it('should include OpenVPN data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('openvpn-cli3-addr').address;
        expect(items).to.deep.include(item);
      });

      it('should include OpenVPN Prefix data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('openvpn-cli1-addr').address;
        expect(items).to.deep.include(item);
        item.address = fwc.ipobjs.get('openvpn-cli2-addr').address;
        expect(items).to.deep.include(item);
      });
    });

    describe('Into group', () => {
      beforeEach(() => {
        items = routes[1].items; // This route has the group of objects.
        item = {
          entityId: fwc.routes.get('route2').id,
          type: 0,
          address: null,
          netmask: null,
          range_start: null,
          range_end: null,
        };
      });

      it('should include address data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('address').address;
        expect(items).to.deep.include(item);
      });

      it('should include address range data', () => {
        item.type = 6;
        item.range_start = fwc.ipobjs.get('addressRange').range_start;
        item.range_end = fwc.ipobjs.get('addressRange').range_end;
        expect(items).to.deep.include(item);
      });

      it('should include lan data', () => {
        item.type = 7;
        item.address = fwc.ipobjs.get('network').address;
        item.netmask = fwc.ipobjs.get('network').netmask;
        expect(items).to.deep.include(item);
      });

      it('should include host data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('host-eth2-addr1').address;
        expect(items).to.deep.include(item);
        item.address = fwc.ipobjs.get('host-eth3-addr1').address;
        expect(items).to.deep.include(item);
        item.address = fwc.ipobjs.get('host-eth3-addr2').address;
        expect(items).to.deep.include(item);
      });

      it('should include OpenVPN data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('openvpn-cli3-addr').address;
        expect(items).to.deep.include(item);
      });

      it('should include OpenVPN Prefix data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('openvpn-cli1-addr').address;
        expect(items).to.deep.include(item);
        item.address = fwc.ipobjs.get('openvpn-cli2-addr').address;
        expect(items).to.deep.include(item);
      });
    });
  });

  describe('For grid', () => {
    let item: ItemForGrid & Partial<{ _order: number }>;

    before(async () => {
      routes = await routingTableService.getRoutingTableData<ItemForGrid>(
        'grid',
        fwc.fwcloud.id,
        fwc.firewall.id,
        fwc.routingTable.id,
      );
    });

    describe('Out of group', async () => {
      beforeEach(() => {
        items = routes[0].items;
        item = {
          entityId: fwc.routes.get('route1').id,
          id: 0,
          name: null,
          type: 0,
          firewall_id: null,
          firewall_name: null,
          cluster_id: null,
          cluster_name: null,
        };
      });

      it('should include address data', async () => {
        item.id = fwc.ipobjs.get('address').id;
        item.type = 5;
        item.name = fwc.ipobjs.get('address').name;
        item.host_id = null;
        item.host_name = null;
        item._order = (
          await getRepository(RouteToIPObj).findOneOrFail({
            where: {
              routeId: fwc.routes.get('route1').id,
              ipObjId: item.id,
            },
          })
        ).order;
        expect(items).to.deep.include(item);
      });

      it('should include address range data', async () => {
        item.id = fwc.ipobjs.get('addressRange').id;
        item.type = 6;
        item.name = fwc.ipobjs.get('addressRange').name;
        item.host_id = null;
        item.host_name = null;
        item._order = (
          await getRepository(RouteToIPObj).findOneOrFail({
            where: {
              routeId: fwc.routes.get('route1').id,
              ipObjId: item.id,
            },
          })
        ).order;
        expect(items).to.deep.include(item);
      });

      it('should include lan data', async () => {
        item.id = fwc.ipobjs.get('network').id;
        item.type = 7;
        item.name = fwc.ipobjs.get('network').name;
        item.host_id = null;
        item.host_name = null;
        item._order = (
          await getRepository(RouteToIPObj).findOneOrFail({
            where: {
              routeId: fwc.routes.get('route1').id,
              ipObjId: item.id,
            },
          })
        ).order;
        expect(items).to.deep.include(item);
      });

      it('should include host data', async () => {
        item.id = fwc.ipobjs.get('host').id;
        item.type = 8;
        item.name = fwc.ipobjs.get('host').name;
        item.host_id = null;
        item.host_name = null;
        item._order = (
          await getRepository(RouteToIPObj).findOneOrFail({
            where: {
              routeId: fwc.routes.get('route1').id,
              ipObjId: item.id,
            },
          })
        ).order;
        expect(items).to.deep.include(item);
      });

      it('should include OpenVPN data', async () => {
        item.id = fwc.openvpnClients.get('OpenVPN-Cli-3').id;
        item.type = 311;
        item.name = fwc.crts.get('OpenVPN-Cli-3').cn;
        item.firewall_id = fwc.firewall.id;
        item.firewall_name = fwc.firewall.name;
        item._order = (
          await getRepository(RouteToOpenVPN).findOneOrFail({
            where: {
              routeId: fwc.routes.get('route1').id,
              openVPNId: item.id,
            },
          })
        ).order;
        expect(items).to.deep.include(item);
      });

      it('should include OpenVPN Prefix data', async () => {
        item.id = fwc.openvpnPrefix.id;
        item.type = 401;
        item.name = fwc.openvpnPrefix.name;
        item.firewall_id = fwc.firewall.id;
        item.firewall_name = fwc.firewall.name;
        item._order = (
          await getRepository(RouteToOpenVPNPrefix).findOneOrFail({
            where: {
              routeId: fwc.routes.get('route1').id,
              openVPNPrefixId: item.id,
            },
          })
        ).order;
        expect(items).to.deep.include(item);
      });
    });

    describe('Into group', () => {
      beforeEach(() => {
        items = routes[1].items; // This route has the group of objects.
        item = {
          entityId: fwc.routes.get('route2').id,
          id: 0,
          name: null,
          type: 0,
          firewall_id: fwc.firewall.id,
          firewall_name: fwc.firewall.name,
          cluster_id: null,
          cluster_name: null,
        };
      });

      it('should include group', async () => {
        item.id = fwc.ipobjGroup.id;
        item.type = 20;
        item.name = fwc.ipobjGroup.name;
        item._order = (
          await getRepository(RouteToIPObjGroup).findOneOrFail({
            where: {
              routeId: fwc.routes.get('route2').id,
              ipObjGroupId: item.id,
            },
          })
        ).order;
        expect(items).to.deep.include(item);
      });
    });
  });

  describe('Get data for only some routes', () => {
    it('should get data for route 2', async () => {
      const ids = [fwc.routes.get('route2').id];
      routes =
        await routingTableService.getRoutingTableData<RouteItemForCompiler>(
          'compiler',
          fwc.fwcloud.id,
          fwc.firewall.id,
          fwc.routingTable.id,
          ids,
        );

      expect(routes.length).to.equal(1);
      expect(routes[0].id).to.equal(ids[0]);
    });

    it('should get data for routes 1 and 3', async () => {
      const ids = [fwc.routes.get('route1').id, fwc.routes.get('route3').id];
      routes =
        await routingTableService.getRoutingTableData<RouteItemForCompiler>(
          'compiler',
          fwc.fwcloud.id,
          fwc.firewall.id,
          fwc.routingTable.id,
          ids,
        );

      expect(routes.length).to.equal(2);
      expect(routes[0].id).to.equal(ids[0]);
      expect(routes[1].id).to.equal(ids[1]);
    });

    it('should get data for routes 2 and 4', async () => {
      const ids = [fwc.routes.get('route2').id, fwc.routes.get('route4').id];
      routes =
        await routingTableService.getRoutingTableData<RouteItemForCompiler>(
          'compiler',
          fwc.fwcloud.id,
          fwc.firewall.id,
          fwc.routingTable.id,
          ids,
        );

      expect(routes.length).to.equal(2);
      expect(routes[0].id).to.equal(ids[0]);
      expect(routes[1].id).to.equal(ids[1]);
    });
  });
});
