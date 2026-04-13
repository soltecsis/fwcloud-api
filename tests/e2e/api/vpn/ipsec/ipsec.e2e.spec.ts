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
import path from 'path';
import fs from 'fs';

let app: Application;
let ipsecService: IPSecService;
let loggedUser: User;
let loggedUserSessionId: string;
let adminUser: User;
let adminUserSessionId: string;
let fwcProduct: FwCloudProduct;
let nodeId: number;
let manager: EntityManager;

describe.only(describeName('IPSec E2E Tests'), () => {
  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    fwcProduct = await new FwCloudFactory().make();

    const basePkiDir = path.join('tests', 'playground', 'DATA', 'pki');
    const caDir = path.join(basePkiDir, String(fwcProduct.fwcloud.id), String(fwcProduct.ca.id));
    fs.mkdirSync(path.join(caDir, 'private'), { recursive: true });
    fs.mkdirSync(path.join(caDir, 'issued'), { recursive: true });
    const dummyCert = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n';
    const dummyKey = '-----BEGIN PRIVATE KEY-----\nMIIC\n-----END PRIVATE KEY-----\n';
    fs.writeFileSync(path.join(caDir, 'ca.crt'), dummyCert);
    for (const crt of Array.from(fwcProduct.crts.values())) {
      if (crt.cn.startsWith('IPSec')) {
        fs.writeFileSync(path.join(caDir, 'private', `${crt.cn}.key`), dummyKey);
        fs.writeFileSync(path.join(caDir, 'issued', `${crt.cn}.crt`), dummyCert);
      }
    }

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
    const node = (await Tree.getNodeByNameAndType(
      fwcProduct.fwcloud.id,
      'IPSec-Server',
      'ISS',
    )) as { id: number };
    nodeId = node.id;
  });

  describe(IPSecController.name, () => {
    const unlockFwcloud = async () => {
      await manager.query(
        'UPDATE fwcloud SET locked = 0, locked_by = NULL, locked_at = NULL WHERE id = ?',
        [fwcProduct.fwcloud.id],
      );
    };

    const getOnlyClientNodes = async (ipsecOnlyClientId: number) =>
      (await Tree.getNodeInfo(
        db.getQuery(),
        fwcProduct.fwcloud.id,
        'ISCNS',
        ipsecOnlyClientId,
      )) as Array<{ id: number; id_parent: number }>;

    const assertIPSecClientWithoutServerCreated = async (
      ipsecOnlyClientId: number,
      rootNodeId: number,
    ) => {
      const createdOnlyClientNodes = await getOnlyClientNodes(ipsecOnlyClientId);
      expect(createdOnlyClientNodes).to.have.length(1);
      expect(createdOnlyClientNodes[0].id_parent).to.equal(rootNodeId);

      const createdOnlyClient = await manager.getRepository(IPSec).findOne({
        where: { id: ipsecOnlyClientId },
      });
      expect(createdOnlyClient).to.exist;
      expect(createdOnlyClient.parentId).to.equal(null);
      expect(createdOnlyClient.crtId).to.equal(null);
    };

    const assertIPSecClientWithoutServerDeleted = async (ipsecOnlyClientId: number) => {
      const deletedIPSec = await manager.getRepository(IPSec).findOne({
        where: { id: ipsecOnlyClientId },
      });
      expect(deletedIPSec).to.not.exist;

      const deletedOnlyClientNodes = (await Tree.getNodeInfo(
        db.getQuery(),
        fwcProduct.fwcloud.id,
        'ISCNS',
        ipsecOnlyClientId,
      )) as Array<{ id: number }>;
      expect(deletedOnlyClientNodes).to.have.length(0);
    };

    const createIPSecClientWithoutServer = async (
      sessionId: string,
      name = 'IPSec-Only-Client-Test',
    ) => {
      const rootNode = (await Tree.getNodeUnderFirewall(
        db.getQuery(),
        fwcProduct.fwcloud.id,
        fwcProduct.firewall.id,
        'IS',
      )) as { id: number };

      const storeResponse = await request(app.express)
        .post(_URL().getURL('vpn.ipsec.store'))
        .set('Cookie', [attachSession(sessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          firewall: fwcProduct.firewall.id,
          node_id: rootNode.id,
          name,
          options: [],
        });

      expect(storeResponse.status).to.equal(201);
      const ipsecOnlyClientId = storeResponse.body.data?.insertId;
      expect(ipsecOnlyClientId).to.be.a('number');
      await assertIPSecClientWithoutServerCreated(ipsecOnlyClientId, rootNode.id);

      return { ipsecOnlyClientId: ipsecOnlyClientId as number };
    };

    describe('@store', async () => {
      let crtId: number;
      beforeEach(async () => {
        crtId = (
          await manager.getRepository(Crt).save(
            manager.getRepository(Crt).create({
              caId: fwcProduct.ca.id,
              cn: 'IPSec-Client-test',
              days: 1000,
              type: 1,
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
            ipsec: fwcProduct.ipsecServer.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            crt: crtId,
            options: [
              {
                name: 'right',
                arg: '10.0.0.1',
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
            ipsec: fwcProduct.ipsecServer.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            crt: crtId,
            options: [
              {
                name: 'right',
                arg: '10.0.0.1',
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
            ipsec: fwcProduct.ipsecServer.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            crt: crtId,
            options: [
              {
                name: 'right',
                arg: '10.0.0.1',
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
            ipsec: fwcProduct.ipsecServer.id,
            install_dir: '/tmp',
            install_name: 'test.conf',
            crt: crtId,
            options: [
              {
                name: 'right',
                arg: '10.0.0.1',
                scope: 2,
              },
            ],
            node_id: nodeId,
          })
          .then((response) => {
            expect(response.status).to.equal(201);
          });
      });

      it('regular user should be able to store IPSec client without server', async () => {
        await createIPSecClientWithoutServer(loggedUserSessionId);
      });

      it('admin user should be able to store IPSec client without server', async () => {
        await createIPSecClientWithoutServer(adminUserSessionId);
      });
    });

    describe('@install', async () => {
      let installStub: sinon.SinonStub;
      let uninstallStub: sinon.SinonStub;

      beforeEach(async () => {
        // Stub of getCommunication to return a fake install method
        sinon.stub(Firewall.prototype, 'getCommunication').callsFake(async () => {
          installStub = sinon.stub().resolves();
          uninstallStub = sinon.stub().resolves();
          const mockCommunication = {
            installIPSecServerConfigs: installStub,
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

      it('should generate ipsec.secrets with all clients without server in the same firewall', async () => {
        await unlockFwcloud();
        const { ipsecOnlyClientId: firstClientId } = await createIPSecClientWithoutServer(
          loggedUserSessionId,
          'IPSec-Only-Client-Secrets-Install-1',
        );
        await unlockFwcloud();
        const { ipsecOnlyClientId: secondClientId } = await createIPSecClientWithoutServer(
          loggedUserSessionId,
          'IPSec-Only-Client-Secrets-Install-2',
        );
        await unlockFwcloud();

        await IPSec.updateCfg({
          dbCon: db.getQuery(),
          body: {
            ipsec: firstClientId,
            name: 'IPSec-Only-Client-Secrets-Install-1',
            install_dir: '/tmp',
            install_name: 'ipsec-only-client-secrets-install.conf',
            comment: '',
          },
        } as any);
        await IPSec.updateCfg({
          dbCon: db.getQuery(),
          body: {
            ipsec: secondClientId,
            name: 'IPSec-Only-Client-Secrets-Install-2',
            install_dir: '/tmp',
            install_name: 'ipsec-only-client-secrets-install-2.conf',
            comment: '',
          },
        } as any);

        const optReq: any = { dbCon: db.getQuery() };
        await IPSec.addCfgOpt(optReq, {
          ipsec: firstClientId,
          ipsec_cli: null,
          name: 'leftid',
          arg: 'left-install-id',
          comment: null,
          order: 1,
          scope: 2,
        });
        await IPSec.addCfgOpt(optReq, {
          ipsec: firstClientId,
          ipsec_cli: null,
          name: 'rightid',
          arg: 'right-install-id',
          comment: null,
          order: 2,
          scope: 2,
        });
        await IPSec.addCfgOpt(optReq, {
          ipsec: firstClientId,
          ipsec_cli: null,
          name: '<<psk>>',
          arg: 'psk-first-client',
          comment: null,
          order: 3,
          scope: 2,
        });

        await IPSec.addCfgOpt(optReq, {
          ipsec: secondClientId,
          ipsec_cli: null,
          name: 'right',
          arg: '1.1.1.1',
          comment: null,
          order: 1,
          scope: 2,
        });
        await IPSec.addCfgOpt(optReq, {
          ipsec: secondClientId,
          ipsec_cli: null,
          name: '<<psk>>',
          arg: 'psk-second-client',
          comment: null,
          order: 2,
          scope: 2,
        });
        await unlockFwcloud();

        const response = await request(app.express)
          .put(_URL().getURL('vpn.ipsec.install'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            ipsec: secondClientId,
            sshuser: '',
            sshpass: '',
          });

        expect(response.status).to.equal(200);
        expect(response.body.data?.installName).to.equal('ipsec-only-client-secrets-install.conf');

        const cfgCall = installStub
          .getCalls()
          .find(
            (call) =>
              Array.isArray(call.args[1]) &&
              call.args[1].some(
                (file: { name: string }) => file.name === 'ipsec-only-client-secrets-install.conf',
              ),
          );
        expect(cfgCall).to.exist;

        const secretsCall = installStub
          .getCalls()
          .find(
            (call) =>
              Array.isArray(call.args[1]) &&
              call.args[1].some((file: { name: string }) => file.name === 'ipsec.secrets'),
          );

        expect(secretsCall).to.exist;
        const secretFile = (secretsCall as sinon.SinonSpyCall).args[1].find(
          (file: { name: string }) => file.name === 'ipsec.secrets',
        );
        expect(secretFile).to.exist;
        expect(secretFile.content).to.equal(
          `'left-install-id' 'right-install-id' : PSK "psk-first-client"\n1.1.1.1 : PSK "psk-second-client"\n`,
        );
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

      it('should uninstall ipsec.secrets for IPSec client without server', async () => {
        await unlockFwcloud();
        const { ipsecOnlyClientId: firstClientId } = await createIPSecClientWithoutServer(
          loggedUserSessionId,
          'IPSec-Only-Client-Uninstall-Secrets-1',
        );
        await unlockFwcloud();
        const { ipsecOnlyClientId: secondClientId } = await createIPSecClientWithoutServer(
          loggedUserSessionId,
          'IPSec-Only-Client-Uninstall-Secrets-2',
        );
        await unlockFwcloud();

        await IPSec.updateCfg({
          dbCon: db.getQuery(),
          body: {
            ipsec: firstClientId,
            name: 'IPSec-Only-Client-Uninstall-Secrets-1',
            install_dir: '/tmp',
            install_name: 'ipsec-only-client-uninstall-secrets-1.conf',
            comment: '',
          },
        } as any);
        await IPSec.updateCfg({
          dbCon: db.getQuery(),
          body: {
            ipsec: secondClientId,
            name: 'IPSec-Only-Client-Uninstall-Secrets-2',
            install_dir: '/tmp',
            install_name: 'ipsec-only-client-uninstall-secrets-2.conf',
            comment: '',
          },
        } as any);
        await unlockFwcloud();

        const response = await request(app.express)
          .put(_URL().getURL('vpn.ipsec.uninstall'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            firewall: fwcProduct.firewall.id,
            ipsec: secondClientId,
            sshuser: '',
            sshpass: '',
          });

        expect(response.status).to.equal(200);
        expect(uninstallStub.called).to.equal(true);
        const [installDirArg, filesArg] = uninstallStub.firstCall.args;
        expect(installDirArg).to.equal('/tmp');
        expect(filesArg).to.deep.equal([
          'ipsec-only-client-uninstall-secrets-1.conf',
          'ipsec.secrets',
        ]);
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

      it('regular user should be able to get IPSec client without server', async () => {
        const { ipsecOnlyClientId } = await createIPSecClientWithoutServer(loggedUserSessionId);

        const response = await request(app.express)
          .put(_URL().getURL('vpn.ipsec.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: ipsecOnlyClientId,
          });

        expect(response.status).to.equal(200);
        expect(response.body.data?.type).to.equal(333);
        expect(response.body.data?.ipsec).to.equal(null);
        expect(response.body.data?.crt).to.equal(null);
      });

      it('admin user should be able to get IPSec client without server', async () => {
        const { ipsecOnlyClientId } = await createIPSecClientWithoutServer(adminUserSessionId);

        const response = await request(app.express)
          .put(_URL().getURL('vpn.ipsec.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: ipsecOnlyClientId,
          });

        expect(response.status).to.equal(200);
        expect(response.body.data?.type).to.equal(333);
        expect(response.body.data?.ipsec).to.equal(null);
        expect(response.body.data?.crt).to.equal(null);
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

      it('regular user should be able to get IPSec file from client without server', async () => {
        const { ipsecOnlyClientId } = await createIPSecClientWithoutServer(loggedUserSessionId);

        const response = await request(app.express)
          .put(_URL().getURL('vpn.ipsec.file.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: ipsecOnlyClientId,
          });

        expect(response.status).to.equal(200);
        expect(response.body.data?.cfg).to.be.a('string');
      });

      it('admin user should be able to get IPSec file from client without server', async () => {
        const { ipsecOnlyClientId } = await createIPSecClientWithoutServer(adminUserSessionId);

        const response = await request(app.express)
          .put(_URL().getURL('vpn.ipsec.file.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: ipsecOnlyClientId,
          });

        expect(response.status).to.equal(200);
        expect(response.body.data?.cfg).to.be.a('string');
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

      it('regular user should be able to get IPSec info from client without server', async () => {
        const { ipsecOnlyClientId } = await createIPSecClientWithoutServer(loggedUserSessionId);

        const response = await request(app.express)
          .put(_URL().getURL('vpn.ipsec.info.get'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: ipsecOnlyClientId,
          });

        expect(response.status).to.equal(200);
        expect(response.body.data).to.be.an('array');
        expect(response.body.data).to.have.length.greaterThan(0);
        expect(response.body.data[0].type).to.equal(333);
      });

      it('admin user should be able to get IPSec info from client without server', async () => {
        const { ipsecOnlyClientId } = await createIPSecClientWithoutServer(adminUserSessionId);

        const response = await request(app.express)
          .put(_URL().getURL('vpn.ipsec.info.get'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: ipsecOnlyClientId,
          });

        expect(response.status).to.equal(200);
        expect(response.body.data).to.be.an('array');
        expect(response.body.data).to.have.length.greaterThan(0);
        expect(response.body.data[0].type).to.equal(333);
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
      beforeEach(async () => {
        await unlockFwcloud();
      });

      afterEach(async () => {
        await unlockFwcloud();
      });

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

      it('regular user should be able to delete IPSec client without server', async () => {
        const { ipsecOnlyClientId } = await createIPSecClientWithoutServer(
          loggedUserSessionId,
          'IPSec-Only-Client-Delete-Test',
        );

        await unlockFwcloud();

        const deleteResponse = await request(app.express)
          .put(_URL().getURL('vpn.ipsec.delete'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: ipsecOnlyClientId,
          });

        expect(deleteResponse.status).to.equal(204);
        await assertIPSecClientWithoutServerDeleted(ipsecOnlyClientId);
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

      it('admin user should be able to delete IPSec client without server', async () => {
        const { ipsecOnlyClientId } = await createIPSecClientWithoutServer(
          adminUserSessionId,
          'IPSec-Only-Client-Delete-Test',
        );

        await unlockFwcloud();

        const deleteResponse = await request(app.express)
          .put(_URL().getURL('vpn.ipsec.delete'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: ipsecOnlyClientId,
          });

        expect(deleteResponse.status).to.equal(204);
        await assertIPSecClientWithoutServerDeleted(ipsecOnlyClientId);
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

      it('regular user should be able to access restricted IPSec client without server', async () => {
        const { ipsecOnlyClientId } = await createIPSecClientWithoutServer(loggedUserSessionId);

        await unlockFwcloud();

        const response = await request(app.express)
          .put(_URL().getURL('vpn.ipsec.restrictions'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: ipsecOnlyClientId,
          });

        expect(response.status).to.equal(204);
      });

      it('admin user should be able to access restricted IPSec client without server', async () => {
        const { ipsecOnlyClientId } = await createIPSecClientWithoutServer(adminUserSessionId);

        await unlockFwcloud();

        const response = await request(app.express)
          .put(_URL().getURL('vpn.ipsec.restrictions'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            fwcloud: fwcProduct.fwcloud.id,
            ipsec: ipsecOnlyClientId,
          });

        expect(response.status).to.equal(204);
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
