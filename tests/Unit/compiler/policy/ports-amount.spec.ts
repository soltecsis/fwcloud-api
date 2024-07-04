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
import { PolicyRuleToIPObj } from '../../../../src/models/policy/PolicyRuleToIPObj';
import {
  AvailablePolicyCompilers,
  PolicyCompiler,
} from '../../../../src/compiler/policy/PolicyCompiler';
import { EntityManager } from 'typeorm';

describe(describeName('Policy Compiler Unit Tests - TCP/UDP ports amount control'), () => {
  let fwcloud: number;
  let dbCon: any;
  let rule: number;
  let compiler: AvailablePolicyCompilers;

  const ruleData = {
    firewall: 0,
    type: 1,
    rule_order: 1,
    action: 1,
    active: 1,
    special: 0,
    options: 1,
  };
  let manager: EntityManager;

  async function populateRule(type: 'TCP' | 'UDP', amount: number): Promise<void> {
    for (let i = 1; i <= amount; i++) {
      await PolicyRuleToIPObj.insertPolicy_r__ipobj({
        rule: rule,
        ipobj: type === 'TCP' ? 20030 + i : 40014 + i, // TCP or UDP std objects
        ipobj_g: -1,
        interface: -1,
        position: 3,
        position_order: i,
      });
    }
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

  beforeEach(async () => {
    rule = await PolicyRule.insertPolicy_r(ruleData);
  });

  describe('TCP ports limit control (IPTables)', () => {
    before(() => {
      compiler = 'IPTables';
    });

    it('should accept 15 TCP ports per iptables command', async () => {
      await populateRule('TCP', 15);
      const rulesData: any = await PolicyRule.getPolicyData(
        'compiler',
        dbCon,
        fwcloud,
        ruleData.firewall,
        1,
        [rule],
        null,
      );
      const result = await PolicyCompiler.compile(compiler, rulesData);

      expect(result).to.eql([
        {
          id: rule,
          active: ruleData.active,
          comment: null,
          cs: '$IPTABLES -A INPUT -p tcp -m multiport --dports 993,6667,88,543,544,389,636,98,515,135,1433,3306,139,2049,119 -m conntrack --ctstate NEW -j ACCEPT\n',
        },
      ]);
    });

    it('16 TCP ports should be split in two iptables commands', async () => {
      await populateRule('TCP', 16);
      const rulesData: any = await PolicyRule.getPolicyData(
        'compiler',
        dbCon,
        fwcloud,
        ruleData.firewall,
        1,
        [rule],
        null,
      );
      const result = await PolicyCompiler.compile(compiler, rulesData);

      expect(result).to.eql([
        {
          id: rule,
          active: ruleData.active,
          comment: null,
          cs: '$IPTABLES -A INPUT -p tcp -m multiport --dports 993,6667,88,543,544,389,636,98,515,135,1433,3306,139,2049,119 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A INPUT -p tcp -m multiport --dports 563 -m conntrack --ctstate NEW -j ACCEPT\n',
        },
      ]);
    });

    it('should count range ports as two ports', async () => {
      await populateRule('TCP', 14);
      await PolicyRuleToIPObj.insertPolicy_r__ipobj({
        rule: rule,
        ipobj: 20026, // std TCP object is a range port
        ipobj_g: -1,
        interface: -1,
        position: 3,
        position_order: 15,
      });
      const rulesData: any = await PolicyRule.getPolicyData(
        'compiler',
        dbCon,
        fwcloud,
        ruleData.firewall,
        1,
        [rule],
        null,
      );
      const result = await PolicyCompiler.compile(compiler, rulesData);

      expect(result).to.eql([
        {
          id: rule,
          active: ruleData.active,
          comment: null,
          cs: '$IPTABLES -A INPUT -p tcp --sport 20 --dport 1024:65535 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A INPUT -p tcp -m multiport --dports 993,6667,88,543,544,389,636,98,515,135,1433,3306,139,2049 -m conntrack --ctstate NEW -j ACCEPT\n',
        },
      ]);
    });
  });

  describe('TCP ports limit control (NFTables)', () => {
    before(() => {
      compiler = 'NFTables';
    });

    it('should accept 15 TCP ports per iptables command', async () => {
      await populateRule('TCP', 15);
      const rulesData: any = await PolicyRule.getPolicyData(
        'compiler',
        dbCon,
        fwcloud,
        ruleData.firewall,
        1,
        [rule],
        null,
      );
      const result = await PolicyCompiler.compile(compiler, rulesData);

      expect(result).to.eql([
        {
          id: rule,
          active: ruleData.active,
          comment: null,
          cs: '$NFT add rule ip filter INPUT ip protocol tcp tcp dport { 993,6667,88,543,544,389,636,98,515,135,1433,3306,139,2049,119} ct state new counter accept\n',
        },
      ]);
    });

    it('16 TCP ports should be split in two nftables commands', async () => {
      await populateRule('TCP', 16);
      const rulesData: any = await PolicyRule.getPolicyData(
        'compiler',
        dbCon,
        fwcloud,
        ruleData.firewall,
        1,
        [rule],
        null,
      );
      const result = await PolicyCompiler.compile(compiler, rulesData);

      expect(result).to.eql([
        {
          id: rule,
          active: ruleData.active,
          comment: null,
          cs: '$NFT add rule ip filter INPUT ip protocol tcp tcp dport { 993,6667,88,543,544,389,636,98,515,135,1433,3306,139,2049,119} ct state new counter accept\n$NFT add rule ip filter INPUT ip protocol tcp tcp dport { 563} ct state new counter accept\n',
        },
      ]);
    });

    it('should count range ports as two ports', async () => {
      await populateRule('TCP', 14);
      await PolicyRuleToIPObj.insertPolicy_r__ipobj({
        rule: rule,
        ipobj: 20026, // std TCP object is a range port
        ipobj_g: -1,
        interface: -1,
        position: 3,
        position_order: 15,
      });
      const rulesData: any = await PolicyRule.getPolicyData(
        'compiler',
        dbCon,
        fwcloud,
        ruleData.firewall,
        1,
        [rule],
        null,
      );
      const result = await PolicyCompiler.compile(compiler, rulesData);

      expect(result).to.eql([
        {
          id: rule,
          active: ruleData.active,
          comment: null,
          cs: '$NFT add rule ip filter INPUT tcp sport 20 tcp dport 1024-65535 ct state new counter accept\n$NFT add rule ip filter INPUT ip protocol tcp tcp dport { 993,6667,88,543,544,389,636,98,515,135,1433,3306,139,2049} ct state new counter accept\n',
        },
      ]);
    });
  });

  describe('UDP ports limit control (IPTables)', () => {
    before(() => {
      compiler = 'IPTables';
    });

    it('should accept 15 UDP ports per iptables command', async () => {
      await populateRule('UDP', 15);
      const rulesData: any = await PolicyRule.getPolicyData(
        'compiler',
        dbCon,
        fwcloud,
        ruleData.firewall,
        1,
        [rule],
        null,
      );
      const result = await PolicyCompiler.compile(compiler, rulesData);

      expect(result).to.eql([
        {
          id: rule,
          active: ruleData.active,
          comment: null,
          cs: '$IPTABLES -A INPUT -p udp -m multiport --dports 464,4444,135,138,137,139,2049,123,26000,1024,161,162,111,514,69 -m conntrack --ctstate NEW -j ACCEPT\n',
        },
      ]);
    });

    it('16 UDP ports should be split in two iptables commands', async () => {
      await populateRule('UDP', 16);
      const rulesData: any = await PolicyRule.getPolicyData(
        'compiler',
        dbCon,
        fwcloud,
        ruleData.firewall,
        1,
        [rule],
        null,
      );
      const result = await PolicyCompiler.compile(compiler, rulesData);

      expect(result).to.eql([
        {
          id: rule,
          active: ruleData.active,
          comment: null,
          cs: '$IPTABLES -A INPUT -p udp -m multiport --dports 464,4444,135,138,137,139,2049,123,26000,1024,161,162,111,514,69 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A INPUT -p udp -m multiport --dports 33434:33524 -m conntrack --ctstate NEW -j ACCEPT\n',
        },
      ]);
    });

    it('should count range ports as two ports', async () => {
      await populateRule('UDP', 14);
      await PolicyRuleToIPObj.insertPolicy_r__ipobj({
        rule: rule,
        ipobj: 40014, // std UDP object that is a range port
        ipobj_g: -1,
        interface: -1,
        position: 3,
        position_order: 15,
      });
      const rulesData: any = await PolicyRule.getPolicyData(
        'compiler',
        dbCon,
        fwcloud,
        ruleData.firewall,
        1,
        [rule],
        null,
      );
      const result = await PolicyCompiler.compile(compiler, rulesData);

      expect(result).to.eql([
        {
          id: rule,
          active: ruleData.active,
          comment: null,
          cs: '$IPTABLES -A INPUT -p udp -m multiport --dports 749:750,464,4444,135,138,137,139,2049,123,26000,1024,161,162,111 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A INPUT -p udp -m multiport --dports 514 -m conntrack --ctstate NEW -j ACCEPT\n',
        },
      ]);
    });
  });

  describe('UDP ports limit control (NFTables)', () => {
    before(() => {
      compiler = 'NFTables';
    });

    it('should accept 15 UDP ports per iptables command', async () => {
      await populateRule('UDP', 15);
      const rulesData: any = await PolicyRule.getPolicyData(
        'compiler',
        dbCon,
        fwcloud,
        ruleData.firewall,
        1,
        [rule],
        null,
      );
      const result = await PolicyCompiler.compile(compiler, rulesData);

      expect(result).to.eql([
        {
          id: rule,
          active: ruleData.active,
          comment: null,
          cs: '$NFT add rule ip filter INPUT ip protocol udp udp dport { 464,4444,135,138,137,139,2049,123,26000,1024,161,162,111,514,69} ct state new counter accept\n',
        },
      ]);
    });

    it('16 UDP ports should be split in two nftables commands', async () => {
      await populateRule('UDP', 16);
      const rulesData: any = await PolicyRule.getPolicyData(
        'compiler',
        dbCon,
        fwcloud,
        ruleData.firewall,
        1,
        [rule],
        null,
      );
      const result = await PolicyCompiler.compile(compiler, rulesData);

      expect(result).to.eql([
        {
          id: rule,
          active: ruleData.active,
          comment: null,
          cs: '$NFT add rule ip filter INPUT ip protocol udp udp dport { 464,4444,135,138,137,139,2049,123,26000,1024,161,162,111,514,69} ct state new counter accept\n$NFT add rule ip filter INPUT ip protocol udp udp dport { 33434-33524} ct state new counter accept\n',
        },
      ]);
    });

    it('should count range ports as two ports', async () => {
      await populateRule('UDP', 14);
      await PolicyRuleToIPObj.insertPolicy_r__ipobj({
        rule: rule,
        ipobj: 40014, // std UDP object that is a range port
        ipobj_g: -1,
        interface: -1,
        position: 3,
        position_order: 15,
      });
      const rulesData: any = await PolicyRule.getPolicyData(
        'compiler',
        dbCon,
        fwcloud,
        ruleData.firewall,
        1,
        [rule],
        null,
      );
      const result = await PolicyCompiler.compile(compiler, rulesData);

      expect(result).to.eql([
        {
          id: rule,
          active: ruleData.active,
          comment: null,
          cs: '$NFT add rule ip filter INPUT ip protocol udp udp dport { 749-750,464,4444,135,138,137,139,2049,123,26000,1024,161,162,111} ct state new counter accept\n$NFT add rule ip filter INPUT ip protocol udp udp dport { 514} ct state new counter accept\n',
        },
      ]);
    });
  });
});
