import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import StringHelper from '../../../../src/utils/string.helper';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import * as path from 'path';
import { Mark } from '../../../../src/models/ipobj/Mark';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { EntityManager } from 'typeorm';
import db from '../../../../src/database/database-manager';

describe(describeName('Firewall Model Unit Tests'), () => {
  let fwCloud: FwCloud;
  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    fwCloud = await manager.getRepository(FwCloud).save(
      manager.getRepository(FwCloud).create({
        name: StringHelper.randomize(10),
      }),
    );
  });

  describe('getPolicyPath()', () => {
    let policyPath: string;
    let policyFilename: string;

    beforeEach(() => {
      policyPath = testSuite.app.config.get('policy').data_dir;
      policyFilename = testSuite.app.config.get('policy').script_name;
    });

    it('should return a path if the firewall belongs to a fwcloud and it has an id', async () => {
      const firewall: Firewall = await manager.getRepository(Firewall).save(
        manager.getRepository(Firewall).create({
          name: StringHelper.randomize(10),
          fwCloudId: fwCloud.id,
        }),
      );

      expect(firewall.getPolicyFilePath()).to.be.deep.eq(
        path.join(
          policyPath,
          firewall.fwCloudId.toString(),
          firewall.id.toString(),
          policyFilename,
        ),
      );
    });

    it('should return null if the firewall does not belong to a fwcloud', async () => {
      const firewall: Firewall = await manager.getRepository(Firewall).save(
        manager.getRepository(Firewall).create({
          name: StringHelper.randomize(10),
        }),
      );

      expect(firewall.getPolicyFilePath()).to.be.null;
    });

    it('should return null if the firewall does not persisted', () => {
      const firewall: Firewall = manager.getRepository(Firewall).create({
        name: StringHelper.randomize(10),
        fwCloudId: fwCloud.id,
      });

      expect(firewall.getPolicyFilePath()).to.be.null;
    });
  });

  describe('hasMarkedRules()', () => {
    it('should return false if firewall does not have any rule', async () => {
      const firewall: Firewall = await manager.getRepository(Firewall).save(
        manager.getRepository(Firewall).create({
          name: StringHelper.randomize(10),
        }),
      );

      expect(await firewall.hasMarkedRules()).to.be.false;
    });

    it('should return false if firewall rules are not marked', async () => {
      const firewall: Firewall = await manager.getRepository(Firewall).save(
        manager.getRepository(Firewall).create({
          name: StringHelper.randomize(10),
        }),
      );

      for (let i = 0; i < 10; i++) {
        await manager.getRepository(PolicyRule).save(
          manager.getRepository(PolicyRule).create({
            firewall: firewall,
            rule_order: 0,
            action: 0,
          }),
        );
      }

      expect(await firewall.hasMarkedRules()).to.be.false;
    });

    it('should return true if at least one rule is marked', async () => {
      const firewall: Firewall = await manager.getRepository(Firewall).save(
        manager.getRepository(Firewall).create({
          name: StringHelper.randomize(10),
          fwCloudId: fwCloud.id,
        }),
      );

      for (let i = 0; i < 10; i++) {
        await manager.getRepository(PolicyRule).save(
          manager.getRepository(PolicyRule).create({
            firewall: firewall,
            rule_order: 0,
            action: 0,
          }),
        );
      }

      await manager.getRepository(PolicyRule).save(
        manager.getRepository(PolicyRule).create({
          firewall: firewall,
          rule_order: 0,
          action: 0,
          mark: await manager.getRepository(Mark).save(
            manager.getRepository(Mark).create({
              name: StringHelper.randomize(10),
              code: 0,
              fwCloud: fwCloud,
            }),
          ),
        }),
      );

      expect(await firewall.hasMarkedRules()).to.be.true;
    });

    it('should return true if a rule is marked with a mark which id is 0', async () => {
      const firewall: Firewall = await manager.getRepository(Firewall).save(
        manager.getRepository(Firewall).create({
          name: StringHelper.randomize(10),
          fwCloudId: fwCloud.id,
        }),
      );

      await manager.getRepository(PolicyRule).save(
        manager.getRepository(PolicyRule).create({
          firewall: firewall,
          rule_order: 0,
          action: 0,
          mark: await manager.getRepository(Mark).save(
            manager.getRepository(Mark).create({
              id: 0,
              name: StringHelper.randomize(10),
              code: 0,
              fwCloud: fwCloud,
            }),
          ),
        }),
      );

      expect(await firewall.hasMarkedRules()).to.be.true;
    });
  });
});
