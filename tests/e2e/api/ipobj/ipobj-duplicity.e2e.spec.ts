import { describeName, testSuite, expect } from '../../../mocha/global-setup';
import request = require('supertest');
import { _URL } from '../../../../src/fonaments/http/router/router.service';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { FwCloudService } from '../../../../src/models/fwcloud/fwcloud.service';
import { Tree } from '../../../../src/models/tree/Tree';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import StringHelper from '../../../../src/utils/string.helper';
import { getRepository } from 'typeorm';
import { User } from '../../../../src/models/user/User';
import {
  createUser,
  generateSession,
  attachSession,
  sleep,
} from '../../../utils/utils';
import { Application } from '../../../../src/Application';
import fwc_tree_node = require('../../../../src/models/tree/node');
import { FwcTree } from '../../../../src/models/tree/fwc-tree.model';
import db from '../../../../src/database/database-manager';

describe(describeName('Ipobj duplicity E2E Tests'), () => {
  let app: Application;
  let fwCloud: FwCloud;
  let fwcTree: Tree;
  let fwcTreeNode;
  let adminUser: User;
  let adminUserSessionId: string;
  let regularUser: User;
  let regularUserSessionId: string;
  let requestData: any;

  const ipobjCreationSchema = {
    title: 'IPObj creation schema',
    type: 'object',
    required: ['insertId', 'TreeinsertId'],
    properties: {
      insertId: { type: 'number', minimum: 1 },
      TreeinsertId: { type: 'number', minimum: 1 },
    },
  };

  const ipobjData = {
    id: null,
    fwcloud: null,
    interface: null,
    name: null,
    type: null,
    protocol: null,
    address: null,
    netmask: null,
    diff_serv: null,
    ip_version: null,
    icmp_code: null,
    icmp_type: null,
    tcp_flags_mask: null,
    tcp_flags_settings: null,
    range_start: null,
    range_end: null,
    source_port_start: null,
    source_port_end: null,
    destination_port_start: null,
    destination_port_end: null,
    options: null,
    comment: null,
  };

  before(async () => {
    app = testSuite.app;
    regularUser = await createUser({ role: 0 });
    adminUser = await createUser({ role: 1 });

    fwCloud = await (
      await app.getService<FwCloudService>(FwCloudService.name)
    ).store({ name: StringHelper.randomize(10) });
  });

  beforeEach(async () => {
    adminUserSessionId = generateSession(adminUser);

    for (const key in ipobjData) {
      ipobjData[key] = null;
    }
    ipobjData.fwcloud = fwCloud.id;
  });

  describe('IpobjDuplicity', () => {
    describe('IpobjDuplicity@address', () => {
      beforeEach(async () => {
        // Insert the object in the data base in order to generate a duplicity error.
        ipobjData.type = 5;
        ipobjData.name = 'Test IP 1';
        ipobjData.address = '1.2.3.4';
        ipobjData.netmask = '255.255.255.0';
        ipobjData.ip_version = 4;
        await IPObj.insertIpobj(db.getQuery(), ipobjData);

        // Get the tree node in which insert the new object.
        fwcTreeNode = await Tree.getNodeByNameAndType(
          fwCloud.id,
          'Addresses',
          'OIA',
        );

        requestData = {
          fwcloud: fwCloud.id,
          type: ipobjData.type,
          name: 'New Address',
          address: ipobjData.address,
          netmask: ipobjData.netmask,
          ip_version: ipobjData.ip_version,
          node_parent: fwcTreeNode.id,
          node_order: 1,
          node_type: 'OIA',
          force: 0,
        };
      });

      it('should receive a duplicate object error', async () => {
        return await request(app.express)
          .post('/ipobj')
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send(requestData)
          .expect(400)
          .then((response) => {
            expect(response.body)
              .to.have.property('fwcErr')
              .which.is.equal(1003);
            expect(response.body)
              .to.have.property('msg')
              .which.is.equal('Already exists');
            expect(response.body)
              .to.have.property('data')
              .which.is.an('array')
              .to.have.lengthOf(1);
            expect(response.body.data[0])
              .to.have.property('address')
              .which.is.equal(ipobjData.address);
            expect(response.body.data[0])
              .to.have.property('netmask')
              .which.is.equal(ipobjData.netmask);
          });
      });

      it('should receive a duplicate object error (netmask in CIDR notation)', async () => {
        // The same test but using CIDR notation for the netmask.
        requestData.netmask = '/24';
        return await request(app.express)
          .post('/ipobj')
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send(requestData)
          .expect(400)
          .then((response) => {
            expect(response.body)
              .to.have.property('fwcErr')
              .which.is.equal(1003);
            expect(response.body)
              .to.have.property('msg')
              .which.is.equal('Already exists');
            expect(response.body)
              .to.have.property('data')
              .which.is.an('array')
              .to.have.lengthOf(2);
            expect(response.body.data[0])
              .to.have.property('address')
              .which.is.equal(ipobjData.address);
            expect(response.body.data[0])
              .to.have.property('netmask')
              .which.is.equal(ipobjData.netmask);
          });
      });

      it('should allow creation with force option', async () => {
        requestData.force = 1;
        return await request(app.express)
          .post('/ipobj')
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send(requestData)
          .expect(200)
          .then((response) => {
            expect(response.body).to.be.jsonSchema(ipobjCreationSchema);
          });
      });
    });
  });
});
