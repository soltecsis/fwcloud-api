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
import { Repository, SelectQueryBuilder } from 'typeorm';

import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import {
  AuditLogService,
  ListAuditLogsOptions,
} from '../../../../src/models/audit/AuditLog.service';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { User } from '../../../../src/models/user/User';
import db from '../../../../src/database/database-manager';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { Cluster } from '../../../../src/models/firewall/Cluster';

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
      startedAt: new Date('2024-01-01T00:00:00Z'),
      sessionId: null,
      userId: null,
      userName: null,
      fwCloudName: null,
      firewallName: null,
      clusterName: null,
      sourceIp: null,
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
    it('excludes only explicitly marked challenges while retaining other errors and historical entries', async () => {
      const challenge = await createAuditLog({ status: 403, confirmationTokenChallenge: true });
      const retained = await Promise.all(
        [
          { status: 403, confirmationTokenChallenge: false },
          { status: 403, confirmationTokenChallenge: null },
          { status: 401, confirmationTokenChallenge: false },
          { status: 500, confirmationTokenChallenge: false },
          { status: 200, confirmationTokenChallenge: false },
        ].map((entry) => createAuditLog(entry)),
      );

      const result = await service.listAuditLogs({
        isAdmin: true,
        excludeConfirmationTokenRequests: true,
      });

      expect(result.total).to.equal(retained.length);
      expect(result.auditLogs.map((entry) => entry.id)).to.have.members(
        retained.map((entry) => entry.id),
      );
      expect(
        result.auditLogs.find((entry) => entry.id === retained[0].id).confirmationTokenChallenge,
      ).to.be.false;
      expect(
        result.auditLogs.find((entry) => entry.id === retained[1].id).confirmationTokenChallenge,
      ).to.be.null;
      expect(await repository.findOneBy({ id: challenge.id })).not.to.be.null;
      expect(await repository.count()).to.equal(retained.length + 1);
    });

    for (const excludeConfirmationTokenRequests of [undefined, false]) {
      it(`includes marked challenges when exclusion is ${String(excludeConfirmationTokenRequests)}`, async () => {
        const challenge = await createAuditLog({ status: 403, confirmationTokenChallenge: true });
        const unrelated = await createAuditLog({ status: 403, confirmationTokenChallenge: false });

        const result = await service.listAuditLogs({
          isAdmin: true,
          excludeConfirmationTokenRequests,
        });

        expect(result.total).to.equal(2);
        expect(result.auditLogs.map((entry) => entry.id)).to.have.members([
          challenge.id,
          unrelated.id,
        ]);
        expect(
          result.auditLogs.find((entry) => entry.id === challenge.id).confirmationTokenChallenge,
        ).to.be.true;
      });
    }

    it('combines exclusion with access restrictions and computes totals before pagination', async () => {
      const first = await createAuditLog({
        userId: 501,
        status: 403,
        confirmationTokenChallenge: false,
      });
      await createAuditLog({ userId: 501, status: 403, confirmationTokenChallenge: true });
      const second = await createAuditLog({
        userId: 501,
        status: 401,
        confirmationTokenChallenge: false,
      });
      await createAuditLog({ userId: 999, confirmationTokenChallenge: false });
      const options: ListAuditLogsOptions = {
        isAdmin: false,
        userId: 501,
        excludeConfirmationTokenRequests: true,
        take: 1,
        sortOrder: 'asc',
      };

      const pageOne = await service.listAuditLogs(options);
      const pageTwo = await service.listAuditLogs({ ...options, skip: 1 });

      expect(pageOne.total).to.equal(2);
      expect(pageTwo.total).to.equal(2);
      expect(pageOne.auditLogs.map((entry) => entry.id)).to.deep.equal([first.id]);
      expect(pageTwo.auditLogs.map((entry) => entry.id)).to.deep.equal([second.id]);
    });

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
        startedAt: new Date('2024-01-03T12:00:00Z'),
        sessionId: 88,
      });
      const ownedByUser = await createAuditLog({
        startedAt: new Date('2024-01-02T12:00:00Z'),
        userId: 501,
        userName: 'current-user',
      });
      await createAuditLog({
        startedAt: new Date('2024-01-04T12:00:00Z'),
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
        startedAt: new Date('2024-01-01T08:00:00Z'),
        userName: 'Alpha Tester',
        fwCloudName: 'North Cloud',
        firewallName: 'North Firewall',
        clusterName: 'North Cluster',
      });

      const expected = await createAuditLog({
        startedAt: new Date('2024-01-05T10:00:00Z'),
        userName: 'Beta Operator',
        fwCloudName: 'Production Stack',
        firewallName: 'Prod Shield',
        clusterName: 'Prod Cluster',
      });

      await createAuditLog({
        startedAt: new Date('2024-01-09T20:00:00Z'),
        userName: 'Gamma Engineer',
        fwCloudName: 'Staging Stack',
        firewallName: 'Stage Shield',
        clusterName: 'Stage Cluster',
      });

      const { auditLogs, total } = await service.listAuditLogs({
        isAdmin: true,
        startedAtFrom: new Date('2024-01-03T00:00:00Z'),
        startedAtTo: new Date('2024-01-07T00:00:00Z'),
        userName: 'beta',
        fwCloudName: 'production',
        firewallName: 'prod',
        clusterName: 'prod',
      });

      expect(total).to.equal(1);
      expect(auditLogs).to.have.length(1);
      expect(auditLogs[0].id).to.equal(expected.id);
    });

    it('filters administrative requests by source IP address', async () => {
      await createAuditLog({
        startedAt: new Date('2024-01-05T10:00:00Z'),
        sourceIp: '198.51.100.10',
      });

      const expected = await createAuditLog({
        startedAt: new Date('2024-01-06T10:00:00Z'),
        sourceIp: '198.51.100.20',
      });

      await createAuditLog({
        startedAt: new Date('2024-01-07T10:00:00Z'),
        sourceIp: '203.0.113.30',
      });

      const { auditLogs, total } = await service.listAuditLogs({
        isAdmin: true,
        sourceIp: '198.51.100.20',
      });

      expect(total).to.equal(1);
      expect(auditLogs).to.have.length(1);
      expect(auditLogs[0].id).to.equal(expected.id);
    });

    it('returns summary entries without the serialized data payload', async () => {
      const expected = await createAuditLog({
        data: JSON.stringify({ payload: 'x'.repeat(10_000), durationMs: 1234 }),
        durationMs: 1234,
      });

      const { auditLogs, total } = await service.listAuditLogs({
        isAdmin: true,
        take: 10,
      });

      expect(total).to.be.greaterThan(0);
      const summary = auditLogs.find((entry) => entry.id === expected.id);
      expect(summary).to.not.be.undefined;
      expect(Object.prototype.hasOwnProperty.call(summary, 'data')).to.equal(false);
      expect(summary?.durationMs).to.equal(1234);
    });

    describe('sorting queries', () => {
      const stubListQuery = () => {
        const query = {
          clone: sinon.stub().returnsThis(),
          select: sinon.stub().returnsThis(),
          addSelect: sinon.stub().returnsThis(),
          orderBy: sinon.stub().returnsThis(),
          addOrderBy: sinon.stub().returnsThis(),
          andWhere: sinon.stub().returnsThis(),
          limit: sinon.stub().returnsThis(),
          offset: sinon.stub().returnsThis(),
          getCount: sinon.stub().resolves(0),
          getRawMany: sinon.stub().resolves([]),
        };
        sinon
          .stub(service['auditLogRepository'], 'createQueryBuilder')
          .returns(query as unknown as SelectQueryBuilder<AuditLog>);
        return query;
      };

      it('applies challenge exclusion to the database query before counts and paging', async () => {
        const query = stubListQuery();

        await service.listAuditLogs({
          isAdmin: true,
          excludeConfirmationTokenRequests: true,
          take: 10,
          skip: 2,
        });

        expect(query.andWhere.firstCall.args).to.deep.equal([
          '(auditLog.confirmationTokenChallenge IS NULL OR auditLog.confirmationTokenChallenge = :confirmationTokenChallenge)',
          { confirmationTokenChallenge: false },
        ]);
        sinon.assert.callOrder(
          query.andWhere,
          query.getCount,
          query.limit,
          query.offset,
          query.getRawMany,
        );
      });

      for (const sortBy of ['start', 'end'] as const) {
        for (const sortOrder of ['asc', 'desc'] as const) {
          it(`uses the selected database sort and cursor comparison for ${sortBy} ${sortOrder}`, async () => {
            const query = stubListQuery();
            const timestamp = new Date('2024-01-10T12:00:00.123Z');
            await service.listAuditLogs({
              isAdmin: true,
              sortBy,
              sortOrder,
              cursor:
                sortBy === 'start'
                  ? { startedAt: timestamp, id: 321 }
                  : { finishedAt: timestamp, id: 321 },
              take: 10,
              skip: 2,
            });

            const direction = sortOrder.toUpperCase();
            const comparison = sortOrder === 'asc' ? '>' : '<';
            const guard = query.andWhere.firstCall.args[0] as string;
            expect(guard).to.contain(`auditLog.id ${comparison} :cursorId`);
            expect(guard).to.contain(`${comparison} '2024-01-10 12:00:00.123'`);
            expect(query.andWhere.firstCall.args[1]).to.deep.equal({ cursorId: 321 });
            expect(query.addOrderBy.lastCall.args).to.deep.equal(['`auditLog`.`id`', direction]);
            if (sortBy === 'start') {
              expect(query.orderBy.firstCall.args).to.deep.equal(['`auditLog`.`ts`', direction]);
              expect(guard).not.to.contain('IS NULL');
            } else {
              expect(query.orderBy.firstCall.args[0]).to.contain('TIMESTAMPADD(MICROSECOND');
              expect(query.orderBy.firstCall.args[0]).to.contain('duration_ms` >= 0');
              expect(query.orderBy.firstCall.args[0]).to.match(/IS NULL$/);
              expect(query.orderBy.firstCall.args[1]).to.equal('ASC');
              expect(query.addOrderBy.firstCall.args[1]).to.equal(direction);
              expect(guard).to.contain('OR (CASE');
              expect(guard).to.contain('IS NULL');
            }
            sinon.assert.callOrder(
              query.orderBy,
              query.getCount,
              query.limit,
              query.offset,
              query.getRawMany,
            );
            expect(query.getCount.calledOnce).to.be.true;
            expect(query.getRawMany.calledOnce).to.be.true;
          });
        }
      }

      for (const sortOrder of ['asc', 'desc'] as const) {
        it(`continues within unknown end timestamps in ${sortOrder} order`, async () => {
          const query = stubListQuery();
          await service.listAuditLogs({
            isAdmin: true,
            sortBy: 'end',
            sortOrder,
            cursor: { finishedAt: null, id: 321 },
          });
          const comparison = sortOrder === 'asc' ? '>' : '<';
          const guard = query.andWhere.firstCall.args[0] as string;
          expect(guard).to.contain(`IS NULL AND auditLog.id ${comparison} :cursorId`);
          expect(guard).not.to.contain(' OR ');
          expect(query.andWhere.firstCall.args[1]).to.deep.equal({ cursorId: 321 });
        });
      }

      it('preserves the default descending start cursor and ignores untrusted runtime sorting values', async () => {
        const query = stubListQuery();
        await service.listAuditLogs({
          isAdmin: true,
          sortBy: 'end; DROP TABLE audit_logs',
          sortOrder: 'ASC; DROP TABLE audit_logs',
          cursor: { startedAt: new Date('2024-01-10T12:00:00Z'), id: 321 },
        } as unknown as ListAuditLogsOptions);
        expect(query.orderBy.firstCall.args).to.deep.equal(['`auditLog`.`ts`', 'DESC']);
        expect(query.addOrderBy.firstCall.args).to.deep.equal(['`auditLog`.`id`', 'DESC']);
        expect(query.andWhere.firstCall.args[0]).to.contain('auditLog.id < :cursorId');
        expect(query.andWhere.firstCall.args[0]).not.to.contain('DROP TABLE');
      });
    });

    it('calculates end ordering with millisecond precision and uses IDs for equal completion times', async () => {
      const long = await createAuditLog({
        startedAt: new Date('2024-01-01T00:00:00.001Z'),
        durationMs: 2,
      });
      const quick = await createAuditLog({
        startedAt: new Date('2024-01-01T00:00:00.002Z'),
        durationMs: 0,
      });
      const tied = await createAuditLog({
        startedAt: new Date('2024-01-01T00:00:00.001Z'),
        durationMs: 1,
      });
      const ascending = await service.listAuditLogs({
        isAdmin: true,
        sortBy: 'end',
        sortOrder: 'asc',
      });
      expect(ascending.total).to.equal(3);
      expect(ascending.auditLogs.map((entry) => entry.id)).to.deep.equal([
        quick.id,
        tied.id,
        long.id,
      ]);
      const descending = await service.listAuditLogs({
        isAdmin: true,
        sortBy: 'end',
        sortOrder: 'desc',
      });
      expect(descending.auditLogs.map((entry) => entry.id)).to.deep.equal([
        long.id,
        tied.id,
        quick.id,
      ]);
    });

    it('filters administrative requests by an explicit session identifier', async () => {
      await createAuditLog({
        startedAt: new Date('2024-01-02T08:00:00Z'),
        sessionId: 11,
      });
      const expected = await createAuditLog({
        startedAt: new Date('2024-01-03T08:00:00Z'),
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

  describe('duration parsing', () => {
    it('reads valid root duration values in current and historical serialized payloads', () => {
      const examples: Array<[string, number]> = [
        ['{"durationMs":0}', 0],
        ['{"durationMs":"1250"}', 1250],
        ['{"duration_ms":"42.9"}', 42],
        ['{"durationMs":null,"duration_ms":25}', 25],
        ['{"durationMs":2147483647}', 2147483647],
      ];
      for (const [payload, expected] of examples) {
        expect(service['extractDurationMsFromSerializedData'](payload)).to.equal(expected);
      }
    });

    it('leaves incomplete, nested, negative, boolean and oversized serialized durations unknown', () => {
      const examples = [
        null,
        undefined,
        '',
        '{"durationMs":123',
        '{"durationMs":123}...[truncated]',
        '{"nested":{"durationMs":123}}',
        '[{"durationMs":123}]',
        '{"durationMs":-1}',
        '{"duration_ms":-0.5}',
        '{"durationMs":true}',
        '{"durationMs":false}',
        '{"durationMs":2147483648}',
        '{"durationMs":"2147483648"}',
        '{"durationMs":"unknown"}',
        '{"durationMs":""}',
        '{}',
        'null',
      ];
      for (const payload of examples) {
        expect(service['extractDurationMsFromSerializedData'](payload), String(payload)).to.be.null;
      }
    });

    it('normalizes valid milliseconds without converting invalid values into completion times', () => {
      for (const value of [0, '0', 42, '42', 42n, 42.9, '42.9', ' 42.9 ', '4.2e1', '0x2a']) {
        expect(service['normalizeDurationMs'](value)).to.equal(Math.trunc(Number(value)));
      }
      for (const value of [
        null,
        undefined,
        '',
        ' ',
        false,
        true,
        [],
        {},
        -1,
        -1n,
        -0.5,
        NaN,
        Infinity,
        2147483648,
        2147483648n,
      ]) {
        expect(service['normalizeDurationMs'](value)).to.be.null;
      }
    });

    it('returns unknown duration in both summary and detail for invalid stored durations', async () => {
      const entry = await createAuditLog({
        durationMs: -1,
        data: JSON.stringify({ durationMs: 123 }),
      });
      const summary = await service.listAuditLogs({ isAdmin: true, sortBy: 'end' });
      expect(summary.auditLogs[0].id).to.equal(entry.id);
      expect(summary.auditLogs[0].durationMs).to.be.null;
      const detail = await service.getAuditLog(entry.id, { isAdmin: true });
      expect(detail.durationMs).to.be.null;
    });
  });

  describe('summary timestamps', () => {
    it('preserves UTC database timestamps and explicit offsets', () => {
      const examples: Array<[Date | string, string]> = [
        [new Date(2024, 5, 1, 12, 34, 56, 123), '2024-06-01T12:34:56.123Z'],
        ['2024-06-01 12:34:56.123', '2024-06-01T12:34:56.123Z'],
        ['2024-06-01T12:34:56.123+02:00', '2024-06-01T10:34:56.123Z'],
      ];
      for (const [value, expected] of examples) {
        expect(service['normalizeSummaryDate'](value).toISOString()).to.equal(expected);
      }
    });

    it('preserves the existing fallbacks for missing and invalid raw timestamps', () => {
      for (const value of [null, undefined, '', '  ', 'invalid', 123, {}]) {
        expect(service['normalizeSummaryDate'](value).getTime()).to.equal(0);
      }
      expect(Number.isNaN(service['normalizeSummaryDate'](new Date('invalid')).getTime())).to.equal(
        true,
      );
    });
  });

  describe('getAuditLog', () => {
    it('returns full detail for an allowed entry and sanitizes parsed data', async () => {
      const expected = await createAuditLog({
        data: JSON.stringify({
          method: 'PUT',
          url: '/api/example',
          query: {
            token: 'plain-token',
          },
          body: {
            name: 'visible',
            password: 'plain-password',
          },
          context: {
            source: 'unit-test',
          },
        }),
        userId: 77,
      });

      const auditLog = await service.getAuditLog(expected.id, {
        isAdmin: false,
        userId: 77,
        sessionId: null,
      });

      expect(auditLog?.id).to.equal(expected.id);
      expect(auditLog?.data).to.be.a('string');

      const data = service.parseAuditLogData(auditLog?.data) as {
        query: { token: string };
        body: { name: string; password: string };
      };

      expect(data.query.token).to.equal('[REDACTED]');
      expect(data.body.name).to.equal('visible');
      expect(data.body.password).to.equal('[REDACTED]');
    });

    it('returns null when a regular user requests a foreign entry', async () => {
      const foreign = await createAuditLog({
        userId: 999,
        sessionId: 888,
      });

      const auditLog = await service.getAuditLog(foreign.id, {
        isAdmin: false,
        userId: 77,
        sessionId: 66,
      });

      expect(auditLog).to.equal(null);
    });

    it('hydrates missing duration values from stored audit payloads while reading detail', async () => {
      const expected = await createAuditLog({
        data: JSON.stringify({ payload: true, durationMs: 3456 }),
        durationMs: null,
      });

      const auditLog = await service.getAuditLog(expected.id, {
        isAdmin: true,
      });

      expect(auditLog?.durationMs).to.equal(3456);
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

  describe('logMutation', () => {
    it('persists non-http mutation entries and redacts sensitive payload fields', async () => {
      const created = await service.logMutation({
        call: 'CRON openvpn.history.archive',
        description: 'Cron task. Archived OpenVPN history.',
        userName: 'scheduler',
        data: {
          source: 'cron',
          token: 'secret-token',
          password: 'super-secret',
          nested: {
            api_key: 'should-be-hidden',
          },
          durationMs: 1250,
        },
      });

      expect(created).to.not.be.null;
      const persisted = await repository.findOneOrFail({ where: { id: created.id } });
      const payload = JSON.parse(persisted.data);

      expect(persisted.call).to.equal('CRON openvpn.history.archive');
      expect(persisted.userName).to.equal('scheduler');
      expect(persisted.status).to.equal(null);
      expect(persisted.description).to.equal('Cron task. Archived OpenVPN history.');
      expect(persisted.description).to.not.contain('status=');
      expect(payload.source).to.equal('cron');
      expect(payload.token).to.equal('[REDACTED]');
      expect(payload.password).to.equal('[REDACTED]');
      expect(payload.nested.api_key).to.equal('[REDACTED]');
      expect(persisted.durationMs).to.equal(1250);
    });

    it('persists an optional HTTP status value', async () => {
      const created = await service.logMutation({
        call: 'PUT /api/example',
        description: 'updated example',
        status: 202,
        data: {
          durationMs: 99,
        },
      });

      expect(created).to.not.be.null;
      const persisted = await repository.findOneOrFail({ where: { id: created.id } });
      expect(persisted.status).to.equal(202);
      expect(persisted.durationMs).to.equal(99);
    });

    it('derives entity names and identifiers from firewall references', async () => {
      sinon.stub(Firewall, 'findOne').resolves({
        id: 91,
        name: 'edge-firewall',
        fwCloudId: 44,
        clusterId: 31,
      } as Firewall);
      sinon.stub(FwCloud, 'findOne').resolves({
        id: 44,
        name: 'production-cloud',
      } as FwCloud);
      sinon.stub(Cluster, 'findOne').resolves({
        id: 31,
        name: 'cluster-alpha',
      } as Cluster);

      const created = await service.logMutation({
        call: 'WORKER openvpn.status.sync',
        description: 'Worker task. Synced OpenVPN status history.',
        firewallId: 91,
        data: { source: 'worker' },
      });

      expect(created).to.not.be.null;
      const persisted = await repository.findOneOrFail({ where: { id: created.id } });
      expect(persisted.firewallId).to.equal(91);
      expect(persisted.firewallName).to.equal('edge-firewall');
      expect(persisted.fwCloudId).to.equal(44);
      expect(persisted.fwCloudName).to.equal('production-cloud');
      expect(persisted.clusterId).to.equal(31);
      expect(persisted.clusterName).to.equal('cluster-alpha');
    });
  });
});
