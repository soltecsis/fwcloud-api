import { EntityManager } from 'typeorm';
import db from '../../../../../src/database/database-manager';
import { _URL } from '../../../../../src/fonaments/http/router/router.service';
import { User } from '../../../../../src/models/user/User';
import { IPSecService } from '../../../../../src/models/vpn/ipsec/ipsec.service';
import { describeName, testSuite, expect } from '../../../../mocha/global-setup';
import { FwCloudProduct, FwCloudFactory } from '../../../../utils/fwcloud-factory';
import { createUser, generateSession, attachSession } from '../../../../utils/utils';
import { Application } from '../../../../../src/Application';
import { Tree } from '../../../../../src/models/tree/Tree';
import request = require('supertest');
import { IPSecController } from '../../../../../src/routes/vpn/ipsec/ipsec.controller';
import { Crt } from '../../../../../src/models/vpn/pki/Crt';
import { IPSec } from '../../../../../src/models/vpn/ipsec/IPSec';
import sinon from 'sinon';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { Communication } from '../../../../../src/communications/communication';

let app: Application;
let ipsecService: IPSecService;
let loggedUser: User;
let loggedUserSessionId: string;
let adminUser: User;
let adminUserSessionId: string;
let fwcProduct: FwCloudProduct;
let nodeId: number;
let manager: EntityManager;

describe(describeName('IPSec E2E Tests'), () => {
  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    fwcProduct = await new FwCloudFactory().make();

    ipsecService = await app.getService(IPSecService.name);

    loggedUser = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUser);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    loggedUser.fwClouds = [fwcProduct.fwcloud];
    adminUser.fwClouds = [fwcProduct.fwcloud];
    await manager.getRepository(User).save([loggedUser, adminUser]);

    await Tree.createAllTreeCloud(fwcProduct.fwcloud);
    await Tree.insertFwc_Tree_New_firewall(fwcProduct.fwcloud.id, 1, fwcProduct.firewall.id);
    const node = (await Tree.getNodeByNameAndType(fwcProduct.fwcloud.id, 'IPsec', 'IS')) as {
      id: number;
    };
    nodeId = node.id;
  });

  describe(IPSecController.name, () => {
    describe('@store', async () => {
      let crtId: number;
      beforeEach(async () => {
        crtId = (
          await manager.getRepository(Crt).save(
            manager.getRepository(Crt).create({
              caId: fwcProduct.ca.id,
              cn: 'IPSec-Server-test',
              days: 1000,
              type: 2,
              comment: 'testComment',
            }),
          )
        ).id;
      });

      it('guest user should not be able to store IPsec', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.ipsec.store'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            crt: crtId,
            options: [
              {
                name: 'left',
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

      it('regular user which does not belong to the fwcloud should not be able to store IPsec', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.ipsec.store'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            crt: crtId,
            options: [
              {
                name: 'left',
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

      it('regular user should be able to store IPSec', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.ipsec.store'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            crt: crtId,
            options: [
              {
                name: 'left',
                arg: '1.1.1.1/24',
                scope: 2,
              },
              {
                name: 'leftsubnet',
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

      it('admin user should be able to store IPSec', async () => {
        await request(app.express)
          .post(_URL().getURL('vpn.ipsec.store'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            crt: crtId,
            options: [
              {
                name: 'left',
                arg: '1.1.1.1/24',
                scope: 2,
              },
              {
                name: 'leftsubnet',
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

    describe('@install', async () => {
      let installStub: sinon.SinonStub;

      beforeEach(async () => {
        // Stub of getCommunication to return a fake install method
        sinon.stub(Firewall.prototype, 'getCommunication').callsFake(async () => {
          installStub = sinon.stub().resolves();
          const mockCommunication = {
            installIPSecServerConfigs: installStub,
          } as unknown as Communication<unknown>;

          return mockCommunication;
        });
      });

      afterEach(() => {
        sinon.restore();
      });

      it('guest user should not be able to uninstall IPsec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.install'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to install IPsec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.install'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to install IPSec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.install'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            ipsec: fwcProduct.ipsecClients.get('IPSec-Cli-1').id,
            sshuser: '',
            sshpass: '',
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to install IPSec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.install'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            ipsec: fwcProduct.ipsecClients.get('IPSec-Cli-1').id,
            sshuser: '',
            sshpass: '',
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@uninstall', async () => {
      let uninstallStub: sinon.SinonStub;

      beforeEach(async () => {
        // Create an install_dir and install_name for the IPSec server
        const req: any = {
          dbCon: db.getQuery(),
          body: {
            install_dir: '/tmp',
            install_name: 'install_uninstall_test',
            comment: '',
            ipsec: fwcProduct.ipsecServer.id,
          },
        };
        await IPSec.updateCfg(req);

        // Stub of getCommunication to return a fake uninstall method
        sinon.stub(Firewall.prototype, 'getCommunication').callsFake(async () => {
          uninstallStub = sinon.stub().resolves();
          const mockCommunication = {
            uninstallIPSecConfigs: uninstallStub,
          } as unknown as Communication<unknown>;

          return mockCommunication;
        });
      });

      afterEach(() => {
        sinon.restore();
      });

      it('guest user should not be able to uninstall IPsec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.uninstall'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to uninstall IPsec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.uninstall'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to uninstall IPSec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.uninstall'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            ipsec: fwcProduct.ipsecServer.id,
            sshuser: '',
            sshpass: '',
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to uninstall IPSec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.uninstall'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            ipsec: fwcProduct.ipsecServer.id,
            sshuser: '',
            sshpass: '',
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@update', async () => {
      let ipsecId: number;
      let crtId: number;

      beforeEach(async () => {
        const crt = await manager.getRepository(Crt).save(
          manager.getRepository(Crt).create({
            caId: fwcProduct.ca.id,
            cn: 'IPSec-Server-test',
            days: 1000,
            type: 2,
            comment: 'testComment',
          }),
        );
        crtId = crt.id;

        const ipsec = await manager.getRepository(IPSec).save(
          manager.getRepository(IPSec).create({
            install_dir: '/tmp',
            install_name: 'test.conf',
            comment: 'created for test',
            status: 1,
            crt: await manager.findOneByOrFail(Crt, { id: crtId }),
            firewall: fwcProduct.firewall,
          }),
        );
        ipsecId = ipsec.id;
      });

      it('guest user should not be able to update IPsec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.update', { id: ipsecId }))
          .send({
            fwcloudId: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            crt: crtId,
            options: [
              {
                name: 'left',
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

      it('regular user which does not belong to the fwcloud should not be able to update IPsec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.update', { id: ipsecId }))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            ipsec: fwcProduct.ipsecServer.id,
            options: [
              {
                name: 'left',
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

      it('regular user should be able to update IPSec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.update', { id: ipsecId }))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            ipsec: fwcProduct.ipsecServer.id,
            options: [
              {
                name: 'left',
                arg: '1.1.1.2/24',
                scope: 2,
              },
            ],
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });

      it('admin user should be able to update IPSec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.update', { id: ipsecId }))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            ipsec: fwcProduct.ipsecServer.id,
            options: [
              {
                name: 'left',
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
      it('guest user should not be able to get IPsec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.get'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to get IPsec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get IPSec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get IPSec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@getFile', async () => {
      it('guest user should not be able to get IPsec file', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.file.get'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to get IPsec file', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.file.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get IPSec file', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.file.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get IPSec file', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.file.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@getIpObj', async () => {
      it('guest user should not be able to get IPsec IP object', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.ipobj.get'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to get IPsec IP object', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.ipobj.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get IPSec IP object', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.ipobj.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get IPSec IP object', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.ipobj.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@getIp', async () => {
      it('guest user should not be able to get IPsec IP', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.ip.get'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to get IPsec IP', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.ip.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get IPSec IP', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.ip.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get IPSec IP', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.ip.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@getInfo', async () => {
      it('guest user should not be able to get IPsec info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.info.get'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to get IPsec info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.info.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get IPSec info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.info.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get IPSec info', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.info.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe.skip('@getFirewall', async () => {
      it('guest user should not be able to get IPsec firewall', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.firewall.get'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to get IPsec firewall', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.firewall.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            firewall: fwcProduct.firewall.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get IPSec firewall', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.firewall.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get IPSec firewall', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.firewall.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@delete', async () => {
      it('guest user should not be able to delete IPsec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.delete'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecClients.get('IPSec-Cli-1').id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to delete IPsec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.delete'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            ipsec: fwcProduct.ipsecClients.get('IPSec-Cli-1').id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to delete IPSec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.delete'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecClients.get('IPSec-Cli-1').id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });

      it('admin user should be able to delete IPSec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.delete'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecClients.get('IPSec-Cli-1').id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });
    });

    describe('@restricted', async () => {
      it('guest user should not be able to access restricted IPSec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.restrictions'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to access restricted IPSec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.restrictions'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to access restricted IPSec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.restrictions'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecClients.get('IPSec-Cli-1').id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });

      it('admin user should be able to access restricted IPSec', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.restrictions'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecClients.get('IPSec-Cli-1').id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });
    });

    describe('@where', async () => {
      it('guest user should not be able to get IPsec usage', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.where'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to get IPsec usage', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.where'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get IPSec usage', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.where'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });

      it('admin user should be able to get IPSec usage', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.where'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });
    });

    describe('@getConfigFilename', async () => {
      it('guest user should not be able to get IPsec config filename', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.config.filename'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to get IPsec config filename', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.config.filename'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get IPsec config filename', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.config.filename'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get IPsec config filename', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.config.filename'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@getClients', async () => {
      it('guest user should not be able to get IPsec clients', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.clients.get'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to get IPsec clients', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.clients.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get IPSec clients', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.clients.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get IPSec clients', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.clients.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@getClientOptions', async () => {
      beforeEach(async () => {
        // Add a option to the client
        const req: any = {
          dbCon: db.getQuery(),
        };
        const opt = {
          ipsec: fwcProduct.ipsecServer.id,
          ipsec_cli: fwcProduct.ipsecClients.get('IPSec-Cli-1').id,
          name: 'rightsubnet',
          arg: '10.0.0.0/24',
          comment: 'Test option',
          order: 1,
          scope: 2,
        };
        await IPSec.addCfgOpt(req, opt);
      });

      it('guest user should not be able to get IPsec client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.client.options.get'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to get IPsec client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.client.options.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to get IPSec client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.client.options.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
            ipsec_cli: fwcProduct.ipsecClients.get('IPSec-Cli-1').id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });

      it('admin user should be able to get IPSec client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.client.options.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
            ipsec_cli: fwcProduct.ipsecClients.get('IPSec-Cli-1').id,
          })
          .then((response) => {
            expect(response.status).to.equal(200);
          });
      });
    });

    describe('@updateClientOptions', async () => {
      it('guest user should not be able to update IPsec client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.client.options.update'))
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(401);
          });
      });

      it('regular user which does not belong to the fwcloud should not be able to update IPsec client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.client.options.update'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: 99999,
            ipsec: fwcProduct.ipsecServer.id,
          })
          .then((response) => {
            expect(response.status).to.equal(400);
          });
      });

      it('regular user should be able to update IPSec client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.client.options.update'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
            ipsec_cli: fwcProduct.ipsecClients.get('IPSec-Cli-1').id,
            options: [],
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });

      it('admin user should be able to update IPSec client options', async () => {
        await request(app.express)
          .put(_URL().getURL('vpn.ipsec.client.options.update'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: fwcProduct.ipsecServer.id,
            ipsec_cli: fwcProduct.ipsecClients.get('IPSec-Cli-1').id,
            options: [],
          })
          .then((response) => {
            expect(response.status).to.equal(204);
          });
      });
    });
  });
});
