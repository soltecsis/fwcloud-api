import { EntityManager } from 'typeorm';
import { Application } from '../../../../../src/Application';
import { User } from '../../../../../src/models/user/User';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import { describeName, expect, testSuite } from '../../../../mocha/global-setup';
import db from '../../../../../src/database/database-manager';
import { attachSession, createUser, generateSession } from '../../../../utils/utils';
import { IPSecPrefixController } from '../../../../../src/routes/vpn/ipsec/ipsec.prefix.controller';
import { _URL } from '../../../../../src/fonaments/http/router/router.service';
import request = require('supertest');
import { Tree } from '../../../../../src/models/tree/Tree';
import { IPSecPrefixService } from '../../../../../src/models/vpn/ipsec/ipsec-prefix.service';

let app: Application;
let ipsecPrefixService: IPSecPrefixService;
let loggedUser: User;
let loggedUserSessionId: string;
let adminUser: User;
let adminUserSessionId: string;
let fwcProduct: FwCloudProduct;
let manager: EntityManager;

describe(describeName('IPSec Prefix E2E Tests'), () => {
  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    fwcProduct = await new FwCloudFactory().make();

    ipsecPrefixService = await app.getService(IPSecPrefixService.name);

    loggedUser = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUser);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    loggedUser.fwClouds = [fwcProduct.fwcloud];
    adminUser.fwClouds = [fwcProduct.fwcloud];
    await manager.getRepository(User).save([loggedUser, adminUser]);

    await Tree.createAllTreeCloud(fwcProduct.fwcloud);
    await Tree.insertFwc_Tree_New_firewall(fwcProduct.fwcloud.id, 1, fwcProduct.firewall.id);
    const node = (await Tree.getNodeByNameAndType(fwcProduct.fwcloud.id, 'IPSec', 'IS')) as {
      id: number;
    };
  });

  describe(IPSecPrefixController.name, () => {
    describe('@prefix', () => {
      it('guest user should not be able to create a prefix', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.ipsec.prefix'))
          .send({
            name: 'test',
            ipsec: fwcProduct.ipsecServer.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to create a prefix', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.ipsec.prefix'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            name: 'test',
            ipsec: fwcProduct.ipsecServer.id,
            fwcloud: 99999,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to create a prefix', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.ipsec.prefix'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            name: 'test',
            ipsec: fwcProduct.ipsecServer.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to create a prefix', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.ipsec.prefix'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            name: 'test',
            ipsec: fwcProduct.ipsecServer.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@update', () => {
      it('guest user should not be able to update a prefix', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.update'))
          .send({
            name: 'test',
            ipsec: fwcProduct.ipsecServer.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to update a prefix', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.update'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            name: 'test',
            ipsec: fwcProduct.ipsecServer.id,
            fwcloud: 99999,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to update a prefix', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.update'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            name: 'Wi',
            ipsec: fwcProduct.ipsecServer.id,
            fwcloud: fwcProduct.fwcloud.id,
            prefix: fwcProduct.ipsecPrefix.id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });

      it('admin user should be able to update a prefix', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.update'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            name: 'Wi',
            ipsec: fwcProduct.ipsecServer.id,
            fwcloud: fwcProduct.fwcloud.id,
            prefix: fwcProduct.ipsecPrefix.id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });
    });

    describe('@getInfo', () => {
      it('guest user should not be able to get prefix info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.info.get'))
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to get prefix info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.info.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: 99999,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get prefix info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.info.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get prefix info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.info.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@restricted', () => {
      it('guest user should not be able to access restricted endpoint', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.restrictions'))
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to access restricted endpoint', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.restrictions'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: 99999,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to access restricted endpoint', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.restrictions'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });

      it('admin user should be able to access restricted endpoint', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.restrictions'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });
    });

    describe('@where', () => {
      it('guest user should not be able to get prefix usage', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.where'))
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to get prefix usage', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.where'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: 99999,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get prefix usage', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.where'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });

      it('admin user should be able to get prefix usage', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.where'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });
    });

    describe('@delete', () => {
      it('guest user should not be able to delete a prefix', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.del'))
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to delete a prefix', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.del'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: 99999,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to delete a prefix', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.del'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });

      it('admin user should be able to delete a prefix', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.prefix.del'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            prefix: fwcProduct.ipsecPrefix.id,
            fwcloud: fwcProduct.fwcloud.id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });
    });
  });
});
