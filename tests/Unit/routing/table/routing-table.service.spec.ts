import { Application } from "../../../../src/Application";
import { ValidationException } from "../../../../src/fonaments/exceptions/validation-exception";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import { RoutingTableService } from "../../../../src/models/routing/routing-table/routing-table.service";
import { Tree } from "../../../../src/models/tree/Tree";
import { describeName, expect, testSuite } from "../../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../../utils/fwcloud-factory";

describe(describeName(RoutingTableService.name + ' Unit Tests'), () => {
    let app: Application;
    let service: RoutingTableService;

    let fwcloudProduct: FwCloudProduct;
    let firewall: Firewall;
    let fwcloud: FwCloud;
    
    beforeEach(async () => {
        app = testSuite.app;
        await testSuite.resetDatabaseData();

        fwcloudProduct = await new FwCloudFactory().make();
        fwcloud = fwcloudProduct.fwcloud;
        firewall = fwcloudProduct.firewall;

        service = await app.getService(RoutingTableService.name);
        await Tree.createAllTreeCloud(fwcloud) as {id: number};
        const node: {id: number} = await Tree.getNodeByNameAndType(fwcloud.id, 'FIREWALLS', 'FDF') as {id: number};
        await Tree.insertFwc_Tree_New_firewall(fwcloud.id, node.id, firewall.id);
    });

    describe('create', () => {
        it('should not create a table with a number being used', () => {
            const numberUsed: number = fwcloudProduct.routingTable.number;

            expect(service.create({
                name: 'newTable',
                number: numberUsed,
                firewallId: firewall.id
            })).to.be.rejectedWith(ValidationException);
        });

        it('should create a table with a valid number', async () => {
            const table: RoutingTable = await service.create({
                name: 'newTable',
                number: 250,
                firewallId: firewall.id
            });

            expect(table).to.be.instanceOf(RoutingTable);
            expect(table).not.to.be.undefined;
        });
    });

    describe('update', () => {
        let table: RoutingTable;
        let numberUsed: number;

        beforeEach(async () => {
            numberUsed = fwcloudProduct.routingTable.number;
            table = await service.create({
                name: 'newTable',
                number: 250,
                firewallId: firewall.id
            });
        });

        it('should not update a table with a number being used by other table', async () => {
            const numberUsed: number = fwcloudProduct.routingTable.number;

            expect(service.update(table.id, {
                number: numberUsed,
            })).to.be.rejectedWith(ValidationException);
        });

        it('should update a table with the same number', async () => {
            const updated: RoutingTable = await service.update(table.id, {
                name: 'updated',
                number: table.number,
            });

            expect(updated.name).to.eq('updated');
        });

    });
});