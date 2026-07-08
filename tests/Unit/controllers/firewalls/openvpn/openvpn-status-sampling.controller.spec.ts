import { Request } from 'express';
import sinon from 'sinon';
import { Application } from '../../../../../src/Application';
import { Authorization } from '../../../../../src/fonaments/authorization/policy';
import { RequestInputs } from '../../../../../src/fonaments/http/request-inputs';
import { ResponseBuilder } from '../../../../../src/fonaments/http/response-builder';
import { OpenVPNStatusSamplingController } from '../../../../../src/controllers/firewalls/openvpn/openvpn-status-sampling.controller';
import db from '../../../../../src/database/database-manager';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { OpenVPNOption } from '../../../../../src/models/vpn/openvpn/openvpn-option.model';
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
        openvpn: fwcProduct.openvpnServer.id,
      },
    } as unknown as Request);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should return disabled sampling when OpenVPN server has no configuration', async () => {
    const response: ResponseBuilder = await controller.show({
      session: { user: null },
    } as unknown as Request);
    const body = response.toJSON();

    expect(body.status).to.eq(200);
    expect(body.data).to.deep.eq({
      enabled: false,
      firewall: fwcProduct.firewall.id,
      openvpn: fwcProduct.openvpnServer.id,
      status_file: null,
    });
  });

  it('should update OpenVPN server sampling configuration', async () => {
    const syncOpenVPNStatusSampling = sinon.stub().resolves(undefined);
    sinon.stub(Firewall.prototype, 'getCommunication').resolves({
      syncOpenVPNStatusSampling,
    } as any);

    await db
      .getSource()
      .manager.getRepository(OpenVPNOption)
      .save(
        db.getSource().manager.getRepository(OpenVPNOption).create({
          openVPNId: fwcProduct.openvpnServer.id,
          name: 'status',
          arg: '/run/openvpn/server.status',
          order: 1,
          scope: 1,
        }),
      );

    const response: ResponseBuilder = await controller.update({
      session: { user: null },
      inputs: new RequestInputs({
        body: {
          enabled: true,
          status_file: '/run/openvpn/server.status',
        },
        query: {},
      } as unknown as Request),
    } as unknown as Request);
    const body = response.toJSON();

    expect(body.status).to.eq(200);
    expect(body.data).to.include({
      enabled: true,
      firewall: fwcProduct.firewall.id,
      openvpn: fwcProduct.openvpnServer.id,
    });
    expect(body.data).to.have.property('status_file').eq('/run/openvpn/server.status');
    expect(syncOpenVPNStatusSampling.calledOnce).to.eq(true);
  });
});
