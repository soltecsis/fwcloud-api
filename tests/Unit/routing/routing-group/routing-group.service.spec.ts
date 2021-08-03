import { getCustomRepository, getRepository } from "typeorm";
import { Application } from "../../../../src/Application";
import rule from "../../../../src/middleware/joi_schemas/policy/rule";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { RoutingGroup } from "../../../../src/models/routing/routing-group/routing-group.model";
import { RoutingGroupService } from "../../../../src/models/routing/routing-group/routing-group.service";
import { RoutingRule } from "../../../../src/models/routing/routing-rule/routing-rule.model";
import { RoutingRuleRepository } from "../../../../src/models/routing/routing-rule/routing-rule.repository";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import StringHelper from "../../../../src/utils/string.helper";
import { expect, testSuite } from "../../../mocha/global-setup";

describe(RoutingGroupService.name, () => {
    let fwCloud: FwCloud;
    let firewall: Firewall;
    let table: RoutingTable;
    let group: RoutingGroup;
    let rule: RoutingRule;
    let service: RoutingGroupService;
    let app: Application;
    
    beforeEach(async () => {
        app = testSuite.app;
        
        service = await app.getService(RoutingGroupService.name);

        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
            name: StringHelper.randomize(10)
        }));

        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwCloud.id
        }));

        table = await getRepository(RoutingTable).save({
            firewallId: firewall.id,
            number: 1,
            name: 'name',
        });

        rule = await getCustomRepository(RoutingRuleRepository).save({
            routingTableId: table.id,
            rule_order: 1
        });
        
        group = await getRepository(RoutingGroup).save({
            name: 'group',
            firewallId: firewall.id,
            routingRules: [rule]
        })
    })
    describe('update', () => {
        it('should remove the group if its empty', async () => {
            await service.update(group.id, {
                routingRules: []
            });

            expect(await service.findOneInPath({
                fwCloudId: fwCloud.id,
                firewallId: firewall.id,
                id: group.id
            })).to.be.undefined;
        });
    })
});