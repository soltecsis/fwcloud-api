import { EntityManager } from 'typeorm';
import db from '../../../../src/database/database-manager';
import { Route } from '../../../../src/models/routing/route/route.model';
import { RouteService } from '../../../../src/models/routing/route/route.service';
import { RoutingRule } from '../../../../src/models/routing/routing-rule/routing-rule.model';
import { RoutingRuleService } from '../../../../src/models/routing/routing-rule/routing-rule.service';
import { OpenVPNPrefix } from '../../../../src/models/vpn/openvpn/OpenVPNPrefix';
import { expect, testSuite } from '../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';

describe(OpenVPNPrefix.name, () => {
  let fwcloudProduct: FwCloudProduct;
  let route: Route;
  let routingRule: RoutingRule;
  let prefix: OpenVPNPrefix;

  let routeService: RouteService;
  let routingRuleService: RoutingRuleService;
  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    fwcloudProduct = await new FwCloudFactory().make();
    routeService = await testSuite.app.getService<RouteService>(RouteService.name);
    routingRuleService = await testSuite.app.getService<RoutingRuleService>(
      RoutingRuleService.name,
    );
    prefix = await manager.getRepository(OpenVPNPrefix).save(
      manager.getRepository(OpenVPNPrefix).create({
        openVPNId: fwcloudProduct.openvpnServer.id,
        name: 'OpenVPN-Cli-test',
      }),
    );

    route = await routeService.create({
      routingTableId: fwcloudProduct.routingTable.id,
      gatewayId: fwcloudProduct.ipobjs.get('gateway').id,
    });

    route = await routeService.update(route.id, {
      openVPNPrefixIds: [{ id: prefix.id, order: 1 }],
    });

    routingRule = await routingRuleService.create({
      routingTableId: fwcloudProduct.routingTable.id,
      openVPNPrefixIds: [{ id: prefix.id, order: 1 }],
    });
  });

  describe('searchPrefixUsage', () => {
    describe('route', () => {
      it('should detect usages', async () => {
        const whereUsed: any = await OpenVPNPrefix.searchPrefixUsage(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          prefix.id,
          true,
        );

        expect(whereUsed.restrictions.PrefixInRoute).to.have.length(1);
        expect(whereUsed.restrictions.PrefixInRoute[0].route_id).to.be.eq(route.id);
      });
    });

    describe('routingRule', () => {
      it('should detect usages', async () => {
        const whereUsed: any = await OpenVPNPrefix.searchPrefixUsage(
          db.getQuery(),
          fwcloudProduct.fwcloud.id,
          prefix.id,
          true,
        );

        expect(whereUsed.restrictions.PrefixInRoutingRule).to.have.length(1);
        expect(whereUsed.restrictions.PrefixInRoutingRule[0].routing_rule_id).to.be.eq(
          routingRule.id,
        );
      });
    });
  });
});
