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

import * as fse from 'fs-extra';
import path from 'path';
import sinon from 'sinon';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';

import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { AuditLogService } from '../../../../src/models/audit/AuditLog.service';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { User } from '../../../../src/models/user/User';
import db from '../../../../src/database/database-manager';

describe(describeName('AuditLogService unit suite'), () => {
  let service: AuditLogService;
  let repository: Repository<AuditLog>;
  let archiveDir: string;
  let customConfigFile: string;

  const resolveArchiveDir = (): string => {
    const configuredDir: string = testSuite.app.config.get('auditLogs.archive.data_dir');
    return path.isAbsolute(configuredDir)
      ? configuredDir
      : path.resolve(testSuite.app.path, configuredDir);
  };

  const createAuditLog = async (overrides: Partial<AuditLog> = {}): Promise<AuditLog> => {
    const entity = repository.create({
      call: 'PUT /api/example',
      data: JSON.stringify({ sample: true }),
      description: 'audit log entry',
      timestamp: new Date('2024-01-01T00:00:00Z'),
      sessionId: null,
      userId: null,
      userName: null,
      fwCloudName: null,
      firewallName: null,
      clusterName: null,
      ...overrides,
    });

    return repository.save(entity);
  };

  beforeEach(async () => {
    service = await testSuite.app.getService<AuditLogService>(AuditLogService.name);

    archiveDir = resolveArchiveDir();
    await fse.remove(archiveDir);

    service = await service.build();

    repository = db.getSource().manager.getRepository(AuditLog);
    await repository.createQueryBuilder().delete().execute();

    customConfigFile = path.join(archiveDir, 'config.json');
    await fse.mkdirp(archiveDir);
  });

  afterEach(async () => {
    await fse.remove(customConfigFile);
    sinon.restore();
  });

  describe('listAuditLogs', () => {
    it('returns an empty result for non administrative users without identifiers', async () => {
      const result = await service.listAuditLogs({
        isAdmin: false,
        sessionId: null,
        userId: null,
      });

      expect(result.total).to.equal(0);
      expect(result.auditLogs).to.be.an('array').that.is.empty;
    });

    it('restricts non administrative users to their own session or user entries', async () => {
      const ownedBySession = await createAuditLog({
        timestamp: new Date('2024-01-03T12:00:00Z'),
        sessionId: 88,
      });
      const ownedByUser = await createAuditLog({
        timestamp: new Date('2024-01-02T12:00:00Z'),
        userId: 501,
        userName: 'current-user',
      });
      await createAuditLog({
        timestamp: new Date('2024-01-04T12:00:00Z'),
        sessionId: 99,
        userId: 999,
        userName: 'foreign',
      });

      const { auditLogs, total } = await service.listAuditLogs({
        isAdmin: false,
        sessionId: 88,
        userId: 501,
        take: 10,
      });

      expect(total).to.equal(2);
      expect(auditLogs.map((entry) => entry.id)).to.include.members([
        ownedBySession.id,
        ownedByUser.id,
      ]);
      auditLogs.forEach((entry) => {
        expect([88, 501]).to.include(entry.sessionId ?? entry.userId);
      });
    });

    it('applies date range and textual filters for administrative users', async () => {
      await createAuditLog({
        timestamp: new Date('2024-01-01T08:00:00Z'),
        userName: 'Alpha Tester',
        fwCloudName: 'North Cloud',
        firewallName: 'North Firewall',
        clusterName: 'North Cluster',
      });

      const expected = await createAuditLog({
        timestamp: new Date('2024-01-05T10:00:00Z'),
        userName: 'Beta Operator',
        fwCloudName: 'Production Stack',
        firewallName: 'Prod Shield',
        clusterName: 'Prod Cluster',
      });

      await createAuditLog({
        timestamp: new Date('2024-01-09T20:00:00Z'),
        userName: 'Gamma Engineer',
        fwCloudName: 'Staging Stack',
        firewallName: 'Stage Shield',
        clusterName: 'Stage Cluster',
      });

      const { auditLogs, total } = await service.listAuditLogs({
        isAdmin: true,
        timestampFrom: new Date('2024-01-03T00:00:00Z'),
        timestampTo: new Date('2024-01-07T00:00:00Z'),
        userName: 'beta',
        fwCloudName: 'production',
        firewallName: 'prod',
        clusterName: 'prod',
      });

      expect(total).to.equal(1);
      expect(auditLogs).to.have.length(1);
      expect(auditLogs[0].id).to.equal(expected.id);
    });

    it('injects cursor guard clauses when paginating', async () => {
      const captured: unknown[] = [];
      const getManyAndCountStub = sinon.stub().resolves([[], 0]);

      const fakeQueryBuilder = {
        orderBy: sinon.stub().returnsThis(),
        addOrderBy: sinon.stub().returnsThis(),
        andWhere: sinon.stub().callsFake((condition: unknown) => {
          captured.push(condition);
          return fakeQueryBuilder;
        }),
        skip: sinon.stub().returnsThis(),
        take: sinon.stub().returnsThis(),
        getManyAndCount: getManyAndCountStub,
      } as unknown as SelectQueryBuilder<AuditLog>;

      sinon
        .stub(service['auditLogRepository'], 'createQueryBuilder')
        .callsFake(() => fakeQueryBuilder);

      await service.listAuditLogs({
        isAdmin: true,
        cursor: {
          timestamp: new Date('2024-01-10T12:00:00Z'),
          id: 321,
        },
      });

      const guardClause = captured.find((entry) => entry instanceof Brackets) as
        | Brackets
        | undefined;
      expect(guardClause).to.not.be.undefined;

      const clauseSource = guardClause?.whereFactory?.toString() ?? '';
      expect(clauseSource).to.contain('auditLog.timestamp < :cursorTimestamp');
      expect(clauseSource).to.contain('auditLog.id < :cursorId');
      expect(getManyAndCountStub.calledOnce).to.be.true;
    });

    it('filters administrative requests by an explicit session identifier', async () => {
      await createAuditLog({
        timestamp: new Date('2024-01-02T08:00:00Z'),
        sessionId: 11,
      });
      const expected = await createAuditLog({
        timestamp: new Date('2024-01-03T08:00:00Z'),
        sessionId: 22,
      });

      const { auditLogs, total } = await service.listAuditLogs({
        isAdmin: true,
        sessionIdFilter: 22,
      });

      expect(total).to.equal(1);
      expect(auditLogs).to.have.length(1);
      expect(auditLogs[0].id).to.equal(expected.id);
    });
  });

  describe('syncEntriesWithUser', () => {
    it('returns the provided collection when there is nothing to synchronise', async () => {
      const entry = await createAuditLog({
        userId: 42,
        userName: 'existing-user',
      });

      const unchanged = await service.syncEntriesWithUser([entry], null);
      expect(unchanged).to.have.length(1);
      expect(unchanged[0].userName).to.equal('existing-user');
    });

    it('persists user identifiers on mismatched entries', async () => {
      const user = Object.assign(new User(), {
        id: 900,
        username: 'updated-user',
        name: 'Updated User',
      });

      const matching = await createAuditLog({
        userId: 900,
        userName: 'updated-user',
      });

      const stale = await createAuditLog({
        userId: null,
        userName: null,
      });

      const updated = await service.syncEntriesWithUser([matching, stale], user);

      expect(updated).to.have.length(2);
      updated.forEach((entry) => {
        expect(entry.userId).to.equal(900);
        expect(entry.userName).to.equal('updated-user');
      });

      const persisted = await repository.findOne({ where: { id: stale.id } });
      expect(persisted?.userId).to.equal(900);
      expect(persisted?.userName).to.equal('updated-user');
    });
  });

  describe('archive configuration', () => {
    it('returns defaults when no custom configuration is present', async () => {
      await fse.remove(customConfigFile);

      const defaults = testSuite.app.config.get('auditLogs.archive');
      const config = service.getCustomizedConfig();

      expect(config.archive_days).to.equal(defaults.archive_days);
      expect(config.retention_days).to.equal(defaults.retention_days);
    });

    it('honours custom configuration overrides', async () => {
      await fse.writeFile(
        customConfigFile,
        JSON.stringify({ archive_days: 8, retention_days: 16 }),
        'utf8',
      );

      const config = service.getCustomizedConfig();
      expect(config.archive_days).to.equal(8);
      expect(config.retention_days).to.equal(16);
    });

    it('persists new configuration values to disk and reloads them', async () => {
      const payload = { archive_days: 12, retention_days: 24 };

      const response = await service.updateArchiveConfig(payload);
      expect(response).to.deep.equal(payload);

      const stored = JSON.parse(await fse.readFile(customConfigFile, 'utf8'));
      expect(stored).to.deep.equal(payload);

      const refreshed = service.getCustomizedConfig();
      expect(refreshed.archive_days).to.equal(12);
      expect(refreshed.retention_days).to.equal(24);
    });
  });
});
