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
import { RoutingTableService } from '../../../../src/models/routing/routing-table/routing-table.service';
import { RouteItemForCompiler } from '../../../../src/models/routing/shared';
import { expect, testSuite } from '../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { IpUtils } from '../../../../src/utils/ip-utils';
import { EntityManager } from 'typeorm';
import db from '../../../../src/database/database-manager';

describe('Routing route compiler', async () => {
  let fwc: FwCloudProduct;
  let routingTableService: RoutingTableService;

  const compiler: RoutingCompiler = new RoutingCompiler();
  let compilation: RoutingCompiled[];
  let gw: string;
  let dev: string;
  let rtn: number; // Routing table number.

  let cs: string;
  let cs_start: string;
  let cs_end: string;
  const head = '$IP route add';
  let tail: string;
  let manager: EntityManager;

  before(async () => {
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    fwc = await new FwCloudFactory().make();
    gw = fwc.ipobjs.get('gateway').address;
    dev = fwc.interfaces.get('firewall-interface1').name;
    rtn = fwc.routingTable.number;

    cs_start = `if [ "$HOSTNAME" = "${fwc.firewall.name}" ]; then\n`;
    cs_end = '\nfi\n';

    routingTableService = await testSuite.app.getService<RoutingTableService>(
      RoutingTableService.name,
    );
    const routes = await routingTableService.getRoutingTableData<RouteItemForCompiler>(
      'compiler',
      fwc.fwcloud.id,
      fwc.firewall.id,
      fwc.routingTable.id,
    );
    compilation = compiler.compile('Route', routes);
  });

  describe('Compilation of empty route', () => {
    before(() => {
      tail = `table ${rtn}\n`; // The first route has interface.
    });

    it('should include default route without interface', () => {
      expect(compilation[2].cs).to.equal(`${head} default via ${gw} ${tail}`);
    });

    it('should include default route with interface', () => {
      expect(compilation[3].cs).to.equal(`${head} default via ${gw} dev ${dev} ${tail}`);
    });

    it('should include default route with interface and firewall apply to code', () => {
      expect(compilation[4].cs).to.equal(
        `if [ "$HOSTNAME" = "${fwc.firewall.name}" ]; then\n${head} default via ${gw} dev ${dev} ${tail}fi\n`,
      );
    });
  });

  describe('Compilation of route with objects', () => {
    before(() => {
      cs = compilation[0].cs;
      tail = `via ${gw} dev ${dev} table ${rtn}\n`; // The first route has interface.
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

    it('should include IPsec data', () => {
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
  });

  describe('Compilation of route with objects and firewall apply to', () => {
    before(() => {
      cs = compilation[5].cs;
      tail = `via ${gw} dev ${dev} table ${rtn}\n`; // The first route has interface.
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
  });

  describe('Compilation of route with objects group', () => {
    before(() => {
      cs = compilation[1].cs;
      tail = `via ${gw} table ${rtn}\n`; // The second route has no interface.
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
  });

  describe('Compilation of route with objects group and firewall apply to', () => {
    before(() => {
      cs = compilation[6].cs;
      tail = `via ${gw} table ${rtn}\n`; // The second route has no interface.
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
  });

  describe('Compile only some routes', () => {
    it('should compile only route 2', async () => {
      const ids = [fwc.routes.get('route2').id];
      const routes = await routingTableService.getRoutingTableData<RouteItemForCompiler>(
        'compiler',
        fwc.fwcloud.id,
        fwc.firewall.id,
        fwc.routingTable.id,
        ids,
      );
      const compilation = compiler.compile('Route', routes);

      expect(compilation.length).to.equal(1);
      expect(compilation[0].id).to.equal(ids[0]);
    });

    it('should compile only routes 1 and 3', async () => {
      const ids = [fwc.routes.get('route1').id, fwc.routes.get('route3').id];
      const routes = await routingTableService.getRoutingTableData<RouteItemForCompiler>(
        'compiler',
        fwc.fwcloud.id,
        fwc.firewall.id,
        fwc.routingTable.id,
        ids,
      );
      const compilation = compiler.compile('Route', routes);

      expect(compilation.length).to.equal(2);
      expect(compilation[0].id).to.equal(ids[0]);
      expect(compilation[1].id).to.equal(ids[1]);
    });

    it('should compile only routes 2 and 4', async () => {
      const ids = [fwc.routes.get('route2').id, fwc.routes.get('route4').id];
      const routes = await routingTableService.getRoutingTableData<RouteItemForCompiler>(
        'compiler',
        fwc.fwcloud.id,
        fwc.firewall.id,
        fwc.routingTable.id,
        ids,
      );
      const compilation = compiler.compile('Route', routes);

      expect(compilation.length).to.equal(2);
      expect(compilation[0].id).to.equal(ids[0]);
      expect(compilation[1].id).to.equal(ids[1]);
    });
  });
});
