import { EntityManager } from 'typeorm';
import db from '../../../../../src/database/database-manager';
import { User } from '../../../../../src/models/user/User';
import { Crt } from '../../../../../src/models/vpn/pki/Crt';
import { OpenVPN } from '../../../../../src/models/vpn/openvpn/OpenVPN';
import { OpenVPNOption } from '../../../../../src/models/vpn/openvpn/openvpn-option.model';
import { describeName, testSuite, expect } from '../../../../mocha/global-setup';
import { FwCloudProduct, FwCloudFactory } from '../../../../utils/fwcloud-factory';
import { createUser, generateSession, attachSession } from '../../../../utils/utils';
import { Application } from '../../../../../src/Application';
import request = require('supertest');
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { PgpHelper } from '../../../../../src/utils/pgp';
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
const REGENERATE_2FA_ROUTE = '/vpn/openvpn/2fa/regenerate';

const getOpenVPNCertificateCN = async (openvpnId: number): Promise<string> => {
  const rows = await manager.query(
    `SELECT crt.cn
      FROM openvpn
      INNER JOIN crt ON openvpn.crt = crt.id
      WHERE openvpn.id = ?`,
    [openvpnId],
  );

  return rows[0].cn;
};

const getPersistedOptions = async (
  openvpnId: number,
  optionNames?: string[],
): Promise<Array<{ name: string; arg: string | null }>> => {
  const options = await manager.getRepository(OpenVPNOption).find({
    select: {
      name: true,
      arg: true,
    },
    where: {
      openVPNId: openvpnId,
    },
    order: {
      name: 'ASC',
    },
  });

  return options
    .filter((option) => !optionNames || optionNames.includes(option.name))
    .map((option) => ({ name: option.name, arg: option.arg }));
};

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
    it('admin user should enable 2FA on server and persist flag and options', async () => {
      await manager.getRepository(Firewall).update(fwcProduct.firewall.id, {
        install_communication: 'ssh' as any,
      });

      const installPlugin = sinon.stub().resolves();
      const installOpenVPNServerConfigs = sinon.stub().resolves();
      const ping = sinon.stub().resolves();
      const serverCN = await getOpenVPNCertificateCN(fwcProduct.openvpnServer.id);

      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        installPlugin,
        installOpenVPNServerConfigs,
        ping,
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
          const options = await getPersistedOptions(fwcProduct.openvpnServer.id, [
            'verify-client-cert',
            'script-security',
            'auth-user-pass-optional',
            'auth-user-pass-verify',
            'setenv',
          ]);

          expect(refreshed.tfaEnabled).to.equal(1);
          expect(installPlugin.called).to.equal(true);
          expect(installOpenVPNServerConfigs.called).to.equal(true);
          expect(installPlugin.firstCall.args[0]).to.equal('openvpn-2fa');
          expect(installPlugin.firstCall.args[1]).to.equal(true);
          expect(installOpenVPNServerConfigs.firstCall.args[0]).to.equal('/etc/openvpn');
          expect(installOpenVPNServerConfigs.firstCall.args[1]).to.deep.equal([
            {
              content: '',
              name: `${serverCN}_2fa_users.txt`,
            },
          ]);
          expect(options).to.deep.equal([
            { name: 'auth-user-pass-optional', arg: '' },
            { name: 'auth-user-pass-verify', arg: '/etc/openvpn/bin/check_2fa.sh via-file' },
            { name: 'script-security', arg: '2' },
            { name: 'setenv', arg: `SERVER_CN ${serverCN}` },
            { name: 'verify-client-cert', arg: 'require' },
          ]);
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
          expect(response.body.fwcErr).to.equal(6008);
        });
    });

    it('admin user should disable server 2FA and remove persisted options', async () => {
      await manager.getRepository(Firewall).update(fwcProduct.firewall.id, {
        install_communication: 'ssh' as any,
      });

      const installPlugin = sinon.stub().resolves();
      const installOpenVPNServerConfigs = sinon.stub().resolves();
      const uninstallOpenVPNConfigs = sinon.stub().resolves();
      const ping = sinon.stub().resolves();
      const serverCN = await getOpenVPNCertificateCN(fwcProduct.openvpnServer.id);

      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        installPlugin,
        installOpenVPNServerConfigs,
        uninstallOpenVPNConfigs,
        ping,
      } as any);

      sinon.stub(OpenVPN, 'dumpCfg').resolves({ cfg: 'server_config', ccd: '' } as any);

      await manager.getRepository(OpenVPN).update(fwcProduct.openvpnServer.id, { tfaEnabled: 1 });
      await manager.getRepository(OpenVPNOption).save([
        manager.getRepository(OpenVPNOption).create({
          openVPNId: fwcProduct.openvpnServer.id,
          ipObjId: null,
          name: 'verify-client-cert',
          arg: 'require',
          order: 10,
          scope: 1,
          comment: null,
        }),
        manager.getRepository(OpenVPNOption).create({
          openVPNId: fwcProduct.openvpnServer.id,
          ipObjId: null,
          name: 'script-security',
          arg: '2',
          order: 11,
          scope: 1,
          comment: null,
        }),
        manager.getRepository(OpenVPNOption).create({
          openVPNId: fwcProduct.openvpnServer.id,
          ipObjId: null,
          name: 'auth-user-pass-optional',
          arg: '',
          order: 12,
          scope: 1,
          comment: null,
        }),
        manager.getRepository(OpenVPNOption).create({
          openVPNId: fwcProduct.openvpnServer.id,
          ipObjId: null,
          name: 'auth-user-pass-verify',
          arg: '/etc/openvpn/bin/check_2fa.sh via-file',
          order: 13,
          scope: 1,
          comment: null,
        }),
        manager.getRepository(OpenVPNOption).create({
          openVPNId: fwcProduct.openvpnServer.id,
          ipObjId: null,
          name: 'setenv',
          arg: `SERVER_CN ${serverCN}`,
          order: 14,
          scope: 1,
          comment: null,
        }),
      ]);

      await request(app.express)
        .put(SERVER_2FA_ROUTE)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnServer.id,
          enabled: false,
        })
        .then(async (response) => {
          expect(response.status).to.equal(204);

          const refreshed = await manager
            .getRepository(OpenVPN)
            .findOneByOrFail({ id: fwcProduct.openvpnServer.id });
          const options = await getPersistedOptions(fwcProduct.openvpnServer.id, [
            'verify-client-cert',
            'script-security',
            'auth-user-pass-optional',
            'auth-user-pass-verify',
            'setenv',
          ]);

          expect(refreshed.tfaEnabled).to.equal(0);
          expect(installPlugin.firstCall.args[0]).to.equal('openvpn-2fa');
          expect(installPlugin.firstCall.args[1]).to.equal(false);
          expect(installPlugin.secondCall.args[0]).to.equal('openvpn-2fa');
          expect(installPlugin.secondCall.args[1]).to.equal(false);
          expect(installPlugin.secondCall.args[3]).to.deep.equal({ serverCN });
          expect(uninstallOpenVPNConfigs.firstCall.args[0]).to.equal('/etc/openvpn');
          expect(uninstallOpenVPNConfigs.firstCall.args[1]).to.deep.equal([
            `${serverCN}_2fa_users.txt`,
          ]);
          expect(options).to.deep.equal([]);
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
          expect(response.body.fwcErr).to.equal(6009);
        });
    });

    it('admin user should enable client 2FA and return TOTP payload', async () => {
      await manager.getRepository(OpenVPN).update(fwcProduct.openvpnServer.id, { tfaEnabled: 1 });
      await manager.getRepository(Firewall).update(fwcProduct.firewall.id, {
        install_communication: 'ssh' as any,
      });

      const installOpenVPNServerConfigs = sinon.stub().resolves();
      const uninstallOpenVPNConfigs = sinon.stub().resolves();
      const ping = sinon.stub().resolves();
      const serverCN = await getOpenVPNCertificateCN(fwcProduct.openvpnServer.id);
      const clientCN = await getOpenVPNCertificateCN(
        fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
      );

      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        installOpenVPNServerConfigs,
        uninstallOpenVPNConfigs,
        ping,
      } as any);

      // Stub encryption to return the text as is for easier assertions
      sinon.stub(PgpHelper.prototype, 'encrypt').callsFake(async (text: string) => text);

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
          const options = await getPersistedOptions(
            fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
            ['auth-user-pass'],
          );
          expect(refreshed.tfaEnabled).to.equal(1);
          expect(options).to.deep.equal([{ name: 'auth-user-pass', arg: clientCN }]);
          expect(installOpenVPNServerConfigs.called).to.equal(true);
          expect(installOpenVPNServerConfigs.firstCall.args[0]).to.equal(
            `/etc/openvpn/google-authenticator/${serverCN}`,
          );
          expect(installOpenVPNServerConfigs.firstCall.args[1][0].name).to.equal(`${clientCN}`);
          expect(installOpenVPNServerConfigs.firstCall.args[1][0].content).to.contain(
            '" TOTP_AUTH',
          );
          expect(installOpenVPNServerConfigs.secondCall.args[0]).to.equal('/etc/openvpn');
          expect(installOpenVPNServerConfigs.secondCall.args[1]).to.deep.equal([
            {
              name: `${serverCN}_2fa_users.txt`,
              content: `${clientCN}\n`,
            },
          ]);
        });
    });

    it('admin user should disable client 2FA', async () => {
      await manager.getRepository(OpenVPN).update(fwcProduct.openvpnServer.id, { tfaEnabled: 1 });
      await manager
        .getRepository(OpenVPN)
        .update(fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id, { tfaEnabled: 1 });
      await manager.getRepository(Firewall).update(fwcProduct.firewall.id, {
        install_communication: 'ssh' as any,
      });

      const installOpenVPNServerConfigs = sinon.stub().resolves();
      const uninstallOpenVPNConfigs = sinon.stub().resolves();
      const ping = sinon.stub().resolves();
      const serverCN = await getOpenVPNCertificateCN(fwcProduct.openvpnServer.id);
      const clientCN = await getOpenVPNCertificateCN(
        fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
      );

      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        installOpenVPNServerConfigs,
        uninstallOpenVPNConfigs,
        ping,
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
          const options = await getPersistedOptions(
            fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
            ['auth-user-pass'],
          );
          expect(refreshed.tfaEnabled).to.equal(0);
          expect(options).to.deep.equal([]);
          expect(uninstallOpenVPNConfigs.called).to.equal(true);
          expect(installOpenVPNServerConfigs.called).to.equal(true);
          expect(uninstallOpenVPNConfigs.firstCall.args[0]).to.equal(
            `/etc/openvpn/google-authenticator/${serverCN}`,
          );
          expect(uninstallOpenVPNConfigs.firstCall.args[1]).to.deep.equal([`${clientCN}`]);
          expect(installOpenVPNServerConfigs.firstCall.args[0]).to.equal('/etc/openvpn');
          expect(installOpenVPNServerConfigs.firstCall.args[1]).to.deep.equal([
            {
              name: `${serverCN}_2fa_users.txt`,
              content: '\n',
            },
          ]);
        });
    });
  });

  describe('regenerate 2FA secret', () => {
    it('guest user should not regenerate 2FA secret', async () => {
      await request(app.express)
        .put(REGENERATE_2FA_ROUTE)
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
        })
        .then((response) => {
          expect(response.status).to.equal(401);
        });
    });

    it('admin user should return error when the OpenVPN is not a client', async () => {
      sinon.stub(Firewall.prototype, 'getCommunication').resolves({} as any);

      await request(app.express)
        .put(REGENERATE_2FA_ROUTE)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnServer.id,
        })
        .then((response) => {
          expect(response.status).to.equal(400);
          expect(response.body.fwcErr).to.equal(6002);
        });
    });

    it('admin user should return error when parent server not found', async () => {
      sinon.stub(Firewall.prototype, 'getCommunication').resolves({} as any);

      // Create a client without parent server
      const clientCrt = await manager.getRepository(Crt).save(
        manager.getRepository(Crt).create({
          caId: fwcProduct.ca.id,
          cn: 'OpenVPN-Cli-Orphan',
          days: 1000,
          type: 1,
        }),
      );

      const orphanClient = await manager.getRepository(OpenVPN).save(
        manager.getRepository(OpenVPN).create({
          parentId: null, // No parent server
          firewallId: fwcProduct.firewall.id,
          crtId: clientCrt.id,
          tfaEnabled: 0,
        }),
      );

      await request(app.express)
        .put(REGENERATE_2FA_ROUTE)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: orphanClient.id,
        })
        .then((response) => {
          expect(response.status).to.equal(400);
          expect(response.body.msg).to.include('OpenVPN parent server not found');
        });
    });

    it('admin user should regenerate 2FA secret when secret is provided', async () => {
      sinon.stub(Firewall.prototype, 'getCommunication').resolves({} as any);
      sinon.stub(PgpHelper.prototype, 'encrypt').callsFake(async (text: string) => text);

      await request(app.express)
        .put(REGENERATE_2FA_ROUTE)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
          secret: 'JBSWY3DPEBLW64TMMQ======',
        })
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.secret).to.be.a('string');
          expect(response.body.otpauth_url).to.be.a('string');
          expect(response.body.dataURL).to.be.a('string');
        });
    });

    it('admin user should regenerate 2FA secret by reading from remote firewall', async () => {
      const readOpenVPNFile = sinon
        .stub()
        .resolves('JBSWY3DPEBLW64TMMQ======\n"TOTP_AUTH\n"WINDOW_SIZE 3');
      const serverCN = await getOpenVPNCertificateCN(fwcProduct.openvpnServer.id);
      const clientCN = await getOpenVPNCertificateCN(
        fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
      );

      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        readOpenVPNFile,
      } as any);

      sinon.stub(PgpHelper.prototype, 'encrypt').callsFake(async (text: string) => text);

      await request(app.express)
        .put(REGENERATE_2FA_ROUTE)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
        })
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.secret).to.be.a('string');
          expect(response.body.otpauth_url).to.be.a('string');
          expect(response.body.dataURL).to.be.a('string');
          expect(readOpenVPNFile.called).to.equal(true);
          expect(readOpenVPNFile.firstCall.args[0]).to.equal(
            `/etc/openvpn/google-authenticator/${serverCN}`,
          );
          expect(readOpenVPNFile.firstCall.args[1]).to.equal(`${clientCN}`);
        });
    });

    it('admin user should return error when TOTP secret is not found remotely', async () => {
      const readOpenVPNFile = sinon.stub().resolves('"TOTP_AUTH\n"WINDOW_SIZE 3');

      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        readOpenVPNFile,
      } as any);

      await request(app.express)
        .put(REGENERATE_2FA_ROUTE)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          openvpn: fwcProduct.openvpnClients.get('OpenVPN-Cli-1').id,
        })
        .then((response) => {
          expect(response.status).to.equal(400);
          expect(response.body.msg).to.include('TOTP secret not found');
        });
    });
  });
});
