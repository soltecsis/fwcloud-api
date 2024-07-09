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
import { Mark } from '../../../src/models/ipobj/Mark';
import { RouteService } from '../../../src/models/routing/route/route.service';
import { RoutingRule } from '../../../src/models/routing/routing-rule/routing-rule.model';
import { RoutingRuleService } from '../../../src/models/routing/routing-rule/routing-rule.service';
import { expect, testSuite } from '../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../utils/fwcloud-factory';

describe(Mark.name, () => {
  let fwcloudProduct: FwCloudProduct;
  let routingRule: RoutingRule;
  let mark: Mark;

  let routingRuleService: RoutingRuleService;
  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    fwcloudProduct = await new FwCloudFactory().make();
    await testSuite.app.getService<RouteService>(RouteService.name);
    routingRuleService = await testSuite.app.getService<RoutingRuleService>(
      RoutingRuleService.name,
    );
    mark = await manager.getRepository(Mark).save(
      manager.getRepository(Mark).create({
        code: 1,
        name: 'mark',
        fwCloudId: fwcloudProduct.fwcloud.id,
      }),
    );

    routingRule = await routingRuleService.create({
      routingTableId: fwcloudProduct.routingTable.id,
      markIds: [{ id: mark.id, order: 1 }],
    });
  });

  describe('searchMarkUsage', () => {
    describe('routingRule', () => {
      it('should detect usages', async () => {
        const whereUsed: any = await Mark.searchMarkUsage(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          mark.id,
        );

        expect(whereUsed.restrictions.MarkInRoutingRule).to.have.length(1);
        expect(whereUsed.restrictions.MarkInRoutingRule[0].routing_rule_id).to.be.eq(
          routingRule.id,
        );
      });
    });
  });
});
