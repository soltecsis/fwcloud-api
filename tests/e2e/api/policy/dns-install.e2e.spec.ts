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

import { expect } from 'chai';
import request = require('supertest');
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { EntityManager } from 'typeorm';
import { Application } from '../../../../src/Application';
import { describeName, testSuite } from '../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { attachSession, createUser, generateSession } from '../../../utils/utils';
import db from '../../../../src/database/database-manager';
import { User } from '../../../../src/models/user/User';
import { Firewall, FirewallInstallCommunication } from '../../../../src/models/firewall/Firewall';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { PolicyRule, SpecialPolicyRules } from '../../../../src/models/policy/PolicyRule';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';
import { RulePositionsMap } from '../../../../src/models/policy/PolicyPosition';
import { populateRule } from '../../../Unit/compiler/policy/utils';
import sshTools from '../../../../src/utils/ssh';

const utilsModel = require('../../../../src/utils/utils.js');

// Compiles policies with DNS objects and installs them through the SSH communication on a disposable
// firewall container (tests/fixtures/dns-firewall, iptables v1.8.10). The firewall resolves hostnames
// through a DNS server in another container, so its DNS queries are subject to the policy being loaded
// (as on a real firewall), without depending on external DNS. Skipped without Docker.
describe(describeName('Policy install E2E Tests - DNS objects'), function () {
  const image = 'fwcloud-dns-firewall:e2e';
  const rootPassword = 'fwcloud-test';
  const ipv4Hostname = 'fwc-v4.test'; // Only has an IPv4 address.
  const ipv6Hostname = 'fwc-v6.test'; // Only has an IPv6 address.
  const sshServiceId = 20063; // Standard TCP 22 service object.

  let dnsServer: string;
  let container: string;
  let sshPort: number;
  let app: Application;
  let manager: EntityManager;
  let fwc: FwCloudProduct;
  let firewall: Firewall;
  let session: string;

  function docker(...args: string[]): string {
    return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  }

  function onFirewall(cmd: string): string {
    return docker('exec', container, 'sh', '-c', cmd);
  }

  async function waitForSSH(): Promise<void> {
    const connection = {
      host: '127.0.0.1',
      port: sshPort,
      username: 'root',
      password: rootPassword,
    };
    for (let attempt = 0; ; attempt++) {
      try {
        await sshTools.runCommand(connection, 'true');
        return;
      } catch (error) {
        if (attempt === 60) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  async function createDNSObject(name: string): Promise<IPObj> {
    return manager.getRepository(IPObj).save({ name, ipObjTypeId: 9, fwCloudId: fwc.fwcloud.id });
  }

  async function addRule(
    policyType: string,
    ruleOrder: number,
    objects: [string, number][] = [],
    special: number = 0,
  ) {
    const rule = await PolicyRule.insertPolicy_r({
      firewall: firewall.id,
      type: PolicyTypesMap.get(policyType),
      rule_order: ruleOrder,
      action: 1,
      active: 1,
      special: special,
      options: 0,
      run_before: null,
      run_after: null,
    });
    for (const [position, ipobj] of objects)
      await populateRule(rule, RulePositionsMap.get(`${policyType}:${position}`), ipobj);
  }

  // Every mutating request locks the FWCloud; release it as the UI would between operations.
  async function unlockFwcloud(): Promise<void> {
    await manager.query(
      'UPDATE fwcloud SET locked = 0, locked_by = NULL, locked_at = NULL WHERE id = ?',
      [fwc.fwcloud.id],
    );
  }

  async function compile(): Promise<string> {
    await unlockFwcloud();
    await request(app.express)
      .put('/policy/compile')
      .set('Cookie', [attachSession(session)])
      .send({ fwcloud: fwc.fwcloud.id, firewall: firewall.id })
      .expect(200);

    return fs.readFileSync(firewall.getPolicyFilePath(), 'utf8');
  }

  async function expectInstalled(): Promise<void> {
    const response = await install();
    expect(response.status, response.body?.message).to.equal(204);
    expect(onFirewall('iptables -S; ip6tables -S')).not.to.contain('FWCloud DNS resolution');
  }

  async function install(): Promise<request.Response> {
    await unlockFwcloud();
    return request(app.express)
      .post('/policy/install')
      .set('Cookie', [attachSession(session)])
      .send({ fwcloud: fwc.fwcloud.id, firewall: firewall.id });
  }

  before(async function () {
    try {
      docker('info');
    } catch {
      this.skip();
    }

    docker(
      'build',
      '-q',
      '-t',
      image,
      path.join(process.cwd(), 'tests', 'fixtures', 'dns-firewall'),
    );
    // Answers only for the test hostnames: an AAAA query for the IPv4 hostname (and vice versa) fails.
    dnsServer = docker(
      'run',
      '-d',
      '--rm',
      '--entrypoint',
      'dnsmasq',
      image,
      '--no-daemon',
      '--no-resolv',
      '--no-hosts',
      '--user=root',
      `--address=/${ipv4Hostname}/192.0.2.10`,
      `--address=/${ipv6Hostname}/2001:db8::10`,
    ).trim();
    const dnsServerAddress = docker(
      'inspect',
      '-f',
      '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}',
      dnsServer,
    ).trim();
    container = docker(
      'run',
      '-d',
      '--rm',
      '--cap-add',
      'NET_ADMIN',
      '-p',
      '127.0.0.1::22',
      '--dns',
      dnsServerAddress,
      image,
    ).trim();
    sshPort = parseInt(docker('port', container, '22/tcp').trim().split(':').pop());
    await waitForSSH();
  });

  after(() => {
    if (container) docker('rm', '-f', container);
    if (dnsServer) docker('rm', '-f', dnsServer);
  });

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    app = testSuite.app;
    manager = db.getSource().manager;
    app.config.set('firewall_communication.ssh_enable', true);

    // Start every test from a firewall without any installed policy.
    onFirewall(
      'for cmd in iptables ip6tables; do $cmd -P INPUT ACCEPT; $cmd -P OUTPUT ACCEPT; $cmd -P FORWARD ACCEPT; $cmd -F; $cmd -X; done; rm -rf /etc/fwcloud /root/fwcloud.sh',
    );

    fwc = await new FwCloudFactory().make();
    const installAddress = await manager.getRepository(IPObj).save({
      name: 'install address',
      address: '127.0.0.1',
      ip_version: 4,
      ipObjTypeId: 5,
      fwCloudId: fwc.fwcloud.id,
    });
    firewall = fwc.firewall;
    firewall.install_communication = FirewallInstallCommunication.SSH;
    firewall.install_ipobj = installAddress.id;
    firewall.install_port = sshPort;
    // Stored credentials: credentials sent in the request must be PGP encrypted with the UI session key.
    firewall.install_user = await utilsModel.encrypt('root');
    firewall.install_pass = await utilsModel.encrypt(rootPassword);
    firewall.save_user_pass = 1;
    firewall.options = 0;
    await manager.getRepository(Firewall).save(firewall);

    const admin = await createUser({ role: 1 });
    admin.fwClouds = [fwc.fwcloud];
    await manager.getRepository(User).save(admin);
    session = generateSession(admin);

    // Usual stateful policy with DROP default policies: it allows the SSH sessions of the installer, but
    // not the firewall's own DNS queries.
    await addRule('IPv4:INPUT', 1, [], SpecialPolicyRules.STATEFUL);
    await addRule('IPv4:INPUT', 2, [['Service', sshServiceId]]);
    await addRule('IPv4:OUTPUT', 1, [], SpecialPolicyRules.STATEFUL);
  });

  it('should install a policy with a DNS object in the source position', async () => {
    const dns = await createDNSObject(ipv4Hostname);
    await addRule('IPv4:INPUT', 3, [['Source', dns.id]]);

    const script = await compile();
    expect(script).to.contain(`$IPTABLES -A INPUT -s ${ipv4Hostname} -j ACCEPT\n`);
    expect(script).not.to.match(/ -[sd] DNS /);

    await expectInstalled();
    expect(onFirewall('iptables -S INPUT')).to.contain('-A INPUT -s 192.0.2.10/32 -j ACCEPT\n');

    // Installing again over the running policy, which does not allow the firewall's DNS queries.
    await expectInstalled();
    expect(onFirewall('iptables -S INPUT')).to.contain('-A INPUT -s 192.0.2.10/32 -j ACCEPT\n');
  });

  it('should install a policy with a DNS object in the destination position', async () => {
    const dns = await createDNSObject(ipv4Hostname);
    await addRule('IPv4:OUTPUT', 2, [['Destination', dns.id]]);

    const script = await compile();
    expect(script).to.contain(`$IPTABLES -A OUTPUT -d ${ipv4Hostname} -j ACCEPT\n`);
    expect(script).not.to.match(/ -[sd] DNS /);

    await expectInstalled();

    expect(onFirewall('iptables -S OUTPUT')).to.contain('-A OUTPUT -d 192.0.2.10/32 -j ACCEPT\n');
  });

  it('should install a policy with a DNS object with an IPv6 address in an IPv6 rule', async () => {
    const dns = await createDNSObject(ipv6Hostname);
    await addRule('IPv6:INPUT', 1, [['Source', dns.id]]);

    await compile();
    await expectInstalled();

    expect(onFirewall('ip6tables -S INPUT')).to.contain('-A INPUT -s 2001:db8::10/128 -j ACCEPT\n');
  });

  it('should reject a DNS object whose hostname does not resolve and keep the installed policy', async () => {
    const dns = await createDNSObject(ipv4Hostname);
    await addRule('IPv4:INPUT', 3, [['Source', dns.id]]);
    await compile();
    await expectInstalled();

    // Reported case: the hostname stored in the DNS object is literally "DNS".
    await manager.getRepository(IPObj).update(dns.id, { name: 'DNS' });
    expect(await compile()).to.contain('$IPTABLES -A INPUT -s DNS -j ACCEPT\n');

    const response = await install();
    expect(response.status).to.equal(400);
    expect(response.body.message).to.contain(
      `ERROR: DNS object 'DNS' (ID: ${dns.id}) in source of rule`,
    );
    expect(response.body.message).to.contain("host/network `DNS' not found");
    expect(response.body.message).to.contain('The installed policy has not been changed.');

    expect(onFirewall('iptables -S INPUT')).to.contain('-A INPUT -s 192.0.2.10/32 -j ACCEPT\n');
    const installedScript = onFirewall('cat /etc/fwcloud/fwcloud.sh');
    expect(installedScript).to.contain(`-s ${ipv4Hostname} `);
    expect(installedScript).not.to.contain('-s DNS ');
  });

  it('should reject a DNS object without an IPv6 address in an IPv6 rule', async () => {
    const dns = await createDNSObject(ipv4Hostname);
    await addRule('IPv6:INPUT', 1, [['Source', dns.id]]);
    await compile();

    const response = await install();
    expect(response.status).to.equal(400);
    expect(response.body.message).to.contain(
      `ERROR: DNS object '${ipv4Hostname}' (ID: ${dns.id}) in source of rule`,
    );
    expect(response.body.message).to.contain('(IPv6) cannot be resolved on this firewall.');
    expect(response.body.message).to.contain(`host/network \`${ipv4Hostname}' not found`);

    expect(
      onFirewall('test -f /etc/fwcloud/fwcloud.sh && echo installed || echo missing'),
    ).to.equal('missing\n');
  });
});
