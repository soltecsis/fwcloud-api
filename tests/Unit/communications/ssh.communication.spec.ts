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
import sinon from 'sinon';
import { CCDHash } from '../../../src/communications/communication';
import { expect, testSuite } from '../../mocha/global-setup';
import { SSHCommunication } from '../../../src/communications/ssh.communication';
import sshTools from '../../../src/utils/ssh';
import { Application } from '../../../src/Application';
import errorTable from '../../../src/utils/error_table';

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

    it('ensure OpenVPN client config dir and communication is disabled, it should throw an error', (done) => {
      ssh.ensureOpenVPNClientConfigDir('/etc/openvpn/ccd', 'nogroup').catch((error) => {
        expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
        done();
      });
    });

    it('remove OpenVPN client config dir and communication is disabled, it should throw an error', (done) => {
      ssh.removeOpenVPNClientConfigDirIfEmpty('/etc/openvpn/ccd').catch((error) => {
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

  describe('Firewall policy installation', () => {
    const standardScriptPath = '/etc/fwcloud/fwcloud.sh';
    const backupPath = '/etc/fwcloud/fwcloud-20261116123045.sh';
    const backupPathOutputMarker = '__FWCLOUD_BACKUP_PATH__=';
    let uploadFile: sinon.SinonStub;
    let runCommand: sinon.SinonStub;

    beforeEach(() => {
      testSuite.app.config.set('firewall_communication.ssh_enable', true);
      uploadFile = sinon.stub(sshTools, 'uploadFile').resolves();
      runCommand = sinon.stub(sshTools, 'runCommand');
    });

    it('backs up an installed script before installing and loading the new policy', async () => {
      runCommand.onCall(0).resolves(`${backupPathOutputMarker}${backupPath}\n`);
      runCommand.onCall(1).resolves('');
      runCommand.onCall(2).resolves('');

      expect(await ssh.installFirewallPolicy('/tmp/fwcloud.sh')).to.equal('DONE');

      expect(uploadFile.firstCall.args.slice(1)).to.deep.equal(['/tmp/fwcloud.sh', 'fwcloud.sh']);
      expect(runCommand.callCount).to.equal(3);
      expect(runCommand.getCall(0).args[1]).to.contain(standardScriptPath);
      expect(runCommand.getCall(0).args[1]).to.contain('date +%Y%m%d%H%M%S');
      expect(runCommand.getCall(0).args[1]).to.contain(backupPathOutputMarker);
      expect(runCommand.getCall(1).args[1]).to.contain("'./fwcloud.sh' install");
      expect(runCommand.getCall(2).args[1]).to.contain(standardScriptPath);
      expect(runCommand.getCall(2).args[1]).to.contain('start');
    });

    it('does not attempt recovery on a first installation', async () => {
      runCommand.onCall(0).resolves('');
      runCommand.onCall(1).resolves('');
      runCommand.onCall(2).resolves('');

      expect(await ssh.installFirewallPolicy('/tmp/fwcloud.sh')).to.equal('DONE');

      expect(runCommand.callCount).to.equal(3);
      expect(runCommand.getCall(2).args[1]).to.contain(standardScriptPath);
      expect(runCommand.getCall(2).args[1]).to.contain('start');
    });

    it('restores the exact backup when installing the new policy fails', async () => {
      const installationError = new Error('installation failed');
      runCommand.onCall(0).resolves(`${backupPathOutputMarker}${backupPath}\n`);
      runCommand.onCall(1).rejects(installationError);
      runCommand.onCall(2).resolves('');
      runCommand.onCall(3).resolves('');

      await expect(ssh.installFirewallPolicy('/tmp/fwcloud.sh')).to.be.rejectedWith(
        installationError,
      );

      expect(runCommand.callCount).to.equal(4);
      expect(runCommand.getCall(2).args[1]).to.contain('rm -f');
      expect(runCommand.getCall(2).args[1]).to.contain(backupPath);
      expect(runCommand.getCall(2).args[1]).to.contain(standardScriptPath);
      expect(runCommand.getCall(3).args[1]).to.contain(`'${standardScriptPath}' start`);
    });

    it('restores the exact backup when loading the new policy fails', async () => {
      const loadingError = new Error('loading failed');
      runCommand.onCall(0).resolves(`${backupPathOutputMarker}${backupPath}\n`);
      runCommand.onCall(1).resolves('');
      runCommand.onCall(2).rejects(loadingError);
      runCommand.onCall(3).resolves('');
      runCommand.onCall(4).resolves('');

      await expect(ssh.installFirewallPolicy('/tmp/fwcloud.sh')).to.be.rejectedWith(loadingError);

      expect(runCommand.callCount).to.equal(5);
      expect(runCommand.getCall(3).args[1]).to.contain('mv');
      expect(runCommand.getCall(3).args[1]).to.contain(backupPath);
      expect(runCommand.getCall(3).args[1]).to.contain(standardScriptPath);
      expect(runCommand.getCall(4).args[1]).to.contain(`'${standardScriptPath}' start`);
    });

    it('ignores pseudo-terminal password masking when restoring an installed script', async () => {
      const installationError = new Error('installation failed');
      const passwordMasking = '********\b \b\b \b\r\n';
      runCommand.onCall(0).resolves(`${passwordMasking}${backupPathOutputMarker}${backupPath}\n`);
      runCommand.onCall(1).rejects(installationError);
      runCommand.onCall(2).resolves('');
      runCommand.onCall(3).resolves('');

      await expect(ssh.installFirewallPolicy('/tmp/fwcloud.sh')).to.be.rejectedWith(
        installationError,
      );

      expect(runCommand.getCall(2).args[1]).to.contain(backupPath);
      expect(runCommand.getCall(2).args[1]).to.not.contain(passwordMasking);
    });
  });

  describe('OpenVPN client config directory', () => {
    let stub: sinon.SinonStub;

    beforeEach(() => {
      testSuite.app.config.set('firewall_communication.ssh_enable', true);
      stub = sinon.stub(sshTools, 'runCommand').resolves('');
    });

    it('should create and set ownership and permissions', async () => {
      await ssh.ensureOpenVPNClientConfigDir('/etc/openvpn/ccd', 'nogroup');

      expect(stub.getCall(0).args[1]).to.equal("sudo mkdir -p '/etc/openvpn/ccd'");
      expect(stub.getCall(1).args[1]).to.equal("sudo chown 'root:nogroup' '/etc/openvpn/ccd'");
      expect(stub.getCall(2).args[1]).to.equal("sudo chmod 750 '/etc/openvpn/ccd'");
    });

    it('should remove the directory only when it is empty', async () => {
      await ssh.removeOpenVPNClientConfigDirIfEmpty('/etc/openvpn/ccd');

      expect(stub.calledOnce).to.be.true;
      expect(stub.firstCall.args[1]).to.equal("sudo rmdir '/etc/openvpn/ccd' 2>/dev/null || true");
    });
  });
});
