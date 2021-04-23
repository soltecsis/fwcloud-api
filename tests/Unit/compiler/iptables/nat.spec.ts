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
import { searchInPolicyData, populateRule } from "./utils";

describe(describeName('IPTables Compiler Unit Tests - SNAT and DNAT'), () => {
  const sandbox = sinon.createSandbox();
  let spy: SinonSpy;

  let fwcloud: number;
  let dbCon: any;
  let rule: number;
  let translatedAddr: number;
  let translatedService: number;

  let IPv: string;
  let nat: string;

  let ruleData = {
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
    
    const result = await IPTablesCompiler.compile(dbCon, fwcloud, ruleData.firewall, ruleData.type, rule);
    
    expect(spy.calledOnce).to.be.true;
    for (let i=0; i<posData.length; i++)
      expect(searchInPolicyData(spy.getCall(0).args[0],posData[i][0],posData[i][1])).to.be.true;
    expect(searchInPolicyData(spy.getCall(0).args[0],RulePositionsMap.get(`${IPv}:${nat}:Translated ${nat==='SNAT'?'Source':'Destination'}`),translatedAddr)).to.be.true;
    expect(searchInPolicyData(spy.getCall(0).args[0],RulePositionsMap.get(`${IPv}:${nat}:Translated Service`),translatedService)).to.be.true;

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

  describe('Not allowed combinations', () => {
    before(() => { IPv = 'IPv4' });

    it('in SNAT should throw error if translated service is empty', async () => {
      nat = 'SNAT'
      ruleData.type = PolicyTypesMap.get(`${IPv}:${nat}`);
      translatedService = 20029; // Standard https service.
      rule = await PolicyRule.insertPolicy_r(ruleData);
      await populateRule(rule, RulePositionsMap.get(`${IPv}:${nat}:Translated Service`),translatedService);
      let error: any;
      
      try {
        const result = await IPTablesCompiler.compile(dbCon, fwcloud, ruleData.firewall, ruleData.type, rule);
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
        const result = await IPTablesCompiler.compile(dbCon, fwcloud, ruleData.firewall, ruleData.type, rule);
      } catch(err) { error = err }

      expect(error).to.eql({
        fwcErr: 999999,
        msg: "For DNAT 'Translated Destination' is mandatory"
      });
    });
  });


  describe('SNAT with TCP translated service', () => {
    before(() => {
      IPv = 'IPv4';
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
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003]], `$IPTABLES -t nat -A POSTROUTING -s 10.0.0.0/255.0.0.0 -j ${nat} -p tcp --to-source 224.0.0.18:443\n`);
    });

    it('with translated source, translated service and one service', async () => {
      // 20020 - Auth service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Service`), 20020]], `$IPTABLES -t nat -A POSTROUTING -p tcp --dport 113 -j ${nat} --to-source 224.0.0.18:443\n`);
    });

    it('with translated source, translated service, one source and one service', async () => {
      // 70003 - Net 10.0.0.0/8
      // 20020 - Auth service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003],[RulePositionsMap.get(`${IPv}:${nat}:Service`), 20020]], `$IPTABLES -t nat -A POSTROUTING -p tcp --dport 113 -s 10.0.0.0/255.0.0.0 -j ${nat} --to-source 224.0.0.18:443\n`);
    });
  });

  describe('SNAT with UDP translated service', () => {
    before(() => {
      IPv = 'IPv4';
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
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003]], `$IPTABLES -t nat -A POSTROUTING -s 10.0.0.0/255.0.0.0 -j ${nat} -p udp --to-source 224.0.0.18:53\n`);
    });

    it('with translated source, translated service and one service', async () => {
      // 40031 - Rsync service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Service`), 40031]], `$IPTABLES -t nat -A POSTROUTING -p udp --dport 873 -j ${nat} --to-source 224.0.0.18:53\n`);
    });

    it('with translated source, translated service, one source and one service', async () => {
      // 70003 - Net 10.0.0.0/8
      // 40031 - Rsync service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003],[RulePositionsMap.get(`${IPv}:${nat}:Service`), 40031]], `$IPTABLES -t nat -A POSTROUTING -p udp --dport 873 -s 10.0.0.0/255.0.0.0 -j ${nat} --to-source 224.0.0.18:53\n`);
    });
  });

  describe('DNAT with TCP translated service', () => {
    before(() => {
      IPv = 'IPv4';
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
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003]], `$IPTABLES -t nat -A PREROUTING -s 10.0.0.0/255.0.0.0 -j ${nat} -p tcp --to-destination 224.0.0.18:443\n`);
    });

    it('with translated source, translated service and one service', async () => {
      // 20020 - Auth service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Service`), 20020]], `$IPTABLES -t nat -A PREROUTING -p tcp --dport 113 -j ${nat} --to-destination 224.0.0.18:443\n`);
    });

    it('with translated source, translated service, one source and one service', async () => {
      // 70003 - Net 10.0.0.0/8
      // 20020 - Auth service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003],[RulePositionsMap.get(`${IPv}:${nat}:Service`), 20020]], `$IPTABLES -t nat -A PREROUTING -p tcp --dport 113 -s 10.0.0.0/255.0.0.0 -j ${nat} --to-destination 224.0.0.18:443\n`);
    });
  });

  describe('SNAT with UDP translated service', () => {
    before(() => {
      IPv = 'IPv4';
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
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003]], `$IPTABLES -t nat -A PREROUTING -s 10.0.0.0/255.0.0.0 -j ${nat} -p udp --to-destination 224.0.0.18:53\n`);
    });

    it('with translated source, translated service and one service', async () => {
      // 40031 - Rsync service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Service`), 40031]], `$IPTABLES -t nat -A PREROUTING -p udp --dport 873 -j ${nat} --to-destination 224.0.0.18:53\n`);
    });

    it('with translated source, translated service, one source and one service', async () => {
      // 70003 - Net 10.0.0.0/8
      // 40031 - Rsync service
      await runTest([[RulePositionsMap.get(`${IPv}:${nat}:Source`), 70003],[RulePositionsMap.get(`${IPv}:${nat}:Service`), 40031]], `$IPTABLES -t nat -A PREROUTING -p udp --dport 873 -s 10.0.0.0/255.0.0.0 -j ${nat} --to-destination 224.0.0.18:53\n`);
    });
  });
});