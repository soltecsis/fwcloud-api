import { expect } from 'chai';
import {
  AbstractApplication,
  app,
} from '../../../src/fonaments/abstract-application';
import { describeName, testSuite } from '../../mocha/global-setup';
import { PolicyRuleService } from '../../../src/policy-rule/policy-rule.service';
import { FwCloudFactory, FwCloudProduct } from '../../utils/fwcloud-factory';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { Firewall } from '../../../src/models/firewall/Firewall';
import * as path from 'path';
import * as fs from 'fs';

describe(describeName('PolicyRuleService Unit tests'), async () => {
  let app: AbstractApplication;
  let fwcProduct: FwCloudProduct;
  let fwcloud: FwCloud;
  let firewall: Firewall;
  let filePath: string;
  let service: PolicyRuleService;

  beforeEach(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();
    fwcProduct = await new FwCloudFactory().make();

    fwcloud = fwcProduct.fwcloud;
    firewall = fwcProduct.firewall;

    filePath = path.join(
      app.config.get('policy').data_dir,
      fwcloud.id.toString(),
      firewall.id.toString(),
      app.config.get('policy').script_name,
    );

    service = await app.getService<PolicyRuleService>(PolicyRuleService.name);
  });

  describe('Bootstrap', () => {
    it('service is instantiated in during bootstrap process', async () => {
      expect(
        await app.getService<PolicyRuleService>(PolicyRuleService.name),
      ).to.be.instanceOf(PolicyRuleService);
    });
  });

  describe('compile()', () => {
    it('should create script', async () => {
      await service.compile(fwcloud.id, firewall.id);
      expect(fs.existsSync(filePath));
    });
  });

  describe('content()', () => {
    beforeEach(() => {
      try {
        // filePath might not exists
        fs.unlinkSync(filePath);
      } catch {}
    });

    it('should returns the same content as the script content', async () => {
      await service.compile(fwcloud.id, firewall.id);
      const content: string = await service.content(fwcloud.id, firewall.id);
      expect(content).to.eq(fs.readFileSync(filePath).toString());
    });

    it('should throw an exception if the file does not exist', async () => {
      await expect(
        service.content(fwcloud.id, firewall.id),
      ).to.eventually.be.rejected.and.have.property('code', 'ENOENT');
    });
  });
});
