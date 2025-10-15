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

import request = require('supertest');
import { Request as ExpressRequest } from 'express';
import { Repository } from 'typeorm';
import { describeName, testSuite, expect } from '../../mocha/global-setup';
import { Application } from '../../../src/Application';
import { _URL } from '../../../src/fonaments/http/router/router.service';
import { AuditLog } from '../../../src/models/audit/AuditLog';
import { AuditLogHelper } from '../../../src/models/audit/audit-log.helper';
import { User } from '../../../src/models/user/User';
import db from '../../../src/database/database-manager';
import { attachSession, createUser, generateSession } from '../../utils/utils';

describe(describeName('AuditLog E2E tests'), () => {
  let app: Application;
  let auditLogRepository: Repository<AuditLog>;

  let regularUser: User;
  let regularSessionId: string;
  let regularSessionNumeric: number;

  let adminUser: User;
  let adminSessionId: string;
  let adminSessionNumeric: number;

  let userOwnedLog: AuditLog;
  let sessionOwnedLog: AuditLog;
  let adminOwnedLog: AuditLog;

  beforeEach(async () => {
    app = testSuite.app;
    auditLogRepository = db.getSource().manager.getRepository(AuditLog);

    await auditLogRepository.clear();

    regularUser = await createUser({ role: 0 });
    regularSessionId = generateSession(regularUser);
    const derivedRegularSession = AuditLogHelper.resolveSessionId({
      session: { user_id: regularUser.id },
      sessionID: regularSessionId,
    } as unknown as ExpressRequest);
    if (derivedRegularSession === null) {
      throw new Error('Unable to derive a numeric session id for the regular user');
    }
    regularSessionNumeric = derivedRegularSession;

    adminUser = await createUser({ role: 1 });
    adminSessionId = generateSession(adminUser);
    const derivedAdminSession = AuditLogHelper.resolveSessionId({
      session: { user_id: adminUser.id },
      sessionID: adminSessionId,
    } as unknown as ExpressRequest);
    if (derivedAdminSession === null) {
      throw new Error('Unable to derive a numeric session id for the admin user');
    }
    adminSessionNumeric = derivedAdminSession;

    const baseAuditLog = {
      call: 'PUT /api/example',
      data: JSON.stringify({ message: 'test' }),
      description: 'Audit log entry',
      fwCloudId: null,
      fwCloudName: null,
      firewallId: null,
      firewallName: null,
      clusterId: null,
      clusterName: null,
      userName: null,
    };

    userOwnedLog = await auditLogRepository.save(
      auditLogRepository.create({
        ...baseAuditLog,
        timestamp: new Date('2024-01-02T12:00:00Z'),
        userId: regularUser.id,
        userName: regularUser.username,
        sessionId: null,
      }),
    );

    sessionOwnedLog = await auditLogRepository.save(
      auditLogRepository.create({
        ...baseAuditLog,
        timestamp: new Date('2024-01-03T12:00:00Z'),
        userId: regularUser.id,
        userName: null,
        sessionId: regularSessionNumeric,
      }),
    );

    adminOwnedLog = await auditLogRepository.save(
      auditLogRepository.create({
        ...baseAuditLog,
        timestamp: new Date('2024-01-04T12:00:00Z'),
        userId: adminUser.id,
        userName: adminUser.username,
        sessionId: adminSessionNumeric,
      }),
    );
  });

  describe('AuditLogController@list', () => {
    it('guest user should not access audit logs', async () => {
      await request(app.express).put(_URL().getURL('auditlogs.list')).expect(401);
    });

    it('regular user should only see their own audit logs', async () => {
      await request(app.express)
        .put(_URL().getURL('auditlogs.list'))
        .set('Cookie', [attachSession(regularSessionId)])
        .send({})
        .expect(200)
        .then((response) => {
          const payload = response.body.data;
          expect(payload.total).to.equal(2);

          const ids = payload.auditLogs.map((entry) => entry.id);
          expect(ids).to.deep.equal([sessionOwnedLog.id, userOwnedLog.id]);

          payload.auditLogs.forEach((entry) => {
            expect(entry.userId).to.equal(regularUser.id);
            expect(entry.userName).to.equal(regularUser.username);
          });
        });
    });

    it('admin user should see all audit logs', async () => {
      await request(app.express)
        .put(_URL().getURL('auditlogs.list'))
        .set('Cookie', [attachSession(adminSessionId)])
        .send({})
        .expect(200)
        .then((response) => {
          const payload = response.body.data;
          expect(payload.total).to.equal(3);
          expect(payload.auditLogs.map((entry) => entry.id)).to.deep.equal([
            adminOwnedLog.id,
            sessionOwnedLog.id,
            userOwnedLog.id,
          ]);

          const adminEntry = payload.auditLogs.find((entry) => entry.id === adminOwnedLog.id);
          expect(adminEntry.userId).to.equal(adminUser.id);
          expect(adminEntry.userName).to.equal(adminUser.username);
        });
    });
  });
});
