import { getCustomRepository, getRepository } from "typeorm";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { RoutingRule } from "../../../../src/models/routing/routing-rule/routing-rule.model";
import { RoutingRuleRepository } from "../../../../src/models/routing/routing-rule/routing-rule.repository";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import { RoutingTableService } from "../../../../src/models/routing/routing-table/routing-table.service";
import { Tree } from "../../../../src/models/tree/Tree";
import StringHelper from "../../../../src/utils/string.helper";
import { expect, testSuite } from "../../../mocha/global-setup";

describe.only(RoutingRuleRepository.name, () => {
    let repository: RoutingRuleRepository;
    let fwCloud: FwCloud;
    let firewall: Firewall;
    
    let tableService: RoutingTableService;
    let table: RoutingTable;

    beforeEach(async() => {
        await testSuite.resetDatabaseData();
        
        repository = getCustomRepository(RoutingRuleRepository);
        tableService = await testSuite.app.getService<RoutingTableService>(RoutingTableService.name);

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
        it.only('should manage position changes', async () => {
            const rulePosition1: RoutingRule = await repository.save({
                routingTableId: table.id,
                position: 1
            });
            const rulePosition2: RoutingRule = await repository.save({
                routingTableId: table.id,
                position: 2
            });
            const rulePosition3: RoutingRule = await repository.save({
                routingTableId: table.id,
                position: 3
            });
            const rulePosition4: RoutingRule = await repository.save({
                routingTableId: table.id,
                position: 4
            });

            await repository.move(rulePosition2.id, 3);

            expect((await repository.findOne(rulePosition1.id)).position).to.eq(1);
            expect((await repository.findOne(rulePosition2.id)).position).to.eq(3);
            expect((await repository.findOne(rulePosition3.id)).position).to.eq(2);
            expect((await repository.findOne(rulePosition4.id)).position).to.eq(4);
        });

        it.only('should manage position changes', async () => {
            const rulePosition1: RoutingRule = await repository.save({
                routingTableId: table.id,
                position: 1
            });
            const rulePosition2: RoutingRule = await repository.save({
                routingTableId: table.id,
                position: 2
            });
            const rulePosition3: RoutingRule = await repository.save({
                routingTableId: table.id,
                position: 3
            });
            const rulePosition4: RoutingRule = await repository.save({
                routingTableId: table.id,
                position: 4
            });

            await repository.move(rulePosition4.id, 2);

            expect((await repository.findOne(rulePosition1.id)).position).to.eq(1);
            expect((await repository.findOne(rulePosition2.id)).position).to.eq(3);
            expect((await repository.findOne(rulePosition3.id)).position).to.eq(4);
            expect((await repository.findOne(rulePosition4.id)).position).to.eq(2);
        })
    })
})