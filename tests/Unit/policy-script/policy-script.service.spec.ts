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
    for (const compiler of ['IPTables', 'NFTables']) {
      for (const optimized of [false, true]) {
        it(`should retain validity matches in ${compiler} ${optimized ? 'optimized' : 'normal'} policy scripts`, async () => {
          firewall.options =
            (compiler === 'NFTables' ? 0x1000 : 0) |
            (optimized ? FireWallOptMask.IPTABLES_OPTIMIZED_COMPILATION : 0);
          await db.getSource().manager.getRepository(Firewall).save(firewall);
          await PolicyRule.insertPolicy_r({
            firewall: firewall.id,
            type: PolicyTypesMap.get('IPv4:INPUT'),
            rule_order: 1,
            action: 1,
            active: 1,
            special: 0,
            options: 0,
            time_start: new Date('2026-10-01T08:15:30+02:00'),
            time_end: new Date('2026-10-31T19:45:59+01:00'),
          });
          await service.compile(fwcloud.id, firewall.id);
          const script = fs.readFileSync(filePath, 'utf8');
          if (compiler === 'IPTables') {
            expect(script).to.include(
              '-m time --datestart 2026-10-01T06:15:30 --datestop 2026-10-31T18:45:59',
            );
          } else {
            const escaped = optimized ? '' : '\\';
            expect(script).to.include(
              `meta time ${escaped}>= ${Date.parse('2026-10-01T06:15:30Z') / 1000}`,
            );
            expect(script).to.include(
              `meta time ${escaped}< ${Date.parse('2026-10-31T18:45:59Z') / 1000 + 1}`,
            );
            if (optimized) {
              const blocks =
                script.match(/cat <<'FWC_NFT_RULES' \| \$NFT -f -\n[\s\S]*?\nFWC_NFT_RULES/g) ?? [];
              expect(blocks.some((block) => block.includes('meta time >='))).to.be.true;
              expect(blocks.join('\n')).not.to.include('meta time \\');
            }
          }
        });
      }
    }

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
      expect(script).to.contain(':INPUT DROP [0:0]');
      expect(script).to.contain(':OUTPUT DROP [0:0]');
      expect(script).to.contain(':FORWARD DROP [0:0]');
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
        /cat <<'FWC_IPTABLES_RESTORE' \| \$IPTABLES_RESTORE\n\*filter\n\n:INPUT DROP \[0:0\]\n:OUTPUT DROP \[0:0\]\n:FORWARD DROP \[0:0\]\n\n# Rule 1 \(ID: \d+\)\n-A INPUT -m conntrack --ctstate NEW -j ACCEPT/,
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

    it('should allow saved optimized mode when the real compiler is NFTables', async () => {
      firewall.options = 0x1000 | FireWallOptMask.IPTABLES_OPTIMIZED_COMPILATION;
      await db.getSource().manager.getRepository(Firewall).save(firewall);

      await service.compile(fwcloud.id, firewall.id);

      const script = fs.readFileSync(filePath, 'utf8');
      expect(script).to.contain('POLICY_COMPILER="NFTables"');
      expect(script).to.contain('POLICY_COMPILATION_MODE="optimized"');
    });

    it('should generate nft -f blocks for optimizable NFTables rules', async () => {
      firewall.options = 0x1000 | FireWallOptMask.IPTABLES_OPTIMIZED_COMPILATION;
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

      const script = fs.readFileSync(filePath, 'utf8');
      expect(script).to.contain("cat <<'FWC_NFT_RULES' | $NFT -f -");
      expect(script).to.contain('add rule ip filter INPUT');
      expect(script).to.contain('add rule ip filter OUTPUT');
      expect(script).to.contain('comment "Stateful firewall rule."');
      expect(script).not.to.contain('comment \\"Stateful firewall rule.\\"');
    });

    it('should not flush previous NFTables rules inside optimized nft -f blocks', async () => {
      firewall.options = 0x1000 | FireWallOptMask.IPTABLES_OPTIMIZED_COMPILATION;
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
      const nftBlocks =
        script.match(/cat <<'FWC_NFT_RULES' \| \$NFT -f -\n[\s\S]*?\nFWC_NFT_RULES/g) ?? [];

      expect(nftBlocks.length).to.be.greaterThan(0);
      expect(script).to.contain('reset_nft()');
      expect(script).to.contain('$NFT flush ruleset ip');
      for (const nftBlock of nftBlocks) {
        expect(nftBlock).not.to.contain('flush ruleset');
        expect(nftBlock).not.to.contain('flush chain');
      }
    });

    it('should generate nft -f blocks for automatic NFTables tables and mangle rules', async () => {
      firewall.options = 0x1000 | FireWallOptMask.IPTABLES_OPTIMIZED_COMPILATION;
      await db.getSource().manager.getRepository(Firewall).save(firewall);

      await PolicyRule.insertPolicy_r({
        firewall: firewall.id,
        type: PolicyTypesMap.get('IPv4:INPUT'),
        rule_order: 1,
        action: 1,
        active: 1,
        special: 0,
        options: 1,
        mark: fwcProduct.mark.id,
        run_before: null,
        run_after: null,
      });

      await service.compile(fwcloud.id, firewall.id);

      const script = fs.readFileSync(filePath, 'utf8');
      const nftBlocks =
        script.match(/cat <<'FWC_NFT_RULES' \| \$NFT -f -\n[\s\S]*?\nFWC_NFT_RULES/g) ?? [];

      expect(nftBlocks.some((block) => block.includes('add table ip filter'))).to.be.true;
      expect(
        nftBlocks.some((block) =>
          block.includes('add rule ip mangle PREROUTING counter meta mark set ct mark'),
        ),
      ).to.be.true;
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
