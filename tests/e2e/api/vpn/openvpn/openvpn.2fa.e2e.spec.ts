import { EntityManager } from 'typeorm';
import db from '../../../../../src/database/database-manager';
import { User } from '../../../../../src/models/user/User';
import { Crt } from '../../../../../src/models/vpn/pki/Crt';
import { OpenVPN } from '../../../../../src/models/vpn/openvpn/OpenVPN';
import { describeName, testSuite, expect } from '../../../../mocha/global-setup';
import { FwCloudProduct, FwCloudFactory } from '../../../../utils/fwcloud-factory';
import { createUser, generateSession, attachSession } from '../../../../utils/utils';
import { Application } from '../../../../../src/Application';
import request = require('supertest');
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import sinon from 'sinon';

let app: Application;
let loggedUser: User;
let loggedUserSessionId: string;
let adminUser: User;
let adminUserSessionId: string;
let fwcProduct: FwCloudProduct;
let manager: EntityManager;

const SERVER_ENABLED_ROUTE = '/vpn/openvpn/2fa/server/enabled';
const SERVER_CLIENTS_ENABLED_ROUTE = '/vpn/openvpn/2fa/server/clients/enabled';
const SERVER_2FA_ROUTE = '/vpn/openvpn/2fa/server';
const CLIENT_2FA_ROUTE = '/vpn/openvpn/2fa/client';

describe(describeName('OpenVPN 2FA Routes E2E Tests'), () => {
  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    fwcProduct = await new FwCloudFactory().make();

    await manager.getRepository(OpenVPN).update(fwcProduct.openvpnServer.id, {
      install_dir: '/etc/openvpn',
      install_name: 'server.conf',
    });

    loggedUser = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUser);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    loggedUser.fwClouds = [fwcProduct.fwcloud];
    adminUser.fwClouds = [fwcProduct.fwcloud];
    await manager.getRepository(User).save([loggedUser, adminUser]);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('check whether another OpenVPN server has 2FA enabled', () => {
    it('guest user should not check if another server has 2FA enabled', async () => {
      await request(app.express)
        .put(SERVER_ENABLED_ROUTE)
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnServer.id,
        })
        .then((response) => {
          expect(response.status).to.equal(401);
        });
    });

    it('admin user should return false when there are no other servers with 2FA', async () => {
      await request(app.express)
        .put(SERVER_ENABLED_ROUTE)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnServer.id,
        })
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.enabled).to.equal(false);
        });
    });

    it('admin user should return true when another server has 2FA enabled', async () => {
      const extraServerCrt = await manager.getRepository(Crt).save(
        manager.getRepository(Crt).create({
          caId: fwcProduct.ca.id,
          cn: 'OpenVPN-Server-2',
          days: 1000,
          type: 2,
        }),
      );

      await manager.getRepository(OpenVPN).save(
        manager.getRepository(OpenVPN).create({
          parentId: null,
          firewallId: fwcProduct.firewall.id,
          crtId: extraServerCrt.id,
          tfaEnabled: 1,
        }),
      );

      await request(app.express)
        .put(SERVER_ENABLED_ROUTE)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnServer.id,
        })
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.enabled).to.equal(true);
        });
    });
  });

  describe('check whether the OpenVPN server has clients with 2FA enabled', () => {
    it('admin user should return false when no clients have 2FA enabled', async () => {
      await request(app.express)
        .put(SERVER_CLIENTS_ENABLED_ROUTE)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnServer.id,
        })
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.enabled).to.equal(false);
        });
    });

    it('admin user should return true when any client has 2FA enabled', async () => {
      await manager
        .getRepository(OpenVPN)
        .update(fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id, { tfaEnabled: 1 });

      await request(app.express)
        .put(SERVER_CLIENTS_ENABLED_ROUTE)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnServer.id,
        })
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.enabled).to.equal(true);
        });
    });
  });

  describe('enable and disable 2FA on an OpenVPN server', () => {
    it('admin user should enable 2FA on server and persist flag', async () => {
      const installPlugin = sinon.stub().resolves();
      const installOpenVPNServerConfigs = sinon.stub().resolves();

      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        installPlugin,
        installOpenVPNServerConfigs,
      } as any);

      sinon.stub(OpenVPN, 'dumpCfg').resolves({ cfg: 'server_config', ccd: '' } as any);

      await request(app.express)
        .put(SERVER_2FA_ROUTE)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnServer.id,
          enabled: true,
        })
        .then(async (response) => {
          expect(response.status).to.equal(204);
          const refreshed = await manager
            .getRepository(OpenVPN)
            .findOneByOrFail({ id: fwcProduct.openvpnServer.id });
          expect(refreshed.tfaEnabled).to.equal(1);
          expect(installPlugin.called).to.equal(true);
          expect(installOpenVPNServerConfigs.called).to.equal(true);
        });
    });

    it('admin user should not disable server 2FA if there are enabled clients', async () => {
      await manager.getRepository(OpenVPN).update(fwcProduct.openvpnServer.id, { tfaEnabled: 1 });
      await manager
        .getRepository(OpenVPN)
        .update(fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id, { tfaEnabled: 1 });

      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        installPlugin: sinon.stub().resolves(),
        installOpenVPNServerConfigs: sinon.stub().resolves(),
      } as any);

      await request(app.express)
        .put(SERVER_2FA_ROUTE)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnServer.id,
          enabled: false,
        })
        .then((response) => {
          expect(response.status).to.equal(400);
          expect(response.body.fwcErr).to.equal(6006);
        });
    });
  });

  describe('enable and disable 2FA on an OpenVPN client', () => {
    it('admin user should return error when server 2FA is disabled', async () => {
      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        installOpenVPNServerConfigs: sinon.stub().resolves(),
        uninstallOpenVPNConfigs: sinon.stub().resolves(),
      } as any);

      await request(app.express)
        .put(CLIENT_2FA_ROUTE)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
          enabled: true,
        })
        .then((response) => {
          expect(response.status).to.equal(400);
          expect(response.body.fwcErr).to.equal(6007);
        });
    });

    it('admin user should enable client 2FA and return TOTP payload', async () => {
      await manager.getRepository(OpenVPN).update(fwcProduct.openvpnServer.id, { tfaEnabled: 1 });

      const installOpenVPNServerConfigs = sinon.stub().resolves();
      const uninstallOpenVPNConfigs = sinon.stub().resolves();

      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        installOpenVPNServerConfigs,
        uninstallOpenVPNConfigs,
      } as any);

      await request(app.express)
        .put(CLIENT_2FA_ROUTE)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
          enabled: true,
        })
        .then(async (response) => {
          expect(response.status).to.equal(200);
          expect(response.body.secret).to.be.a('string');
          expect(response.body.otpauth_url).to.be.a('string');
          expect(response.body.dataURL).to.be.a('string');
          const refreshed = await manager
            .getRepository(OpenVPN)
            .findOneByOrFail({ id: fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id });
          expect(refreshed.tfaEnabled).to.equal(1);
          expect(installOpenVPNServerConfigs.called).to.equal(true);
        });
    });

    it('admin user should disable client 2FA', async () => {
      await manager.getRepository(OpenVPN).update(fwcProduct.openvpnServer.id, { tfaEnabled: 1 });
      await manager
        .getRepository(OpenVPN)
        .update(fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id, { tfaEnabled: 1 });

      const installOpenVPNServerConfigs = sinon.stub().resolves();
      const uninstallOpenVPNConfigs = sinon.stub().resolves();

      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        installOpenVPNServerConfigs,
        uninstallOpenVPNConfigs,
      } as any);

      await request(app.express)
        .put(CLIENT_2FA_ROUTE)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
          enabled: false,
        })
        .then(async (response) => {
          expect(response.status).to.equal(204);
          const refreshed = await manager
            .getRepository(OpenVPN)
            .findOneByOrFail({ id: fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id });
          expect(refreshed.tfaEnabled).to.equal(0);
          expect(uninstallOpenVPNConfigs.called).to.equal(true);
          expect(installOpenVPNServerConfigs.called).to.equal(true);
        });
    });
  });
});
