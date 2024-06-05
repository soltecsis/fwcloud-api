import { Request } from 'express';
import { getRepository } from 'typeorm';
import { Application } from '../../../../src/Application';
import { RoutingTableController } from '../../../../src/controllers/routing/routing-tables/routing-tables.controller';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { RoutingTable } from '../../../../src/models/routing/routing-table/routing-table.model';
import { RoutingTableService } from '../../../../src/models/routing/routing-table/routing-table.service';
import StringHelper from '../../../../src/utils/string.helper';
import { expect, testSuite } from '../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
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
    tableService = await app.getService<RoutingTableService>(
      RoutingTableService.name,
    );

    fwcloud = product.fwcloud;
    firewall = product.firewall;
    table = product.routingTable;

    controller = new RoutingTableController(app);
  });

  describe('make', () => {
    it('should throw error if the table does not belongs to the firewall', async () => {
      const newFirewall: Firewall = await getRepository(Firewall).save({
        name: StringHelper.randomize(10),
        fwCloudId: fwcloud.id,
      });

      await expect(
        controller.make({
          fwcloud: fwcloud.id,
          firewall: newFirewall.id,
          routingTable: table.id,
        } as unknown as Request),
      ).rejected;
    });

    it('should throw an error if the firewall does not belongs to the fwcloud', async () => {
      const newfwcloud = await getRepository(FwCloud).save({
        name: StringHelper.randomize(10),
      });

      await expect(
        controller.make({
          fwcloud: newfwcloud.id,
          firewall: firewall.id,
          routingTable: table.id,
        } as unknown as Request),
      ).rejected;
    });

    it('should throw error if the fwcloud does not exist', async () => {
      await expect(
        controller.make({
          params: {
            fwcloud: -1,
            firewall: firewall.id,
            routingTable: table.id,
          },
        } as unknown as Request),
      ).rejected;
    });

    it('should throw error if the firewall does not exist', async () => {
      await expect(
        controller.make({
          params: {
            fwcloud: fwcloud.id,
            firewall: -1,
            routingTable: table.id,
          },
        } as unknown as Request),
      ).rejected;
    });

    it('should throw error if the table does not exist', async () => {
      await expect(
        controller.make({
          params: {
            fwcloud: fwcloud.id,
            firewall: firewall.id,
            routingTable: -1,
          },
        } as unknown as Request),
      ).rejected;
    });

    it('should not throw error if params are valid', async () => {
      expect(
        await controller.make({
          params: {
            fwcloud: fwcloud.id,
            firewall: firewall.id,
            routingTable: table.id,
          },
        } as unknown as Request),
      ).to.be.undefined;
    });
  });
});
