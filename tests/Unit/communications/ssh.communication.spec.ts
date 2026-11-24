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
import {
  SSHCommunication,
  validatePolicyScriptDates,
} from '../../../src/communications/ssh.communication';
import sshTools from '../../../src/utils/ssh';
import { Application } from '../../../src/Application';
import errorTable from '../../../src/utils/error_table';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

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

    it('waits one second after reporting a loading failure before rollback', async () => {
      const clock = sinon.useFakeTimers();
      const loadingError = new Error('loading failed');
      const eventEmitter = new EventEmitter();
      const messages: Array<{ type: string; message: string }> = [];
      eventEmitter.on('message', (message) => messages.push(message));
      runCommand.onCall(0).resolves(`${backupPathOutputMarker}${backupPath}\n`);
      runCommand.onCall(1).resolves('');
      runCommand.onCall(2).rejects(loadingError);
      runCommand.onCall(3).resolves('');
      runCommand.onCall(4).resolves('');

      const result = expect(
        ssh.installFirewallPolicy('/tmp/fwcloud.sh', eventEmitter),
      ).to.be.rejectedWith(loadingError);

      await clock.tickAsync(999);
      expect(runCommand.callCount).to.equal(3);
      expect(messages.some((message) => message.message === 'Restoring previous firewall script.'))
        .to.be.false;
      await clock.tickAsync(1);
      await result;

      const failureIndex = messages.findIndex(
        (message) =>
          message.message ===
          'Firewall policy policy loading failed. Restoring previous firewall script.',
      );
      const restoreIndex = messages.findIndex(
        (message) => message.message === 'Restoring previous firewall script.',
      );
      expect(messages[failureIndex].type).to.equal('error');
      expect(messages[restoreIndex].type).to.equal('info');
      expect(failureIndex).to.be.lessThan(restoreIndex);
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

  describe('Firewall policy script history', () => {
    let runCommand: sinon.SinonStub;

    beforeEach(() => {
      testSuite.app.config.set('firewall_communication.ssh_enable', true);
      runCommand = sinon.stub(sshTools, 'runCommand');
    });

    it('accepts a regular script and rejects a symbolic link to it', () => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcloud-policy-history-'));
      const script = path.join(directory, 'fwcloud.sh');
      const link = path.join(directory, 'fwcloud-20261118090000.sh');
      const directoryLink = path.join(directory, 'directory-link');
      try {
        fs.writeFileSync(
          script,
          'FWCLOUD_COMPILATION_DATE="2026-11-18 09:00:00"\nFWCLOUD_INSTALLATION_DATE="2026-11-18 09:01:00"\n',
        );
        fs.symlinkSync(script, link);
        fs.symlinkSync(directory, directoryLink);
        const command = `${validatePolicyScriptDates}\nhas_policy_script_dates "$1"`;

        expect(spawnSync('sh', ['-c', command, 'sh', script]).status).to.equal(0);
        expect(spawnSync('sh', ['-c', command, 'sh', link]).status).to.equal(1);
        expect(
          spawnSync('sh', ['-c', command, 'sh', path.join(directoryLink, 'fwcloud.sh')]).status,
        ).to.equal(1);
      } finally {
        if (fs.existsSync(directoryLink)) fs.unlinkSync(directoryLink);
        if (fs.existsSync(link)) fs.unlinkSync(link);
        if (fs.existsSync(script)) fs.unlinkSync(script);
        fs.rmdirSync(directory);
      }
    });

    it('lists the active script and valid backups with lifecycle metadata', async () => {
      runCommand.resolves(
        '__FWCLOUD_POLICY_SCRIPT__=/etc/fwcloud/fwcloud.sh\t2026-11-18 09:30:00\t2026-11-18 09:31:00\n' +
          '__FWCLOUD_POLICY_SCRIPT__=/etc/fwcloud/fwcloud-20261118090000.sh\t2026-11-18 08:30:00\t2026-11-18 08:31:00\n' +
          '__FWCLOUD_POLICY_SCRIPT__=/etc/fwcloud/fwcloud-20261118080000.sh\t\t\n',
      );

      expect(await ssh.getFirewallPolicyScriptHistory()).to.deep.equal([
        {
          path: '/etc/fwcloud/fwcloud.sh',
          compilation_date: '2026-11-18 09:30:00',
          installation_date: '2026-11-18 09:31:00',
        },
        {
          path: '/etc/fwcloud/fwcloud-20261118090000.sh',
          compilation_date: '2026-11-18 08:30:00',
          installation_date: '2026-11-18 08:31:00',
        },
      ]);
      expect(runCommand.firstCall.args[1]).to.contain('/etc/fwcloud');
      expect(runCommand.firstCall.args[1]).to.contain('/config/scripts/post-config.d');
      expect(runCommand.firstCall.args[1]).to.contain('head -n 25');
      expect(runCommand.firstCall.args[1]).to.contain('FWCLOUD_COMPILATION_DATE');
    });

    it('reads an active policy script from an allowed directory', async () => {
      runCommand.resolves('#!/bin/sh\n');

      expect(await ssh.getFirewallPolicyScriptContent('/etc/fwcloud/fwcloud.sh')).to.deep.equal({
        content: '#!/bin/sh\n',
      });
      expect(runCommand.firstCall.args[1]).to.contain('cat');
      expect(runCommand.firstCall.args[1]).to.contain('/etc/fwcloud/fwcloud.sh');
      expect(runCommand.firstCall.args[1]).to.contain('has_policy_script_dates');
      expect(runCommand.firstCall.args[1]).to.contain('head -n 25');
    });

    it('returns a diff when selected policy scripts differ', async () => {
      runCommand.resolves('1c1\n');

      expect(
        await ssh.compareFirewallPolicyScripts(
          '/etc/fwcloud/fwcloud.sh',
          '/etc/fwcloud/fwcloud-20261118090000.sh',
        ),
      ).to.deep.equal({ diff: '1c1\n' });
      expect(runCommand.firstCall.args[1]).to.contain('diff');
      expect(runCommand.firstCall.args[1]).to.contain('[ "$status" -eq 1 ] && exit 0');
      expect(runCommand.firstCall.args[1]).to.contain('has_policy_script_dates');
      expect(runCommand.firstCall.args[1]).to.contain('head -n 25');
    });

    it('rejects paths outside policy script directories before running a command', async () => {
      await expect(ssh.getFirewallPolicyScriptContent('/tmp/fwcloud.sh')).to.be.rejectedWith(
        'Invalid policy script path',
      );
      expect(runCommand.notCalled).to.be.true;
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
