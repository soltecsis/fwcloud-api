import { getRepository } from "typeorm";
import db from "../../../src/database/database-manager";
import { Mark } from "../../../src/models/ipobj/Mark";
import { RouteService } from "../../../src/models/routing/route/route.service";
import { RoutingRule } from "../../../src/models/routing/routing-rule/routing-rule.model";
import { RoutingRuleService } from "../../../src/models/routing/routing-rule/routing-rule.service";
import { expect, testSuite } from "../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../utils/fwcloud-factory";

describe(Mark.name, () => {
    let fwcloudProduct: FwCloudProduct;
    let routingRule: RoutingRule;
    let mark: Mark;
    
    let routeService: RouteService;
    let routingRuleService: RoutingRuleService;

    beforeEach(async () => {
        fwcloudProduct = await (new FwCloudFactory()).make();
        routeService = await testSuite.app.getService<RouteService>(RouteService.name);
        routingRuleService = await testSuite.app.getService<RoutingRuleService>(RoutingRuleService.name);

        mark = await getRepository(Mark).save(getRepository(Mark).create({
            code: 1,
            name: 'mark',
            fwCloudId: fwcloudProduct.fwcloud.id
        }))

        routingRule = await routingRuleService.create({
            routingTableId: fwcloudProduct.routingTable.id,
        });

        routingRule = await routingRuleService.update(routingRule.id, {
            markIds: [mark.id]
        });
    });

    describe('searchMarkUsage', () => {
        describe('routingRule', () => {
            it('should detect usages', async () => {
                const whereUsed: any = await Mark.searchMarkUsage(db.getQuery(), fwcloudProduct.fwcloud.id, mark.id);
    
                expect(whereUsed.restrictions.MarkInRoutingRule).to.have.length(1);
                expect(whereUsed.restrictions.MarkInRoutingRule[0].id).to.be.eq(routingRule.id)
            })
        });
    })
})