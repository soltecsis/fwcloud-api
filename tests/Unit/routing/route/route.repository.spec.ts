import { getCustomRepository, getRepository } from "typeorm";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { RouteGroup } from "../../../../src/models/routing/route-group/route-group.model";
import { RouteGroupService } from "../../../../src/models/routing/route-group/route-group.service";
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
    let routeGroupService: RouteGroupService;

    beforeEach(async() => {
        await testSuite.resetDatabaseData();
        
        repository = getCustomRepository(RouteRepository);
        tableService = await testSuite.app.getService<RoutingTableService>(RoutingTableService.name);
        routeGroupService = await testSuite.app.getService<RouteGroupService>(RouteGroupService.name);

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
        it('should manage route_order forward changes', async () => {
            const routeOrder1: Route = await repository.save({
                routingTableId: table.id,
                route_order: 1,
                gatewayId: gateway.id
            });
            const routeOrder2: Route = await repository.save({
                routingTableId: table.id,
                route_order: 2,
                gatewayId: gateway.id
            });
            const routeOrder3: Route = await repository.save({
                routingTableId: table.id,
                route_order: 3,
                gatewayId: gateway.id
            });
            const routeOrder4: Route = await repository.save({
                routingTableId: table.id,
                route_order: 4,
                gatewayId: gateway.id
            });

            await repository.move([routeOrder2.id], routeOrder4.id, 'below');

            expect((await repository.findOne(routeOrder1.id)).route_order).to.eq(1);
            expect((await repository.findOne(routeOrder2.id)).route_order).to.eq(4);
            expect((await repository.findOne(routeOrder3.id)).route_order).to.eq(2);
            expect((await repository.findOne(routeOrder4.id)).route_order).to.eq(3);
        });

        it('should manage route_order backward changes', async () => {
            const routeOrder1: Route = await repository.save({
                routingTableId: table.id,
                route_order: 1,
                gatewayId: gateway.id
            });
            const routeOrder2: Route = await repository.save({
                routingTableId: table.id,
                route_order: 2,
                gatewayId: gateway.id
            });
            const routeOrder3: Route = await repository.save({
                routingTableId: table.id,
                route_order: 3,
                gatewayId: gateway.id
            });
            const routeOrder4: Route = await repository.save({
                routingTableId: table.id,
                route_order: 4,
                gatewayId: gateway.id
            });

            await repository.move([routeOrder4.id], routeOrder2.id, 'above');

            expect((await repository.findOne(routeOrder1.id)).route_order).to.eq(1);
            expect((await repository.findOne(routeOrder2.id)).route_order).to.eq(3);
            expect((await repository.findOne(routeOrder3.id)).route_order).to.eq(4);
            expect((await repository.findOne(routeOrder4.id)).route_order).to.eq(2);
        });

        it('should add to a group is destination belongs to a group', async () => {
            const routeOrder1: Route = await repository.save({
                routingTableId: table.id,
                route_order: 1,
                gatewayId: gateway.id
            });
            const routeOrder2: Route = await repository.save({
                routingTableId: table.id,
                route_order: 2,
                gatewayId: gateway.id
            });
            const routeOrder3: Route = await repository.save({
                routingTableId: table.id,
                route_order: 3,
                gatewayId: gateway.id
            });

            let group: RouteGroup = await routeGroupService.create({
                name: 'group',
                routes: [routeOrder2],
                firewallId: firewall.id,
            });

            await repository.move([routeOrder3.id], routeOrder2.id, 'above');

            expect((await repository.findOne(routeOrder3.id)).routeGroupId).to.eq(group.id);
            expect((await repository.findOne(routeOrder3.id)).routeGroupId).to.eq(group.id);
        });

        describe('bulk', () => {
            it('should manage route_order forward changes', async () => {
                const routeOrder1: Route = await repository.save({
                    routingTableId: table.id,
                    route_order: 1,
                    gatewayId: gateway.id
                });
                const routeOrder2: Route = await repository.save({
                    routingTableId: table.id,
                    route_order: 2,
                    gatewayId: gateway.id
                });
                const routeOrder3: Route = await repository.save({
                    routingTableId: table.id,
                    route_order: 3,
                    gatewayId: gateway.id
                });
                const routeOrder4: Route = await repository.save({
                    routingTableId: table.id,
                    route_order: 4,
                    gatewayId: gateway.id
                });
    
                await repository.move([routeOrder1.id, routeOrder2.id], routeOrder4.id, 'above');
    
                expect((await repository.findOne(routeOrder1.id)).route_order).to.eq(2);
                expect((await repository.findOne(routeOrder2.id)).route_order).to.eq(3);
                expect((await repository.findOne(routeOrder3.id)).route_order).to.eq(1);
                expect((await repository.findOne(routeOrder4.id)).route_order).to.eq(4);
            });
    
            it('should manage route_order backward changes', async () => {
                const routeOrder1: Route = await repository.save({
                    routingTableId: table.id,
                    route_order: 1,
                    gatewayId: gateway.id
                });
                const routeOrder2: Route = await repository.save({
                    routingTableId: table.id,
                    route_order: 2,
                    gatewayId: gateway.id
                });
                const routeOrder3: Route = await repository.save({
                    routingTableId: table.id,
                    route_order: 3,
                    gatewayId: gateway.id
                });
                const routeOrder4: Route = await repository.save({
                    routingTableId: table.id,
                    route_order: 4,
                    gatewayId: gateway.id
                });
    
                await repository.move([routeOrder3.id, routeOrder4.id], routeOrder2.id, 'above');
    
                expect((await repository.findOne(routeOrder1.id)).route_order).to.eq(1);
                expect((await repository.findOne(routeOrder2.id)).route_order).to.eq(4);
                expect((await repository.findOne(routeOrder3.id)).route_order).to.eq(2);
                expect((await repository.findOne(routeOrder4.id)).route_order).to.eq(3);
            });

            it('should add to a group is destination belongs to a group', async () => {
                const routeOrder1: Route = await repository.save({
                    routingTableId: table.id,
                    route_order: 1,
                    gatewayId: gateway.id
                });
                const routeOrder2: Route = await repository.save({
                    routingTableId: table.id,
                    route_order: 2,
                    gatewayId: gateway.id
                });
                const routeOrder3: Route = await repository.save({
                    routingTableId: table.id,
                    route_order: 3,
                    gatewayId: gateway.id
                });
    
                let group: RouteGroup = await routeGroupService.create({
                    name: 'group',
                    routes: [routeOrder1],
                    firewallId: firewall.id,
                });
    
                await repository.move([routeOrder2.id, routeOrder3.id], 1, 'above');
    
                expect((await repository.findOne(routeOrder3.id)).routeGroupId).to.eq(group.id);
                expect((await repository.findOne(routeOrder3.id)).routeGroupId).to.eq(group.id);
            });
        });
        
    })
})