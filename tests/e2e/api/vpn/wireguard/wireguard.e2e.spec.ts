import { EntityManager } from 'typeorm';
import db from '../../../../../src/database/database-manager';
import { _URL } from '../../../../../src/fonaments/http/router/router.service';
import { User } from '../../../../../src/models/user/User';
import { Crt } from '../../../../../src/models/vpn/pki/Crt';
import { WireGuardService } from '../../../../../src/models/vpn/wireguard/wireguard.service';
import { describeName, testSuite, expect } from '../../../../mocha/global-setup';
import { FwCloudProduct, FwCloudFactory } from '../../../../utils/fwcloud-factory';
import { createUser, generateSession, attachSession } from '../../../../utils/utils';
import { Application } from '../../../../../src/Application';
import { Tree } from '../../../../../src/models/tree/Tree';
import request = require('supertest');
import { WireGuard } from '../../../../../src/models/vpn/wireguard/WireGuard';
import { WireGuardController } from '../../../../../src/routes/vpn/wireguard/wireguard.controller';
import { WireGuardPrefix } from '../../../../../src/models/vpn/wireguard/WireGuardPrefix';
import { WireGuardOption } from '../../../../../src/models/vpn/wireguard/wireguard-option.model';

let app: Application;
let wireGuardService: WireGuardService;
let loggedUser: User;
let loggedUserSessionId: string;
let adminUser: User;
let adminUserSessionId: string;
let fwcProduct: FwCloudProduct;
let nodeId: number;
let manager: EntityManager;

describe(describeName('WireGuard E2E Tests'), () => {
  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    fwcProduct = await new FwCloudFactory().make();

    wireGuardService = await app.getService(WireGuardService.name);

    loggedUser = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUser);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    loggedUser.fwClouds = [fwcProduct.fwcloud];
    adminUser.fwClouds = [fwcProduct.fwcloud];
    await manager.getRepository(User).save([loggedUser, adminUser]);

    await Tree.createAllTreeCloud(fwcProduct.fwcloud);
    await Tree.insertFwc_Tree_New_firewall(fwcProduct.fwcloud.id, 1, fwcProduct.firewall.id);
    const node = (await Tree.getNodeByNameAndType(fwcProduct.fwcloud.id, 'WireGuard', 'WG')) as {
      id: number;
    };
    nodeId = node.id;
  });

  describe(WireGuardController.name, () => {
    describe('@store', async () => {
      let crtId: number;
      beforeEach(async () => {
        crtId = (
          await manager.getRepository(Crt).save(
            manager.getRepository(Crt).create({
              caId: fwcProduct.ca.id,
              cn: 'WireGuard-Server-test',
              days: 1000,
              type: 2,
              comment: 'testComment',
            }),
          )
        ).id;
      });

      it('guest user should not be able to store WireGuard', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.wireguard.store'))
          .send({
            fwcloudId: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            crt: crtId,
            options: [
              {
                name: 'Address',
                arg: '1.1.1.1/24',
                scope: 2,
              },
              {
                name: '<<vpn_network>>',
                arg: '1.1.1.0/24',
                scope: 2,
              },
            ],
            node_id: nodeId,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user wich doest not belong to the fwcloud should not be able to store WireGuard', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.wireguard.store'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            crt: crtId,
            options: [
              {
                name: 'Address',
                arg: '1.1.1.1/24',
                scope: 2,
              },
              {
                name: '<<vpn_network>>',
                arg: '1.1.1.0/24',
                scope: 2,
              },
            ],
            node_id: nodeId,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to store WireGuard', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.wireguard.store'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            crt: crtId,
            options: [
              {
                name: 'Address',
                arg: '1.1.1.1/24',
                scope: 2,
              },
              {
                name: '<<vpn_network>>',
                arg: '1.1.1.0/24',
                scope: 2,
              },
            ],
            node_id: nodeId,
          })
          .then((response) => {
            expect(response.status).to.equal(201);
          });
      });

      it('admin user should be able to store WireGuard', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.wireguard.store'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            crt: crtId,
            options: [
              {
                name: 'Address',
                arg: '1.1.1.1/24',
                scope: 2,
              },
              {
                name: '<<vpn_network>>',
                arg: '1.1.1.0/24',
                scope: 2,
              },
            ],
            node_id: nodeId,
          })
          .then((response) => {
            expect(response.status).to.equal(201);
          });
      });
    });

    describe('@update', async () => {
      let wireguardId: number;
      let crtId: number;

      beforeEach(async () => {
        const crt = await manager.getRepository(Crt).save(
          manager.getRepository(Crt).create({
            caId: fwcProduct.ca.id,
            cn: 'WireGuard-Server-test',
            days: 1000,
            type: 2,
            comment: 'testComment',
          }),
        );
        crtId = crt.id;

        const wireguard = await manager.getRepository(WireGuard).save(
          manager.getRepository(WireGuard).create({
            install_dir: '/tmp',
            install_name: 'test.conf',
            comment: 'created for test',
            status: 1,
            crt: await manager.findOneByOrFail(Crt, { id: crtId }),
            firewall: fwcProduct.firewall,
            public_key: 'dummy',
            private_key: 'dummy',
          }),
        );
        wireguardId = wireguard.id;
      });

      it('guest user should not be able to update WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.update', { id: wireguardId }))
          .send({
            fwcloudId: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            crt: crtId,
            options: [
              {
                name: 'Address',
                arg: '1.1.1.1/24',
                scope: 2,
              },
              {
                name: '<<vpn_network>>',
                arg: '1.1.1.0/24',
                scope: 2,
              },
            ],
            node_id: nodeId,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user wich doest not belong to the fwcloud should not be able to update WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.update', { id: wireguardId }))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            wireguard: wireguardId,
            options: [
              {
                name: 'Address',
                arg: '1.1.1.1/24',
                scope: 2,
              },
              {
                name: '<<vpn_network>>',
                arg: '1.1.1.0/24',
                scope: 2,
              },
            ],
            node_id: nodeId,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to update WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.update', { id: wireguardId }))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            wireguard: wireguardId,
            options: [
              {
                name: 'Address',
                arg: '1.1.1.2/24',
                scope: 2,
              },
            ],
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });

      it('admin user should be able to update WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.update', { id: wireguardId }))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            wireguard: wireguardId,
            options: [
              {
                name: 'Address',
                arg: '1.1.1.2/24',
                scope: 2,
              },
            ],
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });
    });

    describe('@get', async () => {
      it('guest user should not be able to get WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.get'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user wich doest not belong to the fwcloud should not be able to get WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@getFile', async () => {
      it('guest user should not be able to get WireGuard file', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.file.get'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user wich doest not belong to the fwcloud should not be able to get WireGuard file', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.file.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get WireGuard file', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.file.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
      it('admin user should be able to get WireGuard file', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.file.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@getIpObj', async () => {
      it('guest user should not be able to get WireGuard IP object', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.ipobj.get'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user wich doest not belong to the fwcloud should not be able to get WireGuard IP object', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.ipobj.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get WireGuard IP object', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.ipobj.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get WireGuard IP object', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.ipobj.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@getIp', async () => {
      it('guest user should not be able to get WireGuard IP', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.ip.get'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user wich doest not belong to the fwcloud should not be able to get WireGuard IP', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.ip.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get WireGuard IP', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.ip.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get WireGuard IP', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.ip.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@getInfo', async () => {
      it('guest user should not be able to get WireGuard info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.info.get'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user wich doest not belong to the fwcloud should not be able to get WireGuard info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.info.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get WireGuard info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.info.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get WireGuard info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.info.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@delete', async () => {
      beforeEach(async () => {
        await Promise.all(
          Array.from(fwcProduct.wireguardClients.values()).map((client) =>
            manager.getRepository(WireGuard).delete(client.id),
          ),
        );
        await manager.getRepository(WireGuardPrefix).delete(fwcProduct.wireguardPrefix.id);
        await manager.getRepository(WireGuardOption).clear();
      });
      it('guest user should not be able to delete WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.delete'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardClients.get('WireGuard-Cli-1').id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user wich doest not belong to the fwcloud should not be able to delete WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.delete'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to delete WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.delete'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });

      it('admin user should be able to delete WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.delete'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });
    });

    describe('@where', async () => {
      it('guest user should not be able to get WireGuard where', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.where'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user wich doest not belong to the fwcloud should not be able to get WireGuard where', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.where'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get WireGuard where', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.where'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });

      it('admin user should be able to get WireGuard where', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.where'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });
    });

    describe.skip('@install', async () => {
      it('guest user should not be able to install WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.install'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user wich doest not belong to the fwcloud should not be able to install WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.install'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to install WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.install'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to install WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.install'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe.skip('@uninstall', async () => {
      it('guest user should not be able to uninstall WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.uninstall'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user wich doest not belong to the fwcloud should not be able to uninstall WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.uninstall'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to uninstall WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.uninstall'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to uninstall WireGuard', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.uninstall'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@getConfigFilename', async () => {
      it('guest user should not be able to get WireGuard config filename', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.config.filename'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user wich doest not belong to the fwcloud should not be able to get WireGuard config filename', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.config.filename'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get WireGuard config filename', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.config.filename'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get WireGuard config filename', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.config.filename'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@getClientOptions', async () => {
      it('guest user should not be able to get WireGuard client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.client.options.get'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user wich doest not belong to the fwcloud should not be able to get WireGuard client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.client.options.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get WireGuard client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.client.options.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
            wireguard_cli: fwcProduct.wireguardClients.get('WireGuard-Cli-1').id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get WireGuard client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.client.options.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
            wireguard_cli: fwcProduct.wireguardClients.get('WireGuard-Cli-2').id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@updateClientOptions', async () => {
      it('guest user should not be able to update WireGuard client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.client.options.update'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user wich doest not belong to the fwcloud should not be able to update WireGuard client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.client.options.update'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to update WireGuard client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.client.options.update'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
            wireguard_cli: fwcProduct.wireguardClients.get('WireGuard-Cli-1').id,
            options: [],
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to update WireGuard client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.client.options.update'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
            wireguard_cli: fwcProduct.wireguardClients.get('WireGuard-Cli-2').id,
            options: [],
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@getClients', async () => {
      it('guest user should not be able to get WireGuard clients', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.clients.get'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user wich doest not belong to the fwcloud should not be able to get WireGuard clients', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.clients.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get WireGuard clients', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.clients.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get WireGuard clients', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.wireguard.clients.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            wireguard: fwcProduct.wireguardServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });
  });
});
