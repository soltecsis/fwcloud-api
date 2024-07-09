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
  FwcAgentInfo,
  OpenVPNHistoryRecord,
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

      config.headers = Object.assign({}, form.getHeaders(), config.headers);

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
      form.append('perms', 600);

      configs.forEach((config) => {
        eventEmitter.emit(
          'message',
          new ProgressNoticePayload(
            `Uploading OpenVPN configuration file '${dir}/${config.name}' to: (${this.connectionData.host})\n`,
          ),
        );
        form.append('data', config.content, config.name);
      });

      const requestConfig: AxiosRequestConfig = Object.assign({}, this.config);
      requestConfig.headers = Object.assign({}, form.getHeaders(), requestConfig.headers);

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
  ): Promise<string> {
    try {
      const pathUrl: string = this.url + '/api/v1/plugin';

      const config: AxiosRequestConfig = Object.assign({}, this.config);
      config.headers['Content-Type'] = 'application/json';

      const params = {
        name: name,
        action: enabled ? 'enable' : 'disable',
        ws_id: await this.createWebSocket(eventEmitter),
      };

      const requestConfig: AxiosRequestConfig = Object.assign({}, this.config);

      // Disable timeout and manage it from the WebSocket events.
      requestConfig.timeout = 0;

      axios
        .post(pathUrl, params, requestConfig)
        .then(() => {
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
          eventEmitter.emit(
            'message',
            new ProgressPayload('error', false, 'Plugin action failed: ' + err.message),
          );
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
        // TIMEOUT ERROR
        ws.close();
        this.cancel_token.cancel('FWCloud-Agent communication timeout');
        //console.log('FWCloud-Agent communication timeout');
      }, app().config.get('openvpn.agent.plugins_timeout'));

      ws.on('message', (data) => {
        // Restart timer on each WebSocket message.
        // If we receive a message it means that the process is active, then
        // reset the timer. This way, if the process takes a lot of time, we
        // will allow it to complete.
        timer.refresh();

        if (waiting_for_websocket_id) {
          //console.log('WebSocket id: %s', data);
          waiting_for_websocket_id = false;
          resolve(`${data}`);
        } else {
          //console.log('Data: %s', data);
          eventEmitter.emit('message', new ProgressPayload('ssh_cmd_output', false, `${data}`));
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

  protected handleRequestException(error: Error, eventEmitter?: EventEmitter) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' && new RegExp(/timeout/).test(error.message)) {
        eventEmitter?.emit('message', new ProgressErrorPayload(`ERROR: Timeout\n`));
        throw new HttpException(`ECONNABORTED: Timeout`, 400);
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

      requestConfig.headers = Object.assign({}, form.getHeaders(), requestConfig.headers);

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

      requestConfig.headers = Object.assign({}, form.getHeaders(), requestConfig.headers);

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

      requestConfig.headers = Object.assign({}, form.getHeaders(), requestConfig.headers);

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
    requestConfig.headers = Object.assign({}, form.getHeaders(), requestConfig.headers);
    return requestConfig;
  }
}
