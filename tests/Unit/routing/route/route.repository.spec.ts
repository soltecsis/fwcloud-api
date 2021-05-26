import { getCustomRepository, getRepository } from "typeorm";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { Route } from "../../../../src/models/routing/route/route.model";
import { RouteRepository } from "../../../../src/models/routing/route/route.repository";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import { RoutingTableService } from "../../../../src/models/routing/routing-table/routing-table.service";
import { Tree } from "../../../../src/models/tree/Tree";
import StringHelper from "../../../../src/utils/string.helper";
import { expect, testSuite } from "../../../mocha/global-setup";

describe(RouteRepository.name, () => {
    let repository: RouteRepository;
    let fwCloud: FwCloud;
    let firewall: Firewall;
    let gateway: IPObj;

    let tableService: RoutingTableService;
    let table: RoutingTable;

    beforeEach(async() => {
        await testSuite.resetDatabaseData();
        
        repository = getCustomRepository(RouteRepository);
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

        gateway = await getRepository(IPObj).save(getRepository(IPObj).create({
            name: 'test',
            address: '0.0.0.0',
            ipObjTypeId: 0,
            interfaceId: null
        }));
    });

    describe('move', () => {
        it('should manage position changes when move to lower positions', async () => {
            const routePosition1: Route = await repository.save({
                routingTableId: table.id,
                position: 1,
                gatewayId: gateway.id
            });
            const routePosition2: Route = await repository.save({
                routingTableId: table.id,
                position: 2,
                gatewayId: gateway.id
            });
            const routePosition3: Route = await repository.save({
                routingTableId: table.id,
                position: 3,
                gatewayId: gateway.id
            });
            const routePosition4: Route = await repository.save({
                routingTableId: table.id,
                position: 4,
                gatewayId: gateway.id
            });

            await repository.move(routePosition2.id, 3);

            expect((await repository.findOne(routePosition1.id)).position).to.eq(1);
            expect((await repository.findOne(routePosition2.id)).position).to.eq(3);
            expect((await repository.findOne(routePosition3.id)).position).to.eq(2);
            expect((await repository.findOne(routePosition4.id)).position).to.eq(4);
        });

        it('should manage position changes when move to greater positions', async () => {
            const routePosition1: Route = await repository.save({
                routingTableId: table.id,
                position: 1,
                gatewayId: gateway.id
            });
            const routePosition2: Route = await repository.save({
                routingTableId: table.id,
                position: 2,
                gatewayId: gateway.id
            });
            const routePosition3: Route = await repository.save({
                routingTableId: table.id,
                position: 3,
                gatewayId: gateway.id
            });
            const routePosition4: Route = await repository.save({
                routingTableId: table.id,
                position: 4,
                gatewayId: gateway.id
            });

            await repository.move(routePosition4.id, 2);

            expect((await repository.findOne(routePosition1.id)).position).to.eq(1);
            expect((await repository.findOne(routePosition2.id)).position).to.eq(3);
            expect((await repository.findOne(routePosition3.id)).position).to.eq(4);
            expect((await repository.findOne(routePosition4.id)).position).to.eq(2);
        })
    })
})