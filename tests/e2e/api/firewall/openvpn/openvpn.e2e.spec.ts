import { describeName, playgroundPath, expect } from '../../../../mocha/global-setup';
import { Application } from '../../../../../src/Application';
import request = require('supertest');

import { testSuite } from '../../../../mocha/global-setup';
import { createUser, generateSession, attachSession } from '../../../../utils/utils';
import { User } from '../../../../../src/models/user/User';
import { _URL } from '../../../../../src/fonaments/http/router/router.service';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { OpenVPN } from '../../../../../src/models/vpn/openvpn/OpenVPN';
import { FwCloud } from '../../../../../src/models/fwcloud/FwCloud';
import { EntityManager } from 'typeorm';
import StringHelper from '../../../../../src/utils/string.helper';
import sinon from 'sinon';
import path = require('path');
import * as fs from 'fs-extra';
import { InstallerGenerator } from '../../../../../src/openvpn-installer/installer-generator';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import { OpenVPNStatusHistoryService } from '../../../../../src/models/vpn/openvpn/status/openvpn-status-history.service';
import db from '../../../../../src/database/database-manager';

describe(describeName('OpenVPN E2E Tests'), () => {
  let app: Application;
  let loggedUser: User;
  let loggedUserSessionId: string;
  let adminUser: User;
  let adminUserSessionId: string;

  let fwcloudProduct: FwCloudProduct;

  let fwCloud: FwCloud;
  let firewall: Firewall;
  let openvpn: OpenVPN;
  let serverOpenVPN: OpenVPN;

  let stubGenerateInstaller: sinon.SinonStub;
  let stubOpenVPNDumpConfig: sinon.SinonStub;

  let mockExePath: string;

  const connectioName: string = 'test';

  let manager: EntityManager;

  beforeEach(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();
    manager = db.getSource().manager;

    fwcloudProduct = await new FwCloudFactory().make();

    loggedUser = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUser);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    fwCloud = fwcloudProduct.fwcloud;
    firewall = fwcloudProduct.firewall;
    serverOpenVPN = fwcloudProduct.openvpnServer;
    openvpn = fwcloudProduct.openvpnClients.get('OpenVPN-Cli-1');

    mockExePath = path.join(playgroundPath, 'vpn', 'fwcloud-vpn.exe');

    // @ts-ignore
    stubGenerateInstaller = sinon.stub(InstallerGenerator.prototype, 'generate').callsFake(() => {
      fs.mkdirpSync(path.dirname(mockExePath));
      fs.writeFileSync(mockExePath, '');
      return mockExePath;
    });

    stubOpenVPNDumpConfig = sinon
      .stub(OpenVPN, 'dumpCfg')
      .returns(new Promise<string>((resolve) => resolve('<test></test>')));
  });

  afterEach(() => {
    stubGenerateInstaller.restore();
    stubOpenVPNDumpConfig.restore();
  });

  describe('OpenVPNController', () => {
    describe('OpenVPNController@installer', () => {
      it('guest user should not generate an installer', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.openvpns.installer', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: openvpn.id,
            }),
          )
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not generate an installer', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.openvpns.installer', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: openvpn.id,
            }),
          )
          .send({
            connection_name: connectioName,
          })
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should generate an installer', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.openvpns.installer', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: openvpn.id,
            }),
          )
          .send({
            connection_name: connectioName,
          })
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(201);
      });

      it('admin user should generate an installer', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.openvpns.installer', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: openvpn.id,
            }),
          )
          .send({
            connection_name: connectioName,
          })
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(201);
      });

      it('should return the openvpn installer', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.openvpns.installer', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: openvpn.id,
            }),
          )
          .send({
            connection_name: connectioName,
          })
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect('Content-Type', /application/)
          .expect(201);
      });

      it('should return 422 if the connection_name is not provided', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.openvpns.installer', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: openvpn.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(422);
      });

      it('should return 422 if the connection_name is not valid', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.openvpns.installer', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: openvpn.id,
            }),
          )
          .send({
            connection_name: '-' + connectioName,
          })
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(422);
      });

      it('should return 404 if the openvpn does not belongs to the fwcloud', async () => {
        const otherFwCloud: FwCloud = await manager.getRepository(FwCloud).save(
          manager.getRepository(FwCloud).create({
            name: StringHelper.randomize(10),
          }),
        );

        const otherFirewall: Firewall = await manager.getRepository(Firewall).save(
          manager.getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: otherFwCloud.id,
          }),
        );

        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.openvpns.installer', {
              fwcloud: otherFwCloud.id,
              firewall: otherFirewall.id,
              openvpn: openvpn.id,
            }),
          )
          .send({
            connection_name: connectioName,
          })
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(404);
      });

      it('should return 404 if the openvpn is a server', async () => {
        openvpn.parentId = null;
        await manager.getRepository(OpenVPN).save(openvpn);

        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.openvpns.installer', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: openvpn.id,
            }),
          )
          .send({
            connection_name: connectioName,
          })
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(404);
      });
    });

    describe('OpenVPNController@history', () => {
      let historyService: OpenVPNStatusHistoryService;

      beforeEach(async () => {
        historyService = await app.getService(OpenVPNStatusHistoryService.name);
        historyService.create(serverOpenVPN.id, [
          {
            timestampInSeconds: 2,
            name: 'name',
            address: '1.1.1.1',
            bytesReceived: 100,
            bytesSent: 200,
            connectedAtTimestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0)),
          },
        ]);
      });

      it('guest user should not generate an installer', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.openvpns.history', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: serverOpenVPN.id,
            }),
          )
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not generate an installer', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.openvpns.history', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: serverOpenVPN.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should list history', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.openvpns.history', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: serverOpenVPN.id,
            }),
          )
          .query({
            starts_at: new Date(0).getTime(),
            ends_at: new Date(2000).getTime(),
          })
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data.name.connections).to.have.length(1);
          });
      });

      it('admin user should list history', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.openvpns.history', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: serverOpenVPN.id,
            }),
          )
          .query({
            starts_at: new Date(0).getTime(),
            ends_at: new Date(2000).getTime(),
          })
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data.name.connections).to.have.length(1);
          });
      });
    });

    describe('OpenVPNController@graph', () => {
      let historyService: OpenVPNStatusHistoryService;

      beforeEach(async () => {
        historyService = await app.getService(OpenVPNStatusHistoryService.name);
        historyService.create(serverOpenVPN.id, [
          {
            timestampInSeconds: 1,
            name: 'name',
            address: '1.1.1.1',
            bytesReceived: 100,
            bytesSent: 200,
            connectedAtTimestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0)),
          },
        ]);
      });

      it('guest user should not get graph data', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.openvpns.graph', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: serverOpenVPN.id,
            }),
          )
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not get graph data', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.openvpns.graph', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: serverOpenVPN.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should list graph data', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.openvpns.graph', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: serverOpenVPN.id,
            }),
          )
          .query({
            starts_at: new Date(0).getTime(),
            ends_at: new Date(2000).getTime(),
          })
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(1);
          });
      });

      it('admin user should list graph data', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.openvpns.graph', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              openvpn: serverOpenVPN.id,
            }),
          )
          .query({
            starts_at: new Date(0).getTime(),
            ends_at: new Date(2000).getTime(),
          })
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(1);
          });
      });
    });
  });
});
