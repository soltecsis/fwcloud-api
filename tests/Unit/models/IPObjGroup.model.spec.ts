import { getRepository } from "typeorm";
import db from "../../../src/database/database-manager";
import { IPObj } from "../../../src/models/ipobj/IPObj";
import { IPObjGroup } from "../../../src/models/ipobj/IPObjGroup";
import { IPObjToIPObjGroup } from "../../../src/models/ipobj/IPObjToIPObjGroup";
import { Route } from "../../../src/models/routing/route/route.model";
import { RouteService } from "../../../src/models/routing/route/route.service";
import { RoutingRule } from "../../../src/models/routing/routing-rule/routing-rule.model";
import { RoutingRuleService } from "../../../src/models/routing/routing-rule/routing-rule.service";
import { expect, testSuite } from "../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../utils/fwcloud-factory";

describe(IPObjGroup.name, () => {
    let fwcloudProduct: FwCloudProduct;
    let route: Route;
    let ipobjGroup: IPObjGroup;
    let routingRule: RoutingRule;

    let routeService: RouteService;
    let routingRuleService: RoutingRuleService;

    beforeEach(async () => {
        fwcloudProduct = await (new FwCloudFactory()).make();
        routeService = await testSuite.app.getService<RouteService>(RouteService.name);
        routingRuleService = await testSuite.app.getService<RoutingRuleService>(RoutingRuleService.name);

        const ipobj: IPObj = await getRepository(IPObj).save(getRepository(IPObj).create({
            name: 'test',
            address: '0.0.0.0',
            ipObjTypeId: 5,
            interfaceId: null,
        }))
        
        ipobjGroup = await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({
            name: 'ipobjs group',
            type: 20,
            fwCloudId: fwcloudProduct.fwcloud.id
        }));

        await IPObjToIPObjGroup.insertIpobj__ipobjg({
            dbCon: db.getQuery(),
            body: {
                ipobj: ipobj.id,
                ipobj_g: ipobjGroup.id
            }
        });
        route = await routeService.create({
            routingTableId: fwcloudProduct.routingTable.id,
            gatewayId: fwcloudProduct.ipobjs.get('gateway').id
        })

        route = await routeService.update(route.id, {
            ipObjGroupIds: [ipobjGroup.id]
        });
        
        routingRule = await routingRuleService.create({
            routingTableId: fwcloudProduct.routingTable.id,
        });

        routingRule = await routingRuleService.update(routingRule.id, {
            ipObjGroupIds: [ipobjGroup.id]
        });
    });

    describe('searchIpobjUsage', () => {
        describe('route', () => {
            it('should detect usages', async () => {
                const whereUsed: any = await IPObjGroup.searchGroupUsage(ipobjGroup.id, fwcloudProduct.fwcloud.id);
    
                expect(whereUsed.restrictions.GroupInRoute).to.have.length(1);
                expect(whereUsed.restrictions.GroupInRoute[0].id).to.be.eq(route.id)
            })
        });

        describe('routingRule', () => {
            it('should detect usages', async () => {
                const whereUsed: any = await IPObjGroup.searchGroupUsage(ipobjGroup.id, fwcloudProduct.fwcloud.id);
    
                expect(whereUsed.restrictions.GroupInRoutingRule).to.have.length(1);
                expect(whereUsed.restrictions.GroupInRoutingRule[0].id).to.be.eq(routingRule.id)
            })
        });
    })
})