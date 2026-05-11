import { expect } from 'chai';
import { AbstractApplication, app } from '../../../src/fonaments/abstract-application';
import { describeName, testSuite } from '../../mocha/global-setup';
import { PolicyRuleService } from '../../../src/policy-rule/policy-rule.service';
import { FwCloudFactory, FwCloudProduct } from '../../utils/fwcloud-factory';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { Firewall, FireWallOptMask } from '../../../src/models/firewall/Firewall';
import * as path from 'path';
import * as fs from 'fs';
import db from '../../../src/database/database-manager';
import { PolicyRule } from '../../../src/models/policy/PolicyRule';
import { PolicyTypesMap } from '../../../src/models/policy/PolicyType';

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
      expect(await app.getService<PolicyRuleService>(PolicyRuleService.name)).to.be.instanceOf(
        PolicyRuleService,
      );
    });
  });

  describe('compile()', () => {
    it('should create script', async () => {
      await service.compile(fwcloud.id, firewall.id);
      expect(fs.existsSync(filePath));
    });

    it('should include the resolved normal compilation mode in the generated script', async () => {
      await service.compile(fwcloud.id, firewall.id);

      expect(fs.readFileSync(filePath, 'utf8')).to.contain('POLICY_COMPILATION_MODE="normal"');
    });

    it('should include the resolved optimized compilation mode in the generated script', async () => {
      firewall.options = FireWallOptMask.IPTABLES_OPTIMIZED_COMPILATION;
      await db.getSource().manager.getRepository(Firewall).save(firewall);

      await service.compile(fwcloud.id, firewall.id);

      expect(fs.readFileSync(filePath, 'utf8')).to.contain('POLICY_COMPILATION_MODE="optimized"');
    });

    it('should generate iptables-restore blocks for optimizable IPTables rules', async () => {
      firewall.options = FireWallOptMask.IPTABLES_OPTIMIZED_COMPILATION;
      await db.getSource().manager.getRepository(Firewall).save(firewall);

      await PolicyRule.insertPolicy_r({
        firewall: firewall.id,
        type: PolicyTypesMap.get('IPv4:INPUT'),
        rule_order: 1,
        action: 1,
        active: 1,
        special: 0,
        options: 1,
        run_before: null,
        run_after: null,
      });

      await service.compile(fwcloud.id, firewall.id);

      const script = fs.readFileSync(filePath, 'utf8');
      expect(script).to.contain("cat <<'FWC_IPTABLES_RESTORE' | $IPTABLES_RESTORE");
      expect(script).to.contain('*filter');
      expect(script).to.contain('-A INPUT -m conntrack --ctstate NEW -j ACCEPT');
      expect(script).to.contain('COMMIT');
    });

    it('should add rule labels inside optimized iptables-restore blocks', async () => {
      firewall.options = FireWallOptMask.IPTABLES_OPTIMIZED_COMPILATION;
      await db.getSource().manager.getRepository(Firewall).save(firewall);

      await PolicyRule.insertPolicy_r({
        firewall: firewall.id,
        type: PolicyTypesMap.get('IPv4:INPUT'),
        rule_order: 1,
        action: 1,
        active: 1,
        special: 0,
        options: 1,
        run_before: null,
        run_after: null,
      });

      await service.compile(fwcloud.id, firewall.id);

      const script = fs.readFileSync(filePath, 'utf8');
      expect(script).to.match(
        /cat <<'FWC_IPTABLES_RESTORE' \| \$IPTABLES_RESTORE\n\*filter\n\n# Rule 1 \(ID: \d+\)\n-A INPUT -m conntrack --ctstate NEW -j ACCEPT/,
      );
    });

    it('should normalize shell-quoted rule comments to double quotes for iptables-restore', async () => {
      firewall.options = FireWallOptMask.IPTABLES_OPTIMIZED_COMPILATION;
      await db.getSource().manager.getRepository(Firewall).save(firewall);

      await PolicyRule.insertPolicy_r({
        firewall: firewall.id,
        type: PolicyTypesMap.get('IPv4:INPUT'),
        rule_order: 1,
        action: 1,
        active: 1,
        special: 0,
        options: 1,
        comment: 'Stateful firewall rule.',
        run_before: null,
        run_after: null,
      });

      await service.compile(fwcloud.id, firewall.id);

      const script = fs.readFileSync(filePath, 'utf8');
      expect(script).to.contain('--comment "Stateful firewall rule."');
      expect(script).not.to.contain("--comment 'Stateful firewall rule.'");
    });

    it('should use --noflush after the first optimized iptables-restore execution', async () => {
      firewall.options = FireWallOptMask.IPTABLES_OPTIMIZED_COMPILATION;
      await db.getSource().manager.getRepository(Firewall).save(firewall);

      await PolicyRule.insertPolicy_r({
        firewall: firewall.id,
        type: PolicyTypesMap.get('IPv4:INPUT'),
        rule_order: 1,
        action: 1,
        active: 1,
        special: 0,
        options: 1,
        run_before: null,
        run_after: null,
      });
      await PolicyRule.insertPolicy_r({
        firewall: firewall.id,
        type: PolicyTypesMap.get('IPv4:OUTPUT'),
        rule_order: 1,
        action: 1,
        active: 1,
        special: 0,
        options: 1,
        run_before: null,
        run_after: null,
      });

      await service.compile(fwcloud.id, firewall.id);

      expect(fs.readFileSync(filePath, 'utf8')).to.contain('$IPTABLES_RESTORE --noflush');
    });

    it('should reject saved optimized mode when the real compiler is NFTables', async () => {
      firewall.options = 0x1000 | FireWallOptMask.IPTABLES_OPTIMIZED_COMPILATION;
      await db.getSource().manager.getRepository(Firewall).save(firewall);

      await service.compile(fwcloud.id, firewall.id).catch((error) => {
        expect(error).to.deep.include({
          msg: 'Optimized policy compilation is only supported for IPTables firewalls',
        });
      });
    });
  });

  describe('content()', () => {
    beforeEach(() => {
      try {
        // filePath might not exists
        fs.unlinkSync(filePath);
      } catch (e) {
        return e;
      }
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
