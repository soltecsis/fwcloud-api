import { getRepository } from "typeorm";
import db from "../../../src/database/database-manager";
import { IPObj } from "../../../src/models/ipobj/IPObj";
import { Route } from "../../../src/models/routing/route/route.model";
import { RouteService } from "../../../src/models/routing/route/route.service";
import { RoutingRule } from "../../../src/models/routing/routing-rule/routing-rule.model";
import { RoutingRuleService } from "../../../src/models/routing/routing-rule/routing-rule.service";
import { expect, testSuite } from "../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../utils/fwcloud-factory";

describe(IPObj.name, () => {
    let fwcloudProduct: FwCloudProduct;
    let route: Route;
    let ipobj: IPObj;
    let routingRule: RoutingRule;

    let routeService: RouteService;
    let routingRuleService: RoutingRuleService;

    beforeEach(async () => {
        fwcloudProduct = await (new FwCloudFactory()).make();
        routeService = await testSuite.app.getService<RouteService>(RouteService.name);
        routingRuleService = await testSuite.app.getService<RoutingRuleService>(RoutingRuleService.name);

        ipobj = await getRepository(IPObj).save(getRepository(IPObj).create({
            name: 'gateway',
            address: '1.2.3.4',
            ipObjTypeId: 5,
            interfaceId: null,
            fwCloudId: fwcloudProduct.fwcloud.id
        }));

        route = await routeService.create({
            routingTableId: fwcloudProduct.routingTable.id,
            gatewayId:ipobj.id,
        });

        route = await routeService.update(route.id, {
            ipObjIds: [ipobj.id]
        });

        routingRule = await routingRuleService.create({
            routingTableId: fwcloudProduct.routingTable.id,
        });

        routingRule = await routingRuleService.update(routingRule.id, {
            ipObjIds: [ipobj.id]
        })
    });

    describe('searchIpobjUsage', () => {
        describe('route', () => {
            it('should detect usages', async () => {
                const whereUsed: any = await IPObj.searchIpobjUsage(db.getQuery(), fwcloudProduct.fwcloud.id, ipobj.id, 5);
    
                expect(whereUsed.restrictions.IpobjInRoute).to.have.length(1);
                expect(whereUsed.restrictions.IpobjInRoute[0].id).to.be.eq(route.id);
                
                expect(whereUsed.restrictions.AddrInRoute).to.have.length(1);
                expect(whereUsed.restrictions.AddrInRoute[0].id).to.be.eq(route.id)
            })
        });

        describe('routingRule', () => {
            it('should detect usages', async () => {
                const whereUsed: any = await IPObj.searchIpobjUsage(db.getQuery(), fwcloudProduct.fwcloud.id, ipobj.id, 5);
    
                expect(whereUsed.restrictions.IpobjInRoutingRule).to.have.length(1);
                expect(whereUsed.restrictions.IpobjInRoutingRule[0].id).to.be.eq(routingRule.id);
            })
        });
    })
})