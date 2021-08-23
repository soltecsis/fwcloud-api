import { Request } from "express";
import { getRepository } from "typeorm";
import { Application } from "../../../../src/Application";
import { RoutingTableController } from "../../../../src/controllers/routing/routing-tables/routing-tables.controller";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import { RoutingTableService } from "../../../../src/models/routing/routing-table/routing-table.service";
import StringHelper from "../../../../src/utils/string.helper";
import { expect, testSuite } from "../../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../../utils/fwcloud-factory";
import { QueryFailedError } from 'typeorm';

describe(RoutingTableController.name, () => {
    let firewall: Firewall;
    let fwcloud: FwCloud;
    let table: RoutingTable;
    let product: FwCloudProduct;
    let controller: RoutingTableController;
    let app: Application;

    let tableService: RoutingTableService;

    beforeEach(async () => {
        app = testSuite.app;
        product = await new FwCloudFactory().make();
        tableService = await app.getService<RoutingTableService>(RoutingTableService.name);

        fwcloud = product.fwcloud;
        firewall = product.firewall;
        table = product.routingTable;

        controller = new RoutingTableController(app);
    });

    it('should not throw error if the table belongs to the firewall which belongs to the fwcloud', async () => {
        expect(await controller.make({
            params: {
                fwcloud: fwcloud.id.toString(),
                firewall: firewall.id.toString(),
                routingTable: table.id.toString()
            }
        } as unknown as Request)).to.be.undefined;
    });

    it('should throw error if the table blongs to other firewall', async () => {
        const newFirewall: Firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwcloud.id
        }));

        table = await getRepository(RoutingTable).save({
            firewallId: newFirewall.id,
            number: 1,
            name: 'Routing table',
        });

        expect(controller.make({
            params: {
                fwcloud: fwcloud.id.toString(),
                firewall: firewall.id.toString(),
                routingTable: table.id.toString()
            }
        } as unknown as Request)).rejectedWith(QueryFailedError);
    });

    it('should throw error if the firewall blongs to other fwcloud', async () => {
        const newFwcloud: FwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
            name: StringHelper.randomize(10)
        }));

        const newFirewall: Firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwcloud.id
        }));

        
        expect(controller.make({
            params: {
                fwcloud: fwcloud.id.toString(),
                firewall: newFirewall.id.toString()
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
});