/*!
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import type { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { User } from '../../../../src/models/user/User';
import StringHelper from '../../../../src/utils/string.helper';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../../utils/utils';
import type { Repository } from 'typeorm';
import request = require('supertest');

describe(describeName('Assisted Profile availability E2E tests'), () => {
  let app: Application;
  let adminUser: User;
  let adminUserSessionId: string;
  let fwCloud: FwCloud;
  let fwCloudRepository: Repository<FwCloud>;
  let auditLogRepository: Repository<AuditLog>;
  let auditCountBefore: number;

  const availabilityUrl = (cloudId: number = fwCloud.id) =>
    `/fwclouds/${cloudId}/assistant/availability`;

  beforeEach(async () => {
    app = testSuite.app;
    fwCloudRepository = db.getSource().manager.getRepository(FwCloud);
    auditLogRepository = db.getSource().manager.getRepository(AuditLog);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    fwCloud = await fwCloudRepository.save({
      name: StringHelper.randomize(10),
      locked: false,
      locked_by: null,
    });

    auditCountBefore = await auditLogRepository.count();
  });

  it('rejects guest users', async () => {
    await request(app.express).get(availabilityUrl()).expect(401);
  });

  it('rejects users without access to the FWCloud', async () => {
    const regularUser = await createUser({ role: 0 });
    const regularUserSessionId = generateSession(regularUser);

    await request(app.express)
      .get(availabilityUrl())
      .set('Cookie', [attachSession(regularUserSessionId)])
      .expect(401);
  });

  it('allows a member of the FWCloud and returns the process-global availability snapshot', async () => {
    const memberUser = await createUser({ role: 0 });
    memberUser.fwClouds = [fwCloud];
    await db.getSource().manager.getRepository(User).save(memberUser);
    const memberSessionId = generateSession(memberUser);

    await request(app.express)
      .get(availabilityUrl())
      .set('Cookie', [attachSession(memberSessionId)])
      .expect(200)
      .then((response) => {
        const body = response.body.data as Record<string, unknown>;
        expect(body).to.have.all.keys([
          'available',
          'busy',
          'alive',
          'modelReady',
          'status',
          'lastCheckedAt',
        ]);
        expect(body.status).to.be.oneOf(['ready', 'busy', 'unavailable']);
        expect(body.available).to.be.a('boolean');
      });
  });

  it('defaults to a safe unavailable snapshot when the agent is not configured', async () => {
    // This test environment does not configure ASSISTED_PROFILE_AGENT_URL, so
    // the API must never optimistically report the Assistant as available.
    await request(app.express)
      .get(availabilityUrl())
      .set('Cookie', [attachSession(adminUserSessionId)])
      .expect(200)
      .then((response) => {
        const body = response.body.data as Record<string, unknown>;
        expect(body.available).to.equal(false);
        expect(body.status).to.equal('unavailable');
      });
  });

  it('never exposes the agent URL, API key, or a raw upstream error', async () => {
    const response = await request(app.express)
      .get(availabilityUrl())
      .set('Cookie', [attachSession(adminUserSessionId)])
      .expect(200);

    const serialized = JSON.stringify(response.body);
    expect(serialized).to.not.contain('api_key');
    expect(serialized).to.not.contain('apiKey');
    expect(serialized).to.not.contain('X-API-Key');
    expect(serialized).to.not.contain('failureCode');
    expect(serialized).to.not.match(/https?:\/\//);
  });

  it('does not generate an audit log event', async () => {
    await request(app.express)
      .get(availabilityUrl())
      .set('Cookie', [attachSession(adminUserSessionId)])
      .expect(200);
    await request(app.express)
      .get(availabilityUrl())
      .set('Cookie', [attachSession(adminUserSessionId)])
      .expect(200);

    expect(await auditLogRepository.count()).to.equal(auditCountBefore);
  });
});
