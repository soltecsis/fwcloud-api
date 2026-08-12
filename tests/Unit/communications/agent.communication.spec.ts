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

import {
  AgentCommunication,
  crowdSecAgentErrorToHttpException,
} from '../../../src/communications/agent.communication';
import axios from 'axios';
import sinon from 'sinon';
import { CCDHash } from '../../../src/communications/communication';
import { expect } from '../../mocha/global-setup';
import * as https from 'https';

describe(AgentCommunication.name, () => {
  let agent: AgentCommunication;

  beforeEach(async () => {
    agent = new AgentCommunication({
      protocol: 'http',
      host: 'host',
      port: 0,
      apikey: '',
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should set custom agent when https is enabled', () => {
    agent = new AgentCommunication({
      protocol: 'https',
      host: 'host',
      port: 0,
      apikey: '',
    });

    expect((agent['config'].httpsAgent as https.Agent).options.rejectUnauthorized).to.be.false;
  });

  describe('ccdHashList', () => {
    let stub: sinon.SinonStub;

    beforeEach(() => {
      stub = sinon.stub(axios, 'put');
      stub.returns(
        Promise.resolve({
          status: 200,
          data: 'file,sha256\ncrt1,hash1\ncrt2,hash2',
        }),
      );
    });

    it('should parse CSV content', async () => {
      const result: CCDHash[] = await agent.ccdHashList('');

      expect(result).to.deep.eq([
        { filename: 'crt1', hash: 'hash1' },
        { filename: 'crt2', hash: 'hash2' },
      ]);
    });
  });

  describe('OpenVPN client config directory', () => {
    it('should request directory creation with ownership and permissions', async () => {
      const stub = sinon.stub(axios, 'put').resolves({ status: 200 });

      await agent.ensureOpenVPNClientConfigDir('/etc/openvpn/ccd', 'nogroup');

      expect(stub.calledOnce).to.be.true;
      expect(stub.firstCall.args[0]).to.equal('http://host:0/api/v1/openvpn/dirs/ensure');
      expect(stub.firstCall.args[1]).to.deep.equal({
        dir: '/etc/openvpn/ccd',
        owner: 'root',
        group: 'nogroup',
        mode: '750',
      });
    });

    it('should request empty directory removal', async () => {
      const stub = sinon.stub(axios, 'delete').resolves({ status: 200 });

      await agent.removeOpenVPNClientConfigDirIfEmpty('/etc/openvpn/ccd');

      expect(stub.calledOnce).to.be.true;
      expect(stub.firstCall.args[0]).to.equal('http://host:0/api/v1/openvpn/dirs/remove-empty');
      expect(stub.firstCall.args[1].data).to.deep.equal({ dir: '/etc/openvpn/ccd' });
    });
  });

  describe('installPlugin', () => {
    it('should send generic plugin parameters to the agent', async () => {
      const postStub = sinon.stub(axios, 'post').resolves({ status: 200 });
      sinon.stub(agent as any, 'createPluginWebSocket').resolves('ws-id');

      await agent.installPlugin('suricata', true, undefined, {
        pluginParams: ['ens18', 'OINKCODE'],
      });

      expect(postStub.calledOnce).to.be.true;
      expect(postStub.firstCall.args[0]).to.equal('http://host:0/api/v1/plugin');
      expect(postStub.firstCall.args[1]).to.deep.equal({
        name: 'suricata',
        action: 'enable',
        ws_id: 'ws-id',
        server_cn: null,
        plugin_params: ['ens18', 'OINKCODE'],
      });
    });

    it('should keep plugin parameters nullable when they are not provided', async () => {
      const postStub = sinon.stub(axios, 'post').resolves({ status: 200 });
      sinon.stub(agent as any, 'createPluginWebSocket').resolves('ws-id');

      await agent.installPlugin('geoip', true);

      expect(postStub.calledOnce).to.be.true;
      expect(postStub.firstCall.args[1]).to.deep.equal({
        name: 'geoip',
        action: 'enable',
        ws_id: 'ws-id',
        server_cn: null,
        plugin_params: null,
      });
    });
  });

  describe('OpenVPN status sampling', () => {
    it('should send sampling configuration to the agent', async () => {
      const stub = sinon.stub(axios, 'put').resolves({ status: 200, data: { accepted: true } });

      await agent.syncOpenVPNStatusSampling({
        statusFiles: [
          {
            path: '/run/openvpn/server.status',
            samplingInterval: 30,
            requestMaxLines: 1000,
            cacheMaxSize: 10485760,
          },
        ],
      });

      expect(stub.calledOnce).to.be.true;
      expect(stub.firstCall.args[0]).to.equal('http://host:0/api/v1/openvpn/status/sampling');
      expect(stub.firstCall.args[1]).to.deep.equal({
        status_files: [
          {
            path: '/run/openvpn/server.status',
            sampling_interval: 30,
            request_max_lines: 1000,
            cache_max_size: 10485760,
          },
        ],
      });
    });

    it('should read sampling state from the agent', async () => {
      const stub = sinon.stub(axios, 'get').resolves({
        status: 200,
        data: {
          accepted: true,
          status_files: [
            {
              path: '/run/openvpn/server.status',
              sampling_interval: 30,
              request_max_lines: 1000,
              cache_max_size: 10485760,
            },
          ],
        },
      });

      const state = await agent.getOpenVPNStatusSamplingState();

      expect(stub.calledOnce).to.be.true;
      expect(stub.firstCall.args[0]).to.equal('http://host:0/api/v1/openvpn/status/sampling');
      expect(state).to.deep.eq({
        accepted: true,
        statusFiles: [
          {
            path: '/run/openvpn/server.status',
            samplingInterval: 30,
            requestMaxLines: 1000,
            cacheMaxSize: 10485760,
          },
        ],
      });
    });
  });

  describe('CrowdSec error mapping', () => {
    it('should map known agent errors to safe HTTP responses', () => {
      const error = crowdSecAgentErrorToHttpException('CROWDSEC_LAPI_UNAVAILABLE');

      expect(error.status).to.equal(503);
      expect(error.message).to.equal('CrowdSec Local API is unavailable');
    });

    it('should not expose unknown agent error messages', () => {
      const error = crowdSecAgentErrorToHttpException('CROWDSEC_UNEXPECTED_ERROR');

      expect(error.status).to.equal(502);
      expect(error.message).to.equal('CrowdSec agent request failed');
    });

    it('should map collection and Console agent errors to safe HTTP responses', () => {
      const collectionError = crowdSecAgentErrorToHttpException('CROWDSEC_COLLECTION_TAINTED');
      const consoleError = crowdSecAgentErrorToHttpException('CROWDSEC_CONSOLE_INVALID_ENROLLMENT');

      expect(collectionError.status).to.equal(409);
      expect(collectionError.message).to.equal('CrowdSec collection is tainted');
      expect(consoleError.status).to.equal(422);
      expect(consoleError.message).to.equal('CrowdSec Console enrollment request is invalid');
    });
  });

  describe('CrowdSec collections', () => {
    it('should request installed collections from the agent', async () => {
      const stub = sinon.stub(axios, 'get').resolves({
        status: 200,
        data: { collections: [] },
      });

      const response = await agent.getCrowdSecCollections(true);

      expect(stub.calledOnce).to.be.true;
      expect(stub.firstCall.args[0]).to.equal('http://host:0/api/v1/crowdsec/collections');
      expect(stub.firstCall.args[1].params).to.deep.equal({ installed: true });
      expect(response).to.deep.equal({ collections: [] });
    });

    it('should send one collection name for installation', async () => {
      const stub = sinon.stub(axios, 'post').resolves({
        status: 200,
        data: {
          operation: 'install',
          collection: 'crowdsecurity/nginx',
          processed_collections: ['crowdsecurity/nginx'],
          skipped_collections: [],
          message: 'Collection installed',
        },
      });

      await agent.installCrowdSecCollection('crowdsecurity/nginx');

      expect(stub.calledOnce).to.be.true;
      expect(stub.firstCall.args[0]).to.equal('http://host:0/api/v1/crowdsec/collections/install');
      expect(stub.firstCall.args[1]).to.deep.equal({ name: 'crowdsecurity/nginx' });
    });

    it('should send one collection name for removal', async () => {
      const stub = sinon.stub(axios, 'post').resolves({
        status: 200,
        data: {
          operation: 'remove',
          collection: 'crowdsecurity/nginx',
          processed_collections: ['crowdsecurity/nginx'],
          skipped_collections: [],
          message: 'Collection removed',
        },
      });

      await agent.removeCrowdSecCollection('crowdsecurity/nginx');

      expect(stub.calledOnce).to.be.true;
      expect(stub.firstCall.args[0]).to.equal('http://host:0/api/v1/crowdsec/collections/remove');
      expect(stub.firstCall.args[1]).to.deep.equal({ name: 'crowdsecurity/nginx' });
    });

    it('should send an empty update request to the agent', async () => {
      const stub = sinon.stub(axios, 'post').resolves({
        status: 200,
        data: {
          operation: 'update',
          processed_collections: [],
          skipped_collections: [],
          message: 'Collections updated',
        },
      });

      await agent.updateCrowdSecCollections();

      expect(stub.calledOnce).to.be.true;
      expect(stub.firstCall.args[0]).to.equal('http://host:0/api/v1/crowdsec/collections/update');
      expect(stub.firstCall.args[1]).to.deep.equal({});
    });
  });

  describe('CrowdSec Console', () => {
    it('should request Console status from the agent', async () => {
      const stub = sinon.stub(axios, 'get').resolves({
        status: 200,
        data: { state: 'connected', message: 'Connected' },
      });

      const response = await agent.getCrowdSecConsoleStatus();

      expect(stub.calledOnce).to.be.true;
      expect(stub.firstCall.args[0]).to.equal('http://host:0/api/v1/crowdsec/console/status');
      expect(response).to.deep.equal({ state: 'connected', message: 'Connected' });
    });

    it('should forward Console enrollment data using the agent contract', async () => {
      const stub = sinon.stub(axios, 'post').resolves({
        status: 200,
        data: { status: { state: 'pending_approval', message: 'Approve in Console' } },
      });

      await agent.enrollCrowdSecConsole({
        enrollmentKey: 'secret-enrollment-key',
        name: 'fwcloud',
        tags: ['fwcloud'],
      });

      expect(stub.calledOnce).to.be.true;
      expect(stub.firstCall.args[0]).to.equal('http://host:0/api/v1/crowdsec/console/enroll');
      expect(stub.firstCall.args[1]).to.deep.equal({
        enrollment_key: 'secret-enrollment-key',
        name: 'fwcloud',
        tags: ['fwcloud'],
      });
    });
  });
});
