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
import sinon, { SinonSpy } from "sinon";
import { PolicyRule } from "../../../../src/models/policy/PolicyRule";
import db from "../../../../src/database/database-manager";
import { IPTablesCompiler } from '../../../../src/compiler/iptables/iptables-compiler';
import { PolicyTypesMap } from "../../../../src/models/policy/PolicyType";
import { RulePositionsMap } from "../../../../src/models/policy/PolicyPosition";
import { populateRule } from "./utils";

describe.only(describeName('IPTables Compiler Unit Tests - Hook scripts'), () => {
  const sandbox = sinon.createSandbox();
  let spy: SinonSpy;

  let fwcloud: number;
  let dbCon: any;
  const IPv = 'IPv4' ;

  const code_before_cmt = '###########################\n# Before rule load code:';
  const code_after_cmt = '###########################\n# After rule load code:';
  const code_end_cmt = '###########################\n';

  const code_before = 'echo "Code before policy rule load"';
  const code_after = 'echo "Code before policy rule load"';

  let ruleData = {
      firewall: 0,
      type: 0,
      rule_order: 1,
      action: 1,
      active: 1,
      special: 0,
      options: 1,
      run_before: null,
      run_after: null,
  }

  async function runTest(where: 'B' | 'A' | 'BA', cs: string): Promise<void> {
    ruleData.run_before = (where==='B' || where==='BA') ? code_before : null;
    ruleData.run_after = (where==='A' || where==='BA') ? code_after : null;

    const rule = await PolicyRule.insertPolicy_r(ruleData);
    if (ruleData.type === PolicyTypesMap.get(`${IPv}:DNAT`))
      await populateRule(rule,RulePositionsMap.get(`${IPv}:DNAT:Translated Destination`),50010); // 50010 = Standard VRRP IP
    const result = await IPTablesCompiler.compile(dbCon, fwcloud, ruleData.firewall, ruleData.type, rule);
    
    expect(spy.calledOnce).to.be.true;
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
  
  beforeEach(async () => {
    spy = sandbox.spy(IPTablesCompiler, "ruleCompile");
  });
  
  afterEach(() => {
    sandbox.restore();
  });

  describe('Script code is included in rule compilation (INPUT chain)', () => {
    before(() => { ruleData.type = PolicyTypesMap.get(`${IPv}:INPUT`) });

    it('before policy rule load', async () => {
      await runTest('B',`${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -A INPUT -m conntrack --ctstate NEW -j ACCEPT\n`);
    });

    it('after policy rule load', async () => {
      await runTest('A',`$IPTABLES -A INPUT -m conntrack --ctstate NEW -j ACCEPT\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`);
    });

    it('before and after policy rule load', async () => {
      await runTest('BA',`${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -A INPUT -m conntrack --ctstate NEW -j ACCEPT\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`);
    });

  });

  describe('Script code is included in rule compilation (OUTPUT chain)', () => {
    before(() => { ruleData.type = PolicyTypesMap.get(`${IPv}:OUTPUT`) });

    it('before policy rule load', async () => {
      await runTest('B',`${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -A OUTPUT -m conntrack --ctstate NEW -j ACCEPT\n`);
    });

    it('after policy rule load', async () => {
      await runTest('A',`$IPTABLES -A OUTPUT -m conntrack --ctstate NEW -j ACCEPT\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`);
    });

    it('before and after policy rule load', async () => {
      await runTest('BA',`${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -A OUTPUT -m conntrack --ctstate NEW -j ACCEPT\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`);
    });
  });

  describe('Script code is included in rule compilation (FORWARD chain)', () => {
    before(() => { ruleData.type = PolicyTypesMap.get(`${IPv}:FORWARD`) });

    it('before policy rule load', async () => {
      await runTest('B',`${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -A FORWARD -m conntrack --ctstate NEW -j ACCEPT\n`);
    });

    it('after policy rule load', async () => {
      await runTest('A',`$IPTABLES -A FORWARD -m conntrack --ctstate NEW -j ACCEPT\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`);
    });

    it('before and after policy rule load', async () => {
      await runTest('BA',`${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -A FORWARD -m conntrack --ctstate NEW -j ACCEPT\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`);
    });
  });

  describe('Script code is included in rule compilation (SNAT)', () => {
    before(() => { ruleData.type = PolicyTypesMap.get(`${IPv}:SNAT`) });

    it('before policy rule load', async () => {
      await runTest('B',`${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -t nat -A POSTROUTING -j MASQUERADE\n`);
    });

    it('after policy rule load', async () => {
      await runTest('A',`$IPTABLES -t nat -A POSTROUTING -j MASQUERADE\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`);
    });

    it('before and after policy rule load', async () => {
      await runTest('BA',`${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -t nat -A POSTROUTING -j MASQUERADE\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`);
    });
  });

  describe('Script code is included in rule compilation (DNAT)', () => {
    before(() => { ruleData.type = PolicyTypesMap.get(`${IPv}:DNAT`) });

    it('before policy rule load', async () => {
      await runTest('B',`${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -t nat -A PREROUTING -j DNAT --to-destination 224.0.0.18\n`);
    });

    it('after policy rule load', async () => {
      await runTest('A',`$IPTABLES -t nat -A PREROUTING -j DNAT --to-destination 224.0.0.18\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`);
    });

    it('before and after policy rule load', async () => {
      await runTest('BA',`${code_before_cmt}\n${code_before}\n${code_end_cmt}$IPTABLES -t nat -A PREROUTING -j DNAT --to-destination 224.0.0.18\n${code_after_cmt}\n${code_after}\n${code_end_cmt}`);
    });
  });
});