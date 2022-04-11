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
import { PolicyRule, PolicyRuleOptMask, SpecialPolicyRules } from "../../../../src/models/policy/PolicyRule";
import db from "../../../../src/database/database-manager";
import { PolicyTypesMap } from "../../../../src/models/policy/PolicyType";
import { RulePositionsMap } from "../../../../src/models/policy/PolicyPosition";
import { populateRule } from "./utils";
import { AvailablePolicyCompilers, PolicyCompiler } from "../../../../src/compiler/policy/PolicyCompiler";
import { FwCloudFactory, FwCloudProduct } from "../../../utils/fwcloud-factory";

describe(describeName('Policy Compiler Unit Tests - Hook script rule'), () => {
  let fwcProduct: FwCloudProduct;
  let dbCon: any;
  let IPv: string;
  let compiler: AvailablePolicyCompilers;

  const code_before_cmt = '###########################\n# Hook script rule code:';
  const code_end_cmt = '###########################';

  const run_before_code = 'echo "Script rule code"';
  const run_after_code = 'echo "Other code"';

  const comment = "This is the comment text.\nSecond comment line.\n";

  let ruleData = {
      firewall: 0,
      type: 0,
      rule_order: 1,
      action: 1,
      active: 1,
      special: SpecialPolicyRules.HOOKSCRIPT,
      options: 0,
      run_before: null,
      run_after: null,
      fw_apply_to: null,
      comment: null
  }

  async function runTest(comment?: string): Promise<void> {
    ruleData.run_before = run_before_code;
    
    const rule = await PolicyRule.insertPolicy_r(ruleData);
    if (ruleData.type === PolicyTypesMap.get(`${IPv}:DNAT`))
      await populateRule(rule,RulePositionsMap.get(`${IPv}:DNAT:Translated Destination`),50010); // 50010 = Standard VRRP IP
    const rulesData: any = await PolicyRule.getPolicyData('compiler', dbCon, fwcProduct.fwcloud.id, ruleData.firewall, ruleData.type, [rule], null);
    const result = await PolicyCompiler.compile(compiler, rulesData);
    
    expect(result).to.eql([{
      id: rule,
      active: ruleData.active,
      comment: ruleData.comment ? ruleData.comment : null,
      cs: `${ruleData.fw_apply_to ? `if [ \"$HOSTNAME\" = \"${fwcProduct.firewall.name}\" ]; then\n` : ''}${code_before_cmt}\n${run_before_code}\n${code_end_cmt}\n${ruleData.fw_apply_to ? 'fi\n' : ''}`
    }]); 
  }


  before(async () => {
    dbCon = db.getQuery();
    fwcProduct = await (new FwCloudFactory()).make();
    ruleData.firewall = fwcProduct.firewall.id;
  });
  
  describe('IPv4', () => {
    before(() => { IPv = 'IPv4' });

    describe('Hook script rule code is included in rule compilation (IPTables, INPUT chain)', () => {
      before(() => { 
        compiler = 'IPTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:INPUT`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null;
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });

      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (NFTables, INPUT chain)', () => {
      before(() => { 
        compiler = 'NFTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:INPUT`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null; 
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });

      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (IPTables, OUTPUT chain)', () => {
      before(() => { 
        compiler = 'IPTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:OUTPUT`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null;
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });

      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (NFTables, OUTPUT chain)', () => {
      before(() => { 
        compiler = 'NFTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:OUTPUT`); 
        ruleData.comment = null;
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (IPTables, FORWARD chain)', () => {
      before(() => { 
        compiler = 'IPTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:FORWARD`); 
        ruleData.comment = null;
        ruleData.fw_apply_to = null; 
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (NFTables, FORWARD chain)', () => {
      before(() => { 
        compiler = 'NFTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:FORWARD`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null;
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (IPTables, SNAT)', () => {
      before(() => { 
        compiler = 'IPTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:SNAT`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null;
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (NFTables, SNAT)', () => {
      before(() => { 
        compiler = 'NFTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:SNAT`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null;
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (IPTables, DNAT)', () => {
      before(() => { 
        compiler = 'IPTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:DNAT`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null;
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (NFTables, DNAT)', () => {
      before(() => { 
        compiler = 'NFTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:DNAT`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null;
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });

      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });      
  });

  describe('IPv6', () => {
    before(() => { IPv = 'IPv6' });

    describe('Hook script rule code is included in rule compilation (IPTables, INPUT chain)', () => {
      before(() => { 
        compiler = 'IPTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:INPUT`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null; 
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (NFTables, INPUT chain)', () => {
      before(() => { 
        compiler = 'NFTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:INPUT`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null; 
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (IPTables, OUTPUT chain)', () => {
      before(() => { 
        compiler = 'IPTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:OUTPUT`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null;
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (NFTables, OUTPUT chain)', () => {
      before(() => { 
        compiler = 'NFTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:OUTPUT`); 
        ruleData.comment = null;
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (IPTables, FORWARD chain)', () => {
      before(() => { 
        compiler = 'IPTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:FORWARD`); 
        ruleData.comment = null;
        ruleData.fw_apply_to = null; 
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (NFTables, FORWARD chain)', () => {
      before(() => { 
        compiler = 'NFTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:FORWARD`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null;
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (IPTables, SNAT)', () => {
      before(() => { 
        compiler = 'IPTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:SNAT`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null;
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (NFTables, SNAT)', () => {
      before(() => { 
        compiler = 'NFTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:SNAT`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null;
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (IPTables, DNAT)', () => {
      before(() => { 
        compiler = 'IPTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:DNAT`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null;
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });

    describe('Hook script rule code is included in rule compilation (NFTables, DNAT)', () => {
      before(() => { 
        compiler = 'NFTables'; 
        ruleData.type = PolicyTypesMap.get(`${IPv}:DNAT`); 
        ruleData.comment = null; 
        ruleData.fw_apply_to = null;
        ruleData.options = 0; 
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should not include after run code', async () => {
        ruleData.run_after = run_after_code;
        await runTest();
      });

      it('should not include rule comment', async () => {
        ruleData.comment = comment;
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
      
      it('should not include logging code in compilation', async () => {
        ruleData.options = PolicyRuleOptMask.LOG; // Enable logging option in rule. 
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATEFUL;
        await runTest();
        ruleData.options = PolicyRuleOptMask.LOG | PolicyRuleOptMask.STATELESS;
        await runTest();
      });
    });
  });
});