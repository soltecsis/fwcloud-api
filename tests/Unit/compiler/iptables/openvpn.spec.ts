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
import { IPTablesCompiler, POLICY_TYPE_DNAT, POLICY_TYPE_FORWARD, POLICY_TYPE_INPUT, POLICY_TYPE_OUTPUT, POLICY_TYPE_SNAT } from '../../../../src/compiler/iptables/iptables-compiler';
import { Ca } from "../../../../src/models/vpn/pki/Ca";
import { Crt } from "../../../../src/models/vpn/pki/Crt";
import { OpenVPN } from "../../../../src/models/vpn/openvpn/OpenVPN";
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { OpenVPNOption } from "../../../../src/models/vpn/openvpn/openvpn-option.model";
import { PolicyRuleToOpenVPN } from "../../../../src/models/policy/PolicyRuleToOpenVPN";
import { searchInPolicyData } from "./utils"
import { PolicyRuleToIPObj } from "../../../../src/models/policy/PolicyRuleToIPObj";
import { IPObjGroup } from "../../../../src/models/ipobj/IPObjGroup";

describe(describeName('IPTables Compiler Unit Tests - OpenVPN'), () => {
  const sandbox = sinon.createSandbox();
  let spy: SinonSpy;

  let dbCon: any;
  let fwcloud: number;
  let vpnCli: number;
  let vpnCliIP: number;
  let natIP: number;
  let group: number;
  let useGroup = false;

  let ruleData = {
      firewall: 0,
      type: 0,
      rule_order: 1,
      action: 1,
      active: 1,
      special: 0,
      options: 1    
  }

  async function runTest(policyType: number, rulePosition: number, cs: string): Promise<void> {
    ruleData.type = policyType;
    const rule = await PolicyRule.insertPolicy_r(ruleData);
    
    if (!useGroup) {
      await getRepository(PolicyRuleToOpenVPN).save(getRepository(PolicyRuleToOpenVPN).create({ 
        policyRuleId: rule,
        openVPNId: vpnCli,
        policyPositionId: rulePosition,
        position_order: 1
      }));
    } else {
      await getRepository(PolicyRuleToIPObj).save(getRepository(PolicyRuleToIPObj).create({ 
        policyRuleId: rule,
        ipObjId: -1,
        ipObjGroupId: group,
        interfaceId: -1,
        policyPositionId: rulePosition,
        position_order: 1
      }));
    }

    if (rulePosition!=14 && rulePosition!=34 && (policyType===POLICY_TYPE_SNAT || policyType===POLICY_TYPE_DNAT)) {
      await getRepository(PolicyRuleToIPObj).save(getRepository(PolicyRuleToIPObj).create({ 
        policyRuleId: rule,
        ipObjId: natIP,
        ipObjGroupId: -1,
        interfaceId: -1,
        policyPositionId: policyType===POLICY_TYPE_SNAT ? 14 : 34,
        position_order: 1
      }));  
    }

    const result = await IPTablesCompiler.compile(dbCon, fwcloud, ruleData.firewall, policyType, rule);
      
    expect(spy.calledOnce).to.be.true;
    expect(searchInPolicyData(spy.getCall(0).args[0],rulePosition,vpnCliIP)).to.be.true;

    if (rulePosition!=14 && rulePosition!=34 && (policyType===POLICY_TYPE_SNAT || policyType===POLICY_TYPE_DNAT))
      expect(searchInPolicyData(spy.getCall(0).args[0],policyType===POLICY_TYPE_SNAT?14:34,natIP)).to.be.true;

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
    const ca = (await getRepository(Ca).save(getRepository(Ca).create({ cn: StringHelper.randomize(10), fwCloudId: fwcloud, days: 18250 }))).id;
    const crtSrv = (await getRepository(Crt).save(getRepository(Crt).create({ caId: ca, cn: StringHelper.randomize(10), days: 18250, type: 2 }))).id;
    const crtCli = (await getRepository(Crt).save(getRepository(Crt).create({ caId: ca, cn: StringHelper.randomize(10), days: 18250, type: 1 }))).id;
    const vpnSrv = (await getRepository(OpenVPN).save(getRepository(OpenVPN).create({ firewallId: ruleData.firewall, crtId: crtSrv }))).id;
    vpnCli = (await getRepository(OpenVPN).save(getRepository(OpenVPN).create({ firewallId: ruleData.firewall, crtId: crtCli, parentId: vpnSrv }))).id;
    vpnCliIP = (await getRepository(IPObj).save(getRepository(IPObj).create({ fwCloudId: fwcloud, name: '10.20.30.2', ipObjTypeId: 5, address: '10.20.30.2', netmask: '/32', ip_version: 4  }))).id;
    natIP = (await getRepository(IPObj).save(getRepository(IPObj).create({ fwCloudId: fwcloud, name: '192.168.0.50', ipObjTypeId: 5, address: '192.168.0.50', netmask: '/32', ip_version: 4  }))).id;
    await getRepository(OpenVPNOption).save(getRepository(OpenVPNOption).create({ openVPNId: vpnCli, ipObjId: vpnCliIP, name: 'ifconfig-push', order: 1, scope: 0 }));
    group = (await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({ name: StringHelper.randomize(10), type: 21, fwCloudId: fwcloud}))).id;
    await OpenVPN.addToGroup(dbCon,vpnCli,group);
  });
  
  beforeEach(async () => {
    spy = sandbox.spy(IPTablesCompiler, "ruleCompile");
  });

  afterEach(() => {
    sandbox.restore();
  });


  describe('OpenVPN in policy rule', () => {
    beforeEach(async () => {
      useGroup = false;
    });

    describe('in INPUT chain', () => {
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(POLICY_TYPE_INPUT,1,'$IPTABLES -A INPUT -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(POLICY_TYPE_INPUT,2,'$IPTABLES -A INPUT -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n');
      });
    });

    describe('in OUTPUT chain', () => {
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(POLICY_TYPE_OUTPUT,4,'$IPTABLES -A OUTPUT -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(POLICY_TYPE_OUTPUT,5,'$IPTABLES -A OUTPUT -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n');
      });
    });

    describe('in FORWARD chain', () => {
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(POLICY_TYPE_FORWARD,7,'$IPTABLES -A FORWARD -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(POLICY_TYPE_FORWARD,8,'$IPTABLES -A FORWARD -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n');
      });
    });

    describe('in SNAT', () => {
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(POLICY_TYPE_SNAT,11,'$IPTABLES -t nat -A POSTROUTING -s 10.20.30.2 -j SNAT --to-source 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(POLICY_TYPE_SNAT,12,'$IPTABLES -t nat -A POSTROUTING -d 10.20.30.2 -j SNAT --to-source 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated source)', async () => { 
        await runTest(POLICY_TYPE_SNAT,14,'$IPTABLES -t nat -A POSTROUTING -j SNAT --to-source 10.20.30.2\n');
      });
    });

    describe('in DNAT', () => {
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(POLICY_TYPE_DNAT,30,'$IPTABLES -t nat -A PREROUTING -s 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(POLICY_TYPE_DNAT,31,'$IPTABLES -t nat -A PREROUTING -d 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated destination)', async () => { 
        await runTest(POLICY_TYPE_DNAT,34,'$IPTABLES -t nat -A PREROUTING -j DNAT --to-destination 10.20.30.2\n');
      });
    });
  });


  describe('OpenVPN in group in policy rule', () => {
    beforeEach(async () => {
      useGroup = true;
    });

    describe('in INPUT chain', () => {
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(POLICY_TYPE_INPUT,1,'$IPTABLES -A INPUT -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(POLICY_TYPE_INPUT,2,'$IPTABLES -A INPUT -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n');
      });
    });

    describe('in OUTPUT chain', () => {
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(POLICY_TYPE_OUTPUT,4,'$IPTABLES -A OUTPUT -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(POLICY_TYPE_OUTPUT,5,'$IPTABLES -A OUTPUT -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n');
      });
    });

    describe('in FORWARD chain', () => {
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(POLICY_TYPE_FORWARD,7,'$IPTABLES -A FORWARD -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(POLICY_TYPE_FORWARD,8,'$IPTABLES -A FORWARD -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n');
      });
    });

    describe('in SNAT', () => {
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(POLICY_TYPE_SNAT,11,'$IPTABLES -t nat -A POSTROUTING -s 10.20.30.2 -j SNAT --to-source 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(POLICY_TYPE_SNAT,12,'$IPTABLES -t nat -A POSTROUTING -d 10.20.30.2 -j SNAT --to-source 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated source)', async () => { 
        await runTest(POLICY_TYPE_SNAT,14,'$IPTABLES -t nat -A POSTROUTING -j SNAT --to-source 10.20.30.2\n');
      });
    });

    describe('in DNAT', () => {
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(POLICY_TYPE_DNAT,30,'$IPTABLES -t nat -A PREROUTING -s 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(POLICY_TYPE_DNAT,31,'$IPTABLES -t nat -A PREROUTING -d 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated destination)', async () => { 
        await runTest(POLICY_TYPE_DNAT,34,'$IPTABLES -t nat -A PREROUTING -j DNAT --to-destination 10.20.30.2\n');
      });
    });
  });

});