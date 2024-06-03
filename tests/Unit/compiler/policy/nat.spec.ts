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

import { describeName, expect } from "../../../mocha/global-setup";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { getRepository } from "typeorm";
import StringHelper from "../../../../src/utils/string.helper";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { PolicyRule } from "../../../../src/models/policy/PolicyRule";
import db from "../../../../src/database/database-manager";
import { PolicyTypesMap } from "../../../../src/models/policy/PolicyType";
import { RulePositionsMap } from "../../../../src/models/policy/PolicyPosition";
import { populateRule } from "./utils";
import { AvailablePolicyCompilers, PolicyCompiler } from "../../../../src/compiler/policy/PolicyCompiler";

describe(describeName('Policy Compiler Unit Tests - SNAT and DNAT'), () => {
  let fwcloud: number;
  let dbCon: any;
  let rule: number;
  let translatedAddr: number;
  let translatedService: number;

  let IPv: string;
  let compiler: AvailablePolicyCompilers;
  let nat: string;

  const ruleData = {
      firewall: 0,
      type: 0,
      rule_order: 1,
      action: 1,
      active: 1,
      special: 0,
      options: 1    
  }

  async function runTest(posData: [number, number][], cs: string): Promise<void> {
    for (let i=0; i<posData.length; i++)
      await populateRule(rule,posData[i][0],posData[i][1]); 
    
    const rulesData: any = await PolicyRule.getPolicyData('compiler', dbCon, fwcloud, ruleData.firewall, ruleData.type, [rule], null);
    const result = await PolicyCompiler.compile(compiler, rulesData);
      
    expect(result).to.eql([{
      id: rule,
      active: ruleData.active,
      comment: null,
      cs: cs
    }]); 
  }
    

  before(async () => {
    dbCon = db.getQuery();

    fwcloud = (await getRepository(FwCloud).save(getRepository(FwCloud).create({ name: StringHelper.randomize(10) }))).id;
    ruleData.firewall = (await getRepository(Firewall).save(getRepository(Firewall).create({ name: StringHelper.randomize(10), fwCloudId: fwcloud }))).id;
  });
  
  describe('Not allowed combinations (IPTables)', () => {
    before(() => { IPv = 'IPv4'; compiler = 'IPTables'; });

    it('in SNAT should throw error if translated service is empty', async () => {
      nat = 'SNAT'
      ruleData.type = PolicyTypesMap.get(`${IPv}:${nat}`);
      translatedService = 20029; // Standard https service.
      rule = await PolicyRule.insertPolicy_r(ruleData);
      await populateRule(rule, RulePositionsMap.get(`${IPv}:${nat}:Translated Service`),translatedService);
      let error: any;
      
      try {
        const rulesData: any = await PolicyRule.getPolicyData('compiler', dbCon, fwcloud, ruleData.firewall, ruleData.type, [rule], null);
        const result = await PolicyCompiler.compile(compiler, rulesData);
      } catch(err) { error = err }

      expect(error).to.eql({
        fwcErr: 999999,
        msg: "For SNAT 'Translated Service' must be empty if 'Translated Source' is empty"
      });
    });

    it('in DNAT should throw error if translated destination is empty', async () => {
      nat = 'DNAT'
      ruleData.type = PolicyTypesMap.get(`${IPv}:${nat}`);
      translatedService = 20029; // Standard https service.
      rule = await PolicyRule.insertPolicy_r(ruleData);
      await populateRule(rule, RulePositionsMap.get(`${IPv}:${nat}:Translated Service`),translatedService);
      let error: any;
      
      try {
        const rulesData: any = await PolicyRule.getPolicyData('compiler', dbCon, fwcloud, ruleData.firewall, ruleData.type, [rule], null);
        const result = await PolicyCompiler.compile(compiler, rulesData);
      } catch(err) { error = err }

      expect(error).to.eql({
        fwcErr: 999999,
        msg: "For DNAT 'Translated Destination' is mandatory"
      });
    });
  });

  describe('Not allowed combinations (NFTables)', () => {
    before(() => { IPv = 'IPv4'; compiler = 'NFTables'; });

    it('in SNAT should throw error if translated service is empty', async () => {
      nat = 'SNAT'
      ruleData.type = PolicyTypesMap.get(`${IPv}:${nat}`);
      translatedService = 20029; // Standard https service.
      rule = await PolicyRule.insertPolicy_r(ruleData);
      await populateRule(rule, RulePositionsMap.get(`${IPv}:${nat}:Translated Service`),translatedService);
      let error: any;
      
      try {
        const rulesData: any = await PolicyRule.getPolicyData('compiler', dbCon, fwcloud, ruleData.firewall, ruleData.type, [rule], null);
        const result = await PolicyCompiler.compile(compiler, rulesData);
      } catch(err) { error = err }

      expect(error).to.eql({
        fwcErr: 999999,
        msg: "For SNAT 'Translated Service' must be empty if 'Translated Source' is empty"
      });
    });

    it('in DNAT should throw error if translated destination is empty', async () => {
      nat = 'DNAT'
      ruleData.type = PolicyTypesMap.get(`${IPv}:${nat}`);
      translatedService = 20029; // Standard https service.
      rule = await PolicyRule.insertPolicy_r(ruleData);
      await populateRule(rule, RulePositionsMap.get(`${IPv}:${nat}:Translated Service`),translatedService);
      let error: any;
      
      try {
        const rulesData: any = await PolicyRule.getPolicyData('compiler', dbCon, fwcloud, ruleData.firewall, ruleData.type, [rule], null);
        const result = await PolicyCompiler.compile(compiler, rulesData);
      } catch(err) { error = err }

      expect(error).to.eql({
        fwcErr: 999999,
        msg: "For DNAT 'Translated Destination' is mandatory"
      });
    });
  });

  describe('SNAT with TCP translated service (IPTables)', () => {
    before(() => {
      IPv = 'IPv4';
      compiler = 'IPTables';
      nat = 'SNAT';
      ruleData.type = PolicyTypesMap.get(`${IPv}:${nat}`);
      translatedAddr = 50010; // Standard VRRP IP
      translatedService = 20029; // Standard https service.
    });

    beforeEach(async () => {
      rule = await PolicyRule.insertPolicy_r(ruleData);
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Source`),translatedAddr);      
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Service`),translatedService); 
    });
  
    it('only with translated source and translated service', async () => {
      await runTest([], `$IPTABLES -t nat -A POSTROUTING -j ${nat} -p tcp --to-source 224.0.0.18:443\n`);
    });


    it('with translated source, translated service and one source', async () => {
      // 70003 - Net 10.0.0.0/8
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003]], `$IPTABLES -t nat -A POSTROUTING -s 10.0.0.0/8 -j ${nat} -p tcp --to-source 224.0.0.18:443\n`);
    });

    it('with translated source, translated service and one service', async () => {
      // 20020 - Auth service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Service`), 20020]], `$IPTABLES -t nat -A POSTROUTING -p tcp --dport 113 -j ${nat} --to-source 224.0.0.18:443\n`);
    });

    it('with translated source, translated service, one source and one service', async () => {
      // 70003 - Net 10.0.0.0/8
      // 20020 - Auth service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003],[RulePositionsMap.get(`${IPv}:${nat}:Service`), 20020]], `$IPTABLES -t nat -A POSTROUTING -p tcp --dport 113 -s 10.0.0.0/8 -j ${nat} --to-source 224.0.0.18:443\n`);
    });
  });

  describe('SNAT with TCP translated service (NFTables)', () => {
    before(() => {
      IPv = 'IPv4';
      compiler = 'NFTables';
      nat = 'SNAT';
      ruleData.type = PolicyTypesMap.get(`${IPv}:${nat}`);
      translatedAddr = 50010; // Standard VRRP IP
      translatedService = 20029; // Standard https service.
    });

    beforeEach(async () => {
      rule = await PolicyRule.insertPolicy_r(ruleData);
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Source`),translatedAddr);      
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Service`),translatedService); 
    });
  
    it('only with translated source and translated service', async () => {
      await runTest([], `$NFT add rule ip nat POSTROUTING ip protocol tcp counter ${nat.toLowerCase()} to 224.0.0.18:443\n`);
    });


    it('with translated source, translated service and one source', async () => {
      // 70003 - Net 10.0.0.0/8
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003]], `$NFT add rule ip nat POSTROUTING ip saddr 10.0.0.0/8 ip protocol tcp counter ${nat.toLowerCase()} to 224.0.0.18:443\n`);
    });

    it('with translated source, translated service and one service', async () => {
      // 20020 - Auth service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Service`), 20020]], `$NFT add rule ip nat POSTROUTING tcp dport 113 ip protocol tcp counter ${nat.toLowerCase()} to 224.0.0.18:443\n`);
    });

    it('with translated source, translated service, one source and one service', async () => {
      // 70003 - Net 10.0.0.0/8
      // 20020 - Auth service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003],[RulePositionsMap.get(`${IPv}:${nat}:Service`), 20020]], `$NFT add rule ip nat POSTROUTING tcp dport 113 ip saddr 10.0.0.0/8 ip protocol tcp counter ${nat.toLowerCase()} to 224.0.0.18:443\n`);
    });
  });

  describe('SNAT with UDP translated service (IPTables)', () => {
    before(() => {
      IPv = 'IPv4';
      compiler = 'IPTables';
      nat = 'SNAT';
      ruleData.type = PolicyTypesMap.get(`${IPv}:${nat}`);
      translatedAddr = 50010; // Standard VRRP IP
      translatedService = 40011; // Standard domain service.
    });

    beforeEach(async () => {
      rule = await PolicyRule.insertPolicy_r(ruleData);
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Source`),translatedAddr);      
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Service`),translatedService); 
    });
  
    it('only with translated source and translated service', async () => {
      await runTest([], `$IPTABLES -t nat -A POSTROUTING -j ${nat} -p udp --to-source 224.0.0.18:53\n`);
    });


    it('with translated source, translated service and one source', async () => {
      // 70003 - Net 10.0.0.0/8
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003]], `$IPTABLES -t nat -A POSTROUTING -s 10.0.0.0/8 -j ${nat} -p udp --to-source 224.0.0.18:53\n`);
    });

    it('with translated source, translated service and one service', async () => {
      // 40031 - Rsync service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Service`), 40031]], `$IPTABLES -t nat -A POSTROUTING -p udp --dport 873 -j ${nat} --to-source 224.0.0.18:53\n`);
    });

    it('with translated source, translated service, one source and one service', async () => {
      // 70003 - Net 10.0.0.0/8
      // 40031 - Rsync service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003],[RulePositionsMap.get(`${IPv}:${nat}:Service`), 40031]], `$IPTABLES -t nat -A POSTROUTING -p udp --dport 873 -s 10.0.0.0/8 -j ${nat} --to-source 224.0.0.18:53\n`);
    });
  });

  describe('SNAT with UDP translated service (NFTables)', () => {
    before(() => {
      IPv = 'IPv4';
      compiler = 'NFTables';
      nat = 'SNAT';
      ruleData.type = PolicyTypesMap.get(`${IPv}:${nat}`);
      translatedAddr = 50010; // Standard VRRP IP
      translatedService = 40011; // Standard domain service.
    });

    beforeEach(async () => {
      rule = await PolicyRule.insertPolicy_r(ruleData);
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Source`),translatedAddr);      
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Service`),translatedService); 
    });
  
    it('only with translated source and translated service', async () => {
      await runTest([], `$NFT add rule ip nat POSTROUTING ip protocol udp counter ${nat.toLowerCase()} to 224.0.0.18:53\n`);
    });


    it('with translated source, translated service and one source', async () => {
      // 70003 - Net 10.0.0.0/8
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003]], `$NFT add rule ip nat POSTROUTING ip saddr 10.0.0.0/8 ip protocol udp counter ${nat.toLowerCase()} to 224.0.0.18:53\n`);
    });

    it('with translated source, translated service and one service', async () => {
      // 40031 - Rsync service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Service`), 40031]], `$NFT add rule ip nat POSTROUTING udp dport 873 ip protocol udp counter ${nat.toLowerCase()} to 224.0.0.18:53\n`);
    });

    it('with translated source, translated service, one source and one service', async () => {
      // 70003 - Net 10.0.0.0/8
      // 40031 - Rsync service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003],[RulePositionsMap.get(`${IPv}:${nat}:Service`), 40031]], `$NFT add rule ip nat POSTROUTING udp dport 873 ip saddr 10.0.0.0/8 ip protocol udp counter ${nat.toLowerCase()} to 224.0.0.18:53\n`);
    });
  });

  describe('DNAT with TCP translated service (IPTables)', () => {
    before(() => {
      IPv = 'IPv4';
      compiler = 'IPTables';
      nat = 'DNAT';
      ruleData.type = PolicyTypesMap.get(`${IPv}:${nat}`);
      translatedAddr = 50010; // Standard VRRP IP
      translatedService = 20029; // Standard https service.
    });

    beforeEach(async () => {
      rule = await PolicyRule.insertPolicy_r(ruleData);
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Destination`),translatedAddr);      
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Service`),translatedService); 
    });
  
    it('only with translated source and translated service', async () => {
      await runTest([], `$IPTABLES -t nat -A PREROUTING -j ${nat} -p tcp --to-destination 224.0.0.18:443\n`);
    });


    it('with translated source, translated service and one source', async () => {
      // 70003 - Net 10.0.0.0/8
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003]], `$IPTABLES -t nat -A PREROUTING -s 10.0.0.0/8 -j ${nat} -p tcp --to-destination 224.0.0.18:443\n`);
    });

    it('with translated source, translated service and one service', async () => {
      // 20020 - Auth service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Service`), 20020]], `$IPTABLES -t nat -A PREROUTING -p tcp --dport 113 -j ${nat} --to-destination 224.0.0.18:443\n`);
    });

    it('with translated source, translated service, one source and one service', async () => {
      // 70003 - Net 10.0.0.0/8
      // 20020 - Auth service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003],[RulePositionsMap.get(`${IPv}:${nat}:Service`), 20020]], `$IPTABLES -t nat -A PREROUTING -p tcp --dport 113 -s 10.0.0.0/8 -j ${nat} --to-destination 224.0.0.18:443\n`);
    });
  });

  describe('DNAT with TCP translated service (NFTables)', () => {
    before(() => {
      IPv = 'IPv4';
      compiler = 'NFTables';
      nat = 'DNAT';
      ruleData.type = PolicyTypesMap.get(`${IPv}:${nat}`);
      translatedAddr = 50010; // Standard VRRP IP
      translatedService = 20029; // Standard https service.
    });

    beforeEach(async () => {
      rule = await PolicyRule.insertPolicy_r(ruleData);
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Destination`),translatedAddr);      
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Service`),translatedService); 
    });
  
    it('only with translated source and translated service', async () => {
      await runTest([], `$NFT add rule ip nat PREROUTING ip protocol tcp counter ${nat.toLowerCase()} to 224.0.0.18:443\n`);
    });


    it('with translated source, translated service and one source', async () => {
      // 70003 - Net 10.0.0.0/8
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003]], `$NFT add rule ip nat PREROUTING ip saddr 10.0.0.0/8 ip protocol tcp counter ${nat.toLowerCase()} to 224.0.0.18:443\n`);
    });

    it('with translated source, translated service and one service', async () => {
      // 20020 - Auth service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Service`), 20020]], `$NFT add rule ip nat PREROUTING tcp dport 113 ip protocol tcp counter ${nat.toLowerCase()} to 224.0.0.18:443\n`);
    });

    it('with translated source, translated service, one source and one service', async () => {
      // 70003 - Net 10.0.0.0/8
      // 20020 - Auth service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003],[RulePositionsMap.get(`${IPv}:${nat}:Service`), 20020]], `$NFT add rule ip nat PREROUTING tcp dport 113 ip saddr 10.0.0.0/8 ip protocol tcp counter ${nat.toLowerCase()} to 224.0.0.18:443\n`);
    });
  });

  describe('SNAT with UDP translated service (IPTables)', () => {
    before(() => {
      IPv = 'IPv4';
      compiler = 'IPTables';
      nat = 'DNAT';
      ruleData.type = PolicyTypesMap.get(`${IPv}:${nat}`);
      translatedAddr = 50010; // Standard VRRP IP
      translatedService = 40011; // Standard domain service.
    });

    beforeEach(async () => {
      rule = await PolicyRule.insertPolicy_r(ruleData);
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Destination`),translatedAddr);      
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Service`),translatedService); 
    });
  
    it('only with translated source and translated service', async () => {
      await runTest([], `$IPTABLES -t nat -A PREROUTING -j ${nat} -p udp --to-destination 224.0.0.18:53\n`);
    });


    it('with translated source, translated service and one source', async () => {
      // 70003 - Net 10.0.0.0/8
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003]], `$IPTABLES -t nat -A PREROUTING -s 10.0.0.0/8 -j ${nat} -p udp --to-destination 224.0.0.18:53\n`);
    });

    it('with translated source, translated service and one service', async () => {
      // 40031 - Rsync service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Service`), 40031]], `$IPTABLES -t nat -A PREROUTING -p udp --dport 873 -j ${nat} --to-destination 224.0.0.18:53\n`);
    });

    it('with translated source, translated service, one source and one service', async () => {
      // 70003 - Net 10.0.0.0/8
      // 40031 - Rsync service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003],[RulePositionsMap.get(`${IPv}:${nat}:Service`), 40031]], `$IPTABLES -t nat -A PREROUTING -p udp --dport 873 -s 10.0.0.0/8 -j ${nat} --to-destination 224.0.0.18:53\n`);
    });
  });

  describe('SNAT with UDP translated service (NFTables)', () => {
    before(() => {
      IPv = 'IPv4';
      compiler = 'NFTables';
      nat = 'DNAT';
      ruleData.type = PolicyTypesMap.get(`${IPv}:${nat}`);
      translatedAddr = 50010; // Standard VRRP IP
      translatedService = 40011; // Standard domain service.
    });

    beforeEach(async () => {
      rule = await PolicyRule.insertPolicy_r(ruleData);
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Destination`),translatedAddr);      
      await populateRule(rule,RulePositionsMap.get(`${IPv}:${nat}:Translated Service`),translatedService); 
    });
  
    it('only with translated source and translated service', async () => {
      await runTest([], `$NFT add rule ip nat PREROUTING ip protocol udp counter ${nat.toLowerCase()} to 224.0.0.18:53\n`);
    });


    it('with translated source, translated service and one source', async () => {
      // 70003 - Net 10.0.0.0/8
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003]], `$NFT add rule ip nat PREROUTING ip saddr 10.0.0.0/8 ip protocol udp counter ${nat.toLowerCase()} to 224.0.0.18:53\n`);
    });

    it('with translated source, translated service and one service', async () => {
      // 40031 - Rsync service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Service`), 40031]], `$NFT add rule ip nat PREROUTING udp dport 873 ip protocol udp counter ${nat.toLowerCase()} to 224.0.0.18:53\n`);
    });

    it('with translated source, translated service, one source and one service', async () => {
      // 70003 - Net 10.0.0.0/8
      // 40031 - Rsync service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003],[RulePositionsMap.get(`${IPv}:${nat}:Service`), 40031]], `$NFT add rule ip nat PREROUTING udp dport 873 ip saddr 10.0.0.0/8 ip protocol udp counter ${nat.toLowerCase()} to 224.0.0.18:53\n`);
    });
  });
});