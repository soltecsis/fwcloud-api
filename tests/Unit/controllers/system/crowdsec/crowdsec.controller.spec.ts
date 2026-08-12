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
import { Validator } from '../../../../../src/fonaments/validation/validator';

describe(describeName(CrowdSecController.name + ' Unit Tests'), () => {
  let app: Application;
  let controller: CrowdSecController;
  let fwcProduct: FwCloudProduct;
  let communication: AgentCommunication;
  let viewPolicyStub: sinon.SinonStub;

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
    sinon.stub(CrowdSecPolicy, 'manage').resolves(Authorization.grant());
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

  it('should install CrowdSec before the Firewall Bouncer', async () => {
    const crowdsec = { steps: [{ step: 'crowdsec_packages' }] };
    const firewallBouncer = { steps: [{ step: 'blacklist_ipsets' }] };
    const crowdsecStub = sinon.stub(communication, 'installCrowdSec').resolves(crowdsec);
    const bouncerStub = sinon
      .stub(communication, 'installCrowdSecBouncer')
      .resolves(firewallBouncer);

    const response: ResponseBuilder = await controller.install({
      session: { user: null },
    } as unknown as Request);

    expect(crowdsecStub.calledBefore(bouncerStub)).to.be.true;
    const body = response.toJSON();
    expect(body.status).to.equal(200);
    expect(body.data).to.deep.equal({ crowdsec, firewall_bouncer: firewallBouncer });
  });

  it('should not install the Firewall Bouncer when CrowdSec installation fails', async () => {
    sinon.stub(communication, 'installCrowdSec').rejects(new Error('CrowdSec install failed'));
    const bouncerStub = sinon.stub(communication, 'installCrowdSecBouncer');

    await expect(
      controller.install({ session: { user: null } } as unknown as Request),
    ).to.be.rejectedWith('CrowdSec install failed');
    expect(bouncerStub.called).to.be.false;
  });

  it('should forward the uninstall confirmation to the agent', async () => {
    const uninstallStub = sinon.stub(communication, 'uninstallCrowdSec').resolves({ steps: [] });

    const response: ResponseBuilder = await controller.uninstall({
      body: { confirm: true },
      session: { user: null },
    } as unknown as Request);

    expect(uninstallStub.calledOnceWithExactly(true)).to.be.true;
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
