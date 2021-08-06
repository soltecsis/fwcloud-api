import { getCustomRepository, getRepository } from "typeorm";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { RoutingGroup } from "../../../../src/models/routing/routing-group/routing-group.model";
import { RoutingGroupService } from "../../../../src/models/routing/routing-group/routing-group.service";
import { RoutingRule } from "../../../../src/models/routing/routing-rule/routing-rule.model";
import { RoutingRuleRepository } from "../../../../src/models/routing/routing-rule/routing-rule.repository";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import { RoutingTableService } from "../../../../src/models/routing/routing-table/routing-table.service";
import { Tree } from "../../../../src/models/tree/Tree";
import StringHelper from "../../../../src/utils/string.helper";
import { expect, testSuite } from "../../../mocha/global-setup";

describe(RoutingRuleRepository.name, () => {
    let repository: RoutingRuleRepository;
    let fwCloud: FwCloud;
    let firewall: Firewall;
    
    let tableService: RoutingTableService;
    let table: RoutingTable;
    let routingGroup: RoutingGroupService;
    let routingGroupService: RoutingGroupService;

    beforeEach(async() => {
        await testSuite.resetDatabaseData();
        
        repository = getCustomRepository(RoutingRuleRepository);
        tableService = await testSuite.app.getService<RoutingTableService>(RoutingTableService.name);
        routingGroupService = await testSuite.app.getService<RoutingGroupService>(RoutingGroupService.name);


        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
            name: StringHelper.randomize(10)
        }));

        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwCloud.id
        }));

        await Tree.createAllTreeCloud(fwCloud) as {id: number};
        const node: {id: number} = await Tree.getNodeByNameAndType(fwCloud.id, 'FIREWALLS', 'FDF') as {id: number};
        await Tree.insertFwc_Tree_New_firewall(fwCloud.id, node.id, firewall.id);

        table = await tableService.create({
            firewallId: firewall.id,
            name: 'name',
            number: 1,
            comment: null
        });
    });

    describe('move', () => {
        it('should manage rule_order forward changes', async () => {
            const ruleOrder1: RoutingRule = await repository.save({
                routingTableId: table.id,
                rule_order: 1
            });
            const ruleOrder2: RoutingRule = await repository.save({
                routingTableId: table.id,
                rule_order: 2
            });
            const ruleOrder3: RoutingRule = await repository.save({
                routingTableId: table.id,
                rule_order: 3
            });
            const ruleOrder4: RoutingRule = await repository.save({
                routingTableId: table.id,
                rule_order: 4
            });

            await repository.move([ruleOrder2.id], 4);

            expect((await repository.findOne(ruleOrder1.id)).rule_order).to.eq(1);
            expect((await repository.findOne(ruleOrder2.id)).rule_order).to.eq(3);
            expect((await repository.findOne(ruleOrder3.id)).rule_order).to.eq(2);
            expect((await repository.findOne(ruleOrder4.id)).rule_order).to.eq(4);
        });

        it('should manage rule_order backward changes', async () => {
            const ruleOrder1: RoutingRule = await repository.save({
                routingTableId: table.id,
                rule_order: 1
            });
            const ruleOrder2: RoutingRule = await repository.save({
                routingTableId: table.id,
                rule_order: 2
            });
            const ruleOrder3: RoutingRule = await repository.save({
                routingTableId: table.id,
                rule_order: 3
            });
            const ruleOrder4: RoutingRule = await repository.save({
                routingTableId: table.id,
                rule_order: 4
            });

            await repository.move([ruleOrder4.id], 2);

            expect((await repository.findOne(ruleOrder1.id)).rule_order).to.eq(1);
            expect((await repository.findOne(ruleOrder2.id)).rule_order).to.eq(3);
            expect((await repository.findOne(ruleOrder3.id)).rule_order).to.eq(4);
            expect((await repository.findOne(ruleOrder4.id)).rule_order).to.eq(2);
        });

        it('should add to a group is destination belongs to a group', async () => {
            const ruleOrder1: RoutingRule = await repository.save({
                routingTableId: table.id,
                rule_order: 1
            });
            const ruleOrder2: RoutingRule = await repository.save({
                routingTableId: table.id,
                rule_order: 2
            });
            const ruleOrder3: RoutingRule = await repository.save({
                routingTableId: table.id,
                rule_order: 3
            });

            let group: RoutingGroup = await routingGroupService.create({
                name: 'group',
                routingRules: [ruleOrder2],
                firewallId: firewall.id,
            });

            await repository.move([ruleOrder3.id], 2);

            expect((await repository.findOne(ruleOrder2.id)).routingGroupId).to.eq(group.id);
            expect((await repository.findOne(ruleOrder3.id)).routingGroupId).to.eq(group.id);
        });

        describe('bulk', () => {
            it('should manage rule_order forward changes', async () => {
                const ruleOrder1: RoutingRule = await repository.save({
                    routingTableId: table.id,
                    rule_order: 1
                });
                const ruleOrder2: RoutingRule = await repository.save({
                    routingTableId: table.id,
                    rule_order: 2
                });
                const ruleOrder3: RoutingRule = await repository.save({
                    routingTableId: table.id,
                    rule_order: 3
                });
                const ruleOrder4: RoutingRule = await repository.save({
                    routingTableId: table.id,
                    rule_order: 4
                });
    
                await repository.move([ruleOrder1.id, ruleOrder2.id], 4);
    
                expect((await repository.findOne(ruleOrder1.id)).rule_order).to.eq(2);
                expect((await repository.findOne(ruleOrder2.id)).rule_order).to.eq(3);
                expect((await repository.findOne(ruleOrder3.id)).rule_order).to.eq(1);
                expect((await repository.findOne(ruleOrder4.id)).rule_order).to.eq(4);
            });
    
            it('should manage rule_order backward changes', async () => {
                const ruleOrder1: RoutingRule = await repository.save({
                    routingTableId: table.id,
                    rule_order: 1
                });
                const ruleOrder2: RoutingRule = await repository.save({
                    routingTableId: table.id,
                    rule_order: 2
                });
                const ruleOrder3: RoutingRule = await repository.save({
                    routingTableId: table.id,
                    rule_order: 3
                });
                const ruleOrder4: RoutingRule = await repository.save({
                    routingTableId: table.id,
                    rule_order: 4
                });
    
                await repository.move([ruleOrder3.id, ruleOrder4.id], 2);
    
                expect((await repository.findOne(ruleOrder1.id)).rule_order).to.eq(1);
                expect((await repository.findOne(ruleOrder2.id)).rule_order).to.eq(4);
                expect((await repository.findOne(ruleOrder3.id)).rule_order).to.eq(2);
                expect((await repository.findOne(ruleOrder4.id)).rule_order).to.eq(3);
            });

            it('should add to a group if destination belongs to a group', async () => {
                const ruleOrder1: RoutingRule = await repository.save({
                    routingTableId: table.id,
                    rule_order: 1
                });
                const ruleOrder2: RoutingRule = await repository.save({
                    routingTableId: table.id,
                    rule_order: 2
                });
                const ruleOrder3: RoutingRule = await repository.save({
                    routingTableId: table.id,
                    rule_order: 3
                });
    
                let group: RoutingGroup = await routingGroupService.create({
                    name: 'group',
                    routingRules: [ruleOrder1],
                    firewallId: firewall.id,
                });
    
                await repository.move([ruleOrder2.id, ruleOrder3.id], 1);
    
                expect((await repository.findOne(ruleOrder2.id)).routingGroupId).to.eq(group.id);
                expect((await repository.findOne(ruleOrder3.id)).routingGroupId).to.eq(group.id);
            });
        })
    })
})