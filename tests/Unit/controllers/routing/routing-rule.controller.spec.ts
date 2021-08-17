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

describe(RoutingRuleController.name, () => {
    let controller: RoutingRuleController;
    let app: Application;
    let fwcProduct: FwCloudProduct;
    let tableService: RoutingTableService;
    let ruleService: RoutingRuleService;
    let firewall: Firewall;

    beforeEach(async () => {
        app = testSuite.app;
        tableService = await app.getService<RoutingTableService>(RoutingTableService.name);
        ruleService = await app.getService<RoutingRuleService>(RoutingRuleService.name);
    
        fwcProduct = await (new FwCloudFactory()).make();
        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwcProduct.fwcloud.id
        }));

        await Tree.createAllTreeCloud(fwcProduct.fwcloud) as {id: number};
        const node: {id: number} = await Tree.getNodeByNameAndType(fwcProduct.fwcloud.id, 'FIREWALLS', 'FDF') as {id: number};
        await Tree.insertFwc_Tree_New_firewall(fwcProduct.fwcloud.id, node.id, firewall.id);
        
        controller = new RoutingRuleController(app);
        await controller.make({
            params: {
                fwcloud: fwcProduct.fwcloud.id,
                firewall: firewall.id
            }
        } as unknown as Request);
    });

    describe('bulkRemove', () => {
        beforeEach(() => {
            const spy: Sinon.SinonSpy = Sinon.stub(RoutingRulePolicy, 'delete').resolves(Authorization.grant());
        });

        it('should remove rules from different table which belongs to the same firewall', async () => {
            

            let table1: RoutingTable = await tableService.create({
                firewallId: firewall.id,
                name: 'table1',
                number: 1
            });

            let table2: RoutingTable = await tableService.create({
                firewallId: firewall.id,
                name: 'table2',
                number: 2
            });

            let rule1: RoutingRule = await ruleService.create({
                routingTableId: table1.id,
            });

            let rule2: RoutingRule = await ruleService.create({
                routingTableId: table2.id,
            });

            await controller.bulkRemove({
                query: {
                    rules: [rule1.id, rule2.id]
                },
                session: {
                    user: null
                }
            } as unknown as Request);


            expect(await ruleService.findOneInPath({
                id: rule1.id,
            })).to.be.undefined;

            expect(await ruleService.findOneInPath({
                id: rule2.id,
            })).to.be.undefined;
        });
    })
})