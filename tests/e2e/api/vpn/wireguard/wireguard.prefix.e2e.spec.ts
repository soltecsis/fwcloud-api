import { EntityManager } from 'typeorm';
import { Application } from '../../../../../src/Application';
import { User } from '../../../../../src/models/user/User';
import { WireGuardPrefixService } from '../../../../../src/models/vpn/wireguard/wireguard-prefix.service';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import { describeName, expect, testSuite } from '../../../../mocha/global-setup';
import db from '../../../../../src/database/database-manager';
import { attachSession, createUser, generateSession } from '../../../../utils/utils';
import { WireGuardPrefixController } from '../../../../../src/routes/vpn/wireguard/wireguard.prefix.controller';
import { _URL } from '../../../../../src/fonaments/http/router/router.service';
import request = require('supertest');
import { Tree } from '../../../../../src/models/tree/Tree';

let app: Application;
let wireGuardPrefixService: WireGuardPrefixService;
let loggedUSer: User;
let loggedUserSessionId: string;
let adminUser: User;
let adminUserSessionId: string;
let fwcProduct: FwCloudProduct;
let manager: EntityManager;

describe.only(describeName('Wireguard Prefix E2E Tests'), () => {
  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    fwcProduct = await new FwCloudFactory().make();

    wireGuardPrefixService = await app.getService(WireGuardPrefixService.name);

    loggedUSer = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUSer);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    loggedUSer.fwClouds = [fwcProduct.fwcloud];
    adminUser.fwClouds = [fwcProduct.fwcloud];
    await manager.getRepository(User).save([loggedUSer, adminUser]);

    await Tree.createAllTreeCloud(fwcProduct.fwcloud);
    await Tree.insertFwc_Tree_New_firewall(fwcProduct.fwcloud.id, 1, fwcProduct.firewall.id);
    const node = (await Tree.getNodeByNameAndType(fwcProduct.fwcloud.id, 'WireGuard', 'WG')) as {
      id: number;
    };
  });

  describe(WireGuardPrefixController.name, () => {
    describe('@prefix', () => {
      it('guest user should not be able to create a prefix', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.wireguard.prefix'))
          .send({
            name: 'test',
            wireguard: fwcProduct.wireguardServer.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((res) => {
            expect(res.status).to.equal(401);
          });
      });

      it('user should not be able to create a prefix', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.wireguard.prefix'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            name: 'test',
            wireguard: fwcProduct.wireguardServer.id,
            fwcloud: 99999,
          })
          .then((res) => {
            expect(res.status).to.equal(400);
          });
      });

      it('regular user should be able to create a prefix', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.wireguard.prefix'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            name: 'test',
            wireguard: fwcProduct.wireguardServer.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((res) => {
            expect(res.status).to.equal(200);
          });
      });

      it('admin user should be able to create a prefix', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.wireguard.prefix'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            name: 'test',
            wireguard: fwcProduct.wireguardServer.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((res) => {
            expect(res.status).to.equal(200);
          });
      });
    });

    describe.skip('@update', () => {
      it('guest user should not be able to update a prefix', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.prefix.update'))
          .send({
            name: 'test',
            wireguard: fwcProduct.wireguardServer.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((res) => {
            expect(res.status).to.equal(401);
          });
      });

      it('user should not be able to update a prefix', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.prefix.update'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            name: 'test',
            wireguard: fwcProduct.wireguardServer.id,
            fwcloud: 99999,
          })
          .then((res) => {
            expect(res.status).to.equal(400);
          });
      });

      it('regular user should be able to update a prefix', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.prefix.update'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            name: 'test',
            wireguard: fwcProduct.wireguardServer.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((res) => {
            expect(res.status).to.equal(200);
          });
      });

      it('admin user should be able to update a prefix', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.prefix.update'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            name: 'test',
            wireguard: fwcProduct.wireguardServer.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((res) => {
            expect(res.status).to.equal(200);
          });
      });
    });

    describe('@getInfo', () => {
      it('guest user should not be able to get prefix info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.prefix.info.get'))
          .send({
            prefix: fwcProduct.wireguardPrefix.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((res) => {
            expect(res.status).to.equal(401);
          });
      });

      it('user should not be able to get prefix info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.prefix.info.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            prefix: fwcProduct.wireguardPrefix.id,
            fwcloud: 99999,
          })
          .then((res) => {
            expect(res.status).to.equal(400);
          });
      });

      it('regular user should be able to get prefix info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.prefix.info.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            prefix: fwcProduct.wireguardPrefix.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((res) => {
            expect(res.status).to.equal(200);
          });
      });

      it('admin user should be able to get prefix info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.prefix.info.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            prefix: fwcProduct.wireguardPrefix.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((res) => {
            expect(res.status).to.equal(200);
          });
      });
    });
  });
});
