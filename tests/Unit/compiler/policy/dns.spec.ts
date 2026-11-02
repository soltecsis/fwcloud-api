/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { describeName, expect } from '../../../mocha/global-setup';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import db from '../../../../src/database/database-manager';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';
import { RulePositionsMap } from '../../../../src/models/policy/PolicyPosition';
import { populateRule } from './utils';
import { PolicyCompiler } from '../../../../src/compiler/policy/PolicyCompiler';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { IPObj } from '../../../../src/models/ipobj/IPObj';

describe(describeName('Policy Compiler Unit Tests - DNS objects'), () => {
  let fwcProduct: FwCloudProduct;
  let dbCon: any;
  let dns: IPObj;
  let address: IPObj;
  let network: IPObj;
  let range: IPObj;

  // Compile an ACCEPT rule of the given policy type with the given objects in its positions.
  async function compileRule(policyType: string, objects: [string, number][]): Promise<string> {
    const type = PolicyTypesMap.get(policyType);
    const rule = await PolicyRule.insertPolicy_r({
      firewall: fwcProduct.firewall.id,
      type: type,
      rule_order: 1,
      action: 1,
      active: 1,
      special: 0,
      options: 0,
      run_before: null,
      run_after: null,
      fw_apply_to: null,
    });

    for (const [position, ipobj] of objects)
      await populateRule(rule, RulePositionsMap.get(`${policyType}:${position}`), ipobj);

    const rulesData: any = await PolicyRule.getPolicyData(
      'compiler',
      dbCon,
      fwcProduct.fwcloud.id,
      fwcProduct.firewall.id,
      type,
      [rule],
      null,
    );
    const result = await PolicyCompiler.compile('IPTables', rulesData);

    return result[0].cs;
  }

  before(async () => {
    dbCon = db.getQuery();
    fwcProduct = await new FwCloudFactory().make();

    const repository = db.getSource().manager.getRepository(IPObj);
    dns = await repository.save({
      name: 'www.fwcloud.net',
      ipObjTypeId: 9,
      fwCloudId: fwcProduct.fwcloud.id,
    });
    address = await repository.save({
      name: 'address',
      address: '192.0.2.1',
      ip_version: 4,
      ipObjTypeId: 5,
      fwCloudId: fwcProduct.fwcloud.id,
    });
    network = await repository.save({
      name: 'network',
      address: '198.51.100.0',
      netmask: '/24',
      ip_version: 4,
      ipObjTypeId: 7,
      fwCloudId: fwcProduct.fwcloud.id,
    });
    range = await repository.save({
      name: 'range',
      range_start: '203.0.113.10',
      range_end: '203.0.113.20',
      ip_version: 4,
      ipObjTypeId: 6,
      fwCloudId: fwcProduct.fwcloud.id,
    });
  });

  it('should use the hostname of a DNS object in the source position', async () => {
    const cs = await compileRule('IPv4:INPUT', [['Source', dns.id]]);

    expect(cs).to.equal('$IPTABLES -A INPUT -s www.fwcloud.net -j ACCEPT\n');
  });

  it('should use the hostname of a DNS object in the destination position', async () => {
    const cs = await compileRule('IPv4:OUTPUT', [['Destination', dns.id]]);

    expect(cs).to.equal('$IPTABLES -A OUTPUT -d www.fwcloud.net -j ACCEPT\n');
  });

  it('should use the hostname of DNS objects in both source and destination positions', async () => {
    const cs = await compileRule('IPv4:FORWARD', [
      ['Source', dns.id],
      ['Destination', dns.id],
    ]);

    expect(cs).to.equal('$IPTABLES -A FORWARD -s www.fwcloud.net -d www.fwcloud.net -j ACCEPT\n');
  });

  it('should use the hostname of a DNS object in IPv6 rules', async () => {
    const cs = await compileRule('IPv6:INPUT', [['Source', dns.id]]);

    expect(cs).to.equal('$IP6TABLES -A INPUT -s www.fwcloud.net -j ACCEPT\n');
  });

  it('should emit the stored hostname instead of the DNS object type name', async () => {
    const renamed = await db
      .getSource()
      .manager.getRepository(IPObj)
      .save({ ...dns, id: undefined, name: 'fwc-dns-regression.example.org' });

    const cs = await compileRule('IPv4:FORWARD', [
      ['Source', renamed.id],
      ['Destination', renamed.id],
    ]);

    expect(cs).to.contain('-s fwc-dns-regression.example.org');
    expect(cs).to.contain('-d fwc-dns-regression.example.org');
    expect(cs).not.to.match(/ -[sd] DNS /);
  });

  it('should keep compiling addresses, networks and address ranges unchanged next to DNS objects', async () => {
    const source = await compileRule('IPv4:INPUT', [
      ['Source', dns.id],
      ['Source', address.id],
      ['Source', network.id],
      ['Source', range.id],
    ]);
    const destination = await compileRule('IPv4:OUTPUT', [
      ['Destination', dns.id],
      ['Destination', address.id],
      ['Destination', network.id],
      ['Destination', range.id],
    ]);

    expect(
      source
        .split('\n')
        .filter((line) => line)
        .sort(),
    ).to.deep.equal(
      [
        '$IPTABLES -A INPUT -s www.fwcloud.net -j ACCEPT',
        '$IPTABLES -A INPUT -s 192.0.2.1 -j ACCEPT',
        '$IPTABLES -A INPUT -s 198.51.100.0/24 -j ACCEPT',
        '$IPTABLES -A INPUT -m iprange --src-range 203.0.113.10-203.0.113.20 -j ACCEPT',
      ].sort(),
    );
    expect(
      destination
        .split('\n')
        .filter((line) => line)
        .sort(),
    ).to.deep.equal(
      [
        '$IPTABLES -A OUTPUT -d www.fwcloud.net -j ACCEPT',
        '$IPTABLES -A OUTPUT -d 192.0.2.1 -j ACCEPT',
        '$IPTABLES -A OUTPUT -d 198.51.100.0/24 -j ACCEPT',
        '$IPTABLES -A OUTPUT -m iprange --dst-range 203.0.113.10-203.0.113.20 -j ACCEPT',
      ].sort(),
    );
  });
});
