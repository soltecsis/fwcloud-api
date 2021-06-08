import { expect } from "chai";
import { getRepository } from "typeorm";
import db from "../../../../src/database/database-manager";
import { Route } from "../../../../src/models/routing/route/route.model";
import { RouteService } from "../../../../src/models/routing/route/route.service";
import { RoutingRule } from "../../../../src/models/routing/routing-rule/routing-rule.model";
import { RoutingRuleService } from "../../../../src/models/routing/routing-rule/routing-rule.service";
import { OpenVPN } from "../../../../src/models/vpn/openvpn/OpenVPN";
import { Crt } from "../../../../src/models/vpn/pki/Crt";
import { testSuite } from "../../../mocha/global-setup";
import { FwCloudProduct, FwCloudFactory } from "../../../utils/fwcloud-factory";

describe(OpenVPN.name, () => {
    let fwcloudProduct: FwCloudProduct;
    let route: Route;
    let routingRule: RoutingRule;
    let openvpn: OpenVPN;
    
    let routeService: RouteService;
    let routingRuleService: RoutingRuleService;

    beforeEach(async () => {
        fwcloudProduct = await (new FwCloudFactory()).make();
        routeService = await testSuite.app.getService<RouteService>(RouteService.name);
        routingRuleService = await testSuite.app.getService<RoutingRuleService>(RoutingRuleService.name);

        openvpn = await getRepository(OpenVPN).save(getRepository(OpenVPN).create({
            parentId: fwcloudProduct.openvpnServer.id,
            firewallId: fwcloudProduct.firewall.id,
            crtId: (await getRepository(Crt).save(getRepository(Crt).create({
                caId: fwcloudProduct.ca.id,
                cn: 'test',
                days: 1000,
                type: 2
            }))).id
        }))

        route = await routeService.create({
            routingTableId: fwcloudProduct.routingTable.id,
            gatewayId: fwcloudProduct.ipobjs.get('gateway').id
        })

        route = await routeService.update(route.id, {
            openVPNIds: [openvpn.id]
        });
        
        routingRule = await routingRuleService.create({
            routingTableId: fwcloudProduct.routingTable.id,
        });

        routingRule = await routingRuleService.update(routingRule.id, {
            openVPNIds: [openvpn.id]
        });
    });

    describe('searchIpobjUsage', () => {
        describe('route', () => {
            it('should detect usages', async () => {
                const whereUsed: any = await OpenVPN.searchOpenvpnUsage(db.getQuery(), fwcloudProduct.fwcloud.id, openvpn.id, true);
    
                expect(whereUsed.restrictions.OpenVPNInRoute).to.have.length(1);
                expect(whereUsed.restrictions.OpenVPNInRoute[0].id).to.be.eq(route.id)
            })
        });

        describe('routingRule', () => {
            it('should detect usages', async () => {
                const whereUsed: any = await OpenVPN.searchOpenvpnUsage(db.getQuery(), fwcloudProduct.fwcloud.id, openvpn.id, true);
    
                expect(whereUsed.restrictions.OpenVPNInRoutingRule).to.have.length(1);
                expect(whereUsed.restrictions.OpenVPNInRoutingRule[0].id).to.be.eq(routingRule.id)
            })
        });
    })
})