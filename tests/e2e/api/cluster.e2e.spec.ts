import { Application } from '../../../src/Application';
import { Cluster } from '../../../src/models/firewall/Cluster';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { User } from '../../../src/models/user/User';
import { describeName, expect, testSuite } from '../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../utils/utils';
import request = require('supertest');
import { _URL } from '../../../src/fonaments/http/router/router.service';
import StringHelper from '../../../src/utils/string.helper';
import { getRepository } from 'typeorm';
import {
  Firewall,
  FirewallInstallCommunication,
  FirewallInstallProtocol,
} from '../../../src/models/firewall/Firewall';
import { response } from 'express';
import { Tree, TreeNode } from '../../../src/models/tree/Tree';
import db from '../../../src/database/database-manager';

describe(describeName('Cluster E2E test'), () => {
  let app: Application;
  let adminUser: User;
  let adminUserSessionId: string;

  let fwCloud: FwCloud;
  let cluster: Cluster;

  let tree: TreeNode;

  beforeEach(async () => {
    app = testSuite.app;

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    await request(app.express)
      .post(_URL().getURL('fwclouds.store'))
      .send({
        name: StringHelper.randomize(10),
        image: '',
        comment: '',
      })
      .set('Cookie', [attachSession(adminUserSessionId)])
      .then((response) => {
        fwCloud = response.body.data;
      });
    cluster = await getRepository(Cluster).save(
      getRepository(Cluster).create({
        name: StringHelper.randomize(10),
        fwCloudId: fwCloud.id,
      }),
    );
    app.config.set('limits.clusters', 0);

    tree = await Tree.dumpTree(db.getQuery(), 'FIREWALLS', fwCloud.id);
  });
  describe('ClusterController@limit', () => {
    it('the limit is greater than the number of clusters', async () => {
      let numberClusters: number;
      await getRepository(Cluster).save(
        getRepository(Cluster).create({
          name: StringHelper.randomize(10),
          fwCloudId: fwCloud.id,
        }),
      );
      await request(app.express)
        .put('/cluster/cloud/get')
        .send({ fwcloud: fwCloud.id })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .then((response) => {
          numberClusters = response.body.length;
        });
      app.config.set('limits.clusters', numberClusters + 1);

      return await request(app.express)
        .post('/cluster')
        .send({
          fwcloud: fwCloud.id,
          node_id: tree.id,
          clusterData: {
            name: StringHelper.randomize(10),
            options: 3,
            plugins: 0,
            fwnodes: Array(3).fill({
              name: StringHelper.randomize(10),
              install_communication: 'agent',
              install_protocol: 'http',
              install_apikey: null,
              install_port: 33033,
              save_user_pass: 0,
              fwmaster: 1,
            }),
          },
        })
        .set('Cookie', attachSession(adminUserSessionId))
        .expect(200);
    });
    it('the limit is equals than the number of clusters', async () => {
      let numberClusters: number;
      await getRepository(Cluster).save(
        getRepository(Cluster).create({
          name: StringHelper.randomize(10),
          fwCloudId: fwCloud.id,
        }),
      );
      await request(app.express)
        .put('/cluster/cloud/get')
        .send({ fwcloud: fwCloud.id })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .then((response) => {
          numberClusters = response.body.length;
        });
      app.config.set('limits.clusters', numberClusters);

      return await request(app.express)
        .post('/cluster')
        .send({
          fwcloud: fwCloud.id,
          node_id: tree.id,
          clusterData: {
            name: StringHelper.randomize(10),
            options: 3,
            plugins: 0,
            fwnodes: Array(3).fill({
              name: StringHelper.randomize(10),
              install_communication: 'agent',
              install_protocol: 'http',
              install_apikey: null,
              install_port: 33033,
              save_user_pass: 0,
              fwmaster: 1,
            }),
          },
        })
        .set('Cookie', attachSession(adminUserSessionId))
        .expect(400, {
          fwcErr: 8002,
          msg: 'The maximum of available Clusters has been reached',
        });
    });
    it('the limit is less than the number of clusters', async () => {
      let numberClusters: number;
      await getRepository(Cluster).save(
        getRepository(Cluster).create({
          name: StringHelper.randomize(10),
          fwCloudId: fwCloud.id,
        }),
      );
      await request(app.express)
        .put('/cluster/cloud/get')
        .send({ fwcloud: fwCloud.id })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .then((response) => {
          numberClusters = response.body.length;
        });
      app.config.set('limits.clusters', numberClusters - 1);

      return await request(app.express)
        .post('/cluster')
        .send({
          fwcloud: fwCloud.id,
          node_id: tree.id,
          clusterData: {
            name: StringHelper.randomize(10),
            options: 3,
            plugins: 0,
            fwnodes: Array(3).fill({
              name: StringHelper.randomize(10),
              install_communication: 'agent',
              install_protocol: 'http',
              install_apikey: null,
              install_port: 33033,
              save_user_pass: 0,
              fwmaster: 1,
            }),
          },
        })
        .set('Cookie', attachSession(adminUserSessionId))
        .expect(400, {
          fwcErr: 8002,
          msg: 'The maximum of available Clusters has been reached',
        });
    });
    it('the limit is greater than the number of nodes', async () => {
      let numberNodes: number = 2;

      await request(app.express)
        .put('/cluster/get')
        .send({ fwcloud: fwCloud.id, cluster: cluster.id })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .then((response) => {
          numberNodes = response.body.nodes.length;
        });
      app.config.set('limits.nodes', numberNodes + 1);
      return await request(app.express)
        .post('/cluster')
        .send({
          fwcloud: fwCloud.id,
          node_id: tree.id,
          clusterData: {
            name: StringHelper.randomize(10),
            options: 3,
            plugins: 0,
            fwnodes: Array(numberNodes + 1).fill({
              name: StringHelper.randomize(10),
              install_communication: 'agent',
              install_protocol: 'http',
              install_apikey: null,
              install_port: 33033,
              save_user_pass: 0,
              fwmaster: 1,
            }),
          },
        })
        .set('Cookie', attachSession(adminUserSessionId))
        .expect(200);
    });
    it('the limit is equals than the number of nodes', async () => {
      const numberNodes: number = 2;
      app.config.set('limits.nodes', numberNodes);
      return await request(app.express)
        .post('/cluster')
        .send({
          fwcloud: fwCloud.id,
          node_id: tree.id,
          clusterData: {
            name: StringHelper.randomize(10),
            options: 3,
            plugins: 0,
            fwnodes: Array(numberNodes + 1).fill({
              name: StringHelper.randomize(10),
              install_communication: 'agent',
              install_protocol: 'http',
              install_apikey: null,
              install_port: 33033,
              save_user_pass: 0,
              fwmaster: 1,
            }),
          },
        })
        .set('Cookie', attachSession(adminUserSessionId))
        .expect(400, {
          fwcErr: 8003,
          msg: 'The maximum of available Nodes in Cluster has been reached',
        });
    });
    it('the limit is less than the number of nodes', async () => {
      const numberNodes: number = 2;
      app.config.set('limits.nodes', numberNodes - 1);
      return await request(app.express)
        .post('/cluster')
        .send({
          fwcloud: fwCloud.id,
          node_id: tree.id,
          clusterData: {
            name: StringHelper.randomize(10),
            options: 3,
            plugins: 0,
            fwnodes: Array(numberNodes).fill({
              name: StringHelper.randomize(10),
              install_communication: 'agent',
              install_protocol: 'http',
              install_apikey: null,
              install_port: 33033,
              save_user_pass: 0,
              fwmaster: 1,
            }),
          },
        })
        .set('Cookie', attachSession(adminUserSessionId))
        .expect(400, {
          fwcErr: 8003,
          msg: 'The maximum of available Nodes in Cluster has been reached',
        });
    });
  });
});
