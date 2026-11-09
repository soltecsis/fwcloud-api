/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { expect } from 'chai';
import * as fs from 'fs';
import { describeName, testSuite } from '../../mocha/global-setup';
import { PolicyRuleService } from '../../../src/policy-rule/policy-rule.service';
import { FwCloudFactory, FwCloudProduct } from '../../utils/fwcloud-factory';
import db from '../../../src/database/database-manager';
import { Firewall } from '../../../src/models/firewall/Firewall';
import { PolicyRule } from '../../../src/models/policy/PolicyRule';
import { PolicyTypesMap } from '../../../src/models/policy/PolicyType';
import { RulePositionsMap } from '../../../src/models/policy/PolicyPosition';
import { IPObj } from '../../../src/models/ipobj/IPObj';
import { populateRule } from '../compiler/policy/utils';

describe(describeName('PolicyScript Unit tests - DNS objects resolution check'), () => {
  let fwcProduct: FwCloudProduct;
  let firewall: Firewall;
  let service: PolicyRuleService;
  let dns: IPObj;

  async function addRule(
    policyType: string,
    position: string,
    ipobj: number,
    data: { active?: number; fw_apply_to?: number } = {},
  ): Promise<number> {
    const rule = await PolicyRule.insertPolicy_r({
      firewall: firewall.id,
      type: PolicyTypesMap.get(policyType),
      rule_order: 1,
      action: 1,
      active: data.active ?? 1,
      special: 0,
      options: 0,
      run_before: null,
      run_after: null,
      fw_apply_to: data.fw_apply_to ?? null,
    });
    await populateRule(rule, RulePositionsMap.get(`${policyType}:${position}`), ipobj);

    return rule;
  }

  async function compileScript(): Promise<string> {
    await service.compile(fwcProduct.fwcloud.id, firewall.id);
    return fs.readFileSync(firewall.getPolicyFilePath(), 'utf8');
  }

  function dnsCheckFunction(script: string): string {
    return script.match(/\npolicy_dns_check\(\) \{\n[\s\S]*?\n\}\n/)[0].slice(1);
  }

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    fwcProduct = await new FwCloudFactory().make();
    firewall = fwcProduct.firewall;
    service = await testSuite.app.getService<PolicyRuleService>(PolicyRuleService.name);

    dns = await db.getSource().manager.getRepository(IPObj).save({
      name: 'www.fwcloud.net',
      ipObjTypeId: 9,
      fwCloudId: fwcProduct.fwcloud.id,
    });
  });

  it('should check DNS objects used as source or destination with the iptables command of the rule', async () => {
    const src = await addRule('IPv4:INPUT', 'Source', dns.id);
    const dst = await addRule('IPv4:OUTPUT', 'Destination', dns.id);
    const src6 = await addRule('IPv6:INPUT', 'Source', dns.id);

    expect(dnsCheckFunction(await compileScript())).to.equal(
      'policy_dns_check() {\n' +
        `  policy_check_dns "$IPTABLES" 'www.fwcloud.net' 'DNS object '\\''www.fwcloud.net'\\'' (ID: ${dns.id}) in source of rule ${src} (IPv4)' || return 1\n` +
        `  policy_check_dns "$IPTABLES" 'www.fwcloud.net' 'DNS object '\\''www.fwcloud.net'\\'' (ID: ${dns.id}) in destination of rule ${dst} (IPv4)' || return 1\n` +
        `  policy_check_dns "$IP6TABLES" 'www.fwcloud.net' 'DNS object '\\''www.fwcloud.net'\\'' (ID: ${dns.id}) in source of rule ${src6} (IPv6)' || return 1\n` +
        '  return 0\n' +
        '}\n',
    );
  });

  it('should check the hostname stored in the DNS object even when it is not resolvable', async () => {
    await db.getSource().manager.getRepository(IPObj).update(dns.id, { name: 'DNS' });
    await addRule('IPv4:INPUT', 'Source', dns.id);

    expect(dnsCheckFunction(await compileScript())).to.contain(
      `policy_check_dns "$IPTABLES" DNS 'DNS object '\\''DNS'\\'' (ID: ${dns.id}) in source`,
    );
  });

  it('should not check DNS objects of inactive rules nor other object types', async () => {
    const address = await db.getSource().manager.getRepository(IPObj).save({
      name: 'address',
      address: '192.0.2.1',
      ip_version: 4,
      ipObjTypeId: 5,
      fwCloudId: fwcProduct.fwcloud.id,
    });
    await addRule('IPv4:INPUT', 'Source', dns.id, { active: 0 });
    await addRule('IPv4:INPUT', 'Source', address.id);

    expect(dnsCheckFunction(await compileScript())).to.equal(
      'policy_dns_check() {\n  return 0\n}\n',
    );
  });

  it('should only check DNS objects of rules applied to a cluster node on that node', async () => {
    firewall.name = 'node 1';
    await db.getSource().manager.getRepository(Firewall).save(firewall);
    const rule = await addRule('IPv4:INPUT', 'Source', dns.id, { fw_apply_to: firewall.id });

    expect(dnsCheckFunction(await compileScript())).to.equal(
      'policy_dns_check() {\n' +
        `  if [ "$HOSTNAME" = 'node 1' ]; then\n` +
        `    policy_check_dns "$IPTABLES" 'www.fwcloud.net' 'DNS object '\\''www.fwcloud.net'\\'' (ID: ${dns.id}) in source of rule ${rule} (IPv4)' || return 1\n` +
        '  fi\n' +
        '  return 0\n' +
        '}\n',
    );
  });

  it('should not check DNS objects for the NFTables compiler', async () => {
    firewall.options = 0x1000; // NFTables compiler
    await db.getSource().manager.getRepository(Firewall).save(firewall);
    await addRule('IPv4:INPUT', 'Source', dns.id);

    expect(dnsCheckFunction(await compileScript())).to.equal(
      'policy_dns_check() {\n  return 0\n}\n',
    );
  });

  it('should run the DNS check before the install action replaces the installed script', async () => {
    const script = await compileScript();

    // The check must run (with DNS resolution temporarily allowed, since the running policy may not
    // allow it) and abort the install on failure, before "chmod 700" starts replacing the old script.
    expect(script).to.match(
      /\n {2}install\)\n(?: {4}#.*\n)*(?: {4}policy_dns_resolution allow\n)? {4}policy_dns_check\n {4}FWC_DNS_CHECK_STATUS=\$\?\n {4}policy_dns_resolution revoke\n {4}test "\$FWC_DNS_CHECK_STATUS" = "0" \|\| exit 1\n {4}chmod 700 "\$0"\n/,
    );
  });
});
