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

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { app } from '../fonaments/abstract-application';
import { FwCloudError } from '../fonaments/exceptions/error';
import { FireWallOptMask } from '../models/firewall/Firewall';
import { ProgressInfoPayload, ProgressNoticePayload } from '../sockets/messages/socket-message';
import sshTools from '../utils/ssh';
import {
  CCDHash,
  Communication,
  CrowdSecAlertsQuery,
  CrowdSecConsoleEnrollment,
  CrowdSecDecisionsQuery,
  CrowdSecFirewallBackend,
  FwcAgentInfo,
  OpenVPNHistoryRecord,
  OpenVPNStatusSamplingAgentState,
  PluginInstallOptions,
} from './communication';
const config = require('../config/config');
const fwcError = require('../utils/error_table');

type SSHConnectionData = {
  host: string;
  port: number;
  username: string;
  password: string;
  options: any;
};

const OPENVPN_2FA_CHECK_SCRIPT_NAME = 'check_2fa.sh';
const OPENVPN_2FA_REMOTE_SCRIPT_DIR = '/etc/openvpn/bin';
const OPENVPN_2FA_REMOTE_SCRIPT_PATH = `${OPENVPN_2FA_REMOTE_SCRIPT_DIR}/${OPENVPN_2FA_CHECK_SCRIPT_NAME}`;

const OPENVPN_2FA_ENABLE_COMMAND = `
if [ -r /etc/os-release ]; then
  . /etc/os-release
fi

case "$ID $ID_LIKE" in
  *rhel*|*centos*|*rocky*|*fedora*)
    yum install -y epel-release
    yum install -y oathtool
    ;;
  *)
    apt-get install -y oathtool
    ;;
esac

mkdir -p /etc/openvpn
mkdir -p /etc/openvpn/bin
mkdir -p /etc/openvpn/google-authenticator
chmod 755 /etc/openvpn/bin
chmod 755 /etc/openvpn/google-authenticator
`.trim();

const OPENVPN_2FA_DISABLE_COMMAND = `
rm -f ${OPENVPN_2FA_REMOTE_SCRIPT_PATH}
rmdir /etc/openvpn/bin 2>/dev/null || true
rm -rf /etc/openvpn/google-authenticator

if [ -r /etc/os-release ]; then
  . /etc/os-release
fi

case "$ID $ID_LIKE" in
  *rhel*|*centos*|*rocky*|*fedora*)
    yum remove -y oathtool
    ;;
  *)
    apt-get remove -y oathtool
    ;;
esac
`.trim();

const getOpenVPN2FADisableCommand = (serverCN?: string): string => {
  if (!serverCN) {
    return OPENVPN_2FA_DISABLE_COMMAND;
  }

  const escapedServerCN = serverCN.replace(/'/g, `'\\''`);
  return `
rm -rf '/etc/openvpn/google-authenticator/${escapedServerCN}'
rmdir /etc/openvpn/google-authenticator 2>/dev/null || true
`.trim();
};

const getOpenVPN2FACheckScriptPath = (): string => {
  const candidatePaths = [
    path.join(app().path, 'dist', 'src', 'config', 'openvpn', OPENVPN_2FA_CHECK_SCRIPT_NAME),
    path.join(app().path, 'src', 'config', 'openvpn', OPENVPN_2FA_CHECK_SCRIPT_NAME),
  ];

  for (const candidatePath of candidatePaths) {
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  throw new Error(`OpenVPN 2FA check script not found: ${candidatePaths.join(', ')}`);
};

const shellQuote = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;

export class SSHCommunication extends Communication<SSHConnectionData> {
  getOpenVPNHistoryFile(filepath: string): Promise<OpenVPNHistoryRecord[]> {
    throw new Error('Method not implemented.');
  }

  syncOpenVPNStatusSampling(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getOpenVPNStatusSamplingState(): Promise<OpenVPNStatusSamplingAgentState> {
    throw new Error('Method not implemented.');
  }

  async installFirewallPolicy(
    scriptPath: string,
    eventEmitter: EventEmitter = new EventEmitter(),
    _crowdSecBackend?: CrowdSecFirewallBackend,
  ): Promise<string> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      eventEmitter.emit(
        'message',
        new ProgressNoticePayload(`Uploading firewall script (${this.connectionData.host})`),
      );
      await sshTools.uploadFile(this.connectionData, scriptPath, config.get('policy').script_name);

      // Enable sh debug if it is selected in firewalls/cluster options.
      const sh_debug = this.connectionData.options & FireWallOptMask.DEBUG ? '-x' : '';

      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

      eventEmitter.emit('message', new ProgressNoticePayload('Installing firewall script.'));
      await sshTools.runCommand(
        this.connectionData,
        `${sudo} sh ${sh_debug} ./${config.get('policy').script_name} install`,
      );

      eventEmitter.emit('message', new ProgressNoticePayload('Loading firewall policy.'));
      const cmd = `${sudo} sh ${sh_debug} -c 'if [ -d /etc/fwcloud ]; then
                sh ${sh_debug} /etc/fwcloud/${config.get('policy').script_name} start;
                else sh ${sh_debug} /config/scripts/post-config.d/${config.get('policy').script_name} start;
            fi'`;
      await sshTools.runCommand(this.connectionData, cmd, eventEmitter);

      return 'DONE';
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async installOpenVPNServerConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter?: EventEmitter,
  ): Promise<void> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

      const existsDir = await sshTools.runCommand(
        this.connectionData,
        `if [ -d "${dir}" ]; then echo -n 1; else echo -n 0; fi`,
      );
      if (existsDir === '0') {
        eventEmitter.emit('message', new ProgressNoticePayload(`Creating install directory.\n`));
        await sshTools.runCommand(this.connectionData, `${sudo} mkdir "${dir}"`);
        await sshTools.runCommand(this.connectionData, `${sudo} chown root:root "${dir}"`);
        await sshTools.runCommand(this.connectionData, `${sudo} chmod 755 "${dir}"`);
      }

      for (const config of configs) {
        eventEmitter.emit(
          'message',
          new ProgressNoticePayload(
            `Uploading OpenVPN configuration file '${dir}/${config.name}' to: (${this.connectionData.host})\n`,
          ),
        );
        eventEmitter.emit(
          'message',
          new ProgressNoticePayload(`Installing OpenVPN configuration file.\n`),
        );
        await sshTools.uploadStringToFile(this.connectionData, config.content, config.name);
        await sshTools.runCommand(this.connectionData, `${sudo} mv ${config.name} ${dir}/`);
        eventEmitter.emit('message', new ProgressNoticePayload(`Setting up file permissions.\n\n`));
        await sshTools.runCommand(
          this.connectionData,
          `${sudo} chown root:root ${dir}/${config.name}`,
        );
        const isOpenVPN2FAUsersFile =
          dir === '/etc/openvpn' && config.name.endsWith('_2fa_users.txt');
        const isOpenVPN2FASecretFile = dir.startsWith('/etc/openvpn/google-authenticator');
        const fileMode = isOpenVPN2FAUsersFile || isOpenVPN2FASecretFile ? '644' : '600';
        await sshTools.runCommand(
          this.connectionData,
          `${sudo} chmod ${fileMode} ${dir}/${config.name}`,
        );
      }

      return;
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async installOpenVPNClientConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<void> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

      const existsDir = await sshTools.runCommand(
        this.connectionData,
        `if [ -d "${dir}" ]; then echo -n 1; else echo -n 0; fi`,
      );
      if (existsDir === '0') {
        eventEmitter.emit('message', new ProgressNoticePayload(`Creating install directory.\n`));
        await sshTools.runCommand(this.connectionData, `${sudo} mkdir "${dir}"`);
        await sshTools.runCommand(this.connectionData, `${sudo} chown root:root "${dir}"`);
        await sshTools.runCommand(this.connectionData, `${sudo} chmod 755 "${dir}"`);
      }

      for (const config of configs) {
        eventEmitter.emit(
          'message',
          new ProgressInfoPayload(
            `Uploading CCD configuration file '${dir}/${config.name}' to: (${this.connectionData.host})\n`,
          ),
        );
        eventEmitter.emit(
          'message',
          new ProgressNoticePayload(`Installing OpenVPN configuration file.\n`),
        );
        await sshTools.uploadStringToFile(this.connectionData, config.content, config.name);
        await sshTools.runCommand(this.connectionData, `${sudo} mv ${config.name} ${dir}/`);
        eventEmitter.emit('message', new ProgressNoticePayload(`Setting up file permissions.\n\n`));
        await sshTools.runCommand(
          this.connectionData,
          `${sudo} chown root:root ${dir}/${config.name}`,
        );
        await sshTools.runCommand(this.connectionData, `${sudo} chmod 644 ${dir}/${config.name}`);
      }

      return;
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async readOpenVPNFile(dir: string, name: string): Promise<string> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const sudo = this.connectionData.username === 'root' ? '' : 'sudo ';
      const remotePath = `${dir}/${name}`;
      const cmd = `${sudo}cat '${remotePath.replace(/'/g, "'\\''")}'`;
      const content = await sshTools.runCommand(this.connectionData, cmd);
      return content;
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async uninstallOpenVPNConfigs(
    dir: string,
    files: string[],
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<void> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

      for (const file of files) {
        eventEmitter.emit(
          'message',
          new ProgressNoticePayload(
            `Removing OpenVPN configuration file '${dir}/${file}' from: (${this.connectionData.host})\n`,
          ),
        );

        await sshTools.runCommand(this.connectionData, `${sudo} rm -f "${dir}/${file}"`);
      }

      return;
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async ensureOpenVPNClientConfigDir(
    dir: string,
    group: string,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<void> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

      eventEmitter.emit(
        'message',
        new ProgressNoticePayload(`Preparing OpenVPN client configuration directory.\n`),
      );

      await sshTools.runCommand(this.connectionData, `${sudo} mkdir -p ${shellQuote(dir)}`);
      await sshTools.runCommand(
        this.connectionData,
        `${sudo} chown ${shellQuote(`root:${group}`)} ${shellQuote(dir)}`,
      );
      await sshTools.runCommand(this.connectionData, `${sudo} chmod 750 ${shellQuote(dir)}`);

      return;
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async removeOpenVPNClientConfigDirIfEmpty(
    dir: string,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<void> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

      eventEmitter.emit(
        'message',
        new ProgressNoticePayload(`Removing OpenVPN client configuration directory if empty.\n`),
      );

      await sshTools.runCommand(
        this.connectionData,
        `${sudo} rmdir ${shellQuote(dir)} 2>/dev/null || true`,
      );

      return;
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async installWireGuardServerConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter?: EventEmitter,
  ): Promise<void> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

      const existsDir = await sshTools.runCommand(
        this.connectionData,
        `if [ -d "${dir}" ]; then echo -n 1; else echo -n 0; fi`,
      );
      if (existsDir === '0') {
        eventEmitter.emit('message', new ProgressNoticePayload(`Creating install directory.\n`));
        await sshTools.runCommand(this.connectionData, `${sudo} mkdir "${dir}"`);
        await sshTools.runCommand(this.connectionData, `${sudo} chown root:root "${dir}"`);
        await sshTools.runCommand(this.connectionData, `${sudo} chmod 755 "${dir}"`);
      }

      for (const config of configs) {
        eventEmitter.emit(
          'message',
          new ProgressNoticePayload(
            `Uploading WireGuard configuration file '${dir}/${config.name}' to: (${this.connectionData.host})\n`,
          ),
        );
        eventEmitter.emit(
          'message',
          new ProgressNoticePayload(`Installing WireGuard configuration file.\n`),
        );
        await sshTools.uploadStringToFile(this.connectionData, config.content, config.name);
        await sshTools.runCommand(this.connectionData, `${sudo} mv ${config.name} ${dir}/`);
        eventEmitter.emit('message', new ProgressNoticePayload(`Setting up file permissions.\n\n`));
        await sshTools.runCommand(
          this.connectionData,
          `${sudo} chown root:root ${dir}/${config.name}`,
        );
        await sshTools.runCommand(this.connectionData, `${sudo} chmod 600 ${dir}/${config.name}`);
      }

      return;
    } catch (error) {
      console.log('Error ssh: ', error);
      this.handleRequestException(error, eventEmitter);
    }
  }

  async uninstallWireGuardConfigs(
    dir: string,
    files: string[],
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<void> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

      for (const file of files) {
        eventEmitter.emit(
          'message',
          new ProgressNoticePayload(
            `Removing WireGuard configuration file '${dir}/${file}' from: (${this.connectionData.host})\n`,
          ),
        );

        await sshTools.runCommand(this.connectionData, `${sudo} rm -f "${dir}/${file}"`);
      }

      return;
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async installIPSecServerConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter?: EventEmitter,
  ): Promise<void> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

      const existsDir = await sshTools.runCommand(
        this.connectionData,
        `if [ -d "${dir}" ]; then echo -n 1; else echo -n 0; fi`,
      );
      if (existsDir === '0') {
        eventEmitter.emit('message', new ProgressNoticePayload(`Creating install directory.\n`));
        await sshTools.runCommand(this.connectionData, `${sudo} mkdir "${dir}"`);
        await sshTools.runCommand(this.connectionData, `${sudo} chown root:root "${dir}"`);
        await sshTools.runCommand(this.connectionData, `${sudo} chmod 755 "${dir}"`);
      }

      for (const config of configs) {
        eventEmitter.emit(
          'message',
          new ProgressNoticePayload(
            `Uploading IPSec configuration file '${dir}/${config.name}' to: (${this.connectionData.host})\n`,
          ),
        );
        eventEmitter.emit(
          'message',
          new ProgressNoticePayload(`Installing IPSec configuration file.\n`),
        );
        await sshTools.uploadStringToFile(this.connectionData, config.content, config.name);
        await sshTools.runCommand(this.connectionData, `${sudo} mv ${config.name} ${dir}/`);
        eventEmitter.emit('message', new ProgressNoticePayload(`Setting up file permissions.\n\n`));
        await sshTools.runCommand(
          this.connectionData,
          `${sudo} chown root:root ${dir}/${config.name}`,
        );
        await sshTools.runCommand(this.connectionData, `${sudo} chmod 600 ${dir}/${config.name}`);
      }

      return;
    } catch (error) {
      console.log('Error ssh: ', error);
      this.handleRequestException(error, eventEmitter);
    }
  }

  async uninstallIPSecConfigs(
    dir: string,
    files: string[],
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<void> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

      for (const file of files) {
        eventEmitter.emit(
          'message',
          new ProgressNoticePayload(
            `Removing IPSec configuration file '${dir}/${file}' from: (${this.connectionData.host})\n`,
          ),
        );

        await sshTools.runCommand(this.connectionData, `${sudo} rm -f "${dir}/${file}"`);
      }

      return;
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async getFirewallInterfaces(): Promise<string> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';
      const data: any = await sshTools.runCommand(this.connectionData, `${sudo} ip a`);

      // Before answer, parse data to see if we have get a valid answer.

      return data;
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async getFirewallIptablesSave(): Promise<string[]> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';
      const data: string = await sshTools.runCommand(this.connectionData, `${sudo} iptables-save`);
      let iptablesSaveOutput: string[] = data.split('\r\n');

      if (iptablesSaveOutput[0].startsWith('[sudo]')) iptablesSaveOutput.shift();
      if (iptablesSaveOutput[iptablesSaveOutput.length - 1] === '')
        iptablesSaveOutput = iptablesSaveOutput.slice(0, -1);

      return iptablesSaveOutput;
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async ccdHashList(
    dir: string,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<CCDHash[]> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

      eventEmitter.emit(
        'message',
        new ProgressInfoPayload(`Comparing files with OpenVPN client configurations.\n`),
      );

      const commandResult: string = await sshTools.runCommand(
        this.connectionData,
        `${sudo} mkdir -p ${dir}; echo "file,sha256"; find ${dir} -maxdepth 1 -type f -exec sh -c "basename -z {}; echo -n ','; grep -v '^#' {} | sha256sum" \\; | awk '{print $1}'`,
      );

      return commandResult
        .split('\n')
        .filter((item) => item !== '' && item !== '\r')
        .slice(1) // Remove "file,sha256" line
        .map((item) => ({
          filename: item.split(',')[0].replace('\x00', ''),
          hash: item.split(',')[1].replace('\r', ''),
        }));
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async getRealtimeStatus(statusFilepath: string): Promise<string> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';
      const data = await sshTools.runCommand(
        this.connectionData,
        `${sudo} cat "${statusFilepath}"`,
      );
      // Remove the first line ()
      const lines = data.split('\n');
      if (lines[0].startsWith('[sudo] password for ')) {
        lines.splice(0, 1);
      }
      return lines.join('\n');
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async ping(): Promise<void> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }

      const sudo = this.connectionData.username === 'root' ? '' : 'sudo ';
      await sshTools.runCommand(this.connectionData, `${sudo}true`);
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  info(): Promise<FwcAgentInfo> {
    throw new Error('Method not implemented.');
  }

  async systemctlManagement(
    command: string,
    service: string,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<string> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

      const response = await sshTools.runCommand(
        this.connectionData,
        `${sudo} systemctl ${command === 'status' ? '--no-pager' : ''} ${command} ${service}`,
      );

      return response;
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
      return '';
    }
  }

  async installPlugin(
    name: string,
    enabled: boolean,
    eventEmitter: EventEmitter = new EventEmitter(),
    options?: PluginInstallOptions,
  ): Promise<string> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }

      if (name !== 'openvpn-2fa') {
        throw new Error('Method not implemented.');
      }

      const sudo = this.connectionData.username === 'root' ? '' : 'sudo ';
      const remoteCommand = enabled
        ? OPENVPN_2FA_ENABLE_COMMAND
        : getOpenVPN2FADisableCommand(options?.serverCN);

      eventEmitter.emit(
        'message',
        new ProgressNoticePayload(
          `${enabled ? 'Installing' : 'Removing'} OpenVPN 2FA plugin (${this.connectionData.host})`,
        ),
      );

      await sshTools.runCommand(
        this.connectionData,
        `${sudo}sh -c '${remoteCommand.replace(/'/g, `'\\''`)}'`,
        eventEmitter,
      );

      if (enabled) {
        eventEmitter.emit(
          'message',
          new ProgressNoticePayload(
            `Uploading OpenVPN 2FA check script (${this.connectionData.host})`,
          ),
        );

        await sshTools.uploadFile(
          this.connectionData,
          getOpenVPN2FACheckScriptPath(),
          OPENVPN_2FA_CHECK_SCRIPT_NAME,
        );
        await sshTools.runCommand(
          this.connectionData,
          `${sudo}mv ${OPENVPN_2FA_CHECK_SCRIPT_NAME} ${OPENVPN_2FA_REMOTE_SCRIPT_PATH}`,
          eventEmitter,
        );
        await sshTools.runCommand(
          this.connectionData,
          `${sudo}chown root:root ${OPENVPN_2FA_REMOTE_SCRIPT_PATH}`,
          eventEmitter,
        );
        await sshTools.runCommand(
          this.connectionData,
          `${sudo}chmod 755 ${OPENVPN_2FA_REMOTE_SCRIPT_PATH}`,
          eventEmitter,
        );
      }

      return '';
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  getCrowdSecStatus(): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  installCrowdSec(
    _eventEmitter?: EventEmitter,
    _backend?: CrowdSecFirewallBackend,
  ): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  installCrowdSecBouncer(_eventEmitter?: EventEmitter): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  uninstallCrowdSec(
    _confirm: boolean,
    _eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  getCrowdSecCollections(_installed?: boolean): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  installCrowdSecCollection(_name: string): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  removeCrowdSecCollection(_name: string): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  updateCrowdSecCollections(): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  getCrowdSecConsoleStatus(): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  enrollCrowdSecConsole(_enrollment: CrowdSecConsoleEnrollment): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  getCrowdSecDecisions(_query?: CrowdSecDecisionsQuery): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  deleteCrowdSecDecision(_id: string): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  flushCrowdSecDecisions(_confirm: boolean): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  getCrowdSecAlerts(_query?: CrowdSecAlertsQuery): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  getCrowdSecBouncers(): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  registerCrowdSecBouncer(_name: string): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  removeCrowdSecBouncer(_name: string): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  uninstallCrowdSecBouncer(
    _confirm: boolean,
    _eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  installDHCPConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<string> {
    throw new Error('Method not implemented.');
  }

  installKeepalivedConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter?: EventEmitter,
  ): Promise<string> {
    throw new Error('Method not implemented.');
  }

  installHAPRoxyConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter?: EventEmitter,
  ): Promise<string> {
    throw new Error('Method not implemented.');
  }
}
