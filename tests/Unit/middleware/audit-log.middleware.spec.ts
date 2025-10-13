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

import express from 'express';
import request from 'supertest';
import { expect } from 'chai';
import { AuditLogMiddleware } from '../../../src/middleware/audit-log.middleware';
import { AuditLog } from '../../../src/models/audit/AuditLog';
import db from '../../../src/database/database-manager';
import { createHash } from 'crypto';
import { testSuite } from '../../mocha/global-setup';

describe('AuditLogMiddleware', () => {
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
    expect(entry.description).to.contain('user=99');
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
});
