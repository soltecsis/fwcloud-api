/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { describeName, expect } from '../../../mocha/global-setup';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import StringHelper from '../../../../src/utils/string.helper';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import db from '../../../../src/database/database-manager';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';
import { RulePositionsMap } from '../../../../src/models/policy/PolicyPosition';
import { populateRule } from './utils';
import {
  AvailablePolicyCompilers,
  PolicyCompiler,
} from '../../../../src/compiler/policy/PolicyCompiler';
import { EntityManager } from 'typeorm';

describe(describeName('Policy Compiler Unit Tests - Hook scripts'), () => {
  let fwcloud: number;
  let dbCon: any;
  const IPv = 'IPv4';
  let compiler: AvailablePolicyCompilers;
  let manager: EntityManager;
  const code_before_cmt = '###########################\n# Before rule load code:';
  const code_after_cmt = '###########################\n# After rule load code:';
  const code_end_cmt = '###########################\n';

  const code_before = 'echo "Code before policy rule load"';
  const code_after = 'echo "Code before policy rule load"';

  const ruleData = {
    firewall: 0,
    type: 0,
    rule_order: 1,
    action: 1,
    active: 1,
    special: 0,
    options: 1,
    run_before: null,
    run_after: null,
  };

  async function runTest(where: 'B' | 'A' | 'BA', cs: string): Promise<void> {
    ruleData.run_before = where === 'B' || where === 'BA' ? code_before : null;
    ruleData.run_after = where === 'A' || where === 'BA' ? code_after : null;

    const rule = await PolicyRule.insertPolicy_r(ruleData);
    if (ruleData.type === PolicyTypesMap.get(`${IPv}:DNAT`))
      await populateRule(rule, RulePositionsMap.get(`${IPv}:DNAT:Translated Destination`), 50010); // 50010 = Standard VRRP IP
    const rulesData: any = await PolicyRule.getPolicyData(
      'compiler',
      dbCon,
      fwcloud,
      ruleData.firewall,
      ruleData.type,
      [rule],
      null,
    );
    const result = await PolicyCompiler.compile(compiler, rulesData);

    expect(result).to.eql([
      {
        id: rule,
        active: ruleData.active,
        comment: null,
        cs: cs,
      },
    ]);
  }

  before(async () => {
    dbCon = db.getQuery();
    manager = db.getSource().manager;
    fwcloud = (
      await manager
        .getRepository(FwCloud)
        .save(manager.getRepository(FwCloud).create({ name: StringHelper.randomize(10) }))
    ).id;
    ruleData.firewall = (
      await manager
        .getRepository(Firewall)
        .save(
          manager
            .getRepository(Firewall)
            .create({ name: StringHelper.randomize(10), fwCloudId: fwcloud }),
        )
    ).id;
  });

  describe('Script code is included in rule compilation (IPTables, INPUT chain)', () => {
    before(() => {
      ruleData.type = PolicyTypesMap.get(`${IPv}:INPUT`);
      compiler = 'IPTables';
    });

    it('before policy rule load', async () => {
      await runTest(
        'B',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -A INPUT -m conntrack --ctstate NEW -j ACCEPT\n`,
      );
    });

    it('after policy rule load', async () => {
      await runTest(
        'A',
        `$IPTABLES -A INPUT -m conntrack --ctstate NEW -j ACCEPT\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });

    it('before and after policy rule load', async () => {
      await runTest(
        'BA',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -A INPUT -m conntrack --ctstate NEW -j ACCEPT\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });
  });

  describe('Script code is included in rule compilation (NFTables, INPUT chain)', () => {
    before(() => {
      ruleData.type = PolicyTypesMap.get(`${IPv}:INPUT`);
      compiler = 'NFTables';
    });

    it('before policy rule load', async () => {
      await runTest(
        'B',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$NFT add rule ip filter INPUT ct state new counter accept\n`,
      );
    });

    it('after policy rule load', async () => {
      await runTest(
        'A',
        `$NFT add rule ip filter INPUT ct state new counter accept\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });

    it('before and after policy rule load', async () => {
      await runTest(
        'BA',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$NFT add rule ip filter INPUT ct state new counter accept\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });
  });

  describe('Script code is included in rule compilation (IPTables, OUTPUT chain)', () => {
    before(() => {
      ruleData.type = PolicyTypesMap.get(`${IPv}:OUTPUT`);
      compiler = 'IPTables';
    });

    it('before policy rule load', async () => {
      await runTest(
        'B',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -A OUTPUT -m conntrack --ctstate NEW -j ACCEPT\n`,
      );
    });

    it('after policy rule load', async () => {
      await runTest(
        'A',
        `$IPTABLES -A OUTPUT -m conntrack --ctstate NEW -j ACCEPT\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });

    it('before and after policy rule load', async () => {
      await runTest(
        'BA',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -A OUTPUT -m conntrack --ctstate NEW -j ACCEPT\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });
  });

  describe('Script code is included in rule compilation (NFTables, OUTPUT chain)', () => {
    before(() => {
      ruleData.type = PolicyTypesMap.get(`${IPv}:OUTPUT`);
      compiler = 'NFTables';
    });

    it('before policy rule load', async () => {
      await runTest(
        'B',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$NFT add rule ip filter OUTPUT ct state new counter accept\n`,
      );
    });

    it('after policy rule load', async () => {
      await runTest(
        'A',
        `$NFT add rule ip filter OUTPUT ct state new counter accept\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });

    it('before and after policy rule load', async () => {
      await runTest(
        'BA',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$NFT add rule ip filter OUTPUT ct state new counter accept\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });
  });

  describe('Script code is included in rule compilation (IPTables, FORWARD chain)', () => {
    before(() => {
      ruleData.type = PolicyTypesMap.get(`${IPv}:FORWARD`);
      compiler = 'IPTables';
    });

    it('before policy rule load', async () => {
      await runTest(
        'B',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -A FORWARD -m conntrack --ctstate NEW -j ACCEPT\n`,
      );
    });

    it('after policy rule load', async () => {
      await runTest(
        'A',
        `$IPTABLES -A FORWARD -m conntrack --ctstate NEW -j ACCEPT\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });

    it('before and after policy rule load', async () => {
      await runTest(
        'BA',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -A FORWARD -m conntrack --ctstate NEW -j ACCEPT\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });
  });

  describe('Script code is included in rule compilation (NFTables, FORWARD chain)', () => {
    before(() => {
      ruleData.type = PolicyTypesMap.get(`${IPv}:FORWARD`);
      compiler = 'NFTables';
    });

    it('before policy rule load', async () => {
      await runTest(
        'B',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$NFT add rule ip filter FORWARD ct state new counter accept\n`,
      );
    });

    it('after policy rule load', async () => {
      await runTest(
        'A',
        `$NFT add rule ip filter FORWARD ct state new counter accept\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });

    it('before and after policy rule load', async () => {
      await runTest(
        'BA',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$NFT add rule ip filter FORWARD ct state new counter accept\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });
  });

  describe('Script code is included in rule compilation (IPTables, SNAT)', () => {
    before(() => {
      ruleData.type = PolicyTypesMap.get(`${IPv}:SNAT`);
      compiler = 'IPTables';
    });

    it('before policy rule load', async () => {
      await runTest(
        'B',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -t nat -A POSTROUTING -j MASQUERADE\n`,
      );
    });

    it('after policy rule load', async () => {
      await runTest(
        'A',
        `$IPTABLES -t nat -A POSTROUTING -j MASQUERADE\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });

    it('before and after policy rule load', async () => {
      await runTest(
        'BA',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -t nat -A POSTROUTING -j MASQUERADE\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });
  });

  describe('Script code is included in rule compilation (NFTables, SNAT)', () => {
    before(() => {
      ruleData.type = PolicyTypesMap.get(`${IPv}:SNAT`);
      compiler = 'NFTables';
    });

    it('before policy rule load', async () => {
      await runTest(
        'B',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$NFT add rule ip nat POSTROUTING counter masquerade\n`,
      );
    });

    it('after policy rule load', async () => {
      await runTest(
        'A',
        `$NFT add rule ip nat POSTROUTING counter masquerade\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });

    it('before and after policy rule load', async () => {
      await runTest(
        'BA',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$NFT add rule ip nat POSTROUTING counter masquerade\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });
  });

  describe('Script code is included in rule compilation (IPTables, DNAT)', () => {
    before(() => {
      ruleData.type = PolicyTypesMap.get(`${IPv}:DNAT`);
      compiler = 'IPTables';
    });

    it('before policy rule load', async () => {
      await runTest(
        'B',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -t nat -A PREROUTING -j DNAT --to-destination 224.0.0.18\n`,
      );
    });

    it('after policy rule load', async () => {
      await runTest(
        'A',
        `$IPTABLES -t nat -A PREROUTING -j DNAT --to-destination 224.0.0.18\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });

    it('before and after policy rule load', async () => {
      await runTest(
        'BA',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -t nat -A PREROUTING -j DNAT --to-destination 224.0.0.18\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });
  });

  describe('Script code is included in rule compilation (NFTables, DNAT)', () => {
    before(() => {
      ruleData.type = PolicyTypesMap.get(`${IPv}:DNAT`);
      compiler = 'NFTables';
    });

    it('before policy rule load', async () => {
      await runTest(
        'B',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$NFT add rule ip nat PREROUTING counter dnat to 224.0.0.18\n`,
      );
    });

    it('after policy rule load', async () => {
      await runTest(
        'A',
        `$NFT add rule ip nat PREROUTING counter dnat to 224.0.0.18\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });

    it('before and after policy rule load', async () => {
      await runTest(
        'BA',
        `${code_before_cmt}\n${code_before}\n${code_end_cmt}$NFT add rule ip nat PREROUTING counter dnat to 224.0.0.18\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`,
      );
    });
  });
});
