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
import { Ca } from "../../../../src/models/vpn/pki/Ca";
import { Crt } from "../../../../src/models/vpn/pki/Crt";
import { OpenVPN } from "../../../../src/models/vpn/openvpn/OpenVPN";
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { OpenVPNOption } from "../../../../src/models/vpn/openvpn/openvpn-option.model";
import { PolicyRuleToOpenVPN } from "../../../../src/models/policy/PolicyRuleToOpenVPN";

describe.only(describeName('IPTables Compiler Unit Tests - OpenVPN'), () => {
  const sandbox = sinon.createSandbox();
  let spy: SinonSpy;

  let dbCon: any;
  let fwcloud: number;
  let rule: number;
  let vpnCli: number;
  let vpnCliIP: number;

  let ruleData = {
      firewall: 0,
      type: 1,
      rule_order: 1,
      action: 1,
      active: 1,
      special: 0,
      options: 1    
  }

  async function populateRule(position: number): Promise<void> {
    await getRepository(PolicyRuleToOpenVPN).save(getRepository(PolicyRuleToOpenVPN).create({ 
      policyRuleId: rule,
      openVPNId: vpnCli,
      policyPositionId: position,
      position_order: 1
    }));
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
    await getRepository(OpenVPNOption).save(getRepository(OpenVPNOption).create({ openVPNId: vpnCli, ipObjId: vpnCliIP, name: 'ifconfig-push', order: 1, scope: 0 }));
  });
  
  beforeEach(async () => {
    spy = sandbox.spy(IPTablesCompiler, "ruleCompile");
    rule = await PolicyRule.insertPolicy_r(ruleData);
  });

  afterEach(() => {
    sandbox.restore();
  });


  describe('OpenVPN in policy rule', () => {
    it('should include the OpenVPN client IP in compilation string', async () => { 
      await populateRule(1);
      const result = await IPTablesCompiler.compile(dbCon, fwcloud, ruleData.firewall, 1, rule);
      
      expect(spy.getCall(0).args[0].positions[1].ipobjs[0].id).to.equal(vpnCliIP);

      expect(result).to.eql([{
        id: rule,
        active: ruleData.active,
        comment: null,
        cs: '$IPTABLES -A INPUT -s 10.20.30.2 -m conntrack --ctstate NEW -j ACCEPT\n'
      }]); 
    });

  });


  describe('OpenVPN in group in policy rule', () => {
  });

});