import { EntityManager, QueryFailedError } from 'typeorm';
import { Application } from '../../../../src/Application';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import StringHelper from '../../../../src/utils/string.helper';
import { expect, testSuite } from '../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { Request } from 'express';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { RoutingGroupController } from '../../../../src/controllers/routing/routing-group/routing-group.controller';
import { RoutingGroup } from '../../../../src/models/routing/routing-group/routing-group.model';
import db from '../../../../src/database/database-manager';

describe(RoutingGroupController.name, () => {
  let controller: RoutingGroupController;
  let app: Application;
  let fwcProduct: FwCloudProduct;

  let fwcloud: FwCloud;
  let firewall: Firewall;
  let group: RoutingGroup;
  let manager: EntityManager;

  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    fwcProduct = await new FwCloudFactory().make();

    fwcloud = fwcProduct.fwcloud;
    firewall = fwcProduct.firewall;
    group = manager.getRepository(RoutingGroup).create({
      name: '',
      firewallId: firewall.id,
    });
    controller = new RoutingGroupController(app);
  });

  describe('make', () => {
    it('should throw error if the group does not belongs to the firewall', async () => {
      const newFirewall: Firewall = await manager.getRepository(Firewall).save({
        name: StringHelper.randomize(10),
        fwCloudId: fwcloud.id,
      });

      await expect(
        controller.make({
          fwcloud: fwcloud.id,
          firewall: newFirewall.id,
          routingGroup: group.id,
        } as unknown as Request),
      ).rejected;
    });

    it('should throw an error if the firewall does not belongs to the fwcloud', async () => {
      const newfwcloud = await manager.getRepository(FwCloud).save({
        name: StringHelper.randomize(10),
      });

      await expect(
        controller.make({
          fwcloud: newfwcloud.id,
          firewall: firewall.id,
          routingGroup: group.id,
        } as unknown as Request),
      ).rejected;
    });

    it('should throw error if the fwcloud does not exist', async () => {
      await expect(
        controller.make({
          params: {
            fwcloud: -1,
            firewall: firewall.id,
            routingGroup: group.id,
          },
        } as unknown as Request),
      ).rejected;
    });

    it('should throw error if the firewall does not exist', async () => {
      await expect(
        controller.make({
          params: {
            fwcloud: fwcProduct.fwcloud.id,
            firewall: -1,
            routingGroup: group.id,
          },
        } as unknown as Request),
      ).rejected;
    });

    it('should throw error if the group does not exist', async () => {
      await expect(
        controller.make({
          params: {
            fwcloud: fwcProduct.fwcloud.id,
            firewall: firewall.id,
            routingGroup: -1,
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
            routingGroup: group.id,
          },
        } as unknown as Request),
      ).to.be.undefined;
    });
  });
});
