import { Request } from 'express';
import sinon from 'sinon';
import { Application } from '../../../../../src/Application';
import { Authorization } from '../../../../../src/fonaments/authorization/policy';
import { RequestInputs } from '../../../../../src/fonaments/http/request-inputs';
import { ResponseBuilder } from '../../../../../src/fonaments/http/response-builder';
import { OpenVPNStatusSamplingController } from '../../../../../src/controllers/firewalls/openvpn/openvpn-status-sampling.controller';
import { FirewallPolicy } from '../../../../../src/policies/firewall.policy';
import { describeName, expect, testSuite } from '../../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';

describe(describeName(OpenVPNStatusSamplingController.name + ' Unit Tests'), () => {
  let app: Application;
  let controller: OpenVPNStatusSamplingController;
  let fwcProduct: FwCloudProduct;

  beforeEach(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();
    fwcProduct = await new FwCloudFactory().make();
    controller = new OpenVPNStatusSamplingController(app);
    sinon.stub(FirewallPolicy, 'compile').resolves(Authorization.grant());

    await controller.make({
      params: {
        fwcloud: fwcProduct.fwcloud.id,
        firewall: fwcProduct.firewall.id,
      },
    } as unknown as Request);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should return disabled sampling when firewall has no configuration', async () => {
    const response: ResponseBuilder = await controller.show({
      session: { user: null },
    } as unknown as Request);
    const body = response.toJSON();

    expect(body.status).to.eq(200);
    expect(body.data).to.deep.eq({
      enabled: false,
      firewall: fwcProduct.firewall.id,
      cluster: null,
      collector_firewall: null,
      status_files: [],
      last_sync_result: null,
      last_sync_error: null,
      last_synced_at: null,
      last_poll_result: null,
      last_poll_error: null,
      last_polled_at: null,
      agent_state: null,
    });
  });

  it('should update firewall sampling configuration', async () => {
    const response: ResponseBuilder = await controller.update({
      session: { user: null },
      inputs: new RequestInputs({
        body: {
          enabled: true,
          status_files: ['/run/openvpn/server.status'],
        },
        query: {},
      } as unknown as Request),
    } as unknown as Request);
    const body = response.toJSON();

    expect(body.status).to.eq(200);
    expect(body.data).to.include({
      enabled: true,
      firewall: fwcProduct.firewall.id,
      cluster: null,
      collector_firewall: fwcProduct.firewall.id,
    });
    expect(body.data).to.have.property('status_files').deep.eq(['/run/openvpn/server.status']);
  });
});
