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

import { Request } from 'express';
import { EventEmitter } from 'events';
import sinon from 'sinon';
import { AgentCommunication } from '../../../../../src/communications/agent.communication';
import { Application } from '../../../../../src/Application';
import { CrowdSecController } from '../../../../../src/controllers/system/crowdsec/crowdsec.controller';
import { HttpException } from '../../../../../src/fonaments/exceptions/http/http-exception';
import { Authorization } from '../../../../../src/fonaments/authorization/policy';
import { ResponseBuilder } from '../../../../../src/fonaments/http/response-builder';
import {
  Firewall,
  FirewallInstallCommunication,
} from '../../../../../src/models/firewall/Firewall';
import { CrowdSecPolicy } from '../../../../../src/policies/crowdsec.policy';
import { describeName, expect, testSuite } from '../../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import { ValidationException } from '../../../../../src/fonaments/exceptions/validation-exception';
import { CrowdSecUninstallDto } from '../../../../../src/controllers/system/crowdsec/dto/uninstall.dto';
import { CrowdSecCollectionsQueryDto } from '../../../../../src/controllers/system/crowdsec/dto/collections-query.dto';
import { CrowdSecCollectionDto } from '../../../../../src/controllers/system/crowdsec/dto/collection.dto';
import { CrowdSecConsoleEnrollDto } from '../../../../../src/controllers/system/crowdsec/dto/console-enroll.dto';
import { CrowdSecDecisionsQueryDto } from '../../../../../src/controllers/system/crowdsec/dto/decisions-query.dto';
import { CrowdSecAlertsQueryDto } from '../../../../../src/controllers/system/crowdsec/dto/alerts-query.dto';
import { CrowdSecDecisionsFlushDto } from '../../../../../src/controllers/system/crowdsec/dto/decisions-flush.dto';
import { CrowdSecBouncerDto } from '../../../../../src/controllers/system/crowdsec/dto/bouncer.dto';
import { Validator } from '../../../../../src/fonaments/validation/validator';
import { Channel } from '../../../../../src/sockets/channels/channel';
import { ProgressPayload, SocketMessage } from '../../../../../src/sockets/messages/socket-message';

describe(describeName(CrowdSecController.name + ' Unit Tests'), () => {
  let app: Application;
  let controller: CrowdSecController;
  let fwcProduct: FwCloudProduct;
  let communication: AgentCommunication;
  let viewPolicyStub: sinon.SinonStub;
  let managePolicyStub: sinon.SinonStub;

  beforeEach(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();
    fwcProduct = await new FwCloudFactory().make();
    controller = new CrowdSecController(app);
    communication = new AgentCommunication({
      protocol: 'http',
      host: 'host',
      port: 0,
      apikey: 'api-key',
    });

    await controller.make({
      params: {
        fwcloud: fwcProduct.fwcloud.id,
        firewall: fwcProduct.firewall.id,
      },
    } as unknown as Request);
    (controller as any)._firewall.install_communication = FirewallInstallCommunication.Agent;

    sinon.stub(Firewall.prototype, 'getCommunication').resolves(communication);
    viewPolicyStub = sinon.stub(CrowdSecPolicy, 'view').resolves(Authorization.grant());
    managePolicyStub = sinon.stub(CrowdSecPolicy, 'manage').resolves(Authorization.grant());
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should forward CrowdSec status to the agent', async () => {
    const status = { crowdsec: { installed: true } };
    const statusStub = sinon.stub(communication, 'getCrowdSecStatus').resolves(status);

    const response: ResponseBuilder = await controller.status({
      session: { user: null },
    } as unknown as Request);

    expect(statusStub.calledOnce).to.be.true;
    expect(response.toJSON()).to.include({ status: 200, data: status });
  });

  it('should forward CrowdSec decision filters to the agent', async () => {
    const decisions = { decisions: [] };
    const decisionsStub = sinon.stub(communication, 'getCrowdSecDecisions').resolves(decisions);

    const response: ResponseBuilder = await controller.decisions({
      query: {
        limit: '10',
        scope: 'Ip',
        value: '192.0.2.10',
        decision_type: 'ban',
        origin: 'CAPI',
        scenario: 'http:scan',
      },
      session: { user: null },
    } as unknown as Request);

    expect(
      decisionsStub.calledOnceWithExactly({
        limit: 10,
        scope: 'Ip',
        value: '192.0.2.10',
        decisionType: 'ban',
        origin: 'CAPI',
        scenario: 'http:scan',
      }),
    ).to.be.true;
    expect(response.toJSON()).to.include({ status: 200, data: decisions });
  });

  it('should reject CrowdSec decision listing without access before contacting the agent', async () => {
    viewPolicyStub.resolves(Authorization.revoke());
    const decisionsStub = sinon.stub(communication, 'getCrowdSecDecisions');

    await expect(controller.decisions({ query: {}, session: { user: null } } as unknown as Request))
      .to.be.rejected;
    expect(decisionsStub.called).to.be.false;
  });

  it('should forward CrowdSec alert filters to the agent', async () => {
    const alerts = { alerts: [] };
    const alertsStub = sinon.stub(communication, 'getCrowdSecAlerts').resolves(alerts);

    const response: ResponseBuilder = await controller.alerts({
      query: {
        limit: '10',
        since: '24h',
        until: '1h',
        scenario: 'http:scan',
        type: 'ban',
        scope: 'Ip',
        value: '192.0.2.10',
        ip: '192.0.2.10',
        range: '192.0.2.0/24',
      },
      session: { user: null },
    } as unknown as Request);

    expect(
      alertsStub.calledOnceWithExactly({
        limit: 10,
        since: '24h',
        until: '1h',
        scenario: 'http:scan',
        decisionType: 'ban',
        scope: 'Ip',
        value: '192.0.2.10',
        ip: '192.0.2.10',
        range: '192.0.2.0/24',
      }),
    ).to.be.true;
    expect(response.toJSON()).to.include({ status: 200, data: alerts });
  });

  it('should reject CrowdSec alert listing without access before contacting the agent', async () => {
    viewPolicyStub.resolves(Authorization.revoke());
    const alertsStub = sinon.stub(communication, 'getCrowdSecAlerts');

    await expect(controller.alerts({ query: {}, session: { user: null } } as unknown as Request)).to
      .be.rejected;
    expect(alertsStub.called).to.be.false;
  });

  it('should list CrowdSec bouncers through the agent', async () => {
    const bouncers = { bouncers: [] };
    const bouncersStub = sinon.stub(communication, 'getCrowdSecBouncers').resolves(bouncers);

    const response = await controller.bouncers({
      session: { user: null },
    } as unknown as Request);

    expect(bouncersStub.calledOnce).to.be.true;
    expect(response.toJSON()).to.include({ status: 200, data: bouncers });
  });

  it('should reject CrowdSec bouncer listing without access before contacting the agent', async () => {
    viewPolicyStub.resolves(Authorization.revoke());
    const bouncersStub = sinon.stub(communication, 'getCrowdSecBouncers');

    await expect(controller.bouncers({ session: { user: null } } as unknown as Request)).to.be
      .rejected;
    expect(bouncersStub.called).to.be.false;
  });

  it('should return the newly generated CrowdSec bouncer key once', async () => {
    const bouncer = { name: 'remote-bouncer', api_key: 'generated-api-key' };
    const registerStub = sinon.stub(communication, 'registerCrowdSecBouncer').resolves(bouncer);

    const response = await controller.registerBouncer({
      body: { name: 'remote-bouncer' },
      session: { user: null },
    } as unknown as Request);

    expect(registerStub.calledOnceWithExactly('remote-bouncer')).to.be.true;
    expect(response.toJSON()).to.include({ status: 200, data: bouncer });
  });

  it('should remove a CrowdSec bouncer through the agent', async () => {
    const bouncer = { name: 'remote-bouncer', message: 'Removed' };
    const removeStub = sinon.stub(communication, 'removeCrowdSecBouncer').resolves(bouncer);

    const response = await controller.removeBouncer({
      params: { bouncer: 'remote-bouncer' },
      session: { user: null },
    } as unknown as Request);

    expect(removeStub.calledOnceWithExactly('remote-bouncer')).to.be.true;
    expect(response.toJSON()).to.include({ status: 200, data: bouncer });
  });

  it('should reject the reserved FWCloud bouncer name before contacting the agent', async () => {
    const registerStub = sinon.stub(communication, 'registerCrowdSecBouncer');
    const removeStub = sinon.stub(communication, 'removeCrowdSecBouncer');

    await expect(
      controller.registerBouncer({
        body: { name: 'fwcloud' },
        session: { user: null },
      } as unknown as Request),
    ).to.be.rejectedWith(HttpException, 'The FWCloud bouncer name is reserved');
    await expect(
      controller.removeBouncer({
        params: { bouncer: 'fwcloud' },
        session: { user: null },
      } as unknown as Request),
    ).to.be.rejectedWith(HttpException, 'The FWCloud bouncer name is reserved');
    expect(registerStub.called).to.be.false;
    expect(removeStub.called).to.be.false;
  });

  it('should reject CrowdSec bouncer mutations without access before contacting the agent', async () => {
    managePolicyStub.resolves(Authorization.revoke());
    const registerStub = sinon.stub(communication, 'registerCrowdSecBouncer');
    const removeStub = sinon.stub(communication, 'removeCrowdSecBouncer');

    await expect(
      controller.registerBouncer({
        body: { name: 'remote-bouncer' },
        session: { user: null },
      } as unknown as Request),
    ).to.be.rejected;
    await expect(
      controller.removeBouncer({
        params: { bouncer: 'remote-bouncer' },
        session: { user: null },
      } as unknown as Request),
    ).to.be.rejected;
    expect(registerStub.called).to.be.false;
    expect(removeStub.called).to.be.false;
  });

  it('should delete one CrowdSec decision through the agent', async () => {
    const decision = { operation: 'delete', decision_id: '123', deleted_count: 1 };
    const deleteStub = sinon.stub(communication, 'deleteCrowdSecDecision').resolves(decision);

    const response = await controller.deleteDecision({
      params: { decision: '123' },
      session: { user: null },
    } as unknown as Request);

    expect(deleteStub.calledOnceWithExactly('123')).to.be.true;
    expect(response.toJSON()).to.include({ status: 200, data: decision });
  });

  it('should reject an invalid CrowdSec decision ID before contacting the agent', async () => {
    const deleteStub = sinon.stub(communication, 'deleteCrowdSecDecision');

    await expect(
      controller.deleteDecision({
        params: { decision: 'invalid' },
        session: { user: null },
      } as unknown as Request),
    ).to.be.rejectedWith(HttpException, 'Invalid CrowdSec decision ID');
    expect(deleteStub.called).to.be.false;
  });

  it('should forward confirmed CrowdSec decision flushes to the agent', async () => {
    const decisions = { operation: 'flush', deleted_count: 4 };
    const flushStub = sinon.stub(communication, 'flushCrowdSecDecisions').resolves(decisions);

    const response = await controller.flushDecisions({
      body: { confirm: true },
      session: { user: null },
    } as unknown as Request);

    expect(flushStub.calledOnceWithExactly(true)).to.be.true;
    expect(response.toJSON()).to.include({ status: 200, data: decisions });
  });

  it('should reject CrowdSec decision mutations without access before contacting the agent', async () => {
    managePolicyStub.resolves(Authorization.revoke());
    const deleteStub = sinon.stub(communication, 'deleteCrowdSecDecision');
    const flushStub = sinon.stub(communication, 'flushCrowdSecDecisions');

    await expect(
      controller.deleteDecision({
        params: { decision: '123' },
        session: { user: null },
      } as unknown as Request),
    ).to.be.rejected;
    await expect(
      controller.flushDecisions({
        body: { confirm: true },
        session: { user: null },
      } as unknown as Request),
    ).to.be.rejected;
    expect(deleteStub.called).to.be.false;
    expect(flushStub.called).to.be.false;
  });

  it('should forward the installed collection filter to the agent', async () => {
    const collections = { collections: [] };
    const collectionsStub = sinon
      .stub(communication, 'getCrowdSecCollections')
      .resolves(collections);

    const response: ResponseBuilder = await controller.collections({
      query: { installed: 'true' },
      session: { user: null },
    } as unknown as Request);

    expect(collectionsStub.calledOnceWithExactly(true)).to.be.true;
    expect(response.toJSON()).to.include({ status: 200, data: collections });
  });

  it('should request all collections when the installed filter is omitted', async () => {
    const collectionsStub = sinon.stub(communication, 'getCrowdSecCollections').resolves({
      collections: [],
    });

    await controller.collections({
      query: {},
      session: { user: null },
    } as unknown as Request);

    expect(collectionsStub.calledOnceWithExactly(undefined)).to.be.true;
  });

  it('should reject an invalid installed collection filter', async () => {
    await expect(
      new Validator({ installed: 'yes' }, CrowdSecCollectionsQueryDto).validate(),
    ).to.be.rejectedWith(ValidationException);
  });

  it('should reject collection listing without access before contacting the agent', async () => {
    viewPolicyStub.resolves(Authorization.revoke());
    const collectionsStub = sinon.stub(communication, 'getCrowdSecCollections');

    await expect(
      controller.collections({ query: {}, session: { user: null } } as unknown as Request),
    ).to.be.rejected;
    expect(collectionsStub.called).to.be.false;
  });

  it('should forward CrowdSec Console status to the agent', async () => {
    const status = { state: 'connected' as const, message: 'CrowdSec Central API is reachable' };
    const statusStub = sinon.stub(communication, 'getCrowdSecConsoleStatus').resolves(status);

    const response = await controller.consoleStatus({
      session: { user: null },
    } as unknown as Request);

    expect(statusStub.calledOnce).to.be.true;
    expect(response.toJSON()).to.include({ status: 200, data: status });
  });

  it('should reject Console status without access before contacting the agent', async () => {
    viewPolicyStub.resolves(Authorization.revoke());
    const statusStub = sinon.stub(communication, 'getCrowdSecConsoleStatus');

    await expect(controller.consoleStatus({ session: { user: null } } as unknown as Request)).to.be
      .rejected;
    expect(statusStub.called).to.be.false;
  });

  it('should enroll CrowdSec Console without returning the enrollment key', async () => {
    const enrollmentKey = 'crowdsec-enrollment-key';
    const response = {
      status: {
        state: 'pending_approval' as const,
        message: 'Accept the Security Engine in CrowdSec Console',
      },
    };
    const enrollStub = sinon.stub(communication, 'enrollCrowdSecConsole').resolves(response);

    const result = await controller.enrollConsole({
      body: { enrollmentKey, name: 'fwcloud', tags: ['fwcloud'] },
      session: { user: null },
    } as unknown as Request);

    expect(enrollStub.calledOnceWithExactly({ enrollmentKey, name: 'fwcloud', tags: ['fwcloud'] }))
      .to.be.true;
    expect(result.toJSON().data).to.deep.equal(response);
    expect(JSON.stringify(result.toJSON())).to.not.contain(enrollmentKey);
  });

  it('should reject invalid CrowdSec Console enrollment data', async () => {
    await expect(
      new Validator(
        { enrollmentKey: 'invalid\nkey', name: 'invalid name', tags: ['invalid tag'] },
        CrowdSecConsoleEnrollDto,
      ).validate(),
    ).to.be.rejectedWith(ValidationException);
  });

  it('should validate CrowdSec decisions, alerts and bouncer DTOs', async () => {
    await expect(
      new Validator(
        {
          limit: 100,
          scope: 'Ip',
          value: '192.0.2.10',
          decision_type: 'ban',
          origin: 'CAPI',
          scenario: 'http:scan',
        },
        CrowdSecDecisionsQueryDto,
      ).validate(),
    ).to.be.fulfilled;
    await expect(
      new Validator({ limit: 101, origin: 'invalid' }, CrowdSecDecisionsQueryDto).validate(),
    ).to.be.rejectedWith(ValidationException);
    await expect(
      new Validator(
        { limit: 50, since: '24h', type: 'ban', scenario: 'http:scan' },
        CrowdSecAlertsQueryDto,
      ).validate(),
    ).to.be.fulfilled;
    await expect(
      new Validator({ until: '24h!' }, CrowdSecAlertsQueryDto).validate(),
    ).to.be.rejectedWith(ValidationException);
    await expect(
      new Validator({ confirm: false }, CrowdSecDecisionsFlushDto).validate(),
    ).to.be.rejectedWith(ValidationException);
    await expect(
      new Validator({ name: 'invalid/name' }, CrowdSecBouncerDto).validate(),
    ).to.be.rejectedWith(ValidationException);
  });

  it('should reject Console enrollment without access before contacting the agent', async () => {
    managePolicyStub.resolves(Authorization.revoke());
    const enrollStub = sinon.stub(communication, 'enrollCrowdSecConsole');

    await expect(
      controller.enrollConsole({
        body: { enrollmentKey: 'crowdsec-enrollment-key' },
        session: { user: null },
      } as unknown as Request),
    ).to.be.rejected;
    expect(enrollStub.called).to.be.false;
  });

  it('should install a collection and return the refreshed collection list', async () => {
    const result = {
      operation: 'install' as const,
      processed_collections: [],
      skipped_collections: [],
      message: 'Installed',
    };
    const collections = { collections: [] };
    const installStub = sinon.stub(communication, 'installCrowdSecCollection').resolves(result);
    const collectionsStub = sinon
      .stub(communication, 'getCrowdSecCollections')
      .resolves(collections);

    const response = await controller.installCollection({
      body: { name: 'crowdsecurity/nginx' },
      session: { user: null },
    } as unknown as Request);

    expect(installStub.calledOnceWithExactly('crowdsecurity/nginx')).to.be.true;
    expect(installStub.calledBefore(collectionsStub)).to.be.true;
    const body = response.toJSON();
    expect(body.status).to.equal(200);
    expect(body.data).to.deep.equal({ result, collections });
  });

  it('should remove a collection and return the refreshed collection list', async () => {
    const result = {
      operation: 'remove' as const,
      processed_collections: [],
      skipped_collections: [],
      message: 'Removed',
    };
    const collections = { collections: [] };
    const removeStub = sinon.stub(communication, 'removeCrowdSecCollection').resolves(result);
    const collectionsStub = sinon
      .stub(communication, 'getCrowdSecCollections')
      .resolves(collections);

    const response = await controller.removeCollection({
      body: { name: 'crowdsecurity/nginx' },
      session: { user: null },
    } as unknown as Request);

    expect(removeStub.calledOnceWithExactly('crowdsecurity/nginx')).to.be.true;
    expect(removeStub.calledBefore(collectionsStub)).to.be.true;
    const body = response.toJSON();
    expect(body.status).to.equal(200);
    expect(body.data).to.deep.equal({ result, collections });
  });

  it('should update collections and return the refreshed collection list', async () => {
    const result = {
      operation: 'update' as const,
      processed_collections: [],
      skipped_collections: [],
      message: 'Updated',
    };
    const collections = { collections: [] };
    const updateStub = sinon.stub(communication, 'updateCrowdSecCollections').resolves(result);
    const collectionsStub = sinon
      .stub(communication, 'getCrowdSecCollections')
      .resolves(collections);

    const response = await controller.updateCollections({
      body: {},
      session: { user: null },
    } as unknown as Request);

    expect(updateStub.calledOnce).to.be.true;
    expect(updateStub.calledBefore(collectionsStub)).to.be.true;
    const body = response.toJSON();
    expect(body.status).to.equal(200);
    expect(body.data).to.deep.equal({ result, collections });
  });

  it('should reject an invalid collection name', async () => {
    await expect(
      new Validator({ name: 'crowdsecurity/nginx;rm' }, CrowdSecCollectionDto).validate(),
    ).to.be.rejectedWith(ValidationException);
  });

  it('should reject collection mutations without access before contacting the agent', async () => {
    managePolicyStub.resolves(Authorization.revoke());
    const installStub = sinon.stub(communication, 'installCrowdSecCollection');

    await expect(
      controller.installCollection({
        body: { name: 'crowdsecurity/nginx' },
        session: { user: null },
      } as unknown as Request),
    ).to.be.rejected;
    expect(installStub.called).to.be.false;
  });

  it('should install CrowdSec with the configured Firewall Bouncer backend', async () => {
    const crowdsec = { steps: [{ step: 'crowdsec_packages' }] };
    const listener = new EventEmitter();
    const channel = new Channel('crowdsec-install', listener);
    const crowdsecStub = sinon.stub(communication, 'installCrowdSec').resolves(crowdsec);
    const bouncerStub = sinon.stub(communication, 'installCrowdSecBouncer');
    sinon.stub(Firewall, 'getCrowdSecFirewallBouncerBackend').resolves('nftables');
    const channelStub = sinon.stub(Channel, 'fromRequest').resolves(channel);
    const messages: ProgressPayload[] = [];
    listener.on(channel.id, (message: SocketMessage) =>
      messages.push(message.payload as ProgressPayload),
    );

    const response: ResponseBuilder = await controller.install({
      session: { user: null },
    } as unknown as Request);

    expect(channelStub.calledOnce).to.be.true;
    expect(crowdsecStub.calledOnceWithExactly(channel, 'nftables')).to.be.true;
    expect(bouncerStub.called).to.be.false;
    expect(messages).to.deep.equal([
      new ProgressPayload('start', false, 'Installing CrowdSec'),
      new ProgressPayload('end', false, 'CrowdSec installation finished'),
    ]);
    const body = response.toJSON();
    expect(body.status).to.equal(200);
    expect(body.data).to.deep.equal({ crowdsec });
  });

  it('should not invoke a separate Firewall Bouncer operation when CrowdSec installation fails', async () => {
    sinon.stub(communication, 'installCrowdSec').rejects(new Error('CrowdSec install failed'));
    const bouncerStub = sinon.stub(communication, 'installCrowdSecBouncer');
    sinon.stub(Firewall, 'getCrowdSecFirewallBouncerBackend').resolves('iptables');

    await expect(
      controller.install({ session: { user: null } } as unknown as Request),
    ).to.be.rejectedWith('CrowdSec install failed');
    expect(bouncerStub.called).to.be.false;
  });

  it('should preserve the agent default backend when the compiler has no CrowdSec backend', async () => {
    const channel = new Channel('crowdsec-install', new EventEmitter());
    const crowdsecStub = sinon.stub(communication, 'installCrowdSec').resolves({ steps: [] });
    sinon.stub(Channel, 'fromRequest').resolves(channel);
    sinon.stub(Firewall, 'getCrowdSecFirewallBouncerBackend').resolves(null);

    await controller.install({ session: { user: null } } as unknown as Request);

    expect(crowdsecStub.calledOnceWithExactly(channel, undefined)).to.be.true;
  });

  it('should reject CrowdSec installation before reading the backend or contacting the agent', async () => {
    managePolicyStub.resolves(Authorization.revoke());
    const backendStub = sinon.stub(Firewall, 'getCrowdSecFirewallBouncerBackend');
    const installStub = sinon.stub(communication, 'installCrowdSec');

    await expect(controller.install({ session: { user: null } } as unknown as Request)).to.be
      .rejected;

    expect(backendStub.called).to.be.false;
    expect(installStub.called).to.be.false;
  });

  it('should forward the uninstall confirmation to the agent', async () => {
    const listener = new EventEmitter();
    const channel = new Channel('crowdsec-uninstall', listener);
    const uninstallStub = sinon.stub(communication, 'uninstallCrowdSec').resolves({ steps: [] });
    sinon.stub(Channel, 'fromRequest').resolves(channel);
    const messages: ProgressPayload[] = [];
    listener.on(channel.id, (message: SocketMessage) =>
      messages.push(message.payload as ProgressPayload),
    );

    const response: ResponseBuilder = await controller.uninstall({
      body: { confirm: true },
      session: { user: null },
    } as unknown as Request);

    expect(uninstallStub.calledOnceWithExactly(true, channel)).to.be.true;
    expect(messages).to.deep.equal([
      new ProgressPayload('start', false, 'Uninstalling CrowdSec'),
      new ProgressPayload('end', false, 'CrowdSec uninstallation finished'),
    ]);
    const body = response.toJSON();
    expect(body.status).to.equal(200);
    expect(body.data).to.deep.equal({ steps: [] });
  });

  it('should reject CrowdSec operations when the firewall uses SSH', async () => {
    (controller as any)._firewall.install_communication = FirewallInstallCommunication.SSH;

    await expect(
      controller.status({ session: { user: null } } as unknown as Request),
    ).to.be.rejectedWith(HttpException, 'CrowdSec requires FWCloud Agent communication');
  });

  it('should reject a user without access before contacting the agent', async () => {
    viewPolicyStub.resolves(Authorization.revoke());
    const statusStub = sinon.stub(communication, 'getCrowdSecStatus');

    await expect(controller.status({ session: { user: null } } as unknown as Request)).to.be
      .rejected;
    expect(statusStub.called).to.be.false;
  });

  it('should require explicit uninstall confirmation', async () => {
    await expect(
      new Validator({ confirm: false }, CrowdSecUninstallDto).validate(),
    ).to.be.rejectedWith(ValidationException);
  });
});
