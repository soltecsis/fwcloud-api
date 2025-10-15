/*!
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

import express, { Request } from 'express';
import request from 'supertest';
import { expect } from 'chai';
import { AuditLogMiddleware } from '../../../src/middleware/audit-log.middleware';
import { AuditLog } from '../../../src/models/audit/AuditLog';
import db from '../../../src/database/database-manager';
import { createHash } from 'crypto';
import { testSuite } from '../../mocha/global-setup';

describe.only('AuditLogMiddleware', () => {
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitForAuditLogs = async (expectedCount: number = 1): Promise<AuditLog[]> => {
    const repository = db.getSource().manager.getRepository(AuditLog);

    for (let attempt = 0; attempt < 50; attempt++) {
      const entries = await repository.find({ order: { id: 'DESC' } });
      if (entries.length >= expectedCount) {
        return entries;
      }

      await wait(10);
    }

    throw new Error('Timed out waiting for audit logs to be persisted');
  };

  const computeHashedSessionId = (sessionId: string): number => {
    const hash = createHash('sha1').update(sessionId).digest('hex');
    const firstBytes = hash.slice(0, 8);
    const hashedValue = Number.parseInt(firstBytes, 16);
    return hashedValue % 2147483647;
  };

  beforeEach(async () => {
    const repository = db.getSource().manager.getRepository(AuditLog);
    await repository.clear();
  });

  after(async () => {
    await testSuite.resetDatabaseData();
  });

  it('should store audit information for authenticated requests with numeric session ids', async () => {
    const app = express();
    const middleware = new AuditLogMiddleware();

    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).session = { user_id: 99, username: 'tester' };
      (req as any).sessionID = '12345';
      next();
    });
    app.use((req, res, next) => middleware.handle(req, res, next));
    app.post('/audit/:firewallId', (req, res) => {
      res.status(201).json({ received: true });
    });

    await request(app)
      .post('/audit/7?cluster=3')
      .set('Authorization', 'Bearer token')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ fwcloud: 11, firewall: 7 });

    const [entry] = await waitForAuditLogs();
    expect(entry).to.exist;
    expect(entry.userId).to.equal(99);
    expect(entry.userName).to.equal('tester');
    expect(entry.sessionId).to.equal(12345);
    expect(entry.fwCloudId).to.equal(11);
    expect(entry.firewallId).to.equal(7);
    expect(entry.clusterId).to.equal(3);
    expect(entry.call).to.equal('POST /audit/7?cluster=3');
    expect(entry.description).to.contain('status=201');
    expect(entry.description).to.contain('user=tester');
    expect(entry.description).to.not.contain('user=99');
    expect(entry.description).to.contain('ip=203.0.113.10');

    const payload = JSON.parse(entry.data);
    expect(payload.method).to.equal('POST');
    expect(payload.url).to.equal('/audit/7?cluster=3');
    expect(payload.headers.authorization).to.equal('[REDACTED]');
    expect(payload.headers['x-forwarded-for']).to.equal('203.0.113.10');
    expect(payload.body.fwcloud).to.equal(11);
    expect(payload.body.firewall).to.equal(7);
    expect(payload.query.cluster).to.equal('3');
    expect(payload.durationMs).to.be.a('number');
  });

  it('should derive hashed numeric session id for authenticated requests with alphanumeric session identifiers', async () => {
    const sessionIdentifier = 'abc123-xyz';
    const expectedHashedSessionId = computeHashedSessionId(sessionIdentifier);
    const app = express();
    const middleware = new AuditLogMiddleware();

    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).session = { user_id: 7 };
      (req as any).sessionID = sessionIdentifier;
      next();
    });
    app.use((req, res, next) => middleware.handle(req, res, next));
    app.get('/resource/:firewallId', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await request(app).get('/resource/15').query({ fwcloud: '42' });

    const [entry] = await waitForAuditLogs();
    expect(entry.sessionId).to.equal(expectedHashedSessionId);
    expect(entry.userId).to.equal(7);
    expect(entry.firewallId).to.equal(15);
    expect(entry.fwCloudId).to.equal(42);
  });

  it('should leave session data empty when the request is not authenticated', async () => {
    const app = express();
    const middleware = new AuditLogMiddleware();

    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).session = {};
      (req as any).sessionID = '9999';
      next();
    });
    app.use((req, res, next) => middleware.handle(req, res, next));
    app.delete('/resource/:firewallId', (_req, res) => {
      res.status(204).send();
    });

    await request(app).delete('/resource/21').query({ cluster_id: '12' });

    const [entry] = await waitForAuditLogs();
    expect(entry.userId).to.be.null;
    expect(entry.userName).to.be.null;
    expect(entry.sessionId).to.be.null;
    expect(entry.clusterId).to.equal(12);
    expect(entry.firewallId).to.equal(21);
    expect(entry.description).to.contain('status=204');
    expect(entry.description).to.not.contain('user=');
  });

  it('should redact sensitive data from audit payloads', async () => {
    const app = express();
    const middleware = new AuditLogMiddleware();

    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).session = { user_id: 77, username: 'redactor' };
      (req as any).sessionID = 'sess-77';
      next();
    });
    app.use((req, res, next) => middleware.handle(req, res, next));

    app.post('/sensitive', (req, res) => {
      res.status(201).json({ ok: true });
    });

    await request(app)
      .post('/sensitive')
      .set('X-API-Key', 'top-secret-key')
      .query({ token: 'query-token' })
      .send({
        password: 'plain-text',
        tokens: ['one', 'two'],
        nested: {
          apiKey: 'nested-key',
          details: {
            secretValue: 'hidden',
          },
        },
      });

    const [entry] = await waitForAuditLogs();
    const payload = JSON.parse(entry.data);

    expect(payload.headers['x-api-key']).to.equal('[REDACTED]');
    expect(payload.query.token).to.equal('[REDACTED]');
    expect(payload.body.password).to.equal('[REDACTED]');
    expect(payload.body.tokens).to.equal('[REDACTED]');
    expect(payload.body.nested.apiKey).to.equal('[REDACTED]');
    expect(payload.body.nested.details.secretValue).to.equal('[REDACTED]');
  });

  describe('authentication events', () => {
    const createAuthApp = (initializer?: (req: Request) => void) => {
      const app = express();
      const middleware = new AuditLogMiddleware();

      app.use(express.json());
      app.use((req, _res, next) => {
        (req as any).session = (req as any).session ?? {};
        if (initializer) {
          initializer(req);
        }
        next();
      });
      app.use((req, res, next) => middleware.handle(req, res, next));

      return app;
    };

    it('should log successful login attempts with user info', async () => {
      const app = createAuthApp();

      app.post('/login', (req, res) => {
        (req as any).session.user_id = 888;
        (req as any).session.username = 'auth-user';
        (req as any).sessionID = 'login-session';
        res.status(200).json({ ok: true });
      });

      await request(app).post('/login').send({ username: 'auth-user', password: 'secret' });

      const [entry] = await waitForAuditLogs();
      expect(entry.call).to.equal('POST /login');
      expect(entry.userId).to.equal(888);
      expect(entry.userName).to.equal('auth-user');
      expect(entry.description).to.contain('status=200');
      expect(entry.description).to.contain('user=auth-user');

      const payload = JSON.parse(entry.data);
      expect(payload.method).to.equal('POST');
      expect(payload.body.username).to.equal('auth-user');
      expect(payload.body.password).to.equal('[REDACTED]');
    });

    it('should log failed login attempts without user info', async () => {
      const app = createAuthApp();

      app.post('/login', (_req, res) => {
        res.status(401).json({ error: 'invalid credentials' });
      });

      await request(app).post('/login').send({ username: 'auth-user', password: 'wrong' });

      const [entry] = await waitForAuditLogs();
      expect(entry.userId).to.be.null;
      expect(entry.userName).to.be.null;
      expect(entry.description).to.contain('status=401');
      expect(entry.description).to.not.contain('user=');

      const payload = JSON.parse(entry.data);
      expect(payload.method).to.equal('POST');
      expect(payload.body.password).to.equal('[REDACTED]');
    });

    it('should log logout events with existing session info', async () => {
      const app = createAuthApp((req) => {
        (req as any).session.user_id = 777;
        (req as any).session.username = 'auth-user';
        (req as any).sessionID = 'logout-session';
      });

      app.post('/logout', (_req, res) => {
        res.status(204).end();
      });

      await request(app).post('/logout');

      const [entry] = await waitForAuditLogs();
      expect(entry.call).to.equal('POST /logout');
      expect(entry.userId).to.equal(777);
      expect(entry.userName).to.equal('auth-user');
      expect(entry.description).to.contain('status=204');
      expect(entry.description).to.contain('user=auth-user');
    });
  });

  describe('network object actions', () => {
    const createNetworkObjectApp = () => {
      const app = express();
      const middleware = new AuditLogMiddleware();

      app.use(express.json());
      app.use((req, _res, next) => {
        (req as any).session = { user_id: 202, username: 'net-admin' };
        (req as any).sessionID = '5566';
        next();
      });
      app.use((req, res, next) => middleware.handle(req, res, next));

      return app;
    };

    it('should store audit data when creating a network object', async () => {
      const app = createNetworkObjectApp();

      app.post('/network-objects', (req, res) => {
        res.status(201).json({ created: req.body.name });
      });

      await request(app).post('/network-objects').send({
        fwcloud: 77,
        name: 'office-network',
        address: '10.0.0.0',
        netmask: '/24',
      });

      const [entry] = await waitForAuditLogs();
      expect(entry).to.exist;
      expect(entry.call).to.equal('POST /network-objects');
      expect(entry.fwCloudId).to.equal(77);
      expect(entry.userId).to.equal(202);
      expect(entry.description).to.contain('status=201');
      expect(entry.description).to.contain('user=net-admin');

      const payload = JSON.parse(entry.data);
      expect(payload.method).to.equal('POST');
      expect(payload.body.name).to.equal('office-network');
      expect(payload.body.netmask).to.equal('/24');
    });

    it('should store audit data when reading a network object', async () => {
      const app = createNetworkObjectApp();

      app.get('/network-objects/:fwcloudId/:objectId', (req, res) => {
        res.status(200).json({ id: Number.parseInt(req.params.objectId, 10) });
      });

      await request(app)
        .get('/network-objects/88/501')
        .set('X-Forwarded-For', '198.51.100.1')
        .query({ include: 'details' });

      const [entry] = await waitForAuditLogs();
      expect(entry).to.exist;
      expect(entry.call).to.equal('GET /network-objects/88/501?include=details');
      expect(entry.fwCloudId).to.equal(88);
      expect(entry.userId).to.equal(202);
      expect(entry.description).to.contain('status=200');
      expect(entry.description).to.contain('user=net-admin');
      expect(entry.description).to.contain('ip=198.51.100.1');

      const payload = JSON.parse(entry.data);
      expect(payload.method).to.equal('GET');
      expect(payload.params.fwcloudId).to.equal('88');
      expect(payload.params.objectId).to.equal('501');
      expect(payload.query.include).to.equal('details');
    });

    it('should store audit data when updating a network object', async () => {
      const app = createNetworkObjectApp();

      app.put('/network-objects/:objectId', (req, res) => {
        res.status(200).json({ updated: req.params.objectId });
      });

      await request(app).put('/network-objects/901').send({
        fwcloud: 66,
        name: 'branch-network',
        netmask: '/25',
      });

      const [entry] = await waitForAuditLogs();
      expect(entry).to.exist;
      expect(entry.call).to.equal('PUT /network-objects/901');
      expect(entry.fwCloudId).to.equal(66);
      expect(entry.userId).to.equal(202);
      expect(entry.description).to.contain('status=200');
      expect(entry.description).to.contain('user=net-admin');

      const payload = JSON.parse(entry.data);
      expect(payload.method).to.equal('PUT');
      expect(payload.body.name).to.equal('branch-network');
      expect(payload.body.netmask).to.equal('/25');
      expect(payload.params.objectId).to.equal('901');
    });

    it('should store audit data when deleting a network object', async () => {
      const app = createNetworkObjectApp();

      app.delete('/network-objects/:objectId', (req, res) => {
        res.status(204).end();
      });

      await request(app).delete('/network-objects/1234').query({ fwcloud: '55' });

      const [entry] = await waitForAuditLogs();
      expect(entry).to.exist;
      expect(entry.call).to.equal('DELETE /network-objects/1234?fwcloud=55');
      expect(entry.fwCloudId).to.equal(55);
      expect(entry.userId).to.equal(202);
      expect(entry.description).to.contain('status=204');
      expect(entry.description).to.contain('user=net-admin');

      const payload = JSON.parse(entry.data);
      expect(payload.method).to.equal('DELETE');
      expect(payload.params.objectId).to.equal('1234');
      expect(payload.query.fwcloud).to.equal('55');
    });
  });

  describe('user, role and permission actions', () => {
    const createAccountManagementApp = () => {
      const app = express();
      const middleware = new AuditLogMiddleware();

      app.use(express.json());
      app.use((req, _res, next) => {
        (req as any).session = { user_id: 303, username: 'security-admin' };
        (req as any).sessionID = '8877';
        next();
      });
      app.use((req, res, next) => middleware.handle(req, res, next));

      return app;
    };

    it('should store audit data when creating a user', async () => {
      const app = createAccountManagementApp();

      app.post('/users', (req, res) => {
        res.status(201).json({ id: 501, username: req.body.username });
      });

      await request(app).post('/users').send({
        customer: 4,
        username: 'jdoe',
        email: 'jdoe@example.com',
        role: 'analyst',
      });

      const [entry] = await waitForAuditLogs();
      expect(entry.call).to.equal('POST /users');
      expect(entry.description).to.contain('status=201');
      expect(entry.description).to.contain('user=security-admin');
      expect(entry.description).to.not.contain('user=303');

      const payload = JSON.parse(entry.data);
      expect(payload.method).to.equal('POST');
      expect(payload.body.username).to.equal('jdoe');
      expect(payload.body.role).to.equal('analyst');
    });

    it('should store audit data when updating a user', async () => {
      const app = createAccountManagementApp();

      app.patch('/users/:userId', (req, res) => {
        res.status(200).json({ updated: req.params.userId });
      });

      await request(app).patch('/users/41').send({
        email: 'new-email@example.com',
        role: 'manager',
      });

      const [entry] = await waitForAuditLogs();
      expect(entry.call).to.equal('PATCH /users/41');
      expect(entry.description).to.contain('status=200');
      expect(entry.description).to.contain('user=security-admin');
      expect(entry.description).to.not.contain('user=303');

      const payload = JSON.parse(entry.data);
      expect(payload.method).to.equal('PATCH');
      expect(payload.params.userId).to.equal('41');
      expect(payload.body.role).to.equal('manager');
    });

    it('should store audit data when deleting a user', async () => {
      const app = createAccountManagementApp();

      app.delete('/users/:userId', (req, res) => {
        res.status(204).end();
      });

      await request(app).delete('/users/99').query({ force: 'true' });

      const [entry] = await waitForAuditLogs();
      expect(entry.call).to.equal('DELETE /users/99?force=true');
      expect(entry.description).to.contain('status=204');
      expect(entry.description).to.contain('user=security-admin');
      expect(entry.description).to.not.contain('user=303');

      const payload = JSON.parse(entry.data);
      expect(payload.method).to.equal('DELETE');
      expect(payload.params.userId).to.equal('99');
      expect(payload.query.force).to.equal('true');
    });

    it('should store audit data when creating a role', async () => {
      const app = createAccountManagementApp();

      app.post('/roles', (req, res) => {
        res.status(201).json({ id: 12, name: req.body.name });
      });

      await request(app)
        .post('/roles')
        .send({
          name: 'ReadOnly',
          description: 'Read-only access role',
          permissions: ['view-report'],
        });

      const [entry] = await waitForAuditLogs();
      expect(entry.call).to.equal('POST /roles');
      expect(entry.description).to.contain('status=201');
      expect(entry.description).to.contain('user=security-admin');
      expect(entry.description).to.not.contain('user=303');

      const payload = JSON.parse(entry.data);
      expect(payload.method).to.equal('POST');
      expect(payload.body.name).to.equal('ReadOnly');
      expect(payload.body.permissions).to.deep.equal(['view-report']);
    });

    it('should store audit data when updating a role', async () => {
      const app = createAccountManagementApp();

      app.put('/roles/:roleId', (req, res) => {
        res.status(200).json({ updated: req.params.roleId });
      });

      await request(app)
        .put('/roles/55')
        .send({
          name: 'Operations',
          description: 'Operations team role',
          permissions: ['deploy', 'restore'],
        });

      const [entry] = await waitForAuditLogs();
      expect(entry.call).to.equal('PUT /roles/55');
      expect(entry.description).to.contain('status=200');
      expect(entry.description).to.contain('user=security-admin');
      expect(entry.description).to.not.contain('user=303');

      const payload = JSON.parse(entry.data);
      expect(payload.method).to.equal('PUT');
      expect(payload.params.roleId).to.equal('55');
      expect(payload.body.permissions).to.deep.equal(['deploy', 'restore']);
    });

    it('should store audit data when deleting a role', async () => {
      const app = createAccountManagementApp();

      app.delete('/roles/:roleId', (req, res) => {
        res.status(204).end();
      });

      await request(app).delete('/roles/23').query({ reassignedTo: 'manager' });

      const [entry] = await waitForAuditLogs();
      expect(entry.call).to.equal('DELETE /roles/23?reassignedTo=manager');
      expect(entry.description).to.contain('status=204');
      expect(entry.description).to.contain('user=security-admin');
      expect(entry.description).to.not.contain('user=303');

      const payload = JSON.parse(entry.data);
      expect(payload.method).to.equal('DELETE');
      expect(payload.params.roleId).to.equal('23');
      expect(payload.query.reassignedTo).to.equal('manager');
    });

    it('should store audit data when creating a permission', async () => {
      const app = createAccountManagementApp();

      app.post('/permissions', (req, res) => {
        res.status(201).json({ id: 'perm.deploy', description: req.body.description });
      });

      await request(app).post('/permissions').send({
        id: 'perm.deploy',
        description: 'Allow deployment operations',
      });

      const [entry] = await waitForAuditLogs();
      expect(entry.call).to.equal('POST /permissions');
      expect(entry.description).to.contain('status=201');
      expect(entry.description).to.contain('user=security-admin');
      expect(entry.description).to.not.contain('user=303');

      const payload = JSON.parse(entry.data);
      expect(payload.method).to.equal('POST');
      expect(payload.body.id).to.equal('perm.deploy');
      expect(payload.body.description).to.equal('Allow deployment operations');
    });

    it('should store audit data when updating a permission', async () => {
      const app = createAccountManagementApp();

      app.patch('/permissions/:permissionId', (req, res) => {
        res.status(200).json({ updated: req.params.permissionId });
      });

      await request(app).patch('/permissions/perm.view').send({
        description: 'Updated description',
      });

      const [entry] = await waitForAuditLogs();
      expect(entry.call).to.equal('PATCH /permissions/perm.view');
      expect(entry.description).to.contain('status=200');
      expect(entry.description).to.contain('user=security-admin');
      expect(entry.description).to.not.contain('user=303');

      const payload = JSON.parse(entry.data);
      expect(payload.method).to.equal('PATCH');
      expect(payload.params.permissionId).to.equal('perm.view');
      expect(payload.body.description).to.equal('Updated description');
    });

    it('should store audit data when deleting a permission', async () => {
      const app = createAccountManagementApp();

      app.delete('/permissions/:permissionId', (req, res) => {
        res.status(204).end();
      });

      await request(app).delete('/permissions/perm.revoke');

      const [entry] = await waitForAuditLogs();
      expect(entry.call).to.equal('DELETE /permissions/perm.revoke');
      expect(entry.description).to.contain('status=204');
      expect(entry.description).to.contain('user=security-admin');
      expect(entry.description).to.not.contain('user=303');

      const payload = JSON.parse(entry.data);
      expect(payload.method).to.equal('DELETE');
      expect(payload.params.permissionId).to.equal('perm.revoke');
    });
  });
});
