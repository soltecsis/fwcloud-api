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

import { EventEmitter } from 'events';
import {
  CCDHash,
  Communication,
  CrowdSecAlertsQuery,
  CrowdSecConsoleEnrollment,
  CrowdSecDecisionsQuery,
  FwcAgentInfo,
  OpenVPNHistoryRecord,
  OpenVPNStatusSamplingAgentConfig,
  OpenVPNStatusSamplingAgentState,
  PluginInstallOptions,
  SystemCtlInfo,
} from './communication';
import axios, { AxiosRequestConfig, AxiosResponse, CancelTokenSource } from 'axios';
import {
  ProgressErrorPayload,
  ProgressInfoPayload,
  ProgressNoticePayload,
  ProgressPayload,
  ProgressSSHCmdPayload,
} from '../sockets/messages/socket-message';
import * as fs from 'fs';
import FormData from 'form-data';
import * as path from 'path';
import * as https from 'https';
import { HttpException } from '../fonaments/exceptions/http/http-exception';
import { app } from '../fonaments/abstract-application';
import WebSocket from 'ws';

type AgentCommunicationData = {
  protocol: 'https' | 'http';
  host: string;
  port: number;
  apikey: string;
};

const CROWDSEC_AGENT_ERROR_RESPONSES: Record<string, { message: string; status: number }> = {
  CROWDSEC_UNSUPPORTED_SYSTEM: {
    message: 'CrowdSec is not supported on this system',
    status: 422,
  },
  CROWDSEC_NOT_INSTALLED: {
    message: 'CrowdSec is not installed',
    status: 409,
  },
  CROWDSEC_LAPI_UNAVAILABLE: {
    message: 'CrowdSec Local API is unavailable',
    status: 503,
  },
  CROWDSEC_FIREWALL_INTEGRATION_INVALID: {
    message: 'CrowdSec firewall integration is invalid',
    status: 409,
  },
  CROWDSEC_UNINSTALL_CONFIRMATION_REQUIRED: {
    message: 'CrowdSec uninstall confirmation is required',
    status: 422,
  },
  CROWDSEC_OPERATION_TIMEOUT: {
    message: 'CrowdSec operation timed out',
    status: 504,
  },
  CROWDSEC_COMMAND_FAILED: {
    message: 'CrowdSec agent command failed',
    status: 502,
  },
  CROWDSEC_BOUNCER_CONFLICT: {
    message: 'CrowdSec Firewall Bouncer configuration conflicts with FWCloud',
    status: 409,
  },
  CROWDSEC_BOUNCER_INVALID: {
    message: 'CrowdSec Firewall Bouncer configuration is invalid',
    status: 422,
  },
  CROWDSEC_COLLECTION_TAINTED: {
    message: 'CrowdSec collection is tainted',
    status: 409,
  },
  CROWDSEC_CONSOLE_INVALID_ENROLLMENT: {
    message: 'CrowdSec Console enrollment request is invalid',
    status: 422,
  },
};

export function crowdSecAgentErrorToHttpException(code: unknown): HttpException {
  const response = typeof code === 'string' ? CROWDSEC_AGENT_ERROR_RESPONSES[code] : undefined;

  return response
    ? new HttpException(response.message, response.status)
    : new HttpException('CrowdSec agent request failed', 502);
}

export function sanitizeCrowdSecProgressMessage(message: string): string {
  return message.replace(
    /((?:"?(?:api|enrollment)[ _-]?key"?\s*[:=]\s*))(?:(?:"[^"]*")|(?:'[^']*')|[^\s,}\]]+)/gi,
    '$1[REDACTED]',
  );
}

export type CrowdSecProgressMessageType = 'info' | 'success' | 'warning' | 'error';

export type CrowdSecProgressMessage = {
  message_type: CrowdSecProgressMessageType;
  message: string;
};

const CROWDSEC_PROGRESS_MESSAGE_TYPES: ReadonlySet<CrowdSecProgressMessageType> = new Set([
  'info',
  'success',
  'warning',
  'error',
]);

export function parseCrowdSecProgressMessage(message: string): CrowdSecProgressMessage | undefined {
  try {
    const value: unknown = JSON.parse(message);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return undefined;
    }

    const progress = value as Record<string, unknown>;
    if (
      typeof progress.message_type !== 'string' ||
      !CROWDSEC_PROGRESS_MESSAGE_TYPES.has(progress.message_type as CrowdSecProgressMessageType) ||
      typeof progress.message !== 'string' ||
      progress.message.length === 0
    ) {
      return undefined;
    }

    return {
      message_type: progress.message_type as CrowdSecProgressMessageType,
      message: sanitizeCrowdSecProgressMessage(progress.message),
    };
  } catch {
    return undefined;
  }
}

export function crowdSecProgressPayload(message: string): ProgressPayload {
  const progressMessage = parseCrowdSecProgressMessage(message);

  return progressMessage
    ? new ProgressPayload(progressMessage.message_type, false, progressMessage.message)
    : new ProgressSSHCmdPayload(sanitizeCrowdSecProgressMessage(message));
}

export class AgentCommunication extends Communication<AgentCommunicationData> {
  protected readonly url: string;
  protected readonly ws_url: string;
  protected readonly headers: Record<string, unknown>;
  protected readonly config: AxiosRequestConfig;
  protected readonly cancel_token: CancelTokenSource;

  protected WSisClosed: boolean = false;
  protected eventEmitterWSClose: EventEmitter = new EventEmitter();

  constructor(connectionData: AgentCommunicationData) {
    super(connectionData);

    if (connectionData.apikey === null || connectionData.apikey === undefined) {
      throw new Error('Cannot connect to agent without apikey');
    }

    this.url = `${this.connectionData.protocol}://${this.connectionData.host}:${this.connectionData.port}`;
    this.ws_url = this.url.replace('http://', 'ws://').replace('https://', 'wss://');
    this.cancel_token = axios.CancelToken.source();
    this.config = {
      timeout: app().config.get('openvpn.agent.timeout'),
      headers: {
        'X-API-Key': this.connectionData.apikey,
      },
      cancelToken: this.cancel_token.token,
    };

    if (this.connectionData.protocol === 'https') {
      this.config.httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });
    }
  }

  async installFirewallPolicy(
    scriptPath: string,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<string> {
    try {
      const pathUrl: string = this.url + '/api/v1/fwcloud_script/upload';

      const form = new FormData();
      form.append('dst_dir', './tmp');
      form.append('perms', 700);
      form.append('upload', fs.createReadStream(scriptPath));
      form.append('ws_id', await this.createWebSocket(eventEmitter));

      eventEmitter.emit(
        'message',
        new ProgressNoticePayload(`Uploading firewall policy (${this.connectionData.host})`),
      );

      const config: AxiosRequestConfig = Object.assign({}, this.config);

      // Disable timeout and manage it from the WebSocket events.
      config.timeout = 0;

      config.headers = Object.assign({}, config.headers, form.getHeaders());

      const response: AxiosResponse<string> = await axios.post(pathUrl, form, config);

      response.data
        .split('\n')
        .forEach((item) => eventEmitter.emit('message', new ProgressSSHCmdPayload(item)));

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
      const pathUrl: string = this.url + '/api/v1/openvpn/files/upload';
      const form = new FormData();
      form.append('dst_dir', dir);
      const applies2FAPermissions =
        dir.startsWith('/etc/openvpn/google-authenticator') ||
        (dir === '/etc/openvpn' &&
          configs.every((config) => config.name.endsWith('_2fa_users.txt')));
      form.append('perms', applies2FAPermissions ? 644 : 600);

      configs.forEach((config) => {
        eventEmitter.emit(
          'message',
          new ProgressInfoPayload(
            `Uploading OpenVPN configuration file '${dir}/${config.name}' to: (${this.connectionData.host})\n`,
          ),
        );
        form.append('data', config.content, config.name);
      });

      const requestConfig: AxiosRequestConfig = Object.assign({}, this.config);
      requestConfig.headers = Object.assign({}, requestConfig.headers, form.getHeaders());

      await axios.post(pathUrl, form, requestConfig);
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
      const pathUrl: string = this.url + '/api/v1/openvpn/files/upload';
      const form = new FormData();

      const requestConfig: AxiosRequestConfig = this.obtainRequestConfig(
        form,
        dir,
        configs,
        eventEmitter,
      );

      await axios.post(pathUrl, form, requestConfig);
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async uninstallOpenVPNConfigs(
    dir: string,
    files: string[],
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<void> {
    try {
      files.forEach((file) => {
        eventEmitter.emit(
          'message',
          new ProgressInfoPayload(
            `Removing OpenVPN configuration file '${dir}/${file}' from: (${this.connectionData.host})\n`,
          ),
        );
      });

      const pathUrl: string = this.url + '/api/v1/openvpn/files/remove';

      const config: AxiosRequestConfig = Object.assign({}, this.config);
      config.data = {
        dir: dir,
        files: files,
      };

      await axios.delete(pathUrl, config);
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
      eventEmitter.emit(
        'message',
        new ProgressInfoPayload(
          `Preparing OpenVPN client configuration directory '${dir}' on: (${this.connectionData.host})\n`,
        ),
      );

      const pathUrl: string = this.url + '/api/v1/openvpn/dirs/ensure';
      await axios.put(
        pathUrl,
        {
          dir,
          owner: 'root',
          group,
          mode: '750',
        },
        this.config,
      );
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async removeOpenVPNClientConfigDirIfEmpty(
    dir: string,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<void> {
    try {
      eventEmitter.emit(
        'message',
        new ProgressInfoPayload(
          `Removing OpenVPN client configuration directory '${dir}' if empty from: (${this.connectionData.host})\n`,
        ),
      );

      const pathUrl: string = this.url + '/api/v1/openvpn/dirs/remove-empty';
      const config: AxiosRequestConfig = Object.assign({}, this.config);
      config.data = { dir };

      await axios.delete(pathUrl, config);
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
      const pathUrl: string = this.url + '/api/v1/wireguard/files/upload';
      const form = new FormData();
      form.append('dst_dir', dir);
      form.append('perms', 600);

      configs.forEach((config) => {
        eventEmitter.emit(
          'message',
          new ProgressInfoPayload(
            `Uploading WireGuard configuration file '${dir}/${config.name}' to: (${this.connectionData.host})\n`,
          ),
        );
        form.append('data', config.content, config.name);
      });

      const requestConfig: AxiosRequestConfig = Object.assign({}, this.config);
      requestConfig.headers = Object.assign({}, requestConfig.headers, form.getHeaders());

      await axios.post(pathUrl, form, requestConfig);
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async uninstallWireGuardConfigs(
    dir: string,
    files: string[],
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<void> {
    try {
      files.forEach((file) => {
        eventEmitter.emit(
          'message',
          new ProgressInfoPayload(
            `Removing Wireguard configuration file '${dir}/${file}' from: (${this.connectionData.host})\n`,
          ),
        );
      });

      const pathUrl: string = this.url + '/api/v1/wireguard/files/remove';

      const config: AxiosRequestConfig = Object.assign({}, this.config);
      config.data = {
        dir: dir,
        files: files,
      };

      await axios.delete(pathUrl, config);
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
      const pathUrl: string = this.url + '/api/v1/ipsec/files/upload';
      const form = new FormData();
      form.append('dst_dir', dir);
      form.append('perms', 600);

      configs.forEach((config) => {
        eventEmitter.emit(
          'message',
          new ProgressInfoPayload(
            `Uploading IPSec configuration file '${dir}/${config.name}' to: (${this.connectionData.host})\n`,
          ),
        );
        form.append('data', config.content, config.name);
      });

      const requestConfig: AxiosRequestConfig = Object.assign({}, this.config);
      requestConfig.headers = Object.assign({}, requestConfig.headers, form.getHeaders());

      await axios.post(pathUrl, form, requestConfig);
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async uninstallIPSecConfigs(
    dir: string,
    files: string[],
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<void> {
    try {
      files.forEach((file) => {
        eventEmitter.emit(
          'message',
          new ProgressInfoPayload(
            `Removing IPSec configuration file '${dir}/${file}' from: (${this.connectionData.host})\n`,
          ),
        );
      });

      const pathUrl: string = this.url + '/api/v1/ipsec/files/remove';

      const config: AxiosRequestConfig = Object.assign({}, this.config);
      config.data = {
        dir: dir,
        files: files,
      };

      await axios.delete(pathUrl, config);
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async getFirewallInterfaces(): Promise<string> {
    try {
      const pathUrl: string = this.url + '/api/v1/interfaces/info';

      const response: AxiosResponse<string> = await axios.get(pathUrl, this.config);

      if (response.status === 200) {
        return response.data;
      }

      throw new Error('Unexpected getInterfaces response');
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async getFirewallIptablesSave(): Promise<string[]> {
    try {
      const pathUrl: string = this.url + '/api/v1/iptables-save/data';

      const response: AxiosResponse<string> = await axios.get(pathUrl, this.config);

      if (response.status === 200) {
        return response.data.split('\n');
      }

      throw new Error('Unexpected getInterfaces response');
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async readOpenVPNFile(dir: string, name: string): Promise<string> {
    try {
      const pathUrl: string = this.url + '/api/v1/openvpn/files/read';

      const requestConfig: AxiosRequestConfig = Object.assign({}, this.config);
      requestConfig.headers = Object.assign({}, requestConfig.headers, {
        'Content-Type': 'application/json',
      });

      const response: AxiosResponse<string> = await axios.put(
        pathUrl,
        {
          dir: dir,
          files: [name],
        },
        requestConfig,
      );

      if (response.status === 200) {
        return response.data;
      }

      throw new Error('Unexpected readOpenVPNFile response');
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async ccdHashList(dir: string, channel?: EventEmitter): Promise<CCDHash[]> {
    try {
      const pathUrl: string = this.url + '/api/v1/openvpn/files/sha256';

      const config: AxiosRequestConfig = Object.assign({}, this.config);
      config.headers['Content-Type'] = 'application/json';

      const response: AxiosResponse<string> = await axios.put(
        pathUrl,
        {
          dir: dir,
          files: [],
        },
        config,
      );

      if (response.status === 200) {
        return response.data
          .split('\n')
          .filter((item) => item !== '')
          .slice(1)
          .map((item) => ({
            filename: item.split(',')[0],
            hash: item.split(',')[1],
          }));
      }

      throw new Error('Unexpected ccdHashList response');
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async ping(): Promise<void> {
    try {
      const pathUrl: string = this.url + '/api/v1/ping';

      await axios.put(pathUrl, '', this.config);

      return;
    } catch (error) {
      return this.handleRequestException(error);
    }
  }

  async info(): Promise<FwcAgentInfo> {
    try {
      const pathUrl: string = this.url + '/api/v1/info';

      const response: AxiosResponse<FwcAgentInfo> = await axios.get(pathUrl, this.config);

      if (response.status === 200) {
        return response.data;
      }

      throw new Error('Unexpected FWCloud-Agent info response');
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async installPlugin(
    name: string,
    enabled: boolean,
    eventEmitter: EventEmitter = new EventEmitter(),
    options?: PluginInstallOptions,
  ): Promise<string> {
    try {
      const pathUrl: string = this.url + '/api/v1/plugin';

      const config: AxiosRequestConfig = Object.assign({}, this.config);
      config.headers['Content-Type'] = 'application/json';

      const params = {
        name: name,
        action: enabled ? 'enable' : 'disable',
        ws_id: await this.createPluginWebSocket(eventEmitter),
        server_cn: options?.serverCN ?? null,
        plugin_params: options?.pluginParams ?? null,
      };

      const requestConfig: AxiosRequestConfig = Object.assign({}, this.config);

      // Disable timeout and manage it from the WebSocket events.
      requestConfig.timeout = 0;

      await axios
        .post(pathUrl, params, requestConfig)
        .then((_) => {
          const endMessage: ProgressPayload = new ProgressPayload(
            'end',
            false,
            'Plugin action finished',
          );

          this.WSisClosed
            ? eventEmitter.emit('message', endMessage)
            : this.eventEmitterWSClose.on('close', () => eventEmitter.emit('message', endMessage));
        })
        .catch((err) => {
          this.handleRequestException(err, eventEmitter);
        });

      return '';
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  protected createWebSocket(eventEmitter: EventEmitter): Promise<string> {
    return new Promise((resolve, reject) => {
      const pathUrl: string = this.ws_url + '/api/v1/ws';
      const ws = new WebSocket(pathUrl, {
        headers: {
          ['X-API-Key']: this.connectionData.apikey,
        },
        rejectUnauthorized: false,
      });
      let waiting_for_websocket_id = true;

      const timer = setTimeout(() => {
        ws.close();
        this.cancel_token.cancel('FWCloud-Agent communication timeout');
      }, app().config.get('openvpn.agent.plugins_timeout'));

      ws.on('message', (data) => {
        timer.refresh();

        const message =
          typeof data === 'string'
            ? data
            : Buffer.isBuffer(data)
              ? data.toString('utf8')
              : Array.isArray(data)
                ? Buffer.concat(data).toString('utf8')
                : Buffer.from(data).toString('utf8');

        if (waiting_for_websocket_id) {
          waiting_for_websocket_id = false;
          resolve(message);
        } else {
          eventEmitter.emit('message', new ProgressPayload('ssh_cmd_output', false, message));
        }
      });

      ws.on('close', () => {
        this.eventEmitterWSClose.emit('close');
        this.WSisClosed = true;
        clearTimeout(timer);
        ws.close();
        resolve('');
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        console.log(`WebSocket error: ${err}`);
        ws.close();
        reject(err);
      });
    });
  }

  protected createPluginWebSocket(eventEmitter: EventEmitter): Promise<string> {
    return new Promise((resolve, reject) => {
      const pathUrl: string = this.ws_url + '/api/v1/ws';
      const ws = new WebSocket(pathUrl, {
        headers: {
          ['X-API-Key']: this.connectionData.apikey,
        },
        rejectUnauthorized: false,
      });
      let waiting_for_websocket_id = true;

      const timer = setTimeout(() => {
        ws.close();
        this.cancel_token.cancel('FWCloud-Agent communication timeout');
      }, app().config.get('openvpn.agent.plugins_timeout'));

      ws.on('message', (data) => {
        timer.refresh();

        const message =
          typeof data === 'string'
            ? data
            : Buffer.isBuffer(data)
              ? data.toString('utf8')
              : Array.isArray(data)
                ? Buffer.concat(data).toString('utf8')
                : Buffer.from(data).toString('utf8');

        if (waiting_for_websocket_id) {
          waiting_for_websocket_id = false;
          resolve(message);
        } else if (message !== 'ENABLED' && message !== 'DISABLED') {
          eventEmitter.emit('message', new ProgressPayload('ssh_cmd_output', false, message));
        }
      });

      ws.on('close', () => {
        this.eventEmitterWSClose.emit('close');
        this.WSisClosed = true;
        clearTimeout(timer);
        ws.close();
        resolve('');
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  protected createCrowdSecWebSocket(eventEmitter: EventEmitter): Promise<string> {
    return new Promise((resolve, reject) => {
      const pathUrl: string = this.ws_url + '/api/v1/ws';
      const ws = new WebSocket(pathUrl, {
        headers: {
          ['X-API-Key']: this.connectionData.apikey,
        },
        rejectUnauthorized: false,
      });
      let waitingForWebsocketId = true;
      let websocketClosed = false;

      const timer = setTimeout(() => {
        if (!websocketClosed) {
          ws.close();
        }

        if (waitingForWebsocketId) {
          reject(new HttpException('CrowdSec progress connection timed out', 504));
        } else {
          eventEmitter.emit(
            'message',
            new ProgressErrorPayload('ERROR: CrowdSec progress connection timed out\n'),
          );
        }
      }, app().config.get('openvpn.agent.plugins_timeout'));

      ws.on('message', (data) => {
        timer.refresh();

        const message =
          typeof data === 'string'
            ? data
            : Buffer.isBuffer(data)
              ? data.toString('utf8')
              : Array.isArray(data)
                ? Buffer.concat(data).toString('utf8')
                : Buffer.from(data).toString('utf8');

        if (waitingForWebsocketId) {
          waitingForWebsocketId = false;
          resolve(message);
        } else {
          eventEmitter.emit('message', crowdSecProgressPayload(message));
        }
      });

      ws.on('close', () => {
        websocketClosed = true;
        clearTimeout(timer);

        if (waitingForWebsocketId) {
          reject(new HttpException('CrowdSec progress connection closed unexpectedly', 502));
        }
      });

      ws.on('error', () => {
        clearTimeout(timer);

        if (waitingForWebsocketId) {
          reject(new HttpException('CrowdSec progress connection failed', 502));
        } else {
          eventEmitter.emit(
            'message',
            new ProgressErrorPayload('ERROR: CrowdSec progress connection failed\n'),
          );
        }
      });
    });
  }

  async getRealtimeStatus(statusFilepath: string): Promise<string> {
    try {
      const urlPath: string = this.url + '/api/v1/openvpn/get/status/rt';
      const dir: string = path.dirname(statusFilepath);
      const filename: string = path.basename(statusFilepath);

      const config: AxiosRequestConfig = Object.assign({}, this.config);
      config.headers['Content-Type'] = 'application/json';

      const response: AxiosResponse<string> = await axios.put(
        urlPath,
        {
          dir: dir,
          files: [filename],
        },
        config,
      );

      if (response.status === 200) {
        return response.data;
      }

      throw new Error('Unexpected getRealtimeStatus response');
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async getOpenVPNHistoryFile(filepath: string): Promise<OpenVPNHistoryRecord[]> {
    try {
      const filename: string = path.basename(filepath);
      const dir: string = path.dirname(filepath);
      const pathUrl: string = this.url + '/api/v1/openvpn/get/status';

      const config: AxiosRequestConfig = Object.assign({}, this.config);
      config.headers['Content-Type'] = 'application/json';

      const response: AxiosResponse<string> = await axios.put(
        pathUrl,
        {
          dir,
          files: [filename],
        },
        config,
      );

      if (response.status === 200) {
        return response.data
          .split('\n')
          .filter((item) => item !== '')
          .slice(1)
          .map((item) => ({
            timestamp: parseInt(item.split(',')[0]),
            name: item.split(',')[1],
            address: item.split(',')[2],
            bytesReceived: parseInt(item.split(',')[3]),
            bytesSent: parseInt(item.split(',')[4]),
            connectedAtTimestampInSeconds: parseInt(item.split(',')[5]),
          }));
      }

      throw new Error('Unexpected getOpenVPNHistoryFile response');
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async syncOpenVPNStatusSampling(configData: OpenVPNStatusSamplingAgentConfig): Promise<void> {
    try {
      const pathUrl: string = this.url + '/api/v1/openvpn/status/sampling';

      const config: AxiosRequestConfig = Object.assign({}, this.config);
      config.headers['Content-Type'] = 'application/json';

      const response: AxiosResponse<{ accepted: boolean }> = await axios.put(
        pathUrl,
        {
          status_files: configData.statusFiles.map((statusFile) => ({
            path: statusFile.path,
            sampling_interval: statusFile.samplingInterval,
            request_max_lines: statusFile.requestMaxLines,
            cache_max_size: statusFile.cacheMaxSize,
          })),
        },
        config,
      );

      if (response.status === 200 && response.data.accepted) {
        return;
      }

      throw new Error('Unexpected syncOpenVPNStatusSampling response');
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async getOpenVPNStatusSamplingState(): Promise<OpenVPNStatusSamplingAgentState> {
    try {
      const pathUrl: string = this.url + '/api/v1/openvpn/status/sampling';
      const response: AxiosResponse<{
        accepted: boolean;
        status_files: {
          path: string;
          sampling_interval: number;
          request_max_lines: number;
          cache_max_size: number;
        }[];
      }> = await axios.get(pathUrl, this.config);

      if (response.status === 200 && response.data.accepted) {
        return {
          accepted: response.data.accepted,
          statusFiles: response.data.status_files.map((statusFile) => ({
            path: statusFile.path,
            samplingInterval: statusFile.sampling_interval,
            requestMaxLines: statusFile.request_max_lines,
            cacheMaxSize: statusFile.cache_max_size,
          })),
        };
      }

      throw new Error('Unexpected getOpenVPNStatusSamplingState response');
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async systemctlManagement(command: string, service: string): Promise<string> {
    try {
      const pathUrl: string = this.url + '/api/v1/systemctl';

      const systemCtlInfo: SystemCtlInfo = {
        command: command,
        service: service,
      };
      const response: AxiosResponse<string> = await axios.post(pathUrl, systemCtlInfo, this.config);
      if (response.status === 200) {
        return response.data;
      }
      throw new Error('Unexpected FWCloud-Agent info response');
    } catch (error) {
      this.handleRequestException(error);
    }
  }

  async getCrowdSecStatus(): Promise<Record<string, unknown>> {
    try {
      const pathUrl: string = this.url + '/api/v1/crowdsec/status';
      const response: AxiosResponse<Record<string, unknown>> = await axios.get(
        pathUrl,
        this.config,
      );

      if (response.status === 200 && response.data && !Array.isArray(response.data)) {
        return response.data;
      }

      throw new Error('Unexpected CrowdSec status response');
    } catch (error) {
      this.handleCrowdSecRequestException(error);
    }
  }

  async getCrowdSecCollections(installed?: boolean): Promise<Record<string, unknown>> {
    try {
      const params = installed === undefined ? undefined : { installed };
      return await this.runCrowdSecGetOperation('/api/v1/crowdsec/collections', params);
    } catch (error) {
      this.handleCrowdSecRequestException(error);
    }
  }

  async installCrowdSecCollection(name: string): Promise<Record<string, unknown>> {
    try {
      return await this.runCrowdSecOperation(this.url + '/api/v1/crowdsec/collections/install', {
        name,
      });
    } catch (error) {
      this.handleCrowdSecRequestException(error);
    }
  }

  async removeCrowdSecCollection(name: string): Promise<Record<string, unknown>> {
    try {
      return await this.runCrowdSecOperation(this.url + '/api/v1/crowdsec/collections/remove', {
        name,
      });
    } catch (error) {
      this.handleCrowdSecRequestException(error);
    }
  }

  async updateCrowdSecCollections(): Promise<Record<string, unknown>> {
    try {
      return await this.runCrowdSecOperation(this.url + '/api/v1/crowdsec/collections/update', {});
    } catch (error) {
      this.handleCrowdSecRequestException(error);
    }
  }

  async getCrowdSecConsoleStatus(): Promise<Record<string, unknown>> {
    try {
      return await this.runCrowdSecGetOperation('/api/v1/crowdsec/console/status');
    } catch (error) {
      this.handleCrowdSecRequestException(error);
    }
  }

  async enrollCrowdSecConsole(
    enrollment: CrowdSecConsoleEnrollment,
  ): Promise<Record<string, unknown>> {
    try {
      return await this.runCrowdSecOperation(this.url + '/api/v1/crowdsec/console/enroll', {
        enrollment_key: enrollment.enrollmentKey,
        name: enrollment.name,
        tags: enrollment.tags,
      });
    } catch (error) {
      this.handleCrowdSecRequestException(error);
    }
  }

  async getCrowdSecDecisions(query?: CrowdSecDecisionsQuery): Promise<Record<string, unknown>> {
    try {
      return await this.runCrowdSecGetOperation('/api/v1/crowdsec/decisions', {
        limit: query?.limit,
        scope: query?.scope,
        value: query?.value,
        decision_type: query?.decisionType,
        origin: query?.origin,
        scenario: query?.scenario,
      });
    } catch (error) {
      this.handleCrowdSecRequestException(error);
    }
  }

  async deleteCrowdSecDecision(id: string): Promise<Record<string, unknown>> {
    try {
      return await this.runCrowdSecDeleteOperation(
        `/api/v1/crowdsec/decisions/${encodeURIComponent(id)}`,
      );
    } catch (error) {
      this.handleCrowdSecRequestException(error);
    }
  }

  async flushCrowdSecDecisions(confirm: boolean): Promise<Record<string, unknown>> {
    try {
      return await this.runCrowdSecOperation(this.url + '/api/v1/crowdsec/decisions/flush', {
        confirm,
      });
    } catch (error) {
      this.handleCrowdSecRequestException(error);
    }
  }

  async getCrowdSecAlerts(query?: CrowdSecAlertsQuery): Promise<Record<string, unknown>> {
    try {
      return await this.runCrowdSecGetOperation('/api/v1/crowdsec/alerts', {
        limit: query?.limit,
        since: query?.since,
        until: query?.until,
        scenario: query?.scenario,
        type: query?.decisionType,
        scope: query?.scope,
        value: query?.value,
        ip: query?.ip,
        range: query?.range,
      });
    } catch (error) {
      this.handleCrowdSecRequestException(error);
    }
  }

  async getCrowdSecBouncers(): Promise<Record<string, unknown>> {
    try {
      return await this.runCrowdSecGetOperation('/api/v1/crowdsec/bouncers');
    } catch (error) {
      this.handleCrowdSecRequestException(error);
    }
  }

  async registerCrowdSecBouncer(name: string): Promise<Record<string, unknown>> {
    try {
      return await this.runCrowdSecOperation(this.url + '/api/v1/crowdsec/bouncers/register', {
        name,
      });
    } catch (error) {
      this.handleCrowdSecRequestException(error);
    }
  }

  async removeCrowdSecBouncer(name: string): Promise<Record<string, unknown>> {
    try {
      return await this.runCrowdSecDeleteOperation(
        `/api/v1/crowdsec/bouncers/${encodeURIComponent(name)}`,
      );
    } catch (error) {
      this.handleCrowdSecRequestException(error);
    }
  }

  async installCrowdSec(eventEmitter?: EventEmitter): Promise<Record<string, unknown>> {
    try {
      const pathUrl: string = this.url + '/api/v1/crowdsec/install';
      const response = await this.runCrowdSecOperation(pathUrl, {}, eventEmitter);

      return response;
    } catch (error) {
      this.handleCrowdSecRequestException(error, eventEmitter);
    }
  }

  async installCrowdSecBouncer(eventEmitter?: EventEmitter): Promise<Record<string, unknown>> {
    try {
      const pathUrl: string = this.url + '/api/v1/crowdsec/bouncer/install';
      const response = await this.runCrowdSecOperation(pathUrl, {}, eventEmitter);

      return response;
    } catch (error) {
      this.handleCrowdSecRequestException(error, eventEmitter);
    }
  }

  async uninstallCrowdSec(
    confirm: boolean,
    eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>> {
    try {
      const pathUrl: string = this.url + '/api/v1/crowdsec/uninstall';
      const response = await this.runCrowdSecOperation(pathUrl, { confirm }, eventEmitter);

      return response;
    } catch (error) {
      this.handleCrowdSecRequestException(error, eventEmitter);
    }
  }

  async uninstallCrowdSecBouncer(
    confirm: boolean,
    eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>> {
    try {
      const pathUrl: string = this.url + '/api/v1/crowdsec/bouncer/uninstall';
      return await this.runCrowdSecOperation(pathUrl, { confirm }, eventEmitter);
    } catch (error) {
      this.handleCrowdSecRequestException(error, eventEmitter);
    }
  }

  private async runCrowdSecGetOperation(
    path: string,
    params?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const requestConfig: AxiosRequestConfig = Object.assign({}, this.config, { params });
    const response: AxiosResponse<Record<string, unknown>> = await axios.get(
      this.url + path,
      requestConfig,
    );

    return this.crowdSecOperationResponse(response);
  }

  private async runCrowdSecDeleteOperation(path: string): Promise<Record<string, unknown>> {
    const response: AxiosResponse<Record<string, unknown>> = await axios.delete(
      this.url + path,
      this.config,
    );

    return this.crowdSecOperationResponse(response);
  }

  private async runCrowdSecOperation(
    pathUrl: string,
    params: Record<string, unknown>,
    eventEmitter?: EventEmitter,
  ): Promise<Record<string, unknown>> {
    const requestParams = { ...params };
    const requestConfig: AxiosRequestConfig = Object.assign({}, this.config);

    if (eventEmitter) {
      requestParams.ws_id = await this.createCrowdSecWebSocket(eventEmitter);
      requestConfig.timeout = 0;
    }

    const response: AxiosResponse<Record<string, unknown>> = await axios.post(
      pathUrl,
      requestParams,
      requestConfig,
    );

    return this.crowdSecOperationResponse(response);
  }

  private crowdSecOperationResponse(
    response: AxiosResponse<Record<string, unknown>>,
  ): Record<string, unknown> {
    if (response.status === 200 && response.data && !Array.isArray(response.data)) {
      return response.data;
    }

    throw new Error('Unexpected CrowdSec operation response');
  }

  private handleCrowdSecRequestException(error: unknown, eventEmitter?: EventEmitter): never {
    let exception: HttpException;

    if (error instanceof HttpException) {
      exception = error;
    } else if (axios.isAxiosError(error)) {
      const code = error.response?.data?.code;
      if (code) {
        exception = crowdSecAgentErrorToHttpException(code);
      } else if (error.code === 'ECONNABORTED') {
        exception = new HttpException('CrowdSec agent request timed out', 504);
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
        exception = new HttpException('CrowdSec agent is unavailable', 503);
      } else {
        exception = crowdSecAgentErrorToHttpException(null);
      }
    } else {
      exception = crowdSecAgentErrorToHttpException(null);
    }

    eventEmitter?.emit('message', new ProgressErrorPayload(`ERROR: ${exception.message}\n`));

    throw exception;
  }

  protected handleRequestException(error: Error, eventEmitter?: EventEmitter) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' && new RegExp(/timeout/).test(error.message)) {
        eventEmitter?.emit('message', new ProgressErrorPayload(`ERROR: Timeout\n`));
        throw new HttpException(`ECONNABORTED: Timeout`, 400);
      }

      if (error.code === 'ERR_BAD_REQUEST') {
        eventEmitter?.emit(
          'message',
          new ProgressErrorPayload(`ERROR: Bad Request: ${error.response.data.message}\n`),
        );
        throw new HttpException(`ERR_BAD_REQUEST: ${error.response.data.message}\n`, 400);
      }

      if (error.code === 'ERR_BAD_REQUEST') {
        eventEmitter?.emit(
          'message',
          new ProgressErrorPayload(`ERROR: Bad Request: ${error.response.data.message}\n`),
        );
        throw new HttpException(`ERR_BAD_REQUEST: ${error.response.data.message}\n`, 400);
      }

      if (error.response?.data?.message) {
        eventEmitter?.emit(
          'message',
          new ProgressErrorPayload(`ERROR: ${error.response.data.message}\n`),
        );
        let message = error.response.data.message;

        if (error.response.data.message === 'API key not found') {
          message = `ApiKeyNotFound: ${error.response.data.message}`;
        }

        if (error.response.data.message === 'Invalid API key') {
          message = `ApiKeyNotValid: ${error.response.data.message}`;
        }

        if (
          error.response.data.message === 'Authorization error, access from your IP is not allowed'
        ) {
          message = `NotAllowedIP: ${error.response.data.message}`;
        }

        if (error.response.data.message === 'Directory not found') {
          message = `DirNotFound: ${error.response.data.message}`;
        }

        throw new HttpException(message, error.response.status);
      }
    }

    return super.handleRequestException(error, eventEmitter);
  }

  async installHAPRoxyConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<string> {
    try {
      const pathUrl: string = this.url + '/api/v1/daemon/config/upload';
      const form: FormData = new FormData();

      const requestConfig: AxiosRequestConfig = this.obtainRequestConfig(
        form,
        dir,
        configs,
        eventEmitter,
      );

      requestConfig.timeout = 0;

      requestConfig.headers = Object.assign({}, requestConfig.headers, form.getHeaders());

      const response: AxiosResponse<string> = await axios.post(pathUrl, form, requestConfig);

      response.data
        .split('\n')
        .forEach((item) => eventEmitter.emit('message', new ProgressSSHCmdPayload(item)));

      return 'DONE';
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async installDHCPConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<string> {
    try {
      const pathUrl: string = this.url + '/api/v1/daemon/config/upload';
      const form: FormData = new FormData();

      const requestConfig: AxiosRequestConfig = this.obtainRequestConfig(
        form,
        dir,
        configs,
        eventEmitter,
      );

      requestConfig.timeout = 0;

      requestConfig.headers = Object.assign({}, requestConfig.headers, form.getHeaders());

      const response: AxiosResponse<string> = await axios.post(pathUrl, form, requestConfig);

      response.data
        .split('\n')
        .forEach((item) => eventEmitter.emit('message', new ProgressSSHCmdPayload(item)));

      return 'DONE';
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  async installKeepalivedConfigs(
    dir: string,
    configs: { name: string; content: string }[],
    eventEmitter?: EventEmitter,
  ): Promise<string> {
    try {
      const pathUrl: string = this.url + '/api/v1/daemon/config/upload';

      const form: FormData = new FormData();

      const requestConfig: AxiosRequestConfig = this.obtainRequestConfig(
        form,
        dir,
        configs,
        eventEmitter,
      );

      requestConfig.timeout = 0;

      requestConfig.headers = Object.assign({}, requestConfig.headers, form.getHeaders());

      const response: AxiosResponse<string> = await axios.post(pathUrl, form, requestConfig);

      response.data
        .split('\n')
        .forEach((item) => eventEmitter.emit('message', new ProgressSSHCmdPayload(item)));

      return 'DONE';
    } catch (error) {
      this.handleRequestException(error, eventEmitter);
    }
  }

  private obtainRequestConfig(
    form: FormData,
    dir: string,
    configs: {
      name: string;
      content: string;
    }[],
    eventEmitter: EventEmitter,
  ) {
    form.append('dst_dir', dir);
    form.append('perms', 644);

    configs.forEach((config) => {
      form.append('data', config.content, config.name);
      eventEmitter.emit(
        'message',
        new ProgressInfoPayload(
          `Uploading configuration file '${dir}/${config.name}' to: (${this.connectionData.host})\n`,
        ),
      );
    });

    const requestConfig: AxiosRequestConfig = Object.assign({}, this.config);
    requestConfig.headers = Object.assign({}, requestConfig.headers, form.getHeaders());
    return requestConfig;
  }
}
