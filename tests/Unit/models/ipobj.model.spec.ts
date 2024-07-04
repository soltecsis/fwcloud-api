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
import { IPObj } from '../../../src/models/ipobj/IPObj';
import { expect } from '../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../utils/fwcloud-factory';

describe(IPObj.name, () => {
  let fwcloudProduct: FwCloudProduct;
  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    fwcloudProduct = await new FwCloudFactory().make();
  });

  describe('searchIpobjUsage', () => {
    describe('route', () => {
      it('should detect address usages', async () => {
        const whereUsed: any = await IPObj.searchIpobjUsage(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          fwcloudProduct.ipobjs.get('address').id,
          5,
        );
        expect(whereUsed.restrictions.IpobjInRoute.map((route) => route.route_id)).to.contains(
          fwcloudProduct.routes.get('route1').id,
        );
      });

      it('should detect address range usages', async () => {
        const whereUsed: any = await IPObj.searchIpobjUsage(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          fwcloudProduct.ipobjs.get('addressRange').id,
          5,
        );
        expect(whereUsed.restrictions.IpobjInRoute.map((route) => route.route_id)).to.contains(
          fwcloudProduct.routes.get('route1').id,
        );
      });

      it('should detect network in CIDR notation usages', async () => {
        const whereUsed: any = await IPObj.searchIpobjUsage(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          fwcloudProduct.ipobjs.get('network').id,
          5,
        );
        expect(whereUsed.restrictions.IpobjInRoute.map((route) => route.route_id)).to.contains(
          fwcloudProduct.routes.get('route1').id,
        );
      });

      it('should detect network not in CIDR notation usages', async () => {
        const whereUsed: any = await IPObj.searchIpobjUsage(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          fwcloudProduct.ipobjs.get('networkNoCIDR').id,
          5,
        );
        expect(whereUsed.restrictions.IpobjInRoute.map((route) => route.route_id)).to.contains(
          fwcloudProduct.routes.get('route1').id,
        );
      });

      it('should detect host usages', async () => {
        const whereUsed: any = await IPObj.searchIpobjUsage(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          fwcloudProduct.ipobjs.get('host').id,
          5,
        );
        expect(whereUsed.restrictions.IpobjInRoute.map((route) => route.route_id)).to.contains(
          fwcloudProduct.routes.get('route1').id,
        );
      });

      it('should detect last addr in host in route', async () => {
        await manager
          .getRepository(IPObj)
          .delete({ id: fwcloudProduct.ipobjs.get('host-eth3-addr1').id });
        await manager
          .getRepository(IPObj)
          .delete({ id: fwcloudProduct.ipobjs.get('host-eth3-addr2').id });
        const whereUsed: any = await IPObj.searchIpobjUsage(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          fwcloudProduct.ipobjs.get('host-eth2-addr1').id,
          5,
        );
        expect(whereUsed.restrictions.LastAddrInHostInRoute).to.have.length(2);
      });
    });

    describe('routingRule', () => {
      it('should detect usages', async () => {
        const whereUsed: any = await IPObj.searchIpobjUsage(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          fwcloudProduct.ipobjs.get('address').id,
          5,
        );
        expect(
          whereUsed.restrictions.IpobjInRoutingRule.map((rule) => rule.routing_rule_id),
        ).to.contains(fwcloudProduct.routingRules.get('routing-rule-1').id);
      });

      it('should detect address range usages', async () => {
        const whereUsed: any = await IPObj.searchIpobjUsage(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          fwcloudProduct.ipobjs.get('addressRange').id,
          5,
        );
        expect(
          whereUsed.restrictions.IpobjInRoutingRule.map((rule) => rule.routing_rule_id),
        ).to.contains(fwcloudProduct.routingRules.get('routing-rule-1').id);
      });

      it('should detect network in CIDR notation usages', async () => {
        const whereUsed: any = await IPObj.searchIpobjUsage(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          fwcloudProduct.ipobjs.get('network').id,
          5,
        );
        expect(
          whereUsed.restrictions.IpobjInRoutingRule.map((rule) => rule.routing_rule_id),
        ).to.contains(fwcloudProduct.routingRules.get('routing-rule-1').id);
      });

      it('should detect network not in CIDR notation usages', async () => {
        const whereUsed: any = await IPObj.searchIpobjUsage(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          fwcloudProduct.ipobjs.get('networkNoCIDR').id,
          5,
        );
        expect(
          whereUsed.restrictions.IpobjInRoutingRule.map((rule) => rule.routing_rule_id),
        ).to.contains(fwcloudProduct.routingRules.get('routing-rule-1').id);
      });

      it('should detect host usages', async () => {
        const whereUsed: any = await IPObj.searchIpobjUsage(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          fwcloudProduct.ipobjs.get('host').id,
          5,
        );
        expect(
          whereUsed.restrictions.IpobjInRoutingRule.map((rule) => rule.routing_rule_id),
        ).to.contains(fwcloudProduct.routingRules.get('routing-rule-1').id);
      });

      it('should detect should detect last addr in host in routing rule', async () => {
        await manager
          .getRepository(IPObj)
          .delete({ id: fwcloudProduct.ipobjs.get('host-eth3-addr1').id });
        await manager
          .getRepository(IPObj)
          .delete({ id: fwcloudProduct.ipobjs.get('host-eth3-addr2').id });
        const whereUsed: any = await IPObj.searchIpobjUsage(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          fwcloudProduct.ipobjs.get('host-eth2-addr1').id,
          5,
        );
        expect(
          whereUsed.restrictions.LastAddrInHostInRoutingRule.map((rule) => rule.routing_rule_id),
        ).to.contains(fwcloudProduct.routingRules.get('routing-rule-1').id);
      });
    });
  });
});
