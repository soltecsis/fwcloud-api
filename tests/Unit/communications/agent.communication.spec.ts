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
  sanitizeCrowdSecProgressMessage,
} from '../../../src/communications/agent.communication';
import axios from 'axios';
import { EventEmitter } from 'events';
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
  });

  describe('CrowdSec progress communication', () => {
    let postStub: sinon.SinonStub;

    beforeEach(() => {
      postStub = sinon.stub(axios, 'post').resolves({ status: 200, data: { steps: [] } });
      sinon.stub(agent as any, 'createCrowdSecWebSocket').resolves('crowdsec-ws-id');
    });

    it('should request CrowdSec installation with a dedicated progress websocket', async () => {
      await agent.installCrowdSec(new EventEmitter());

      const post = postStub.firstCall;
      expect(post.args[0]).to.equal('http://host:0/api/v1/crowdsec/install');
      expect(post.args[1]).to.deep.equal({ ws_id: 'crowdsec-ws-id' });
      expect(post.args[2].timeout).to.equal(0);
    });

    it('should request Firewall Bouncer installation with a dedicated progress websocket', async () => {
      await agent.installCrowdSecBouncer(new EventEmitter());

      const post = postStub.firstCall;
      expect(post.args[0]).to.equal('http://host:0/api/v1/crowdsec/bouncer/install');
      expect(post.args[1]).to.deep.equal({ ws_id: 'crowdsec-ws-id' });
    });

    it('should preserve uninstall confirmation when requesting progress', async () => {
      await agent.uninstallCrowdSec(true, new EventEmitter());

      const post = postStub.firstCall;
      expect(post.args[0]).to.equal('http://host:0/api/v1/crowdsec/uninstall');
      expect(post.args[1]).to.deep.equal({ confirm: true, ws_id: 'crowdsec-ws-id' });
    });

    it('should request Firewall Bouncer removal with dedicated progress', async () => {
      await agent.uninstallCrowdSecBouncer(true, new EventEmitter());

      const post = postStub.firstCall;
      expect(post.args[0]).to.equal('http://host:0/api/v1/crowdsec/bouncer/uninstall');
      expect(post.args[1]).to.deep.equal({ confirm: true, ws_id: 'crowdsec-ws-id' });
    });

    it('should redact API and enrollment keys from CrowdSec progress output', () => {
      const message = 'api_key: secret-key\nenrollment_key="enrollment-secret"';

      expect(sanitizeCrowdSecProgressMessage(message)).to.equal(
        'api_key: [REDACTED]\nenrollment_key=[REDACTED]',
      );
    });
  });

  describe('CrowdSec operations', () => {
    it('should forward collection list filters and mutations to the agent', async () => {
      const getStub = sinon.stub(axios, 'get').resolves({ status: 200, data: { collections: [] } });
      const postStub = sinon.stub(axios, 'post').resolves({ status: 200, data: {} });

      await agent.getCrowdSecCollections(true);
      await agent.installCrowdSecCollection('crowdsecurity/sshd');
      await agent.removeCrowdSecCollection('crowdsecurity/sshd');
      await agent.updateCrowdSecCollections();

      expect(getStub.firstCall.args[0]).to.equal('http://host:0/api/v1/crowdsec/collections');
      expect(getStub.firstCall.args[1].params).to.deep.equal({ installed: true });
      expect(postStub.firstCall.args).to.include(
        'http://host:0/api/v1/crowdsec/collections/install',
      );
      expect(postStub.firstCall.args[1]).to.deep.equal({ name: 'crowdsecurity/sshd' });
      expect(postStub.secondCall.args).to.include(
        'http://host:0/api/v1/crowdsec/collections/remove',
      );
      expect(postStub.thirdCall.args).to.include(
        'http://host:0/api/v1/crowdsec/collections/update',
      );
    });

    it('should map Console enrollment data without exposing it in request paths', async () => {
      const postStub = sinon.stub(axios, 'post').resolves({ status: 200, data: {} });

      await agent.enrollCrowdSecConsole({
        enrollmentKey: 'enrollment-key',
        name: 'fwcloud',
        tags: ['fwcloud'],
      });

      expect(postStub.firstCall.args[0]).to.equal('http://host:0/api/v1/crowdsec/console/enroll');
      expect(postStub.firstCall.args[1]).to.deep.equal({
        enrollment_key: 'enrollment-key',
        name: 'fwcloud',
        tags: ['fwcloud'],
      });
    });

    it('should map decision and alert filters to the agent query format', async () => {
      const getStub = sinon.stub(axios, 'get').resolves({ status: 200, data: {} });

      await agent.getCrowdSecDecisions({
        limit: 10,
        decisionType: 'ban',
        origin: 'CAPI',
      });
      await agent.getCrowdSecAlerts({ decisionType: 'ban', scenario: 'http:scan' });

      expect(getStub.firstCall.args[0]).to.equal('http://host:0/api/v1/crowdsec/decisions');
      expect(getStub.firstCall.args[1].params).to.include({
        limit: 10,
        decision_type: 'ban',
        origin: 'CAPI',
      });
      expect(getStub.secondCall.args[0]).to.equal('http://host:0/api/v1/crowdsec/alerts');
      expect(getStub.secondCall.args[1].params).to.include({ type: 'ban', scenario: 'http:scan' });
    });

    it('should forward decision and bouncer mutations to their agent routes', async () => {
      const postStub = sinon.stub(axios, 'post').resolves({ status: 200, data: {} });
      const deleteStub = sinon.stub(axios, 'delete').resolves({ status: 200, data: {} });

      await agent.flushCrowdSecDecisions(true);
      await agent.deleteCrowdSecDecision('123');
      await agent.registerCrowdSecBouncer('remote-bouncer');
      await agent.removeCrowdSecBouncer('remote-bouncer');

      expect(postStub.firstCall.args[0]).to.equal('http://host:0/api/v1/crowdsec/decisions/flush');
      expect(postStub.firstCall.args[1]).to.deep.equal({ confirm: true });
      expect(deleteStub.firstCall.args[0]).to.equal('http://host:0/api/v1/crowdsec/decisions/123');
      expect(postStub.secondCall.args[0]).to.equal(
        'http://host:0/api/v1/crowdsec/bouncers/register',
      );
      expect(deleteStub.secondCall.args[0]).to.equal(
        'http://host:0/api/v1/crowdsec/bouncers/remote-bouncer',
      );
    });
  });
});
