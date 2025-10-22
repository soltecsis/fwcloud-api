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

import { Repository } from 'typeorm';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import {
  AuditLogService,
  ListAuditLogsOptions,
} from '../../../../src/models/audit/AuditLog.service';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import db from '../../../../src/database/database-manager';

describe.only(describeName('AuditLogService list Unit tests'), () => {
  let service: AuditLogService;
  let repository: Repository<AuditLog>;

  const createLog = async (overrides: Partial<AuditLog>): Promise<AuditLog> => {
    const entity = repository.create(
      Object.assign(
        {
          call: 'PUT /resource',
          data: JSON.stringify({ payload: true }),
          description: 'test audit entry',
          timestamp: new Date('2024-01-01T12:00:00Z'),
        },
        overrides,
      ),
    );

    return repository.save(entity);
  };

  beforeEach(async () => {
    service = await testSuite.app.getService<AuditLogService>(AuditLogService.name);
    repository = db.getSource().manager.getRepository(AuditLog);
    await repository.createQueryBuilder().delete().execute();
  });

  it('returns no results for restricted users without identifiers', async () => {
    const result = await service.listAuditLogs({
      isAdmin: false,
      sessionId: null,
      userId: null,
    });

    expect(result.total).to.equal(0);
    expect(result.auditLogs).to.be.an('array').that.is.empty;
  });

  it('filters entries by date range and text fields', async () => {
    await createLog({
      timestamp: new Date('2024-01-01T00:00:00Z'),
      userName: 'Alpha User',
      fwCloudName: 'Edge Cloud',
      firewallName: 'North Firewall',
      clusterName: 'Cluster North',
      sessionId: 10,
      userId: 1,
    });

    const matching = await createLog({
      timestamp: new Date('2024-01-05T10:00:00Z'),
      userName: 'Beta Operator',
      fwCloudName: 'Production Cloud',
      firewallName: 'Prod Firewall',
      clusterName: 'Prod Cluster',
      sessionId: 11,
      userId: 2,
    });

    await createLog({
      timestamp: new Date('2024-01-10T18:00:00Z'),
      userName: 'Gamma Admin',
      fwCloudName: 'Staging Cloud',
      firewallName: 'Staging Firewall',
      clusterName: 'Staging Cluster',
      sessionId: 12,
      userId: 3,
    });

    const options: ListAuditLogsOptions = {
      isAdmin: true,
      timestampFrom: new Date('2024-01-03T00:00:00Z'),
      timestampTo: new Date('2024-01-08T00:00:00Z'),
      userName: 'beta',
      fwCloudName: 'production',
      firewallName: 'prod',
      clusterName: 'prod',
      take: 5,
    };

    const result = await service.listAuditLogs(options);

    expect(result.total).to.equal(1);
    expect(result.auditLogs).to.have.length(1);
    expect(result.auditLogs[0].id).to.equal(matching.id);
  });

  it('enforces session or user restrictions for non administrative requests', async () => {
    const sessionEntry = await createLog({
      timestamp: new Date('2024-01-03T12:00:00Z'),
      sessionId: 33,
      userId: null,
      userName: null,
      fwCloudName: 'Session Cloud',
    });

    const userEntry = await createLog({
      timestamp: new Date('2024-01-04T12:00:00Z'),
      sessionId: null,
      userId: 44,
      userName: 'User Entry',
      fwCloudName: 'User Cloud',
    });

    await createLog({
      timestamp: new Date('2024-01-05T12:00:00Z'),
      sessionId: 55,
      userId: 66,
      userName: 'Other',
      fwCloudName: 'Other Cloud',
    });

    const result = await service.listAuditLogs({
      isAdmin: false,
      sessionId: 33,
      userId: 44,
      take: 10,
    });

    expect(result.total).to.equal(2);
    const ids = result.auditLogs.map((entry) => entry.id);
    expect(ids).to.include(sessionEntry.id);
    expect(ids).to.include(userEntry.id);
  });

  it('supports cursor based pagination by timestamp and id', async () => {
    const first = await createLog({
      timestamp: new Date('2024-01-01T08:00:00Z'),
      userName: 'First',
    });

    const second = await createLog({
      timestamp: new Date('2024-01-02T08:00:00Z'),
      userName: 'Second',
    });

    const third = await createLog({
      timestamp: new Date('2024-01-02T08:00:00Z'),
      userName: 'Third',
    });

    const firstPage = await service.listAuditLogs({
      isAdmin: true,
      take: 2,
    });

    expect(firstPage.auditLogs).to.have.length(2);
    expect(firstPage.auditLogs[0].id).to.equal(third.id);
    expect(firstPage.auditLogs[1].id).to.equal(second.id);

    const cursor = {
      timestamp: firstPage.auditLogs[1].timestamp,
      id: firstPage.auditLogs[1].id,
    };

    const secondPage = await service.listAuditLogs({
      isAdmin: true,
      take: 2,
      cursor,
    });

    expect(secondPage.total).to.equal(1);
    expect(secondPage.auditLogs).to.have.length(1);
    expect(secondPage.auditLogs[0].id).to.equal(first.id);
  });
});
