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

    You should have received a copy of the GNU Affero General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import request from 'supertest';
import { Request as ExpressRequest } from 'express';
import { Repository } from 'typeorm';

import { describeName, expect, testSuite } from '../../mocha/global-setup';
import { Application } from '../../../src/Application';
import { _URL } from '../../../src/fonaments/http/router/router.service';
import { AuditLog } from '../../../src/models/audit/AuditLog';
import { AuditLogHelper } from '../../../src/models/audit/audit-log.helper';
import { User } from '../../../src/models/user/User';
import db from '../../../src/database/database-manager';
import { attachSession, createUser, generateSession } from '../../utils/utils';

describe(describeName('AuditLog API E2E suite'), () => {
  let app: Application;
  let repository: Repository<AuditLog>;

  let regularUser: User;
  let regularSessionToken: string;
  let regularSessionNumeric: number;

  let adminUser: User;
  let adminSessionToken: string;

  let userOwnedLog: AuditLog;
  let sessionOwnedLog: AuditLog;
  let adminOwnedLog: AuditLog;
  let foreignLog: AuditLog;

  const resolveNumericSession = (user: User, sessionId: string): number => {
    const resolved = AuditLogHelper.resolveSessionId({
      session: { user_id: user.id },
      sessionID: sessionId,
    } as unknown as ExpressRequest);

    if (resolved === null) {
      throw new Error('Unable to resolve a numeric session identifier');
    }

    return resolved;
  };

  const persistAuditLog = async (overrides: Partial<AuditLog>): Promise<AuditLog> => {
    const base: Partial<AuditLog> = {
      call: 'PUT /api/example',
      data: JSON.stringify({ payload: true }),
      description: 'audit log entry',
      timestamp: new Date('2024-01-01T00:00:00Z'),
      userId: null,
      userName: null,
      sessionId: null,
      fwCloudId: null,
      fwCloudName: null,
      firewallId: null,
      firewallName: null,
      clusterId: null,
      clusterName: null,
    };

    return repository.save(repository.create({ ...base, ...overrides }));
  };

  const listAuditLogs = (sessionId: string, query: Record<string, unknown> = {}) => {
    return request(app.express)
      .put(_URL().getURL('auditlogs.list'))
      .set('Cookie', [attachSession(sessionId)])
      .query(query)
      .send({});
  };

  beforeEach(async () => {
    app = testSuite.app;
    repository = db.getSource().manager.getRepository(AuditLog);
    await repository.clear();

    regularUser = await createUser({ role: 0 });
    regularSessionToken = generateSession(regularUser);
    regularSessionNumeric = resolveNumericSession(regularUser, regularSessionToken);

    adminUser = await createUser({ role: 1 });
    adminSessionToken = generateSession(adminUser);
    resolveNumericSession(adminUser, adminSessionToken);

    userOwnedLog = await persistAuditLog({
      call: 'PUT /api/user-owned',
      timestamp: new Date('2024-01-02T12:00:00Z'),
      userId: regularUser.id,
      userName: regularUser.username,
      fwCloudName: 'User Cloud',
      firewallName: 'User Firewall',
      clusterName: 'User Cluster',
    });

    sessionOwnedLog = await persistAuditLog({
      call: 'PUT /api/session-owned',
      timestamp: new Date('2024-01-03T12:00:00Z'),
      sessionId: regularSessionNumeric,
      userId: regularUser.id,
      userName: null,
      fwCloudName: 'Session Cloud',
      firewallName: 'Session Firewall',
      clusterName: 'Session Cluster',
    });

    adminOwnedLog = await persistAuditLog({
      call: 'PUT /api/admin-owned',
      timestamp: new Date('2024-01-04T12:00:00Z'),
      userId: adminUser.id,
      userName: adminUser.username,
      fwCloudName: 'Production Cloud',
      firewallName: 'Production Firewall',
      clusterName: 'Production Cluster',
    });

    foreignLog = await persistAuditLog({
      call: 'PUT /api/foreign',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      userId: 9999,
      userName: 'foreign-user',
      fwCloudName: 'Foreign Cloud',
      firewallName: 'Foreign Firewall',
      clusterName: 'Foreign Cluster',
    });
  });

  it('rejects unauthenticated access attempts', async () => {
    await request(app.express).put(_URL().getURL('auditlogs.list')).expect(401);
  });

  it('limits regular users to their own entries and synchronises ownership details', async () => {
    await listAuditLogs(regularSessionToken)
      .expect(200)
      .then((response) => {
        const payload = response.body.data;

        expect(payload.total).to.equal(2);
        expect(payload.auditLogs.map((entry: AuditLog) => entry.id)).to.deep.equal([
          sessionOwnedLog.id,
          userOwnedLog.id,
        ]);

        payload.auditLogs.forEach((entry: AuditLog) => {
          expect(entry.userId).to.equal(regularUser.id);
          expect(entry.userName).to.equal(regularUser.username);
        });
      });
  });

  it('allows administrators to filter by text fields and time windows', async () => {
    await listAuditLogs(adminSessionToken, {
      ts_from: '2024-01-04T00:00:00.000Z',
      ts_to: '2024-01-05T00:00:00.000Z',
      user_name: 'admin',
      fwcloud_name: 'production',
      firewall_name: 'production',
      cluster_name: 'production',
    })
      .expect(200)
      .then((response) => {
        const payload = response.body.data;

        expect(payload.total).to.equal(1);
        expect(payload.auditLogs).to.have.length(1);
        expect(payload.auditLogs[0].id).to.equal(adminOwnedLog.id);
      });
  });

  it('filters administrative listings by explicit session identifier', async () => {
    await listAuditLogs(adminSessionToken, {
      session_id: regularSessionNumeric.toString(),
    })
      .expect(200)
      .then((response) => {
        const payload = response.body.data;

        expect(payload.total).to.equal(1);
        expect(payload.auditLogs).to.have.length(1);
        expect(payload.auditLogs[0].id).to.equal(sessionOwnedLog.id);
      });
  });

  it('returns the complete dataset when the limit is set to zero', async () => {
    await listAuditLogs(adminSessionToken, { limit: 0 })
      .expect(200)
      .then((response) => {
        const payload = response.body.data;

        expect(payload.total).to.equal(4);
        expect(payload.auditLogs.map((entry: AuditLog) => entry.id)).to.deep.equal([
          adminOwnedLog.id,
          sessionOwnedLog.id,
          userOwnedLog.id,
          foreignLog.id,
        ]);
      });
  });

  it('supports cursor-based pagination for administrators', async () => {
    const baselineResponse = await listAuditLogs(adminSessionToken).expect(200);
    const baseline = baselineResponse.body.data;

    expect(baseline.total).to.equal(4);
    expect(baseline.auditLogs.map((entry: AuditLog) => entry.id)).to.deep.equal([
      adminOwnedLog.id,
      sessionOwnedLog.id,
      userOwnedLog.id,
      foreignLog.id,
    ]);

    const pivot = baseline.auditLogs[baseline.auditLogs.length - 2];
    const cursor = `${pivot.timestamp}:${pivot.id}`;

    await listAuditLogs(adminSessionToken, { cursor })
      .expect(200)
      .then((response) => {
        const payload = response.body.data;

        expect(payload.total).to.equal(1);
        expect(payload.auditLogs.map((entry: AuditLog) => entry.id)).to.deep.equal([foreignLog.id]);
      });
  });
});
