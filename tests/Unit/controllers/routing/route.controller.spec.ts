import { expect } from "chai";
import { getRepository, QueryFailedError } from "typeorm";
import { Application } from "../../../../src/Application";
import { RouteController } from "../../../../src/controllers/routing/route/route.controller";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { Route } from "../../../../src/models/routing/route/route.model";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import StringHelper from "../../../../src/utils/string.helper";
import { testSuite } from "../../../mocha/global-setup";
import { FwCloudProduct, FwCloudFactory } from "../../../utils/fwcloud-factory";
import { Request } from 'express';

describe(RouteController.name, () => {
    let firewall: Firewall;
    let fwcloud: FwCloud;
    let table: RoutingTable;
    let route: Route;

    let product: FwCloudProduct;
    let controller: RouteController;
    let app: Application;

    beforeEach(async () => {
        app = testSuite.app;
        product = await new FwCloudFactory().make();
        
        fwcloud = product.fwcloud;
        firewall = product.firewall;
        table = product.routingTable;
        route = product.routes.get('route1');

        controller = new RouteController(app);
    });

    describe('make', () => {

        it('should not throw error if the table belongs to the firewall which belongs to the fwcloud', async () => {
            expect(await controller.make({
                params: {
                    fwcloud: fwcloud.id,
                    firewall: firewall.id,
                    routingTable: table.id,
                    route: route.id
                }
            } as unknown as Request)).to.be.undefined;
        });

        it('should throw error if the route belongs to other table', async () => {
            const newTable: RoutingTable = await getRepository(RoutingTable).save(getRepository(RoutingTable).create({
                firewallId: firewall.id,
                name: 'table',
                number: 1
            }));

            expect(controller.make({
                params: {
                    fwcloud: fwcloud.id.toString(),
                    firewall: firewall.id.toString(),
                    routingTable: newTable.id,
                    route: route.id
                }
            } as unknown as Request)).rejectedWith(QueryFailedError);
        });

        it('should throw error if the table belongs to other firewall', async () => {
            const newFirewall: Firewall = await getRepository(Firewall).save({
                name: 'firewall',
                fwCloudId: fwcloud.id
            });

            await getRepository(RoutingTable).update(table.id, {
                firewallId: newFirewall.id
            });

            expect(controller.make({
                params: {
                    fwcloud: fwcloud.id.toString(),
                    firewall: firewall.id.toString(),
                    routingTable: table.id,
                    route: route.id
                }
            } as unknown as Request)).rejectedWith(QueryFailedError);
        });

        it('should throw error if the firewall belongs to other fwcloud', async () => {
            const newFwcloud: FwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
                name: StringHelper.randomize(10)
            }));

            const newFirewall: Firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
                name: StringHelper.randomize(10),
                fwCloudId: fwcloud.id
            }));

            await getRepository(RoutingTable).update(table.id, {
                firewallId: newFirewall.id
            });

            
            expect(controller.make({
                params: {
                    fwcloud: fwcloud.id.toString(),
                    firewall: newFirewall.id.toString(),
                    routingTable: table.id
                }
            } as unknown as Request)).rejectedWith(QueryFailedError);
        });

        it('should throw error if the fwcloud does not exist', async () => {
            expect(controller.make({
                params: {
                    fwcloud: -1,
                    firewall: firewall.id.toString(),
                    routingTable: table.id.toString()
                }
            } as unknown as Request)).rejectedWith(QueryFailedError);
        });

        it('should throw error if the firewall does not exist', async () => {
            expect(controller.make({
                params: {
                    fwcloud: fwcloud.id.toString(),
                    firewall: -1,
                    routingTable: table.id.toString()
                }
            } as unknown as Request)).rejectedWith(QueryFailedError);
        });

        it('should throw error if the table does not exist', async () => {
            expect(controller.make({
                params: {
                    fwcloud: fwcloud.id.toString(),
                    firewall: firewall.id,
                    routingTable: -1
                }
            } as unknown as Request)).rejectedWith(QueryFailedError);
        });

        it('should throw error if the route does not exist', async () => {
            expect(controller.make({
                params: {
                    fwcloud: fwcloud.id.toString(),
                    firewall: firewall.id,
                    routingTable: table.id,
                    rotue: -1
                }
            } as unknown as Request)).rejectedWith(QueryFailedError);
        });
    });
});