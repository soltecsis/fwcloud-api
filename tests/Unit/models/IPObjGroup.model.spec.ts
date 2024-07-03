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

import { EntityManager } from 'typeorm';
import db from '../../../src/database/database-manager';
import { Interface } from '../../../src/models/interface/Interface';
import { InterfaceIPObj } from '../../../src/models/interface/InterfaceIPObj';
import { IPObj } from '../../../src/models/ipobj/IPObj';
import { IPObjGroup } from '../../../src/models/ipobj/IPObjGroup';
import { IPObjToIPObjGroup } from '../../../src/models/ipobj/IPObjToIPObjGroup';
import { Route } from '../../../src/models/routing/route/route.model';
import { RouteService } from '../../../src/models/routing/route/route.service';
import { RoutingRule } from '../../../src/models/routing/routing-rule/routing-rule.model';
import { RoutingRuleService } from '../../../src/models/routing/routing-rule/routing-rule.service';
import { expect, testSuite } from '../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../utils/fwcloud-factory';

describe(IPObjGroup.name, () => {
  let fwcloudProduct: FwCloudProduct;
  let route: Route;
  let ipobjGroup: IPObjGroup;
  let routingRule: RoutingRule;

  let routeService: RouteService;
  let routingRuleService: RoutingRuleService;
  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    fwcloudProduct = await new FwCloudFactory().make();
    routeService = await testSuite.app.getService<RouteService>(
      RouteService.name,
    );
    routingRuleService = await testSuite.app.getService<RoutingRuleService>(
      RoutingRuleService.name,
    );
    const _interface: Interface = await manager.getRepository(Interface).save(
      manager.getRepository(Interface).create({
        name: 'eth1',
        type: '11',
        interface_type: '11',
      }),
    );

    const host = await manager.getRepository(IPObj).save(
      manager.getRepository(IPObj).create({
        name: 'test',
        address: '0.0.0.0',
        ipObjTypeId: 8,
        interfaceId: _interface.id,
      }),
    );

    await manager.getRepository(InterfaceIPObj).save(
      manager.getRepository(InterfaceIPObj).create({
        interfaceId: _interface.id,
        ipObjId: host.id,
        interface_order: '1',
      }),
    );

    ipobjGroup = await manager.getRepository(IPObjGroup).save(
      manager.getRepository(IPObjGroup).create({
        name: 'ipobjs group',
        type: 20,
        fwCloudId: fwcloudProduct.fwcloud.id,
      }),
    );

    await IPObjToIPObjGroup.insertIpobj__ipobjg({
      dbCon: db.getQuery(),
      body: {
        ipobj: host.id,
        ipobj_g: ipobjGroup.id,
      },
    });

    route = await routeService.create({
      routingTableId: fwcloudProduct.routingTable.id,
      gatewayId: fwcloudProduct.ipobjs.get('gateway').id,
    });

    route = await routeService.update(route.id, {
      ipObjGroupIds: [{ id: ipobjGroup.id, order: 1 }],
    });

    routingRule = await routingRuleService.create({
      routingTableId: fwcloudProduct.routingTable.id,
      ipObjGroupIds: [{ id: ipobjGroup.id, order: 1 }],
    });
  });

  describe('searchGroupUsage', () => {
    describe('route', () => {
      it('should detect usages', async () => {
        const whereUsed: any = await IPObjGroup.searchGroupUsage(
          ipobjGroup.id,
          fwcloudProduct.fwcloud.id,
        );

        expect(whereUsed.restrictions.GroupInRoute).to.have.length(1);
        expect(whereUsed.restrictions.GroupInRoute[0].route_id).to.be.eq(
          route.id,
        );
      });
    });

    describe('routingRule', () => {
      it('should detect usages', async () => {
        const whereUsed: any = await IPObjGroup.searchGroupUsage(
          ipobjGroup.id,
          fwcloudProduct.fwcloud.id,
        );

        expect(whereUsed.restrictions.GroupInRoutingRule).to.have.length(1);
        expect(
          whereUsed.restrictions.GroupInRoutingRule[0].routing_rule_id,
        ).to.be.eq(routingRule.id);
      });
    });
  });
});
