import { describeName, expect, testSuite } from '../../mocha/global-setup';
import { Application } from '../../../src/Application';
import { User } from '../../../src/models/user/User';
import request = require('supertest');
import { createUser, generateSession, attachSession } from '../../utils/utils';
import { _URL } from '../../../src/fonaments/http/router/router.service';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { EntityManager } from 'typeorm';
import StringHelper from '../../../src/utils/string.helper';
import {
  Firewall,
  FirewallInstallCommunication,
} from '../../../src/models/firewall/Firewall';
import { IPObj } from '../../../src/models/ipobj/IPObj';
import sinon from 'sinon';
import sshTools from '../../../src/utils/ssh';
import { FwCloudFactory, FwCloudProduct } from '../../utils/fwcloud-factory';
import { RoutingTable } from '../../../src/models/routing/routing-table/routing-table.model';
import { RoutingRule } from '../../../src/models/routing/routing-rule/routing-rule.model';
import { RoutingRuleService } from '../../../src/models/routing/routing-rule/routing-rule.service';
import { Mark } from '../../../src/models/ipobj/Mark';
import { Tree, TreeNode } from '../../../src/models/tree/Tree';
import db from '../../../src/database/database-manager';
import { DHCPRule } from '../../../src/models/system/dhcp/dhcp_r/dhcp_r.model';
import { HAProxyRule } from '../../../src/models/system/haproxy/haproxy_r/haproxy_r.model';

describe(describeName('Firewall E2E Tests'), () => {
  let app: Application;
  let loggedUser: User;
  let loggedUserSessionId: string;

  let adminUser: User;
  let adminUserSessionId: string;

  let fwCloud: FwCloud;
  let firewall: Firewall;

  let manager: EntityManager;

  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;

    loggedUser = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUser);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    fwCloud = await manager
      .getRepository(FwCloud)
      .save(
        manager
          .getRepository(FwCloud)
          .create({ name: StringHelper.randomize(10) }),
      );
    const ipObj: IPObj = await manager.getRepository(IPObj).save(
      manager.getRepository(IPObj).create({
        name: 'test',
        address: '0.0.0.0',
        ipObjTypeId: 0,
      }),
    );
    firewall = await manager.getRepository(Firewall).save(
      manager.getRepository(Firewall).create({
        name: StringHelper.randomize(10),
        fwCloudId: fwCloud.id,
        install_ipobj: ipObj.id,
      }),
    );
  });

  describe.skip('FirewallController@compile', () => {
    it('guest user should not compile a firewall', async () => {
      return await request(app.express)
        .post(
          _URL().getURL('firewalls.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .expect(401);
    });

    it('regular user should not compile a firewall if it does not belong to the fwcloud', async () => {
      return await request(app.express)
        .post(
          _URL().getURL('firewalls.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(401);
    });

    it('regular user should compile a firewall if it does belong to the fwcloud', async () => {
      loggedUser.fwClouds = [fwCloud];
      await manager.getRepository(User).save(loggedUser);

      return await request(app.express)
        .post(
          _URL().getURL('firewalls.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(201);
    });

    it('admin user should compile a firewall', async () => {
      return await request(app.express)
        .post(
          _URL().getURL('firewalls.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(201);
    });
  });

  describe.skip('FirewallController@install', () => {
    let sshRunCommandStub: sinon.SinonStub;
    let sshUploadFileStub: sinon.SinonStub;
    before(async () => {
      sshRunCommandStub = sinon.stub(sshTools, 'runCommand').resolves('done');
      sshUploadFileStub = sinon.stub(sshTools, 'uploadFile').resolves('done');
    });

    after(async () => {
      sshRunCommandStub.restore();
      sshUploadFileStub.restore();
    });

    it('guest user should not compile a firewall', async () => {
      return await request(app.express)
        .post(
          _URL().getURL('firewalls.install', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .expect(401);
    });

    it('regular user should not install a firewall if it does not belong to the fwcloud', async () => {
      return await request(app.express)
        .post(
          _URL().getURL('firewalls.install', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(401);
    });

    it('regular user should install a firewall if it does belong to the fwcloud', async () => {
      loggedUser.fwClouds = [fwCloud];
      await manager.getRepository(User).save(loggedUser);

      return await request(app.express)
        .post(
          _URL().getURL('firewalls.install', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(201);
    });

    it('admin user should install a firewall if user belongs to the fwcloud', async () => {
      adminUser.fwClouds = [fwCloud];
      await manager.getRepository(User).save(adminUser);

      return await request(app.express)
        .post(
          _URL().getURL('firewalls.install', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(201);
    });

    it.skip('should use custom credentials if they are provided', () => {});
  });

  describe('@compileRoutingRules', () => {
    let fwcProduct: FwCloudProduct;
    let table: RoutingTable;
    let rule1: RoutingRule;
    let rule2: RoutingRule;

    beforeEach(async () => {
      fwcProduct = await new FwCloudFactory().make();
      fwCloud = fwcProduct.fwcloud;
      firewall = fwcProduct.firewall;
      table = fwcProduct.routingTable;

      const ruleService: RoutingRuleService =
        await app.getService<RoutingRuleService>(RoutingRuleService.name);

      rule1 = await ruleService.create({
        routingTableId: table.id,
        markIds: [
          {
            id: (
              await manager.getRepository(Mark).save({
                code: 1,
                name: 'test',
                fwCloudId: fwCloud.id,
              })
            ).id,
            order: 0,
          },
        ],
      });

      rule2 = await ruleService.create({
        routingTableId: table.id,
        markIds: [
          {
            id: (
              await manager.getRepository(Mark).save({
                code: 2,
                name: 'test',
                fwCloudId: fwCloud.id,
              })
            ).id,
            order: 0,
          },
        ],
      });
    });

    it('guest user should not routing compile a firewall', async () => {
      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.routing.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .expect(401);
    });

    it('regular user should not routing compile a firewall if it does not belong to the fwcloud', async () => {
      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.routing.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(401);
    });

    it('regular user should routing compile a firewall if it does belong to the fwcloud', async () => {
      loggedUser.fwClouds = [fwcProduct.fwcloud];
      await manager.getRepository(User).save(loggedUser);

      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.routing.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(200);
    });

    it('admin user should routing compile a firewall', async () => {
      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.routing.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200);
    });

    it('should compile a list of routes', async () => {
      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.routing.compile', {
            fwcloud: fwCloud.id,
            firewall: firewall.id,
          }),
        )
        .query({
          rules: [rule1.id, rule2.id],
        })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .expect((response) => {
          expect(response.body.data).to.have.length(2);
        });
    });
  });

  describe('@compileDhcpRules', () => {
    let fwcProduct: FwCloudProduct;
    let rule1: DHCPRule;
    let rule2: DHCPRule;

    beforeEach(async () => {
      fwcProduct = await new FwCloudFactory().make();
      fwCloud = fwcProduct.fwcloud;
      firewall = fwcProduct.firewall;

      rule1 = await manager.getRepository(DHCPRule).save(
        manager.getRepository(DHCPRule).create({
          rule_order: 1,
          interface: null,
          rule_type: 1,
          firewall: firewall,
          max_lease: 5,
          network: await manager.getRepository(IPObj).save(
            manager.getRepository(IPObj).create({
              name: 'test',
              address: '0.0.0.0',
              ipObjTypeId: 0,
              netmask: '/24',
            }),
          ),
          range: await manager.getRepository(IPObj).save(
            manager.getRepository(IPObj).create({
              name: 'test',
              address: '0.0.0.0',
              ipObjTypeId: 0,
              range_start: '1',
              range_end: '2',
            }),
          ),
          router: await manager.getRepository(IPObj).save(
            manager.getRepository(IPObj).create({
              name: 'test',
              address: '0.0.0.0',
              ipObjTypeId: 0,
              netmask: '/24',
            }),
          ),
        }),
      );

      rule2 = await manager.getRepository(DHCPRule).save(
        manager.getRepository(DHCPRule).create({
          rule_order: 2,
          interface: null,
          rule_type: 1,
          firewall: firewall,
          max_lease: 5,
          network: await manager.getRepository(IPObj).save(
            manager.getRepository(IPObj).create({
              name: 'test',
              address: '0.0.0.0',
              ipObjTypeId: 0,
              netmask: '/24',
            }),
          ),
          range: await manager.getRepository(IPObj).save(
            manager.getRepository(IPObj).create({
              name: 'test',
              address: '0.0.0.0',
              ipObjTypeId: 0,
              range_start: '1',
              range_end: '2',
            }),
          ),
          router: await manager.getRepository(IPObj).save(
            manager.getRepository(IPObj).create({
              name: 'test',
              address: '0.0.0.0',
              ipObjTypeId: 0,
              netmask: '/24',
            }),
          ),
        }),
      );
    });

    it('guest user should not dhcp compile a firewall', async () => {
      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.system.dhcp.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .expect(401);
    });

    it('regular user should not dhcp compile a firewall if it does not belong to the fwcloud', async () => {
      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.system.dhcp.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(401);
    });

    it('regular user should dhcp compile a firewall if it does belong to the fwcloud', async () => {
      loggedUser.fwClouds = [fwcProduct.fwcloud];
      await manager.getRepository(User).save(loggedUser);

      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.system.dhcp.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(200);
    });

    it('admin user should dhcp compile a firewall', async () => {
      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.system.dhcp.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200);
    });

    it('should compile a list of dhcp rules', async () => {
      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.system.dhcp.compile', {
            fwcloud: fwCloud.id,
            firewall: firewall.id,
          }),
        )
        .query({
          rules: [rule1.id, rule2.id],
        })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .expect((response) => {
          expect(response.body.data).to.have.length(2);
        });
    });
  });

  describe('@compileHAProxyRules', () => {
    let fwcProduct: FwCloudProduct;
    let rule1: HAProxyRule;
    let rule2: HAProxyRule;

    beforeEach(async () => {
      fwcProduct = await new FwCloudFactory().make();
      fwCloud = fwcProduct.fwcloud;
      firewall = fwcProduct.firewall;

      rule1 = await manager.getRepository(HAProxyRule).save(
        manager.getRepository(HAProxyRule).create({
          rule_type: 1,
          firewall: firewall,
          frontendIp: await manager.getRepository(IPObj).save(
            manager.getRepository(IPObj).create({
              address: `192.168.1.1`,
              destination_port_start: 80,
              destination_port_end: 80,
              name: 'test',
              ipObjTypeId: 0,
            }),
          ),
          frontendPort: await manager.getRepository(IPObj).save(
            manager.getRepository(IPObj).create({
              destination_port_start: 80,
              destination_port_end: 80,
              name: 'test',
              ipObjTypeId: 0,
            }),
          ),
          rule_order: 1,
        }),
      );
      rule2 = await manager.getRepository(HAProxyRule).save(
        manager.getRepository(HAProxyRule).create({
          rule_type: 1,
          firewall: firewall,
          frontendIp: await manager.getRepository(IPObj).save(
            manager.getRepository(IPObj).create({
              address: `192.168.1.1`,
              destination_port_start: 80,
              destination_port_end: 80,
              name: 'test',
              ipObjTypeId: 0,
            }),
          ),
          frontendPort: await manager.getRepository(IPObj).save(
            manager.getRepository(IPObj).create({
              destination_port_start: 80,
              destination_port_end: 80,
              name: 'test',
              ipObjTypeId: 0,
            }),
          ),
          rule_order: 2,
        }),
      );
    });

    it('guest user should not haproxy compile a firewall', async () => {
      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.system.haproxy.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .expect(401);
    });

    it('regular user should not haproxy compile a firewall if it does not belong to the fwcloud', async () => {
      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.system.haproxy.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(401);
    });

    it('regular user should haproxy compile a firewall if it does belong to the fwcloud', async () => {
      loggedUser.fwClouds = [fwcProduct.fwcloud];
      await manager.getRepository(User).save(loggedUser);

      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.system.haproxy.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(200);
    });

    it('admin user should haproxy compile a firewall', async () => {
      return await request(app.express)
        .get(
          _URL().getURL('fwclouds.firewalls.system.haproxy.compile', {
            fwcloud: firewall.fwCloudId,
            firewall: firewall.id,
          }),
        )
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200);
    });
  });

  describe('FirewallController@limits', () => {
    let tree: TreeNode;
    beforeEach(async () => {
      const response = await request(app.express)
        .post(_URL().getURL('fwclouds.store'))
        .send({
          name: StringHelper.randomize(10),
          image: '',
          comment: '',
        })
        .set('Cookie', [attachSession(adminUserSessionId)]);

      fwCloud = response.body.data;
      tree = await Tree.dumpTree(db.getQuery(), 'FIREWALLS', fwCloud.id);
    });

    it('the limit is greater than the number of firewalls', async () => {
      let numberFirewalls: number;

      await request(app.express)
        .post('/firewall')
        .send({
          name: StringHelper.randomize(10),
          fwcloud: fwCloud.id,
          install_communication: 'agent',
          install_protocol: 'http',
          install_apikey: null,
          install_port: 33033,
          save_user_pass: 0,
          fwmaster: 0,
          options: 3,
          plugins: 0,
          node_id: tree.id,
        })
        .set('Cookie', [attachSession(adminUserSessionId)]);
      await request(app.express)
        .post('/firewall')
        .send({
          name: StringHelper.randomize(10),
          fwcloud: fwCloud.id,
          install_communication: 'agent',
          install_protocol: 'http',
          install_apikey: null,
          install_port: 33033,
          save_user_pass: 0,
          fwmaster: 0,
          options: 3,
          plugins: 0,
          node_id: tree.id,
        })
        .set('Cookie', [attachSession(adminUserSessionId)]);

      await request(app.express)
        .put('/firewall/cloud/get')
        .send({ fwcloud: fwCloud.id })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .then((response) => {
          numberFirewalls = response.body.length ? response.body.length : 0;
        });

      app.config.set('limits.firewalls', numberFirewalls + 1);

      return await request(app.express)
        .post('/firewall')
        .send({
          name: StringHelper.randomize(10),
          fwcloud: fwCloud.id,
          install_communication: 'agent',
          install_protocol: 'http',
          install_apikey: null,
          install_port: 33033,
          save_user_pass: 0,
          fwmaster: 0,
          options: 3,
          plugins: 0,
          node_id: tree.id,
        })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200);
    });

    it('the limit is equals than the number of firewalls', async () => {
      let numberFirewalls: number;

      await request(app.express)
        .post('/firewall')
        .send({
          name: StringHelper.randomize(10),
          fwcloud: fwCloud.id,
          install_communication: 'agent',
          install_protocol: 'http',
          install_apikey: null,
          install_port: 33033,
          save_user_pass: 0,
          fwmaster: 0,
          options: 3,
          plugins: 0,
          node_id: tree.id,
        })
        .set('Cookie', [attachSession(adminUserSessionId)]);
      await request(app.express)
        .post('/firewall')
        .send({
          name: StringHelper.randomize(10),
          fwcloud: fwCloud.id,
          install_communication: 'agent',
          install_protocol: 'http',
          install_apikey: null,
          install_port: 33033,
          save_user_pass: 0,
          fwmaster: 0,
          options: 3,
          plugins: 0,
          node_id: tree.id,
        })
        .set('Cookie', [attachSession(adminUserSessionId)]);

      await request(app.express)
        .put('/firewall/cloud/get')
        .send({ fwcloud: fwCloud.id })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .then((response) => {
          numberFirewalls = response.body.length ? response.body.length : 0;
        });

      app.config.set('limits.firewalls', numberFirewalls);

      return await request(app.express)
        .post('/firewall')
        .send({
          name: StringHelper.randomize(10),
          fwcloud: fwCloud.id,
          install_communication: 'agent',
          install_protocol: 'http',
          install_apikey: null,
          install_port: 33033,
          save_user_pass: 0,
          fwmaster: 0,
          options: 3,
          plugins: 0,
          node_id: tree.id,
        })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(400, {
          fwcErr: 8001,
          msg: 'The maximum of available Firewalls has been reached',
        });
    });

    it('the limit is less than the number of firewalls', async () => {
      let numberFirewalls: number;

      await request(app.express)
        .post('/firewall')
        .send({
          name: StringHelper.randomize(10),
          fwcloud: fwCloud.id,
          install_communication: 'agent',
          install_protocol: 'http',
          install_apikey: null,
          install_port: 33033,
          save_user_pass: 0,
          fwmaster: 0,
          options: 3,
          plugins: 0,
          node_id: tree.id,
        })
        .set('Cookie', [attachSession(adminUserSessionId)]);
      await request(app.express)
        .post('/firewall')
        .send({
          name: StringHelper.randomize(10),
          fwcloud: fwCloud.id,
          install_communication: 'agent',
          install_protocol: 'http',
          install_apikey: null,
          install_port: 33033,
          save_user_pass: 0,
          fwmaster: 0,
          options: 3,
          plugins: 0,
          node_id: tree.id,
        })
        .set('Cookie', [attachSession(adminUserSessionId)]);

      await request(app.express)
        .put('/firewall/cloud/get')
        .send({ fwcloud: fwCloud.id })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .then((response) => {
          numberFirewalls = response.body.length ? response.body.length : 0;
        });
      app.config.set('limits.firewalls', numberFirewalls - 1);

      return await request(app.express)
        .post('/firewall')
        .send({
          name: StringHelper.randomize(10),
          fwcloud: fwCloud.id,
          install_communication: 'agent',
          install_protocol: 'http',
          install_apikey: null,
          install_port: 33033,
          save_user_pass: 0,
          fwmaster: 0,
          options: 3,
          plugins: 0,
          node_id: tree.id,
        })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(400, {
          fwcErr: 8001,
          msg: 'The maximum of available Firewalls has been reached',
        });
    });
  });
});
