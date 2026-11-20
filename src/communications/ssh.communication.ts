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
import {
  ProgressErrorPayload,
  ProgressInfoPayload,
  ProgressNoticePayload,
} from '../sockets/messages/socket-message';
import sshTools from '../utils/ssh';
import {
  CCDHash,
  Communication,
  CrowdSecAlertsQuery,
  CrowdSecCollectionAcquisition,
  CrowdSecCollectionAcquisitionParserSelection,
  CrowdSecCollectionAcquisitionUpdate,
  CrowdSecConsoleEnrollment,
  CrowdSecDecisionsQuery,
  CrowdSecBouncers,
  CrowdSecFirewallBackend,
  CrowdSecFirewallBouncerStatisticsSamples,
  CrowdSecFirewallBouncerStatisticsSamplingConfig,
  CrowdSecLapiConnectivityCheck,
  CrowdSecMachineActivation,
  CrowdSecMachineCredentials,
  CrowdSecMachineInstall,
  CrowdSecLapiMachines,
  CrowdSecMachineReauthentication,
  CrowdSecTransitionActivation,
  CrowdSecTransitionPrepare,
  FwcAgentInfo,
  OpenVPNHistoryRecord,
  OpenVPNStatusSamplingAgentState,
  PluginInstallOptions,
  PolicyScriptComparison,
  PolicyScriptContent,
  PolicyScriptHistoryEntry,
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
const backupPathOutputMarker = '__FWCLOUD_BACKUP_PATH__=';
const policyScriptOutputMarker = '__FWCLOUD_POLICY_SCRIPT__=';
const policyScriptBackupName = /^fwcloud-\d{14}\.sh$/;
export const validatePolicyScriptDates = `
has_policy_script_dates() {
  [ ! -L "$1" ] || return 1
  [ -f "$1" ] || return 1
  policy_dir="$(dirname "$1")"
  while [ "$policy_dir" != / ]; do
    [ ! -L "$policy_dir" ] || return 1
    policy_dir="$(dirname "$policy_dir")"
  done
  header="$(head -n 25 "$1")" || return 1
  compilation_date="$(printf '%s\\n' "$header" | sed -n 's/^FWCLOUD_COMPILATION_DATE="\\(.*\\)"$/\\1/p' | head -n 1)"
  installation_date="$(printf '%s\\n' "$header" | sed -n 's/^FWCLOUD_INSTALLATION_DATE="\\(.*\\)"$/\\1/p' | head -n 1)"
  [ -n "$compilation_date" ] && [ -n "$installation_date" ]
}
`.trim();

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
    let backupPath = '';
    let installedScriptPath = '';
    let shDebug = '';
    let sudo = '';
    let failedAction = 'installation';

    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }
      const scriptName = config.get('policy').script_name;
      const uploadedScriptPath = `./${scriptName}`;
      const standardScriptPath = `/etc/fwcloud/${scriptName}`;
      const edgeOSScriptPath = `/config/scripts/post-config.d/${scriptName}`;
      eventEmitter.emit(
        'message',
        new ProgressInfoPayload(`Uploading firewall script (${this.connectionData.host})`),
      );
      await sshTools.uploadFile(this.connectionData, scriptPath, scriptName);

      // Enable sh debug if it is selected in firewalls/cluster options.
      shDebug = this.connectionData.options & FireWallOptMask.DEBUG ? '-x' : '';

      sudo = this.connectionData.username === 'root' ? '' : 'sudo';

      eventEmitter.emit('message', new ProgressInfoPayload('Checking previous firewall script.'));
      const backupCommand = `
if [ -f ${shellQuote(standardScriptPath)} ]; then
  installed_script_path=${shellQuote(standardScriptPath)}
elif [ -f ${shellQuote(edgeOSScriptPath)} ]; then
  installed_script_path=${shellQuote(edgeOSScriptPath)}
else
  exit 0
fi
backup_path="$(dirname "$installed_script_path")/fwcloud-$(date +%Y%m%d%H%M%S).sh"
[ ! -e "$backup_path" ] || exit 1
mv "$installed_script_path" "$backup_path"
printf '${backupPathOutputMarker}%s\\n' "$backup_path"
`.trim();
      const backupOutput = (
        await sshTools.runCommand(this.connectionData, `${sudo} sh -c ${shellQuote(backupCommand)}`)
      ).trim();
      const backupPathLine = backupOutput
        .split(/\r?\n/)
        .find((line) => line.includes(backupPathOutputMarker));
      backupPath = backupPathLine
        ? backupPathLine.slice(
            backupPathLine.indexOf(backupPathOutputMarker) + backupPathOutputMarker.length,
          )
        : '';
      if (backupPath) {
        installedScriptPath = path.posix.join(path.posix.dirname(backupPath), scriptName);
        eventEmitter.emit(
          'message',
          new ProgressInfoPayload('Previous firewall script backed up.'),
        );
      }

      eventEmitter.emit('message', new ProgressInfoPayload('Installing firewall script.'));
      await sshTools.runCommand(
        this.connectionData,
        `${sudo} sh ${shDebug} ${shellQuote(uploadedScriptPath)} install`,
      );

      eventEmitter.emit('message', new ProgressInfoPayload('Loading firewall policy.'));
      failedAction = 'policy loading';
      const cmd = `${sudo} sh ${shDebug} -c ${shellQuote(`if [ -f ${shellQuote(standardScriptPath)} ]; then
  sh ${shDebug} ${shellQuote(standardScriptPath)} start
else
  sh ${shDebug} ${shellQuote(edgeOSScriptPath)} start
fi`)}`;
      await sshTools.runCommand(this.connectionData, cmd, eventEmitter);

      return 'DONE';
    } catch (error) {
      if (backupPath) {
        try {
          eventEmitter.emit(
            'message',
            new ProgressErrorPayload(
              `Firewall policy ${failedAction} failed. Restoring previous firewall script.`,
            ),
          );
          eventEmitter.emit(
            'message',
            new ProgressInfoPayload('Restoring previous firewall script.'),
          );
          const restoreCommand = [
            `rm -f ${shellQuote(`./${config.get('policy').script_name}`)} ${shellQuote(installedScriptPath)}`,
            `mv ${shellQuote(backupPath)} ${shellQuote(installedScriptPath)}`,
          ].join('\n');
          await sshTools.runCommand(
            this.connectionData,
            `${sudo} sh -c ${shellQuote(restoreCommand)}`,
          );
          await sshTools.runCommand(
            this.connectionData,
            `${sudo} sh ${shDebug} ${shellQuote(installedScriptPath)} start`,
            eventEmitter,
          );
        } catch (recoveryError) {
          throw Object.assign(
            new Error(
              `Firewall policy installation failed and the previous policy could not be restored: ${recoveryError.message}`,
            ),
            { cause: recoveryError },
          );
        }
      }
      this.handleRequestException(error, eventEmitter);
    }
  }

  async getFirewallPolicyScriptHistory(): Promise<PolicyScriptHistoryEntry[]> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }

      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';
      const scriptName = config.get('policy').script_name;
      const installationDirectories = this.getPolicyScriptInstallationDirectories();
      const timestampPattern =
        '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]';
      const listCommand = `
print_policy_script() {
  script_path="$1"
  has_policy_script_dates "$script_path" || return
  printf '${policyScriptOutputMarker}%s\\t%s\\t%s\\n' "$script_path" "$compilation_date" "$installation_date"
}

{
  for installation_dir in ${installationDirectories.map(shellQuote).join(' ')}; do
    active_script_path="$installation_dir"/${shellQuote(scriptName)}
    if [ -f "$active_script_path" ]; then
      print_policy_script "$active_script_path"
    fi

    for script_path in "$installation_dir"/fwcloud-${timestampPattern}.sh; do
      [ -f "$script_path" ] || continue
      print_policy_script "$script_path"
    done
  done
} | LC_ALL=C sort -r
`.trim();
      const output = await sshTools.runCommand(
        this.connectionData,
        `${sudo} sh -c ${shellQuote(`${validatePolicyScriptDates}\n${listCommand}`)}`,
      );

      return output
        .split(/\r?\n/)
        .filter((line) => line.startsWith(policyScriptOutputMarker))
        .map((line) => line.slice(policyScriptOutputMarker.length).split('\t'))
        .filter(
          ([scriptPath, compilationDate, installationDate]) =>
            scriptPath !== undefined && compilationDate !== '' && installationDate !== '',
        )
        .map(([scriptPath, compilationDate, installationDate]) => ({
          path: scriptPath,
          compilation_date: compilationDate,
          installation_date: installationDate,
        }));
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async getFirewallPolicyScriptContent(file: string): Promise<PolicyScriptContent> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }

      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';
      const scriptPath = this.getValidPolicyScriptPath(file);
      const content = await sshTools.runCommand(
        this.connectionData,
        `${sudo} sh -c ${shellQuote(`${validatePolicyScriptDates}\nhas_policy_script_dates ${shellQuote(scriptPath)} || exit 1\ncat ${shellQuote(scriptPath)}`)}`,
      );

      return { content };
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async compareFirewallPolicyScripts(
    file1: string,
    file2: string,
  ): Promise<PolicyScriptComparison> {
    try {
      if (!app().config.get('firewall_communication.ssh_enable')) {
        throw fwcError.SSH_COMMUNICATION_DISABLE;
      }

      const sudo = this.connectionData.username === 'root' ? '' : 'sudo';
      const scriptPath1 = this.getValidPolicyScriptPath(file1);
      const scriptPath2 = this.getValidPolicyScriptPath(file2);
      const comparisonCommand = `
${validatePolicyScriptDates}
has_policy_script_dates ${shellQuote(scriptPath1)} || exit 1
has_policy_script_dates ${shellQuote(scriptPath2)} || exit 1
if diff ${shellQuote(scriptPath1)} ${shellQuote(scriptPath2)}; then
  exit 0
else
  status=$?
fi

[ "$status" -eq 1 ] && exit 0
exit "$status"
`.trim();
      const diff = await sshTools.runCommand(
        this.connectionData,
        `${sudo} sh -c ${shellQuote(comparisonCommand)}`,
      );

      return { diff };
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  private getPolicyScriptInstallationDirectories(): string[] {
    return ['/etc/fwcloud', '/config/scripts/post-config.d'];
  }

  private getValidPolicyScriptPath(file: string): string {
    const scriptName = config.get('policy').script_name;
    const directory = path.posix.dirname(file);
    const filename = path.posix.basename(file);
    const isExpectedDirectory = this.getPolicyScriptInstallationDirectories().includes(directory);
    const isActiveScript = filename === scriptName;

    if (!isExpectedDirectory || (!isActiveScript && !policyScriptBackupName.test(filename))) {
      throw new Error('Invalid policy script path');
    }

    return file;
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
    _managedBouncerName?: string,
  ): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  installCrowdSecBouncer(
    _eventEmitter?: EventEmitter,
    _managedBouncerName?: string,
  ): Promise<Record<string, unknown>> {
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

  getCrowdSecCollectionAcquisition(_name: string): Promise<CrowdSecCollectionAcquisition> {
    throw new Error('Method not implemented.');
  }

  updateCrowdSecCollectionAcquisition(
    _acquisition: CrowdSecCollectionAcquisitionUpdate,
  ): Promise<CrowdSecCollectionAcquisition> {
    throw new Error('Method not implemented.');
  }

  selectCrowdSecCollectionAcquisitionParser(
    _selection: CrowdSecCollectionAcquisitionParserSelection,
  ): Promise<CrowdSecCollectionAcquisition> {
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

  getCrowdSecBouncers(): Promise<CrowdSecBouncers> {
    throw new Error('Method not implemented.');
  }

  getCrowdSecFirewallBouncerStatistics(): Promise<CrowdSecFirewallBouncerStatisticsSamples> {
    throw new Error('Method not implemented.');
  }

  takeCrowdSecFirewallBouncerStatistics(): Promise<CrowdSecFirewallBouncerStatisticsSamples> {
    throw new Error('Method not implemented.');
  }

  getCrowdSecFirewallBouncerStatisticsSampling(): Promise<CrowdSecFirewallBouncerStatisticsSamplingConfig> {
    throw new Error('Method not implemented.');
  }

  updateCrowdSecFirewallBouncerStatisticsSampling(
    _config: CrowdSecFirewallBouncerStatisticsSamplingConfig,
  ): Promise<void> {
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

  configureCrowdSecCentralLapi(_listenUri: string): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  checkCrowdSecLapiConnectivity(_lapiUrl: string): Promise<CrowdSecLapiConnectivityCheck> {
    throw new Error('Method not implemented.');
  }

  getCrowdSecLapiReplicationReadiness(): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  exportCrowdSecMachineCredentials(_name: string): Promise<CrowdSecMachineCredentials> {
    throw new Error('Method not implemented.');
  }

  replicateCrowdSecLapiMachine(_name: string, _password: string): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  replicateCrowdSecLapiBouncer(_name: string, _apiKey: string): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  getCrowdSecLapiMachines(): Promise<CrowdSecLapiMachines> {
    throw new Error('Method not implemented.');
  }

  validateCrowdSecLapiMachine(_name: string): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  removeCrowdSecLapiMachine(_name: string): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  installCrowdSecMachine(
    _installation: CrowdSecMachineInstall,
    _eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  activateCrowdSecMachine(
    _activation: CrowdSecMachineActivation,
    _eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  reauthenticateCrowdSecMachine(
    _reauthentication: CrowdSecMachineReauthentication,
    _eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  resumeCrowdSecMachine(
    _machineName: string,
    _localRemediation: boolean,
    _eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  preflightCrowdSecTransition(
    _transition: CrowdSecTransitionPrepare,
    _eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  prepareCrowdSecTransition(
    _transition: CrowdSecTransitionPrepare,
    _eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  activateCrowdSecTransition(
    _transition: CrowdSecTransitionActivation,
    _eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  recoverCrowdSecTransition(_transitionId: string): Promise<Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  finalizeCrowdSecTransition(_transitionId: string): Promise<Record<string, unknown>> {
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
