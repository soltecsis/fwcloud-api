/*
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { describeName, testSuite, expect } from '../../../mocha/global-setup';
import request = require('supertest');
import { _URL } from '../../../../src/fonaments/http/router/router.service';
import { User } from '../../../../src/models/user/User';
import { createUser, generateSession, attachSession } from '../../../utils/utils';
import { Application } from '../../../../src/Application';
import { EntityManager } from 'typeorm';
import db from '../../../../src/database/database-manager';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { Tree } from '../../../../src/models/tree/Tree';
import { Mark } from '../../../../src/models/ipobj/Mark';

describe(describeName('Iptables Mark E2E Tests'), () => {
  let app: Application;
  let loggedUser: User;
  let loggedUserSessionId: string;
  let adminUser: User;
  let adminUserSessionId: string;
  let fwcProduct: FwCloudProduct;
  let manager: EntityManager;

  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    fwcProduct = await new FwCloudFactory().make();

    loggedUser = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUser);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    loggedUser.fwClouds = [fwcProduct.fwcloud];
    adminUser.fwClouds = [fwcProduct.fwcloud];
    await manager.getRepository(User).save([loggedUser, adminUser]);
  });

  describe('POST /ipobj/mark - Create mark', () => {
    it('guest user should not be able to create mark', async () => {
      const parentNodeId = await Tree.newNode(
        db.getQuery(),
        fwcProduct.fwcloud.id,
        'Marks',
        null,
        'MRK',
        null,
        30,
      );

      await request(app.express)
        .post('/ipobj/mark')
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          name: 'Test Mark',
          code: 100,
          comment: 'This is a test mark',
          node_id: parentNodeId,
        })
        .expect(401);
    });

    it('regular user which does not belong to the fwcloud should not be able to create mark', async () => {
      const parentNodeId = await Tree.newNode(
        db.getQuery(),
        fwcProduct.fwcloud.id,
        'Marks',
        null,
        'MRK',
        null,
        30,
      );

      await request(app.express)
        .post('/ipobj/mark')
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .send({
          fwcloud: 99999,
          name: 'Test Mark',
          code: 100,
          comment: 'This is a test mark',
          node_id: parentNodeId,
        })
        .expect(400);
    });

    it('regular user should be able to create mark', async () => {
      const parentNodeId = await Tree.newNode(
        db.getQuery(),
        fwcProduct.fwcloud.id,
        'Marks',
        null,
        'MRK',
        null,
        30,
      );

      await request(app.express)
        .post('/ipobj/mark')
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          name: 'Test Mark',
          code: 100,
          comment: 'This is a test mark',
          node_id: parentNodeId,
        })
        .expect(200);
    });

    it('admin user should be able to create a new mark', async () => {
      // Create parent node of type MRK in the tree
      const parentNodeId = await Tree.newNode(
        db.getQuery(),
        fwcProduct.fwcloud.id,
        'Marks',
        null,
        'MRK',
        null,
        30,
      );

      await request(app.express)
        .post('/ipobj/mark')
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          name: 'Test Mark',
          code: 100,
          comment: 'This is a test mark',
          node_id: parentNodeId,
        })
        .then((response) => {
          expect(response.status).to.equal(200);
        });
    });

    it('should fail when creating duplicate mark', async () => {
      // Create a mark first
      const existingMark = await Mark.createMark({
        dbCon: db.getQuery(),
        body: {
          fwcloud: fwcProduct.fwcloud.id,
          name: 'Existing Mark',
          code: 100,
          comment: 'Existing mark',
        },
      });

      const parentNodeId = await Tree.newNode(
        db.getQuery(),
        fwcProduct.fwcloud.id,
        'Marks',
        null,
        'MRK',
        null,
        30,
      );

      await request(app.express)
        .post('/ipobj/mark')
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          name: 'Duplicate Mark',
          code: 100, // Same code as existing mark
          comment: 'Duplicate mark comment',
          node_id: parentNodeId,
        })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect((res) => {
          expect(res.body.msg).to.include('Already exists');
        });
    });
  });

  describe('PUT /ipobj/mark - Update mark', () => {
    it('guest user should not be able to update mark', async () => {
      await request(app.express)
        .put('/ipobj/mark')
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          mark: fwcProduct.mark.id,
          name: 'Test Mark',
          code: 999,
          comment: 'Updated comment',
        })
        .expect(401);
    });

    it('regular user which does not belong to the fwcloud should not be able to update mark', async () => {
      await request(app.express)
        .put('/ipobj/mark')
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .send({
          fwcloud: 99999,
          mark: fwcProduct.mark.id,
          name: 'Test Mark',
          code: 999,
          comment: 'Updated comment',
        })
        .expect(400);
    });

    it('regular user should be able to update mark', async () => {
      await request(app.express)
        .put('/ipobj/mark')
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          mark: fwcProduct.mark.id,
          name: 'Test Mark Updated',
          code: 888,
          comment: 'Updated by regular user',
        })
        .then(async (response) => {
          expect(response.status).to.equal(200);
          const updatedMark = await db
            .getSource()
            .getRepository(Mark)
            .findOne({
              where: { id: fwcProduct.mark.id },
            });
          expect(updatedMark).to.have.property('name', 'Test Mark Updated');
          expect(updatedMark).to.have.property('code', 888);
        });
    });

    it('admin user should be able to update a mark', async () => {
      await request(app.express)
        .put('/ipobj/mark')
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          mark: fwcProduct.mark.id,
          name: 'Test Mark',
          code: 999,
          comment: 'Updated comment',
        })
        .then(async (response) => {
          expect(response.status).to.equal(200);
          const updatedMark = await db
            .getSource()
            .getRepository(Mark)
            .findOne({
              where: { id: fwcProduct.mark.id },
            });
          expect(updatedMark).to.have.property('name', 'Test Mark');
          expect(updatedMark).to.have.property('code', 999);
          expect(updatedMark).to.have.property('comment', 'Updated comment');
        });
    });
  });

  describe('PUT /ipobj/mark/get - Get mark data', () => {
    let testMark: any;

    beforeEach(async () => {
      testMark = await Mark.createMark({
        dbCon: db.getQuery(),
        body: {
          fwcloud: fwcProduct.fwcloud.id,
          name: 'Test Mark',
          code: 300,
          comment: 'Test mark for get',
        },
      });
    });

    it('guest user should not be able to get mark', async () => {
      await request(app.express)
        .put('/ipobj/mark/get')
        .send({
          mark: testMark,
          fwcloud: fwcProduct.fwcloud.id,
        })
        .expect(401);
    });

    it('regular user which does not belong to the fwcloud should not be able to get mark', async () => {
      await request(app.express)
        .put('/ipobj/mark/get')
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .send({
          mark: testMark,
          fwcloud: 99999,
        })
        .expect(400);
    });

    it('regular user should be able to get mark', async () => {
      await request(app.express)
        .put('/ipobj/mark/get')
        .send({
          mark: testMark,
          fwcloud: fwcProduct.fwcloud.id,
        })
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body).to.have.property('name', 'Test Mark');
          expect(response.body).to.have.property('code', 300);
        });
    });

    it('admin user should be able to get mark data', async () => {
      await request(app.express)
        .put('/ipobj/mark/get')
        .send({
          mark: testMark,
          fwcloud: fwcProduct.fwcloud.id,
        })
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body).to.have.property('name', 'Test Mark');
          expect(response.body).to.have.property('code', 300);
          expect(response.body).to.have.property('comment', 'Test mark for get');
        });
    });
  });

  describe('PUT /ipobj/mark/del - Delete mark', () => {
    let testMark: any;

    beforeEach(async () => {
      testMark = await Mark.createMark({
        dbCon: db.getQuery(),
        body: {
          fwcloud: fwcProduct.fwcloud.id,
          name: 'Test Mark to Delete',
          code: 400,
          comment: 'Test mark for deletion',
        },
      });
    });

    it('guest user should not be able to delete mark', async () => {
      await request(app.express)
        .put('/ipobj/mark/del')
        .send({
          mark: testMark,
          fwcloud: fwcProduct.fwcloud.id,
        })
        .expect(401);
    });

    it('regular user which does not belong to the fwcloud should not be able to delete mark', async () => {
      await request(app.express)
        .put('/ipobj/mark/del')
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .send({
          mark: testMark,
          fwcloud: 99999,
        })
        .expect(400);
    });

    it('regular user should be able to delete mark', async () => {
      await request(app.express)
        .put('/ipobj/mark/del')
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .send({
          mark: testMark,
          fwcloud: fwcProduct.fwcloud.id,
        })
        .then((response) => {
          expect(response.status).to.equal(204);
        });
    });

    it('admin user should be able to delete a mark', async () => {
      await request(app.express)
        .put('/ipobj/mark/del')
        .send({
          mark: testMark,
          fwcloud: fwcProduct.fwcloud.id,
        })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .then((response) => {
          expect(response.status).to.equal(204);
        });
    });
  });

  describe('PUT /ipobj/mark/where - Find mark usage', () => {
    let testMark: any;

    beforeEach(async () => {
      testMark = await Mark.createMark({
        dbCon: db.getQuery(),
        body: {
          fwcloud: fwcProduct.fwcloud.id,
          name: 'Test Mark Usage',
          code: 500,
          comment: 'Test mark for usage search',
        },
      });
    });

    it('guest user should not be able to find mark usage', async () => {
      await request(app.express)
        .put('/ipobj/mark/where')
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          mark: testMark,
        })
        .expect(401);
    });

    it('regular user which does not belong to the fwcloud should not be able to find mark usage', async () => {
      await request(app.express)
        .put('/ipobj/mark/where')
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .send({
          fwcloud: 99999,
          mark: testMark,
        })
        .expect(400);
    });

    it('regular user should be able to find mark usage', async () => {
      await request(app.express)
        .put('/ipobj/mark/where')
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          mark: testMark,
        })
        .expect(204);
    });

    it('admin user should be able to get mark usage', async () => {
      await request(app.express)
        .put('/ipobj/mark/where')
        .send({
          fwcloud: fwcProduct.fwcloud.id,
          mark: testMark,
        })
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(204);
    });
  });

  describe('PUT /ipobj/mark/restricted - Check restrictions', () => {
    let testMark: any;

    beforeEach(async () => {
      testMark = await Mark.createMark({
        dbCon: db.getQuery(),
        body: {
          fwcloud: fwcProduct.fwcloud.id,
          name: 'Test Mark Restrictions',
          code: 600,
          comment: 'Test mark for restrictions check',
        },
      });
    });

    it('guest user should not be able to check mark restrictions', async () => {
      await request(app.express)
        .put('/ipobj/mark/restricted')
        .send({
          mark: testMark,
          fwcloud: fwcProduct.fwcloud.id,
        })
        .expect(401);
    });

    it('regular user which does not belong to the fwcloud should not be able to check mark restrictions', async () => {
      await request(app.express)
        .put('/ipobj/mark/restricted')
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .send({
          mark: testMark,
          fwcloud: 99999,
        })
        .expect(400);
    });

    it('regular user should be able to check mark restrictions', async () => {
      await request(app.express)
        .put('/ipobj/mark/restricted')
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .send({
          mark: testMark,
          fwcloud: fwcProduct.fwcloud.id,
        })
        .expect(204);
    });

    it('admin user should be able to check mark restrictions', async () => {
      await request(app.express)
        .put('/ipobj/mark/restricted')
        .send({
          mark: testMark,
          fwcloud: fwcProduct.fwcloud.id,
        })
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(204);
    });
  });
});
