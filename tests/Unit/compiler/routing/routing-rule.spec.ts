/*!
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { before } from 'mocha';
import { RoutingCompiled, RoutingCompiler } from '../../../../src/compiler/routing/RoutingCompiler';
import { RoutingRuleItemForCompiler } from '../../../../src/models/routing/shared';
import { expect, testSuite } from '../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { IpUtils } from '../../../../src/utils/ip-utils';
import { RoutingRuleService } from '../../../../src/models/routing/routing-rule/routing-rule.service';
import { EntityManager } from 'typeorm';
import db from '../../../../src/database/database-manager';

describe('Routing rule compiler', () => {
  let fwc: FwCloudProduct;

  let routingRuleService: RoutingRuleService;
  const compiler: RoutingCompiler = new RoutingCompiler();
  let compilation: RoutingCompiled[];
  let gw: string;
  let rtn: number; // Routing table number.

  let cs: string;
  let cs_start: string;
  let cs_end: string;
  const head = '$IP rule add from';
  let tail: string;
  let manager: EntityManager;

  before(async () => {
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    fwc = await new FwCloudFactory().make();
    gw = fwc.ipobjs.get('gateway').address;
    rtn = fwc.routingTable.number;
    tail = `table ${rtn}\n`;
    cs_start = `if [ "$HOSTNAME" = "${fwc.firewall.name}" ]; then\n`;
    cs_end = '\nfi\n';

    routingRuleService = await testSuite.app.getService<RoutingRuleService>(
      RoutingRuleService.name,
    );
    const rules = await routingRuleService.getRoutingRulesData<RoutingRuleItemForCompiler>(
      'compiler',
      fwc.fwcloud.id,
      fwc.firewall.id,
    );
    console.log('Routing rules for compilation:', rules);
    compilation = compiler.compile('Rule', rules);
  });

  describe('Compilation of routing rule with objects', () => {
    before(() => {
      cs = compilation[0].cs;
    });

    it('should include address data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('address').address} ${tail}`);
    });

    it('should include network data', () => {
      const net = IpUtils.subnet(
        fwc.ipobjs.get('networkNoCIDR').address,
        fwc.ipobjs.get('networkNoCIDR').netmask,
      );
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('network').address}${fwc.ipobjs.get('network').netmask} ${tail}`,
      );
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('networkNoCIDR').address}/${net.subnetMaskLength} ${tail}`,
      );
    });

    it('should include address range data', () => {
      const firstLong = IpUtils.toLong(fwc.ipobjs.get('addressRange').range_start);
      const lastLong = IpUtils.toLong(fwc.ipobjs.get('addressRange').range_end);
      for (let current = firstLong; current <= lastLong; current++)
        expect(cs).to.deep.include(`${head} ${IpUtils.fromLong(current)} ${tail}`);
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

    it('should include IPSec data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli1-addr').address} ${tail}`);
    });

    it('should include IPSec prefix data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli1-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli2-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli3-addr').address} ${tail}`);
    });

    it('should include WireGuard data', () => {
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli1-addr').address} ${tail}`,
      );
    });

    it('should include WireGuard prefix data', () => {
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli1-addr').address} ${tail}`,
      );
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli2-addr').address} ${tail}`,
      );
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli3-addr').address} ${tail}`,
      );
    });

    it('should include firewall mark data', () => {
      expect(cs).to.deep.include(`$IP rule add fwmark ${fwc.mark.code} ${tail}`);
    });
  });

  describe('Compilation of routing rule with objects and with firewall apply to', () => {
    before(() => {
      cs = compilation[3].cs;
    });

    it('should include address data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('address').address} ${tail}`);
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include network data', () => {
      const net = IpUtils.subnet(
        fwc.ipobjs.get('networkNoCIDR').address,
        fwc.ipobjs.get('networkNoCIDR').netmask,
      );
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('network').address}${fwc.ipobjs.get('network').netmask} ${tail}`,
      );
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('networkNoCIDR').address}/${net.subnetMaskLength} ${tail}`,
      );
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include address range data', () => {
      const firstLong = IpUtils.toLong(fwc.ipobjs.get('addressRange').range_start);
      const lastLong = IpUtils.toLong(fwc.ipobjs.get('addressRange').range_end);
      for (let current = firstLong; current <= lastLong; current++)
        expect(cs).to.deep.include(`${head} ${IpUtils.fromLong(current)} ${tail}`);
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include host data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth2-addr1').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth3-addr1').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth3-addr2').address} ${tail}`);
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include OpenVPN data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli1-addr').address} ${tail}`);
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include OpenVPN prefix data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli1-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli2-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli3-addr').address} ${tail}`);
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include IPSec data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli1-addr').address} ${tail}`);
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include IPSec prefix data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli1-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli2-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli3-addr').address} ${tail}`);
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include WireGuard data', () => {
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli1-addr').address} ${tail}`,
      );
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include WireGuard prefix data', () => {
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli1-addr').address} ${tail}`,
      );
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli2-addr').address} ${tail}`,
      );
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli3-addr').address} ${tail}`,
      );
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include firewall mark data', () => {
      expect(cs).to.deep.include(`$IP rule add fwmark ${fwc.mark.code} ${tail}`);
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });
  });

  describe('Compilation of routing rule with objects group', () => {
    before(() => {
      cs = compilation[1].cs;
    });

    it('should include address data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('address').address} ${tail}`);
    });

    it('should include network data', () => {
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('network').address}${fwc.ipobjs.get('network').netmask} ${tail}`,
      );
    });

    it('should include address range data', () => {
      const firstLong = IpUtils.toLong(fwc.ipobjs.get('addressRange').range_start);
      const lastLong = IpUtils.toLong(fwc.ipobjs.get('addressRange').range_end);
      for (let current = firstLong; current <= lastLong; current++)
        expect(cs).to.deep.include(`${head} ${IpUtils.fromLong(current)} ${tail}`);
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

    it('should include IPSec data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli1-addr').address} ${tail}`);
    });

    it('should include IPSec prefix data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli1-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli2-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli3-addr').address} ${tail}`);
    });

    it('should include WireGuard data', () => {
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli1-addr').address} ${tail}`,
      );
    });

    it.skip('should include WireGuard prefix data', () => {
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli1-addr').address} ${tail}`,
      );
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli2-addr').address} ${tail}`,
      );
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli3-addr').address} ${tail}`,
      );
    });
  });

  describe('Compilation of routing rule with objects group and firewall apply to', () => {
    before(() => {
      cs = compilation[4].cs;
    });

    it('should include address data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('address').address} ${tail}`);
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include network data', () => {
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('network').address}${fwc.ipobjs.get('network').netmask} ${tail}`,
      );
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include address range data', () => {
      const firstLong = IpUtils.toLong(fwc.ipobjs.get('addressRange').range_start);
      const lastLong = IpUtils.toLong(fwc.ipobjs.get('addressRange').range_end);
      for (let current = firstLong; current <= lastLong; current++)
        expect(cs).to.deep.include(`${head} ${IpUtils.fromLong(current)} ${tail}`);
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include host data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth2-addr1').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth3-addr1').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('host-eth3-addr2').address} ${tail}`);
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include OpenVPN data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli1-addr').address} ${tail}`);
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include OpenVPN prefix data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli1-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli2-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('openvpn-cli3-addr').address} ${tail}`);
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include IPSec data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli1-addr').address} ${tail}`);
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include IPSec prefix data', () => {
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli1-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli2-addr').address} ${tail}`);
      expect(cs).to.deep.include(`${head} ${fwc.ipobjs.get('ipsec-cli3-addr').address} ${tail}`);
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it('should include WireGuard data', () => {
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli1-addr').address} ${tail}`,
      );
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });

    it.skip('should include WireGuard prefix data', async () => {
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli1-addr').address} ${tail}`,
      );
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli2-addr').address} ${tail}`,
      );
      expect(cs).to.deep.include(
        `${head} ${fwc.ipobjs.get('wireguard-cli3-addr').address} ${tail}`,
      );
      expect(cs.startsWith(cs_start)).to.be.true;
      expect(cs.endsWith(cs_end)).to.be.true;
    });
  });

  describe('Compile only some routing rules', () => {
    it('should compile only routing rule 2', async () => {
      const ids = [fwc.routingRules.get('routing-rule-2').id];
      const rules = await routingRuleService.getRoutingRulesData<RoutingRuleItemForCompiler>(
        'compiler',
        fwc.fwcloud.id,
        fwc.firewall.id,
        ids,
      );
      const compilation = compiler.compile('Rule', rules);

      expect(compilation.length).to.equal(1);
      expect(compilation[0].id).to.equal(ids[0]);
    });

    it('should compile only routing rules 1 and 3', async () => {
      const ids = [
        fwc.routingRules.get('routing-rule-1').id,
        fwc.routingRules.get('routing-rule-3').id,
      ];
      const rules = await routingRuleService.getRoutingRulesData<RoutingRuleItemForCompiler>(
        'compiler',
        fwc.fwcloud.id,
        fwc.firewall.id,
        ids,
      );
      const compilation = compiler.compile('Rule', rules);

      expect(compilation.length).to.equal(2);
      expect(compilation[0].id).to.equal(ids[0]);
      expect(compilation[1].id).to.equal(ids[1]);
    });
  });
});
