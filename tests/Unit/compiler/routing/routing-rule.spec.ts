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

import { before } from "mocha";
import { RoutingCompiled, RoutingCompiler } from "../../../../src/compiler/routing/RoutingCompiler";
import { RoutingRuleItemForCompiler } from "../../../../src/models/routing/shared";
import { expect, testSuite } from "../../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../../utils/fwcloud-factory";
import ip from 'ip';
import { RoutingRulesData, RoutingRuleService } from "../../../../src/models/routing/routing-rule/routing-rule.service";

describe('Routing rule compiler', () => {
  let routingRuleService: RoutingRuleService;
  let fwc: FwCloudProduct;

  let rules: RoutingRulesData<RoutingRuleItemForCompiler>[];

  let compiler: RoutingCompiler = new RoutingCompiler;
  let compilation: RoutingCompiled[];
  let gw: string;
  let rtn: number; // Routing table number.

  let cs: string;
  const head = '$IP rule add from';
  let tail: string;

  before(async () => {
    await testSuite.resetDatabaseData();

    routingRuleService = await testSuite.app.getService<RoutingRuleService>(RoutingRuleService.name);

    fwc = await (new FwCloudFactory()).make();
    gw = fwc.ipobjs.get('gateway').address;
    rtn = fwc.routingTable.number;
    tail = `table ${rtn}\n`;

    rules = await routingRuleService.getRoutingRulesData<RoutingRuleItemForCompiler>('compiler', fwc.fwcloud.id, fwc.firewall.id);            
    compilation = compiler.compile('Rule',rules);
  });

  describe('Compilation of routing rule with objects', () => {
    before(() => { cs = compilation[0].cs });

    it('should include address data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('address').address} ${tail}`);
    });

    it('should include network data', () => {
      const net = ip.subnet(fwc.ipobjs.get('networkNoCIDR').address, fwc.ipobjs.get('networkNoCIDR').netmask);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('network').address}${fwc.ipobjs.get('network').netmask} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('networkNoCIDR').address}/${net.subnetMaskLength} ${tail}`);
    });

    it('should include address range data', () => {
      const firstLong = ip.toLong(fwc.ipobjs.get('addressRange').range_start);
      const lastLong = ip.toLong(fwc.ipobjs.get('addressRange').range_end);
      for(let current=firstLong; current<=lastLong; current++)
        expect(cs).to.deep.include(`${head} ${ip.fromLong(current)} ${tail}`);
    });

    it('should include host data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth2-addr1').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth3-addr1').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth3-addr2').address} ${tail}`);
    });

    it('should include OpenVPN data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli1-addr').address} ${tail}`);
    });

    it('should include OpenVPN prefix data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli1-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli2-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli3-addr').address} ${tail}`);
    });

    it('should include firewall mark data', () => {
      expect(cs).to.deep.include(`$IP rule add fwmark ${fwc.mark.code} ${tail}`);
    });
  });


  describe('Compilation of routing rule with objects group', () => {
    before(() => { cs = compilation[1].cs });

    it('should include address data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('address').address} ${tail}`);
    });

    it('should include network data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('network').address}${fwc.ipobjs.get('network').netmask} ${tail}`);
    });

    it('should include address range data', () => {
      const firstLong = ip.toLong(fwc.ipobjs.get('addressRange').range_start);
      const lastLong = ip.toLong(fwc.ipobjs.get('addressRange').range_end);
      for(let current=firstLong; current<=lastLong; current++)
        expect(cs).to.deep.include(`${head} ${ip.fromLong(current)} ${tail}`);
    });

    it('should include host data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth2-addr1').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth3-addr1').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth3-addr2').address} ${tail}`);
    });

    it('should include OpenVPN data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli1-addr').address} ${tail}`);
    });

    it('should include OpenVPN prefix data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli1-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli2-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli3-addr').address} ${tail}`);
    });
  });
})
