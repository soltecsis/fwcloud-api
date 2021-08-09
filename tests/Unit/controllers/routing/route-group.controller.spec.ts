import { getRepository } from "typeorm";
import { Application } from "../../../../src/Application";
import { RoutingRuleController } from "../../../../src/controllers/routing/routing-rule/routing-rule.controller";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FirewallService } from "../../../../src/models/firewall/firewall.service";
import { RoutingRule } from "../../../../src/models/routing/routing-rule/routing-rule.model";
import { RoutingRuleService } from "../../../../src/models/routing/routing-rule/routing-rule.service";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import { RoutingTableService } from "../../../../src/models/routing/routing-table/routing-table.service";
import StringHelper from "../../../../src/utils/string.helper";
import { expect, testSuite } from "../../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../../utils/fwcloud-factory";
import { Request } from 'express';
import Sinon from "sinon";
import { RoutingRulePolicy } from "../../../../src/policies/routing-rule.policy";
import { Tree } from "../../../../src/models/tree/Tree";
import { Authorization } from "../../../../src/fonaments/authorization/policy";
import { RouteGroupController } from "../../../../src/controllers/routing/route-group/route-group.controller";
import { RouteService } from "../../../../src/models/routing/route/route.service";
import { RouteGroup } from "../../../../src/models/routing/route-group/route-group.model";
import { RouteGroupService } from "../../../../src/models/routing/route-group/route-group.service";
import { RouteGroupPolicy } from "../../../../src/policies/route-group.policy";
import { RequestInputs } from "../../../../src/fonaments/http/request-inputs";

describe(RoutingRuleController.name, () => {
    let controller: RouteGroupController;
    let app: Application;
    let fwcProduct: FwCloudProduct;
    let tableService: RoutingTableService;
    let routeService: RouteService;
    let routeGroupService: RouteGroupService;
    let firewall: Firewall;

    beforeEach(async () => {
        app = testSuite.app;
        tableService = await app.getService<RoutingTableService>(RoutingTableService.name);
        routeService = await app.getService<RouteService>(RouteService.name);
        routeGroupService = await app.getService<RouteGroupService>(RouteGroupService.name);
    
        fwcProduct = await (new FwCloudFactory()).make();
        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwcProduct.fwcloud.id
        }));

        await Tree.createAllTreeCloud(fwcProduct.fwcloud) as {id: number};
        const node: {id: number} = await Tree.getNodeByNameAndType(fwcProduct.fwcloud.id, 'FIREWALLS', 'FDF') as {id: number};
        await Tree.insertFwc_Tree_New_firewall(fwcProduct.fwcloud.id, node.id, firewall.id);
        
        controller = new RouteGroupController(app);
        
        await controller.make({
            params: {
                fwcloud: fwcProduct.fwcloud.id,
                firewall: firewall.id
            }
        } as unknown as Request);
    });

    describe('update', () => {
        let group: RouteGroup;

        beforeEach(async () => {
            group = await routeGroupService.create({
                name: 'group',
                routes: [fwcProduct.routes.get('route1')],
                firewallId: firewall.id
            });

            const spy: Sinon.SinonSpy = Sinon.stub(RouteGroupPolicy, 'update').resolves(Authorization.grant());
        });

        it('should handle updates without changing routes', async () => {
            await controller.update({
                params: {
                    routeGroup: group.id
                },
                session: {
                    user: null
                },
                inputs: new RequestInputs({
                    body: {
                        style: "#E6EE9C"
                    },
                    query: {}
                } as unknown as Request)
            } as unknown as Request);


            expect((await routeGroupService.findOneInPath({
                id: group.id,
            })).style).to.be.eq("#E6EE9C");

            expect((await routeGroupService.findOneInPath({
                id: group.id,
            }, {relations: ['routes']})).routes).to.have.length(1);
        });
    })
})