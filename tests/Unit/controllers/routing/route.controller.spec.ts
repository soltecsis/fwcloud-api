import { expect } from 'chai';
import { EntityManager } from 'typeorm';
import { Application } from '../../../../src/Application';
import { RouteController } from '../../../../src/controllers/routing/route/route.controller';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { Route } from '../../../../src/models/routing/route/route.model';
import { RoutingTable } from '../../../../src/models/routing/routing-table/routing-table.model';
import StringHelper from '../../../../src/utils/string.helper';
import { testSuite } from '../../../mocha/global-setup';
import { FwCloudProduct, FwCloudFactory } from '../../../utils/fwcloud-factory';
import { Request } from 'express';
import db from '../../../../src/database/database-manager';

describe(RouteController.name, () => {
  let firewall: Firewall;
  let fwcloud: FwCloud;
  let table: RoutingTable;
  let route: Route;

  let product: FwCloudProduct;
  let controller: RouteController;
  let app: Application;
  let manager: EntityManager;

  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();
    product = await new FwCloudFactory().make();

    fwcloud = product.fwcloud;
    firewall = product.firewall;
    table = product.routingTable;
    route = product.routes.get('route1');

    controller = new RouteController(app);
  });

  describe('make', () => {
    it('should throw error if the route does not belongs to the table', async () => {
      const newTable: RoutingTable = await manager.getRepository(RoutingTable).save({
        name: 'table',
        firewallId: firewall.id,
        number: 1,
      });

      await manager.getRepository(Route).update(route.id, {
        routingTableId: newTable.id,
      });

      await expect(
        controller.make({
          params: {
            fwcloud: fwcloud.id,
            firewall: firewall.id,
            routingTable: table.id,
            route: route.id,
          },
        } as unknown as Request),
      ).rejected;
    });

    it('should throw error if the table does not belong to the firewall', async () => {
      const newFirewall: Firewall = await manager.getRepository(Firewall).save({
        name: StringHelper.randomize(10),
        fwCloudId: fwcloud.id,
      });

      await expect(
        controller.make({
          params: {
            fwcloud: fwcloud.id,
            firewall: newFirewall.id,
            routingTable: table.id,
            route: route.id,
          },
        } as unknown as Request),
      ).rejected;
    });

    it('should throw error if the firewall does not belong to the fwcloud', async () => {
      const newfwcloud = await manager.getRepository(FwCloud).save({
        name: StringHelper.randomize(10),
      });

      await expect(
        controller.make({
          fwcloud: newfwcloud.id,
          firewall: firewall.id,
          routingTable: table.id,
          route: route.id,
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

    it('should throw error if the route does not exist', async () => {
      await expect(
        controller.make({
          params: {
            fwcloud: fwcloud.id,
            firewall: firewall.id,
            routingTable: table.id,
            route: -1,
          },
        } as unknown as Request),
      ).rejected;
    });

    it('should not throw error if the params are valid', async () => {
      expect(
        await controller.make({
          params: {
            fwcloud: fwcloud.id,
            firewall: firewall.id,
            routingTable: table.id,
            route: route.id,
          },
        } as unknown as Request),
      ).to.be.undefined;
    });
  });
});
