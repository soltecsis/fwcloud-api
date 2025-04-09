import { Application } from '../../../../../src/Application';
import { User } from '../../../../../src/models/user/User';
import { WireGuardController } from '../../../../../src/routes/vpn/wireguard/wireguard.controller';
import { testSuite } from '../../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import { attachSession, createUser, generateSession } from '../../../../utils/utils';
import { _URL } from '../../../../../src/fonaments/http/router/router.service';
import db from '../../../../../src/database/database-manager';
import request = require('supertest');
import { EntityManager } from 'typeorm';

describe.only('WireGuard E2E Tests', () => {
  let app: Application;
  let loggedUser: User;
  let loggedUserSessionId: string;

  let adminUser: User;
  let adminUserSessionId: string;

  let fwcProduct: FwCloudProduct;
  let manager: EntityManager;

  beforeEach(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();

    loggedUser = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUser);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    fwcProduct = await new FwCloudFactory().make();
    manager = db.getSource().manager;
  });

  describe(WireGuardController.name, () => {
    describe('@store', () => {
      it('guest user should not store a wireguard', async () => {
        return await request(app.express).post(_URL().getURL('vpn.wireguard.store')).expect(401);
      });

      it('regular user which does not belong to the fwcloud should not store a wireguard', async () => {
        return await request(app.express)
          .post(_URL().getURL('vpn.wireguard.store'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            crt: fwcProduct.crts.get('Wireguard-Server').id,
            node_id: 719,
            install_dir: '/tmp',
            install_name: 'test',
            options: [],
          })
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should store a wireguard', async () => {
        loggedUser.fwClouds = [fwcProduct.fwcloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .post(_URL().getURL('vpn.wireguard.store'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            crt: fwcProduct.crts.get('Wireguard-Server').id,
            node_id: 719,
            install_dir: '/tmp',
            install_name: 'test',
            options: [],
          })
          .expect(200);
      });
    });
  });
});
