/*
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import axios from 'axios';
import { EventEmitter } from 'events';
import sinon from 'sinon';
import { CCDHash } from '../../../src/communications/communication';
import { expect, testSuite } from '../../mocha/global-setup';
import { SSHCommunication } from '../../../src/communications/ssh.communication';
import sshTools from '../../../src/utils/ssh';
import { Application } from '../../../src/Application';
import errorTable from '../../../src/utils/error_table';
import { getOpenVPNServerConfigInstallData } from '../../../src/communications/openvpn-config-parser';

describe(SSHCommunication.name, () => {
  let ssh: SSHCommunication;
  let app: Application;

  beforeEach(async () => {
    ssh = new SSHCommunication({
      host: 'host',
      port: 0,
      username: 'username',
      password: 'password',
      options: 0,
    });
  });

  afterEach(() => {
    sinon.restore();
    testSuite.app.config.set('firewall_communication.ssh_enable', true);
  });

  describe('OpenVPN server config install data', () => {
    it('should parse client-config-dir and group directives', () => {
      const result = getOpenVPNServerConfigInstallData(`
        # client-config-dir /ignored
        client-config-dir /etc/openvpn/old-ccd
        group root
        --client-config-dir="/etc/openvpn/ccd" # inline comment
        --group=nogroup
        <ca>
        group ignored
        </ca>
      `);

      expect(result).to.deep.equal({
        clientConfigDir: '/etc/openvpn/ccd',
        group: 'nogroup',
      });
    });

    it('should use nogroup if group directive is not present', () => {
      const result = getOpenVPNServerConfigInstallData(`client-config-dir '/etc/openvpn/ccd'`);

      expect(result).to.deep.equal({
        clientConfigDir: '/etc/openvpn/ccd',
        group: 'nogroup',
      });
    });
  });

  describe('installOpenVPNServerConfigs', () => {
    it('should create the OpenVPN client-config-dir with the configured group and mode', async () => {
      testSuite.app.config.set('firewall_communication.ssh_enable', true);

      const runCommandStub = sinon.stub(sshTools, 'runCommand').resolves('');
      runCommandStub.onFirstCall().resolves('1');
      sinon.stub(sshTools, 'uploadStringToFile').resolves();

      await ssh.installOpenVPNServerConfigs(
        '/etc/openvpn',
        [
          {
            name: 'server.conf',
            content: `
              port 1194
              client-config-dir /etc/openvpn/ccd
              group nogroup
            `,
          },
        ],
        new EventEmitter(),
      );

      const commands = runCommandStub.getCalls().map((call) => call.args[1]);

      expect(commands).to.include(`sudo mkdir -p '/etc/openvpn/ccd'`);
      expect(commands).to.include(`sudo chown root:nogroup '/etc/openvpn/ccd'`);
      expect(commands).to.include(`sudo chmod 750 '/etc/openvpn/ccd'`);
    });
  });

  describe('ccdHashList', () => {
    let stub: sinon.SinonStub;

    beforeEach(() => {
      stub = sinon.stub(sshTools, 'runCommand');
      stub.returns(Promise.resolve('\r\nfile,sha256\ncrt1,hash1\ncrt2,hash2'));
    });

    it('should parse CSV content', async () => {
      const result: CCDHash[] = await ssh.ccdHashList('');

      expect(result).to.deep.eq([
        { filename: 'crt1', hash: 'hash1' },
        { filename: 'crt2', hash: 'hash2' },
      ]);
    });
  });

  describe('Disabled from configuration', () => {
    beforeEach(() => {
      app = testSuite.app;
      app.config.set('firewall_communication.ssh_enable', false);
    });

    it('install a firewall policy and communication is disabled, it should throw an error', (done) => {
      ssh.installFirewallPolicy('').catch((error) => {
        expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
        done();
      });
    });

    it('install OpenVPN server configs and communication is disabled, it should throw an error', (done) => {
      ssh.installOpenVPNServerConfigs('', []).catch((error) => {
        expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
        done();
      });
    });

    it('install OpenVPN client configs and communication is disabled, it should throw an error', (done) => {
      ssh.installOpenVPNClientConfigs('', []).catch((error) => {
        expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
        done();
      });
    });

    it('unistall OpenVPN configs and communication is disabled, it should throw an error', (done) => {
      ssh.uninstallOpenVPNConfigs('', []).catch((error) => {
        expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
        done();
      });
    });

    it('get firewalls interfaces and communication is disabled, it should throw an error', (done) => {
      ssh.getFirewallInterfaces().catch((error) => {
        expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
        done();
      });
    });

    it('get firewalls IP tables and communication is disabled, it should throw an error', (done) => {
      ssh.getFirewallIptablesSave().catch((error) => {
        expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
        done();
      });
    });

    it('get CCD hash list and communication is disabled, it should throw an error', (done) => {
      ssh.ccdHashList('').catch((error) => {
        expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
        done();
      });
    });

    it('get real time status and communication is disabled, it should throw an error', (done) => {
      ssh.getRealtimeStatus('').catch((error) => {
        expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
        done();
      });
    });
  });
});
