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
import { Ca } from "../../../../src/models/vpn/pki/Ca";
import { Crt } from "../../../../src/models/vpn/pki/Crt";
import { OpenVPN } from "../../../../src/models/vpn/openvpn/OpenVPN";
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { OpenVPNOption } from "../../../../src/models/vpn/openvpn/openvpn-option.model";
import { PolicyRuleToOpenVPN } from "../../../../src/models/policy/PolicyRuleToOpenVPN";
import { PolicyRuleToIPObj } from "../../../../src/models/policy/PolicyRuleToIPObj";
import { IPObjGroup } from "../../../../src/models/ipobj/IPObjGroup";
import { PolicyTypesMap } from "../../../../src/models/policy/PolicyType";
import { RulePositionsMap } from "../../../../src/models/policy/PolicyPosition";
import { OpenVPNPrefix } from "../../../../src/models/vpn/openvpn/OpenVPNPrefix";
import { PolicyRuleToOpenVPNPrefix } from "../../../../src/models/policy/PolicyRuleToOpenVPNPrefix";
import { AvailablePolicyCompilers, PolicyCompiler } from "../../../../src/compiler/PolicyCompiler";

describe(describeName('Policy Compiler Unit Tests - OpenVPN'), () => {
  let dbCon: any;
  let fwcloud: number;
  let vpnSrv: number;
  let vpnCli1: number;
  let vpnCli1IP: number;
  let crtCli2: number;
  let vpnCli2: number;
  let vpnCli2IP: number;
  let vpnPrefix: number;
  let natIP: number;
  let group: number;
  let useGroup = false;
  let usePrefix = false;

  let IPv: string;
  let compiler: AvailablePolicyCompilers;
  let policy: string;

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
    let result: any;
    let error: any;
    
    if (!useGroup) {
      if (!usePrefix) {
        await getRepository(PolicyRuleToOpenVPN).save(getRepository(PolicyRuleToOpenVPN).create({ 
          policyRuleId: rule,
          openVPNId: vpnCli1,
          policyPositionId: rulePosition,
          position_order: 1
        }));
      } else {
        await getRepository(PolicyRuleToOpenVPNPrefix).save(getRepository(PolicyRuleToOpenVPNPrefix).create({ 
          policyRuleId: rule,
          openVPNPrefixId : vpnPrefix,
          policyPositionId: rulePosition,
          position_order: 1
        }));
      }
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

    if (rulePosition!=14 && rulePosition!=34 && (policyType===PolicyTypesMap.get(`${IPv}:SNAT`) || policyType===PolicyTypesMap.get(`${IPv}:DNAT`))) {
      await getRepository(PolicyRuleToIPObj).save(getRepository(PolicyRuleToIPObj).create({ 
        policyRuleId: rule,
        ipObjId: natIP,
        ipObjGroupId: -1,
        interfaceId: -1,
        policyPositionId: policyType===PolicyTypesMap.get(`${IPv}:SNAT`) ? 14 : 34,
        position_order: 1
      }));  
    }

    try {
        result = await PolicyCompiler.compile(compiler, dbCon, fwcloud, ruleData.firewall, policyType, rule);
    } catch(err) { error = err }

    if (!cs && usePrefix && vpnCli2 && 
        ((policyType===PolicyTypesMap.get(`${IPv}:SNAT`) && rulePosition===RulePositionsMap.get(`${IPv}:${policy}:Translated Source`)) || 
        (policyType===PolicyTypesMap.get(`${IPv}:DNAT`) && rulePosition===RulePositionsMap.get(`${IPv}:${policy}:Translated Destination`)))) 
    { 
      expect(error).to.eql({
          fwcErr: 999999,
          msg: "Translated fields must contain a maximum of one item"
      });
    } else {
      expect(result).to.eql([{
        id: rule,
        active: ruleData.active,
        comment: null,
        cs: cs
      }]); 
    }
  }


  before(async () => {
    dbCon = db.getQuery();

    fwcloud = (await getRepository(FwCloud).save(getRepository(FwCloud).create({ name: StringHelper.randomize(10) }))).id;
    ruleData.firewall = (await getRepository(Firewall).save(getRepository(Firewall).create({ name: StringHelper.randomize(10), fwCloudId: fwcloud }))).id;
    const ca = (await getRepository(Ca).save(getRepository(Ca).create({ cn: StringHelper.randomize(10), fwCloudId: fwcloud, days: 18250 }))).id;
    const crtSrv = (await getRepository(Crt).save(getRepository(Crt).create({ caId: ca, cn: StringHelper.randomize(10), days: 18250, type: 2 }))).id;
    const crtCli1 = (await getRepository(Crt).save(getRepository(Crt).create({ caId: ca, cn: `SOLTECSIS-${StringHelper.randomize(10)}`, days: 18250, type: 1 }))).id;
    crtCli2 = (await getRepository(Crt).save(getRepository(Crt).create({ caId: ca, cn: `SOLTECSIS-${StringHelper.randomize(10)}`, days: 18250, type: 1 }))).id;
    vpnSrv = (await getRepository(OpenVPN).save(getRepository(OpenVPN).create({ firewallId: ruleData.firewall, crtId: crtSrv }))).id;
    vpnPrefix = (await getRepository(OpenVPNPrefix).save(getRepository(OpenVPNPrefix).create({ openVPNId: vpnSrv, name: 'SOLTECSIS-' }))).id;
    vpnCli1 = (await getRepository(OpenVPN).save(getRepository(OpenVPN).create({ firewallId: ruleData.firewall, crtId: crtCli1, parentId: vpnSrv }))).id;
    vpnCli1IP = (await getRepository(IPObj).save(getRepository(IPObj).create({ fwCloudId: fwcloud, name: '10.20.30.2', ipObjTypeId: 5, address: '10.20.30.2', netmask: '/32', ip_version: 4  }))).id;
    await getRepository(OpenVPNOption).save(getRepository(OpenVPNOption).create({ openVPNId: vpnCli1, ipObjId: vpnCli1IP, name: 'ifconfig-push', order: 1, scope: 0 }));
    natIP = (await getRepository(IPObj).save(getRepository(IPObj).create({ fwCloudId: fwcloud, name: '192.168.0.50', ipObjTypeId: 5, address: '192.168.0.50', netmask: '/32', ip_version: 4  }))).id;
  });
  

  describe('OpenVPN in policy rule (IPTables)', () => {
    before(() => { 
      IPv = 'IPv4';
      compiler = 'IPTables'; 
      useGroup = false; 
      usePrefix = false; 
    });

    describe('in INPUT chain', () => {
      before(() => { policy = 'INPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });
    });

    describe('in OUTPUT chain', () => {
      before(() => { policy = 'OUTPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });
    });

    describe('in FORWARD chain', () => {
      before(() => { policy = 'FORWARD' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });
    });

    describe('in SNAT', () => {
      before(() => { policy = 'SNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$IPTABLES -t nat -A POSTROUTING -s 10.20.30.2 -j SNAT --to-source 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$IPTABLES -t nat -A POSTROUTING -d 10.20.30.2 -j SNAT --to-source 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated source)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Source`),'$IPTABLES -t nat -A POSTROUTING -j SNAT --to-source 10.20.30.2\n');
      });
    });

    describe('in DNAT', () => {
      before(() => { policy = 'DNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$IPTABLES -t nat -A PREROUTING -s 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$IPTABLES -t nat -A PREROUTING -d 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated destination)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Destination`),'$IPTABLES -t nat -A PREROUTING -j DNAT --to-destination 10.20.30.2\n');
      });
    });
  });

  describe('OpenVPN in policy rule (NFTables)', () => {
    before(() => { 
      IPv = 'IPv4';
      compiler = 'NFTables'; 
      useGroup = false; 
      usePrefix = false; 
    });

    describe('in INPUT chain', () => {
      before(() => { policy = 'INPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n`);
      });
    });

    describe('in OUTPUT chain', () => {
      before(() => { policy = 'OUTPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n`);
      });
    });

    describe('in FORWARD chain', () => {
      before(() => { policy = 'FORWARD' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n`);
      });
    });

    describe('in SNAT', () => {
      before(() => { policy = 'SNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$NFT add rule ip nat POSTROUTING ip saddr 10.20.30.2 counter snat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$NFT add rule ip nat POSTROUTING ip daddr 10.20.30.2 counter snat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated source)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Source`),'$NFT add rule ip nat POSTROUTING counter snat to 10.20.30.2\n');
      });
    });

    describe('in DNAT', () => {
      before(() => { policy = 'DNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$NFT add rule ip nat PREROUTING ip saddr 10.20.30.2 counter dnat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$NFT add rule ip nat PREROUTING ip daddr 10.20.30.2 counter dnat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated destination)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Destination`),'$NFT add rule ip nat PREROUTING counter dnat to 10.20.30.2\n');
      });
    });
  });


  describe('OpenVPN in group in policy rule (IPTables)', () => {
    before(async () => { 
      IPv = 'IPv4';
      compiler = 'IPTables';  
      useGroup = true;
      usePrefix = false;
      group = (await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({ name: StringHelper.randomize(10), type: 21, fwCloudId: fwcloud}))).id; 
      await OpenVPN.addToGroup(dbCon,vpnCli1,group); 
    });

    describe('in INPUT chain', () => {
      before(() => { policy = 'INPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });
    });

    describe('in OUTPUT chain', () => {
      before(() => { policy = 'OUTPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });
    });

    describe('in FORWARD chain', () => {
      before(() => { policy = 'FORWARD' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });
    });

    describe('in SNAT', () => {
      before(() => { policy = 'SNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$IPTABLES -t nat -A POSTROUTING -s 10.20.30.2 -j SNAT --to-source 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$IPTABLES -t nat -A POSTROUTING -d 10.20.30.2 -j SNAT --to-source 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated source)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Source`),'$IPTABLES -t nat -A POSTROUTING -j SNAT --to-source 10.20.30.2\n');
      });
    });

    describe('in DNAT', () => {
      before(() => { policy = 'DNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$IPTABLES -t nat -A PREROUTING -s 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$IPTABLES -t nat -A PREROUTING -d 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated destination)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Destination`),'$IPTABLES -t nat -A PREROUTING -j DNAT --to-destination 10.20.30.2\n');
      });
    });
  });

  describe('OpenVPN in group in policy rule (NFTables)', () => {
    before(async () => { 
      IPv = 'IPv4';
      compiler = 'NFTables';  
      useGroup = true;
      usePrefix = false;
      group = (await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({ name: StringHelper.randomize(10), type: 21, fwCloudId: fwcloud}))).id; 
      await OpenVPN.addToGroup(dbCon,vpnCli1,group); 
    });

    describe('in INPUT chain', () => {
      before(() => { policy = 'INPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n`);
      });
    });

    describe('in OUTPUT chain', () => {
      before(() => { policy = 'OUTPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n`);
      });
    });

    describe('in FORWARD chain', () => {
      before(() => { policy = 'FORWARD' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n`);
      });
    });

    describe('in SNAT', () => {
      before(() => { policy = 'SNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$NFT add rule ip nat POSTROUTING ip saddr 10.20.30.2 counter snat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$NFT add rule ip nat POSTROUTING ip daddr 10.20.30.2 counter snat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated source)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Source`),'$NFT add rule ip nat POSTROUTING counter snat to 10.20.30.2\n');
      });
    });

    describe('in DNAT', () => {
      before(() => { policy = 'DNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$NFT add rule ip nat PREROUTING ip saddr 10.20.30.2 counter dnat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$NFT add rule ip nat PREROUTING ip daddr 10.20.30.2 counter dnat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated destination)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Destination`),'$NFT add rule ip nat PREROUTING counter dnat to 10.20.30.2\n');
      });
    });
  });


  describe('OpenVPN prefix in policy rule (IPTables)', () => {
    before(() => { 
      IPv = 'IPv4';
      compiler = 'IPTables';  
      useGroup = false; 
      usePrefix = true; 
    });

    describe('in INPUT chain', () => {
      before(() => { policy = 'INPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });
    });

    describe('in OUTPUT chain', () => {
      before(() => { policy = 'OUTPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });
    });

    describe('in FORWARD chain', () => {
      before(() => { policy = 'FORWARD' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });
    });

    describe('in SNAT', () => {
      before(() => { policy = 'SNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$IPTABLES -t nat -A POSTROUTING -s 10.20.30.2 -j SNAT --to-source 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$IPTABLES -t nat -A POSTROUTING -d 10.20.30.2 -j SNAT --to-source 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated source)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Source`),'$IPTABLES -t nat -A POSTROUTING -j SNAT --to-source 10.20.30.2\n');
      });
    });

    describe('in DNAT', () => {
      before(() => { policy = 'DNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$IPTABLES -t nat -A PREROUTING -s 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$IPTABLES -t nat -A PREROUTING -d 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated destination)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Destination`),'$IPTABLES -t nat -A PREROUTING -j DNAT --to-destination 10.20.30.2\n');
      });
    });
  });

  describe('OpenVPN prefix in policy rule (NFTables)', () => {
    before(() => { 
      IPv = 'IPv4';
      compiler = 'NFTables';  
      useGroup = false; 
      usePrefix = true; 
    });

    describe('in INPUT chain', () => {
      before(() => { policy = 'INPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n`);
      });
    });

    describe('in OUTPUT chain', () => {
      before(() => { policy = 'OUTPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n`);
      });
    });

    describe('in FORWARD chain', () => {
      before(() => { policy = 'FORWARD' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n`);
      });
    });

    describe('in SNAT', () => {
      before(() => { policy = 'SNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$NFT add rule ip nat POSTROUTING ip saddr 10.20.30.2 counter snat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$NFT add rule ip nat POSTROUTING ip daddr 10.20.30.2 counter snat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated source)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Source`),'$NFT add rule ip nat POSTROUTING counter snat to 10.20.30.2\n');
      });
    });

    describe('in DNAT', () => {
      before(() => { policy = 'DNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$NFT add rule ip nat PREROUTING ip saddr 10.20.30.2 counter dnat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$NFT add rule ip nat PREROUTING ip daddr 10.20.30.2 counter dnat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated destination)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Destination`),'$NFT add rule ip nat PREROUTING counter dnat to 10.20.30.2\n');
      });
    });
  });


  describe('OpenVPN in group in policy rule (IPTables)', () => {
    before(async () => { 
      IPv = 'IPv4';
      compiler = 'IPTables';  
      useGroup = true;
      usePrefix = true;
      group = (await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({ name: StringHelper.randomize(10), type: 21, fwCloudId: fwcloud}))).id;  
      await OpenVPNPrefix.addPrefixToGroup(dbCon,vpnPrefix,group); 
    });

    describe('in INPUT chain', () => {
      before(() => { policy = 'INPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });
    });

    describe('in OUTPUT chain', () => {
      before(() => { policy = 'OUTPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });
    });

    describe('in FORWARD chain', () => {
      before(() => { policy = 'FORWARD' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n`);
      });
    });

    describe('in SNAT', () => {
      before(() => { policy = 'SNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$IPTABLES -t nat -A POSTROUTING -s 10.20.30.2 -j SNAT --to-source 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$IPTABLES -t nat -A POSTROUTING -d 10.20.30.2 -j SNAT --to-source 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated source)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Source`),'$IPTABLES -t nat -A POSTROUTING -j SNAT --to-source 10.20.30.2\n');
      });
    });

    describe('in DNAT', () => {
      before(() => { policy = 'DNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$IPTABLES -t nat -A PREROUTING -s 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$IPTABLES -t nat -A PREROUTING -d 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated destination)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Destination`),'$IPTABLES -t nat -A PREROUTING -j DNAT --to-destination 10.20.30.2\n');
      });
    });
  });

  describe('OpenVPN in group in policy rule (NFTables)', () => {
    before(async () => { 
      IPv = 'IPv4';
      compiler = 'NFTables';  
      useGroup = true;
      usePrefix = true;
      group = (await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({ name: StringHelper.randomize(10), type: 21, fwCloudId: fwcloud}))).id;  
      await OpenVPNPrefix.addPrefixToGroup(dbCon,vpnPrefix,group); 
    });

    describe('in INPUT chain', () => {
      before(() => { policy = 'INPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n`);
      });
    });

    describe('in OUTPUT chain', () => {
      before(() => { policy = 'OUTPUT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n`);
      });
    });

    describe('in FORWARD chain', () => {
      before(() => { policy = 'FORWARD' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n`);
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n`);
      });
    });

    describe('in SNAT', () => {
      before(() => { policy = 'SNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$NFT add rule ip nat POSTROUTING ip saddr 10.20.30.2 counter snat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$NFT add rule ip nat POSTROUTING ip daddr 10.20.30.2 counter snat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated source)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Source`),'$NFT add rule ip nat POSTROUTING counter snat to 10.20.30.2\n');
      });
    });

    describe('in DNAT', () => {
      before(() => { policy = 'DNAT' });
      it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$NFT add rule ip nat PREROUTING ip saddr 10.20.30.2 counter dnat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$NFT add rule ip nat PREROUTING ip daddr 10.20.30.2 counter dnat to 192.168.0.50\n');
      });

      it('should include the OpenVPN client IP in compilation string (translated destination)', async () => { 
        await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Destination`),'$NFT add rule ip nat PREROUTING counter dnat to 10.20.30.2\n');
      });
    });
  });


  describe('OpenVPN prefix with several IPs', () => {
    before(async () => {
      vpnCli2 = (await getRepository(OpenVPN).save(getRepository(OpenVPN).create({ firewallId: ruleData.firewall, crtId: crtCli2, parentId: vpnSrv }))).id;
      vpnCli2IP = (await getRepository(IPObj).save(getRepository(IPObj).create({ fwCloudId: fwcloud, name: '10.20.30.3', ipObjTypeId: 5, address: '10.20.30.3', netmask: '/32', ip_version: 4  }))).id;  
      await getRepository(OpenVPNOption).save(getRepository(OpenVPNOption).create({ openVPNId: vpnCli2, ipObjId: vpnCli2IP, name: 'ifconfig-push', order: 1, scope: 0 }));
    });

    describe('IPTables compiler', () => {
      before(() => { compiler = 'IPTables' });

      describe('In policy rule', () => {
        before(() => { 
          IPv = 'IPv4'; 
          useGroup = false; 
          usePrefix = true;
        });

        describe('in INPUT chain', () => {
          before(() => { policy = 'INPUT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A ${policy} -s 10.20.30.3 -m conntrack --ctstate NEW -j ACCEPT\n`);
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A ${policy} -d 10.20.30.3 -m conntrack --ctstate NEW -j ACCEPT\n`);
          });
        });

        describe('in OUTPUT chain', () => {
          before(() => { policy = 'OUTPUT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A ${policy} -s 10.20.30.3 -m conntrack --ctstate NEW -j ACCEPT\n`);
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A ${policy} -d 10.20.30.3 -m conntrack --ctstate NEW -j ACCEPT\n`);
          });
        });

        describe('in FORWARD chain', () => {
          before(() => { policy = 'FORWARD' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A ${policy} -s 10.20.30.3 -m conntrack --ctstate NEW -j ACCEPT\n`);
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A ${policy} -d 10.20.30.3 -m conntrack --ctstate NEW -j ACCEPT\n`);
          });
        });

        describe('in SNAT', () => {
          before(() => { policy = 'SNAT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$IPTABLES -t nat -A POSTROUTING -s 10.20.30.2 -j SNAT --to-source 192.168.0.50\n$IPTABLES -t nat -A POSTROUTING -s 10.20.30.3 -j SNAT --to-source 192.168.0.50\n');
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$IPTABLES -t nat -A POSTROUTING -d 10.20.30.2 -j SNAT --to-source 192.168.0.50\n$IPTABLES -t nat -A POSTROUTING -d 10.20.30.3 -j SNAT --to-source 192.168.0.50\n');
          });

          it('should generate error (translated source)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Source`),null);
          });
        });

        describe('in DNAT', () => {
          before(() => { policy = 'DNAT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$IPTABLES -t nat -A PREROUTING -s 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n$IPTABLES -t nat -A PREROUTING -s 10.20.30.3 -j DNAT --to-destination 192.168.0.50\n');
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$IPTABLES -t nat -A PREROUTING -d 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n$IPTABLES -t nat -A PREROUTING -d 10.20.30.3 -j DNAT --to-destination 192.168.0.50\n');
          });

          it('should generate error (translated destination)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Destination`),null);
          });
        });
      });

      describe('In group in policy rule', () => {
        before(() => { 
          IPv = 'IPv4'; 
          useGroup = true; 
          usePrefix = true;
        });

        describe('in INPUT chain', () => {
          before(() => { policy = 'INPUT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A ${policy} -s 10.20.30.3 -m conntrack --ctstate NEW -j ACCEPT\n`);
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A ${policy} -d 10.20.30.3 -m conntrack --ctstate NEW -j ACCEPT\n`);
          });
        });

        describe('in OUTPUT chain', () => {
          before(() => { policy = 'OUTPUT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A ${policy} -s 10.20.30.3 -m conntrack --ctstate NEW -j ACCEPT\n`);
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A ${policy} -d 10.20.30.3 -m conntrack --ctstate NEW -j ACCEPT\n`);
          });
        });

        describe('in FORWARD chain', () => {
          before(() => { policy = 'FORWARD' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$IPTABLES -A ${policy} -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A ${policy} -s 10.20.30.3 -m conntrack --ctstate NEW -j ACCEPT\n`);
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$IPTABLES -A ${policy} -d 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n$IPTABLES -A ${policy} -d 10.20.30.3 -m conntrack --ctstate NEW -j ACCEPT\n`);
          });
        });

        describe('in SNAT', () => {
          before(() => { policy = 'SNAT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$IPTABLES -t nat -A POSTROUTING -s 10.20.30.2 -j SNAT --to-source 192.168.0.50\n$IPTABLES -t nat -A POSTROUTING -s 10.20.30.3 -j SNAT --to-source 192.168.0.50\n');
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$IPTABLES -t nat -A POSTROUTING -d 10.20.30.2 -j SNAT --to-source 192.168.0.50\n$IPTABLES -t nat -A POSTROUTING -d 10.20.30.3 -j SNAT --to-source 192.168.0.50\n');
          });

          it('should generate error (translated source)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Source`),null);
          });
        });

        describe('in DNAT', () => {
          before(() => { policy = 'DNAT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$IPTABLES -t nat -A PREROUTING -s 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n$IPTABLES -t nat -A PREROUTING -s 10.20.30.3 -j DNAT --to-destination 192.168.0.50\n');
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$IPTABLES -t nat -A PREROUTING -d 10.20.30.2 -j DNAT --to-destination 192.168.0.50\n$IPTABLES -t nat -A PREROUTING -d 10.20.30.3 -j DNAT --to-destination 192.168.0.50\n');
          });

          it('should generate error (translated destination)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Destination`),null);
          });
        });
      });
    });

    describe('NFTables compiler', () => {
      before(() => { compiler = 'NFTables' });

      describe('In policy rule', () => {
        before(() => { 
          IPv = 'IPv4'; 
          useGroup = false; 
          usePrefix = true;
        });

        describe('in INPUT chain', () => {
          before(() => { policy = 'INPUT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n$NFT add rule ip filter ${policy} ip saddr 10.20.30.3 ct state new counter accept\n`);
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n$NFT add rule ip filter ${policy} ip daddr 10.20.30.3 ct state new counter accept\n`);
          });
        });

        describe('in OUTPUT chain', () => {
          before(() => { policy = 'OUTPUT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n$NFT add rule ip filter ${policy} ip saddr 10.20.30.3 ct state new counter accept\n`);
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n$NFT add rule ip filter ${policy} ip daddr 10.20.30.3 ct state new counter accept\n`);
          });
        });

        describe('in FORWARD chain', () => {
          before(() => { policy = 'FORWARD' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n$NFT add rule ip filter ${policy} ip saddr 10.20.30.3 ct state new counter accept\n`);
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n$NFT add rule ip filter ${policy} ip daddr 10.20.30.3 ct state new counter accept\n`);
          });
        });

        describe('in SNAT', () => {
          before(() => { policy = 'SNAT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$NFT add rule ip nat POSTROUTING ip saddr 10.20.30.2 counter snat to 192.168.0.50\n$NFT add rule ip nat POSTROUTING ip saddr 10.20.30.3 counter snat to 192.168.0.50\n');
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$NFT add rule ip nat POSTROUTING ip daddr 10.20.30.2 counter snat to 192.168.0.50\n$NFT add rule ip nat POSTROUTING ip daddr 10.20.30.3 counter snat to 192.168.0.50\n');
          });

          it('should generate error (translated source)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Source`),null);
          });
        });

        describe('in DNAT', () => {
          before(() => { policy = 'DNAT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$NFT add rule ip nat PREROUTING ip saddr 10.20.30.2 counter dnat to 192.168.0.50\n$NFT add rule ip nat PREROUTING ip saddr 10.20.30.3 counter dnat to 192.168.0.50\n');
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$NFT add rule ip nat PREROUTING ip daddr 10.20.30.2 counter dnat to 192.168.0.50\n$NFT add rule ip nat PREROUTING ip daddr 10.20.30.3 counter dnat to 192.168.0.50\n');
          });

          it('should generate error (translated destination)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Destination`),null);
          });
        });
      });

      describe('In group in policy rule', () => {
        before(() => { 
          IPv = 'IPv4'; 
          useGroup = true; 
          usePrefix = true;
        });

        describe('in INPUT chain', () => {
          before(() => { policy = 'INPUT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n$NFT add rule ip filter ${policy} ip saddr 10.20.30.3 ct state new counter accept\n`);
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n$NFT add rule ip filter ${policy} ip daddr 10.20.30.3 ct state new counter accept\n`);
          });
        });

        describe('in OUTPUT chain', () => {
          before(() => { policy = 'OUTPUT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n$NFT add rule ip filter ${policy} ip saddr 10.20.30.3 ct state new counter accept\n`);
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n$NFT add rule ip filter ${policy} ip daddr 10.20.30.3 ct state new counter accept\n`);
          });
        });

        describe('in FORWARD chain', () => {
          before(() => { policy = 'FORWARD' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),`$NFT add rule ip filter ${policy} ip saddr 10.20.30.2 ct state new counter accept\n$NFT add rule ip filter ${policy} ip saddr 10.20.30.3 ct state new counter accept\n`);
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),`$NFT add rule ip filter ${policy} ip daddr 10.20.30.2 ct state new counter accept\n$NFT add rule ip filter ${policy} ip daddr 10.20.30.3 ct state new counter accept\n`);
          });
        });

        describe('in SNAT', () => {
          before(() => { policy = 'SNAT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$NFT add rule ip nat POSTROUTING ip saddr 10.20.30.2 counter snat to 192.168.0.50\n$NFT add rule ip nat POSTROUTING ip saddr 10.20.30.3 counter snat to 192.168.0.50\n');
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$NFT add rule ip nat POSTROUTING ip daddr 10.20.30.2 counter snat to 192.168.0.50\n$NFT add rule ip nat POSTROUTING ip daddr 10.20.30.3 counter snat to 192.168.0.50\n');
          });

          it('should generate error (translated source)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Source`),null);
          });
        });

        describe('in DNAT', () => {
          before(() => { policy = 'DNAT' });
          it('should include the OpenVPN client IP in compilation string (source position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Source`),'$NFT add rule ip nat PREROUTING ip saddr 10.20.30.2 counter dnat to 192.168.0.50\n$NFT add rule ip nat PREROUTING ip saddr 10.20.30.3 counter dnat to 192.168.0.50\n');
          });

          it('should include the OpenVPN client IP in compilation string (destination position)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Destination`),'$NFT add rule ip nat PREROUTING ip daddr 10.20.30.2 counter dnat to 192.168.0.50\n$NFT add rule ip nat PREROUTING ip daddr 10.20.30.3 counter dnat to 192.168.0.50\n');
          });

          it('should generate error (translated destination)', async () => { 
            await runTest(PolicyTypesMap.get(`${IPv}:${policy}`),RulePositionsMap.get(`${IPv}:${policy}:Translated Destination`),null);
          });
        });
      });

    });
  });

});