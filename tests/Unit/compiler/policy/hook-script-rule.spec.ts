/*!
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { PolicyRule, SpecialPolicyRules } from "../../../../src/models/policy/PolicyRule";
import db from "../../../../src/database/database-manager";
import { PolicyTypesMap } from "../../../../src/models/policy/PolicyType";
import { RulePositionsMap } from "../../../../src/models/policy/PolicyPosition";
import { populateRule } from "./utils";
import { AvailablePolicyCompilers, PolicyCompiler } from "../../../../src/compiler/policy/PolicyCompiler";

describe(describeName('Policy Compiler Unit Tests - Hook script rule'), () => {
  let fwcloud: number;
  let dbCon: any;
  const IPv = 'IPv4' ;
  let compiler: AvailablePolicyCompilers;

  const code_before_cmt = '###########################\n# Hook script rule code:';
  const code_end_cmt = '###########################';

  const run_before_code = 'echo "Script rule code"';
  const run_after_code = 'echo "Other code"';

  let ruleData = {
      firewall: 0,
      type: 0,
      rule_order: 1,
      action: 1,
      active: 1,
      special: SpecialPolicyRules.HOOKSCRIPT,
      options: 1,
      run_before: null,
      run_after: null,
  }

  async function runTest(): Promise<void> {
    ruleData.run_before = run_before_code;
    
    const rule = await PolicyRule.insertPolicy_r(ruleData);
    if (ruleData.type === PolicyTypesMap.get(`${IPv}:DNAT`))
      await populateRule(rule,RulePositionsMap.get(`${IPv}:DNAT:Translated Destination`),50010); // 50010 = Standard VRRP IP
    const rulesData: any = await PolicyRule.getPolicyData('compiler', dbCon, fwcloud, ruleData.firewall, ruleData.type, [rule], null);
    const result = await PolicyCompiler.compile(compiler, rulesData);
    
    expect(result).to.eql([{
      id: rule,
      active: ruleData.active,
      comment: null,
      cs: `${code_before_cmt}\n${run_before_code}\n${code_end_cmt}\n`
    }]); 
  }


  before(async () => {
    dbCon = db.getQuery();

    fwcloud = (await getRepository(FwCloud).save(getRepository(FwCloud).create({ name: StringHelper.randomize(10) }))).id;
    ruleData.firewall = (await getRepository(Firewall).save(getRepository(Firewall).create({ name: StringHelper.randomize(10), fwCloudId: fwcloud }))).id;
  });
  
  describe('Hook script rule code is included in rule compilation (IPTables, INPUT chain)', () => {
    before(() => { ruleData.type = PolicyTypesMap.get(`${IPv}:INPUT`); compiler = 'IPTables'; });

    it('should compile as expected', async () => {
      await runTest();
    });

    it('should not include after run code', async () => {
      ruleData.run_after = run_after_code;
      await runTest();
    });
  });

  describe('Hook script rule code is included in rule compilation (NFTables, INPUT chain)', () => {
    before(() => { ruleData.type = PolicyTypesMap.get(`${IPv}:INPUT`); compiler = 'NFTables'; });

    it('should compile as expected', async () => {
      await runTest();
    });

    it('should not include after run code', async () => {
      ruleData.run_after = run_after_code;
      await runTest();
    });
  });

  describe('Hook script rule code is included in rule compilation (IPTables, OUTPUT chain)', () => {
    before(() => { ruleData.type = PolicyTypesMap.get(`${IPv}:OUTPUT`); compiler = 'IPTables'; });

    it('should compile as expected', async () => {
      await runTest();
    });

    it('should not include after run code', async () => {
      ruleData.run_after = run_after_code;
      await runTest();
    });
  });

  describe('Hook script rule code is included in rule compilation (NFTables, OUTPUT chain)', () => {
    before(() => { ruleData.type = PolicyTypesMap.get(`${IPv}:OUTPUT`); compiler = 'NFTables'; });

    it('should compile as expected', async () => {
      await runTest();
    });

    it('should not include after run code', async () => {
      ruleData.run_after = run_after_code;
      await runTest();
    });
  });

  describe('Hook script rule code is included in rule compilation (IPTables, FORWARD chain)', () => {
    before(() => { ruleData.type = PolicyTypesMap.get(`${IPv}:FORWARD`); compiler = 'IPTables'; });

    it('should compile as expected', async () => {
      await runTest();
    });

    it('should not include after run code', async () => {
      ruleData.run_after = run_after_code;
      await runTest();
    });
  });

  describe('Hook script rule code is included in rule compilation (NFTables, FORWARD chain)', () => {
    before(() => { ruleData.type = PolicyTypesMap.get(`${IPv}:FORWARD`); compiler = 'NFTables'; });

    it('should compile as expected', async () => {
      await runTest();
    });

    it('should not include after run code', async () => {
      ruleData.run_after = run_after_code;
      await runTest();
    });
  });

  describe('Hook script rule code is included in rule compilation (IPTables, SNAT)', () => {
    before(() => { ruleData.type = PolicyTypesMap.get(`${IPv}:SNAT`); compiler = 'IPTables'; });

    it('should compile as expected', async () => {
      await runTest();
    });

    it('should not include after run code', async () => {
      ruleData.run_after = run_after_code;
      await runTest();
    });
  });

  describe('Hook script rule code is included in rule compilation (NFTables, SNAT)', () => {
    before(() => { ruleData.type = PolicyTypesMap.get(`${IPv}:SNAT`); compiler = 'NFTables'; });

    it('should compile as expected', async () => {
      await runTest();
    });

    it('should not include after run code', async () => {
      ruleData.run_after = run_after_code;
      await runTest();
    });
  });

  describe('Hook script rule code is included in rule compilation (IPTables, DNAT)', () => {
    before(() => { ruleData.type = PolicyTypesMap.get(`${IPv}:DNAT`); compiler = 'IPTables'; });

    it('should compile as expected', async () => {
      await runTest();
    });

    it('should not include after run code', async () => {
      ruleData.run_after = run_after_code;
      await runTest();
    });
  });

  describe('Hook script rule code is included in rule compilation (NFTables, DNAT)', () => {
    before(() => { ruleData.type = PolicyTypesMap.get(`${IPv}:DNAT`); compiler = 'NFTables'; });

    it('should compile as expected', async () => {
      await runTest();
    });

    it('should not include after run code', async () => {
      ruleData.run_after = run_after_code;
      await runTest();
    });
  });
});