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
import { HttpException } from '../fonaments/exceptions/http/http-exception';
import { ProgressErrorPayload } from '../sockets/messages/socket-message';

export type CCDHash = {
  filename: string;
  hash: string;
};

export type OpenVPNHistoryRecord = {
  timestamp: number;
  name: string;
  address: string;
  bytesReceived: number;
  bytesSent: number;
  connectedAtTimestampInSeconds: number;
};

export type OpenVPNStatusSamplingAgentStatusFile = {
  path: string;
  samplingInterval: number;
  requestMaxLines: number;
  cacheMaxSize: number;
};

export type OpenVPNStatusSamplingAgentConfig = {
  statusFiles: OpenVPNStatusSamplingAgentStatusFile[];
};

export type OpenVPNStatusSamplingAgentState = {
  accepted: boolean;
  statusFiles: OpenVPNStatusSamplingAgentStatusFile[];
};

export type WireGuardHistoryRecord = {
  timestamp: number;
  name: string;
  address: string;
  bytesReceived: number;
  bytesSent: number;
  connectedAtTimestampInSeconds: number;
};

export type IPSecHistoryRecord = {
  timestamp: number;
  name: string;
  address: string;
  bytesReceived: number;
  bytesSent: number;
  connectedAtTimestampInSeconds: number;
};

export type FwcAgentInfo = {
  fwc_agent_version: string;
  host_name: string;
  system_name: string;
  os_version: string;
  kernel_version: string;
};

export type SystemCtlInfo = {
  command: string;
  service: string;
};

export type PluginInstallOptions = {
  serverCN?: string;
  pluginParams?: string[];
};

export type CrowdSecConsoleEnrollment = {
  enrollmentKey: string;
  name?: string;
  tags?: string[];
};

export type CrowdSecFirewallBackend = 'iptables' | 'nftables';

export type CrowdSecMachineInstall = {
  machineName: string;
  lapiUrl: string;
  centralAgentUrl: string;
  centralAgentTlsFingerprint: string;
  preflightToken: string;
};

export type CrowdSecMachineActivation = {
  machineName: string;
  localRemediation: boolean;
  backend: CrowdSecFirewallBackend;
  bouncerApiKey?: string;
};

export type CrowdSecMachineReauthentication = CrowdSecMachineInstall;

export type CrowdSecDecisionsQuery = {
  limit?: number;
  scope?: string;
  value?: string;
  decisionType?: string;
  origin?: string;
  scenario?: string;
};

export type CrowdSecAlertsQuery = {
  limit?: number;
  since?: string;
  until?: string;
  scenario?: string;
  decisionType?: string;
  scope?: string;
  value?: string;
  ip?: string;
  range?: string;
};

type ErrorWithCode = {
  code: string;
} & Error;

function errorHasCode(error: Error): error is ErrorWithCode {
  return Object.prototype.hasOwnProperty.call(error, 'code');
}

export abstract class Communication<ConnectionData> {
  constructor(protected readonly connectionData: ConnectionData) {}

  abstract installOpenVPNServerConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter?: EventEmitter,
  ): Promise<void>;
  abstract installOpenVPNClientConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter?: EventEmitter,
  ): Promise<void>;
  abstract installWireGuardServerConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter?: EventEmitter,
  ): Promise<void>;
  abstract installIPSecServerConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter?: EventEmitter,
  ): Promise<void>;
  abstract installHAPRoxyConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter?: EventEmitter,
  ): Promise<string>;
  abstract installDHCPConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter?: EventEmitter,
  ): Promise<string>;
  abstract installKeepalivedConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter?: EventEmitter,
  ): Promise<string>;
  abstract ccdHashList(dir: string, channel?: EventEmitter): Promise<CCDHash[]>;
  abstract getOpenVPNHistoryFile(filepath: string): Promise<OpenVPNHistoryRecord[]>;
  abstract syncOpenVPNStatusSampling(config: OpenVPNStatusSamplingAgentConfig): Promise<void>;
  abstract getOpenVPNStatusSamplingState(): Promise<OpenVPNStatusSamplingAgentState>;
  abstract getRealtimeStatus(statusFilepath: string): Promise<string>;
  abstract uninstallOpenVPNConfigs(
    dir: string,
    files: string[],
    channel?: EventEmitter,
  ): Promise<void>;
  abstract ensureOpenVPNClientConfigDir(
    dir: string,
    group: string,
    channel?: EventEmitter,
  ): Promise<void>;
  abstract removeOpenVPNClientConfigDirIfEmpty(dir: string, channel?: EventEmitter): Promise<void>;
  abstract uninstallWireGuardConfigs(
    dir: string,
    files: string[],
    channel?: EventEmitter,
  ): Promise<void>;
  abstract uninstallIPSecConfigs(
    dir: string,
    files: string[],
    channel?: EventEmitter,
  ): Promise<void>;
  abstract readOpenVPNFile(dir: string, name: string): Promise<string>;
  abstract installFirewallPolicy(
    sourcePath: string,
    eventEmitter?: EventEmitter,
    crowdSecBackend?: CrowdSecFirewallBackend,
  ): Promise<string>;
  abstract getFirewallInterfaces(): Promise<string>;
  abstract getFirewallIptablesSave(): Promise<string[]>;
  abstract ping(): Promise<void>;
  abstract info(): Promise<FwcAgentInfo>;
  abstract systemctlManagement(command: string, service: string): Promise<string>;
  abstract installPlugin(
    name: string,
    enabled: boolean,
    eventEmitter?: EventEmitter,
    options?: PluginInstallOptions,
  ): Promise<string>;
  abstract getCrowdSecStatus(): Promise<Record<string, unknown>>;
  abstract installCrowdSec(
    eventEmitter?: EventEmitter,
    backend?: CrowdSecFirewallBackend,
  ): Promise<Record<string, unknown>>;
  abstract installCrowdSecBouncer(eventEmitter?: EventEmitter): Promise<Record<string, unknown>>;
  abstract uninstallCrowdSec(
    confirm: boolean,
    eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>>;
  abstract getCrowdSecCollections(installed?: boolean): Promise<Record<string, unknown>>;
  abstract installCrowdSecCollection(name: string): Promise<Record<string, unknown>>;
  abstract removeCrowdSecCollection(name: string): Promise<Record<string, unknown>>;
  abstract updateCrowdSecCollections(): Promise<Record<string, unknown>>;
  abstract getCrowdSecConsoleStatus(): Promise<Record<string, unknown>>;
  abstract enrollCrowdSecConsole(
    enrollment: CrowdSecConsoleEnrollment,
  ): Promise<Record<string, unknown>>;
  abstract getCrowdSecDecisions(query?: CrowdSecDecisionsQuery): Promise<Record<string, unknown>>;
  abstract deleteCrowdSecDecision(id: string): Promise<Record<string, unknown>>;
  abstract flushCrowdSecDecisions(confirm: boolean): Promise<Record<string, unknown>>;
  abstract getCrowdSecAlerts(query?: CrowdSecAlertsQuery): Promise<Record<string, unknown>>;
  abstract getCrowdSecBouncers(): Promise<Record<string, unknown>>;
  abstract registerCrowdSecBouncer(name: string): Promise<Record<string, unknown>>;
  abstract removeCrowdSecBouncer(name: string): Promise<Record<string, unknown>>;
  abstract uninstallCrowdSecBouncer(
    confirm: boolean,
    eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>>;
  abstract configureCrowdSecCentralLapi(listenUri: string): Promise<Record<string, unknown>>;
  abstract getCrowdSecLapiMachines(): Promise<Record<string, unknown>>;
  abstract validateCrowdSecLapiMachine(name: string): Promise<Record<string, unknown>>;
  abstract removeCrowdSecLapiMachine(name: string): Promise<Record<string, unknown>>;
  abstract createCrowdSecLapiPreflightToken(machineName: string): Promise<Record<string, unknown>>;
  abstract installCrowdSecMachine(
    installation: CrowdSecMachineInstall,
    eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>>;
  abstract activateCrowdSecMachine(
    activation: CrowdSecMachineActivation,
    eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>>;
  abstract reauthenticateCrowdSecMachine(
    reauthentication: CrowdSecMachineReauthentication,
    eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>>;
  abstract resumeCrowdSecMachine(
    machineName: string,
    localRemediation: boolean,
    eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>>;

  protected handleRequestException(error: Error, eventEmitter?: EventEmitter) {
    if (errorHasCode(error)) {
      if (error.code === 'ECONNREFUSED') {
        eventEmitter?.emit(
          'message',
          new ProgressErrorPayload(`ECONNREFUSED: Port is not valid\n`),
        );
        throw new HttpException(`ECONNREFUSED: Port is not valid`, 400);
      }

      if (error.code === 'ETIMEDOUT') {
        eventEmitter?.emit('message', new ProgressErrorPayload(`ETIMEDOUT: Host is not valid\n`));
        throw new HttpException(`ETIMEDOUT: IP is not valid`, 400);
      }

      if (error.code === 'ECONNRESET') {
        eventEmitter?.emit(
          'message',
          new ProgressErrorPayload(`ECONNRESET: Port or protocol might not be valid\n`),
        );
        throw new HttpException(`ECONNRESET: Port or protocol might not be valid`, 400);
      }

      if (error.code === 'EPROTO') {
        eventEmitter?.emit('message', new ProgressErrorPayload(`EPROTO: Protocol error\n`));
        throw new HttpException(`EPROTO: Protocol error`, 400);
      }
    }

    throw error;
  }
}
