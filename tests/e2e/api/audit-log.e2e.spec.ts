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
import { AuditEventType } from '../../../src/models/audit/audit-event-type';
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
      startedAt: new Date('2024-01-01T00:00:00Z'),
      userId: null,
      userName: null,
      sessionId: null,
      fwCloudId: null,
      fwCloudName: null,
      firewallId: null,
      firewallName: null,
      clusterId: null,
      clusterName: null,
      sourceIp: null,
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

  const getAuditLog = (sessionId: string, id: number) => {
    return request(app.express)
      .get(_URL().getURL('auditlogs.show', { auditlog: id }))
      .set('Cookie', [attachSession(sessionId)]);
  };

  const getScopedAuditLog = (sessionId: string, fwCloudId: number, id: number) => {
    return request(app.express)
      .get(_URL().getURL('fwclouds.auditlogs.show', { fwcloud: fwCloudId, auditlog: id }))
      .set('Cookie', [attachSession(sessionId)]);
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
      status: 200,
      durationMs: 55,
      data: JSON.stringify({
        method: 'PUT',
        url: '/api/user-owned?token=plain-token',
        statusCode: 200,
        durationMs: 55,
        query: {
          token: 'plain-token',
        },
        params: {
          fwcloud: '101',
        },
        body: {
          name: 'visible',
          password: 'plain-password',
        },
        context: {
          source: 'e2e',
        },
      }),
      startedAt: new Date('2024-01-02T12:00:00Z'),
      userId: regularUser.id,
      userName: regularUser.username,
      fwCloudId: 101,
      fwCloudName: 'User Cloud',
      firewallName: 'User Firewall',
      clusterName: 'User Cluster',
      sourceIp: '198.51.100.10',
    });

    sessionOwnedLog = await persistAuditLog({
      call: 'PUT /api/session-owned',
      status: 202,
      startedAt: new Date('2024-01-03T12:00:00Z'),
      sessionId: regularSessionNumeric,
      userId: regularUser.id,
      userName: null,
      fwCloudName: 'Session Cloud',
      firewallName: 'Session Firewall',
      clusterName: 'Session Cluster',
      sourceIp: '198.51.100.20',
    });

    adminOwnedLog = await persistAuditLog({
      call: 'PUT /api/admin-owned',
      status: 204,
      data: JSON.stringify({ payload: true, durationMs: 9876 }),
      durationMs: 9876,
      startedAt: new Date('2024-01-04T12:00:00Z'),
      userId: adminUser.id,
      userName: adminUser.username,
      fwCloudName: 'Production Cloud',
      firewallName: 'Production Firewall',
      clusterName: 'Production Cluster',
      sourceIp: '198.51.100.30',
    });

    foreignLog = await persistAuditLog({
      call: 'PUT /api/foreign',
      startedAt: new Date('2024-01-01T12:00:00Z'),
      userId: 9999,
      userName: 'foreign-user',
      fwCloudName: 'Foreign Cloud',
      firewallName: 'Foreign Firewall',
      clusterName: 'Foreign Cluster',
      sourceIp: '198.51.100.40',
    });
  });

  it('rejects unauthenticated access attempts', async () => {
    await request(app.express).put(_URL().getURL('auditlogs.list')).expect(401);
    await request(app.express)
      .get(_URL().getURL('auditlogs.show', { auditlog: userOwnedLog.id }))
      .expect(401);
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
        expect(payload.auditLogs.map((entry: AuditLog) => entry.status)).to.deep.equal([202, 200]);

        payload.auditLogs.forEach((entry: AuditLog) => {
          expect(entry.userId).to.equal(regularUser.id);
          expect(entry.userName).to.equal(regularUser.username);
          expect(entry).to.not.have.property('data');
        });
      });
  });

  it('returns structured detail data for an allowed audit log', async () => {
    await getAuditLog(regularSessionToken, userOwnedLog.id)
      .expect(200)
      .then((response) => {
        const auditLog = response.body.data.auditLog;

        expect(auditLog.id).to.equal(userOwnedLog.id);
        expect(auditLog.data.body.name).to.equal('visible');
        expect(auditLog.data.body.password).to.equal('[REDACTED]');
        expect(auditLog.data.query.token).to.equal('[REDACTED]');
        expect(auditLog.request.body.password).to.equal('[REDACTED]');
        expect(auditLog.request.params.fwcloud).to.equal('101');
        expect(auditLog.response.statusCode).to.equal(200);
        expect(auditLog.response.durationMs).to.equal(55);
        expect(auditLog.context.source).to.equal('e2e');
      });
  });

  it('honours fwcloud scoped detail requests', async () => {
    await getScopedAuditLog(adminSessionToken, 101, userOwnedLog.id).expect(200);
    await getScopedAuditLog(adminSessionToken, 999, userOwnedLog.id).expect(404);
  });

  it('hides foreign detail entries from regular users', async () => {
    await getAuditLog(regularSessionToken, foreignLog.id).expect(404);
  });

  it('allows administrators to filter by text fields and time windows', async () => {
    await listAuditLogs(adminSessionToken, {
      started_at_from: '2024-01-04T00:00:00.000Z',
      started_at_to: '2024-01-05T00:00:00.000Z',
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
        expect(payload.auditLogs[0].durationMs).to.equal(9876);
        expect(payload.auditLogs[0].status).to.equal(204);
        expect(payload.auditLogs[0]).to.not.have.property('data');
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

  it('filters administrative listings by source IP address', async () => {
    await listAuditLogs(adminSessionToken, {
      source_ip: '198.51.100.30',
    })
      .expect(200)
      .then((response) => {
        const payload = response.body.data;

        expect(payload.total).to.equal(1);
        expect(payload.auditLogs).to.have.length(1);
        expect(payload.auditLogs[0].id).to.equal(adminOwnedLog.id);
        expect(payload.auditLogs[0].sourceIp).to.equal('198.51.100.30');
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
        expect(payload.auditLogs[3].status).to.equal(null);
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
    const cursor = `${pivot.startedAt}:${pivot.id}`;

    await listAuditLogs(adminSessionToken, { cursor })
      .expect(200)
      .then((response) => {
        const payload = response.body.data;

        expect(payload.total).to.equal(1);
        expect(payload.auditLogs.map((entry: AuditLog) => entry.id)).to.deep.equal([foreignLog.id]);
      });
  });

  describe('confirmation token challenges', () => {
    let entries: Record<string, AuditLog>;

    beforeEach(async () => {
      await repository.clear();
      entries = {};
      const fixtures: Array<[string, Partial<AuditLog>]> = [
        ['challenge', { status: 403, confirmationTokenChallenge: true }],
        ['forbidden', { status: 403, confirmationTokenChallenge: false }],
        ['unauthorized', { status: 401, confirmationTokenChallenge: false }],
        ['historical', { status: 403, confirmationTokenChallenge: null }],
        ['successful', { status: 200, confirmationTokenChallenge: false }],
        [
          'foreign',
          {
            status: 403,
            confirmationTokenChallenge: false,
            userId: adminUser.id,
            userName: adminUser.username,
            sessionId: null,
          },
        ],
      ];
      for (const [index, [name, fixture]] of fixtures.entries()) {
        entries[name] = await persistAuditLog({
          startedAt: new Date(`2024-01-0${6 - index}T12:00:00Z`),
          durationMs: 10,
          userId: regularUser.id,
          userName: regularUser.username,
          sessionId: regularSessionNumeric,
          eventType: AuditEventType.Modification,
          fwCloudId: 101,
          fwCloudName: 'Confirmation Cloud',
          firewallId: 201,
          firewallName: 'Confirmation Firewall',
          clusterId: 301,
          clusterName: 'Confirmation Cluster',
          sourceIp: '198.51.100.50',
          ...fixture,
        });
      }
    });

    for (const query of [{}, { exclude_confirmation_token_requests: false }]) {
      it(`includes challenges when the filter is ${Object.keys(query).length ? 'false' : 'omitted'}`, async () => {
        const response = await listAuditLogs(adminSessionToken, query).expect(200);
        expect(response.body.data.total).to.equal(6);
        expect(response.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal(
          Object.values(entries).map((entry) => entry.id),
        );
        expect(response.body.data.auditLogs[0].confirmationTokenChallenge).to.equal(true);
      });
    }

    it('excludes only explicitly marked challenges and keeps unrelated errors and historical entries', async () => {
      const response = await listAuditLogs(adminSessionToken, {
        exclude_confirmation_token_requests: true,
      }).expect(200);
      expect(response.body.data.total).to.equal(5);
      expect(response.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal(
        ['forbidden', 'unauthorized', 'historical', 'successful', 'foreign'].map(
          (name) => entries[name].id,
        ),
      );
      expect(response.body.data.auditLogs.map((entry) => entry.status)).to.deep.equal([
        403, 401, 403, 200, 403,
      ]);
      expect(response.body.data.auditLogs[0].confirmationTokenChallenge).to.equal(false);
      expect(response.body.data.auditLogs[2].confirmationTokenChallenge).to.equal(null);
    });

    it('keeps filtered challenges stored and accessible in detail and unfiltered history', async () => {
      const storedBefore = await repository.find({ order: { id: 'ASC' } });
      await listAuditLogs(adminSessionToken, {
        exclude_confirmation_token_requests: true,
      }).expect(200);
      expect(await repository.find({ order: { id: 'ASC' } })).to.deep.equal(storedBefore);

      const detail = await getAuditLog(adminSessionToken, entries.challenge.id).expect(200);
      expect(detail.body.data.auditLog.confirmationTokenChallenge).to.equal(true);
      expect(detail.body.data.auditLog.status).to.equal(403);
      const historical = await getAuditLog(adminSessionToken, entries.historical.id).expect(200);
      expect(historical.body.data.auditLog.confirmationTokenChallenge).to.equal(null);

      const unfiltered = await listAuditLogs(adminSessionToken, {
        exclude_confirmation_token_requests: false,
      }).expect(200);
      expect(
        unfiltered.body.data.auditLogs.some((entry) => entry.id === entries.challenge.id),
      ).to.equal(true);
    });

    it('filters before offset and cursor pagination and returns accurate counts', async () => {
      const filters = { exclude_confirmation_token_requests: true, limit: 2 };
      const first = await listAuditLogs(adminSessionToken, filters).expect(200);
      const second = await listAuditLogs(adminSessionToken, { ...filters, page: 2 }).expect(200);
      expect(first.body.data.total).to.equal(5);
      expect(second.body.data.total).to.equal(5);
      expect(first.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal([
        entries.forbidden.id,
        entries.unauthorized.id,
      ]);
      expect(second.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal([
        entries.historical.id,
        entries.successful.id,
      ]);

      const pivot = first.body.data.auditLogs[1];
      const next = await listAuditLogs(adminSessionToken, {
        ...filters,
        cursor: `${pivot.startedAt}:${pivot.id}`,
      }).expect(200);
      expect(next.body.data.total).to.equal(3);
      expect(next.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal([
        entries.historical.id,
        entries.successful.id,
      ]);
    });

    it('combines challenge exclusion with existing filters and end-time sorting', async () => {
      const filters = {
        exclude_confirmation_token_requests: true,
        sort_by: 'end',
        sort_order: 'desc',
        event_type: 'modification',
        started_at_from: '2024-01-02T00:00:00Z',
        started_at_to: '2024-01-07T00:00:00Z',
        user_name: regularUser.username,
        session_id: String(regularSessionNumeric),
        fwcloud_id: 101,
        fwcloud_name: 'confirmation',
        firewall_id: 201,
        firewall_name: 'confirmation',
        cluster_id: 301,
        cluster_name: 'confirmation',
        source_ip: '198.51.100.50',
        limit: 2,
        page: 2,
      };
      const response = await listAuditLogs(adminSessionToken, filters).expect(200);
      expect(response.body.data.total).to.equal(4);
      expect(response.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal([
        entries.historical.id,
        entries.successful.id,
      ]);
    });

    it('preserves authorization restrictions while excluding challenges', async () => {
      const response = await listAuditLogs(regularSessionToken, {
        exclude_confirmation_token_requests: true,
      }).expect(200);
      expect(response.body.data.total).to.equal(4);
      expect(response.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal(
        ['forbidden', 'unauthorized', 'historical', 'successful'].map((name) => entries[name].id),
      );
      await getAuditLog(regularSessionToken, entries.foreign.id).expect(404);
      await getAuditLog(regularSessionToken, entries.challenge.id).expect(200);
      await request(app.express)
        .put(_URL().getURL('auditlogs.list'))
        .query({ exclude_confirmation_token_requests: true })
        .expect(401);
    });

    for (const value of ['1', '0', 'yes', 'TRUE', '', ['true', 'false']]) {
      it(`rejects invalid challenge exclusion value ${JSON.stringify(value)}`, async () => {
        await listAuditLogs(adminSessionToken, {
          exclude_confirmation_token_requests: value,
        }).expect(422);
      });
    }
  });

  describe('sorting', () => {
    let entries: Record<string, AuditLog>;

    beforeEach(async () => {
      await repository.clear();
      entries = {};
      const fixtures: Array<[string, Partial<AuditLog>]> = [
        ['long', { startedAt: new Date('2024-01-01T00:00:00.100Z'), durationMs: 4000 }],
        ['quick', { startedAt: new Date('2024-01-01T00:00:01.100Z'), durationMs: 0 }],
        ['tieFirst', { startedAt: new Date('2024-01-01T00:00:02.100Z'), durationMs: 1000 }],
        ['tieSecond', { startedAt: new Date('2024-01-01T00:00:02.100Z'), durationMs: 1000 }],
        ['missing', { startedAt: new Date('2024-01-01T00:00:03.100Z'), durationMs: null }],
        [
          'negative',
          {
            startedAt: new Date('2024-01-01T00:00:04.100Z'),
            durationMs: -1,
            userId: adminUser.id,
            sessionId: null,
          },
        ],
        [
          'incomplete',
          {
            startedAt: new Date('2024-01-01T00:00:05.100Z'),
            durationMs: null,
            data: JSON.stringify({ durationMs: 'unknown' }),
            userId: adminUser.id,
            sessionId: null,
          },
        ],
      ];
      for (const [name, fixture] of fixtures) {
        entries[name] = await persistAuditLog({
          userId: regularUser.id,
          userName: regularUser.username,
          sessionId: regularSessionNumeric,
          eventType: AuditEventType.Modification,
          fwCloudId: 101,
          fwCloudName: 'Sorting Cloud',
          firewallId: 201,
          firewallName: 'Sorting Firewall',
          clusterId: 301,
          clusterName: 'Sorting Cluster',
          sourceIp: '198.51.100.50',
          ...fixture,
        });
      }
    });

    const modes = [
      {
        sort_by: 'start',
        sort_order: 'asc',
        names: ['long', 'quick', 'tieFirst', 'tieSecond', 'missing', 'negative', 'incomplete'],
      },
      {
        sort_by: 'start',
        sort_order: 'desc',
        names: ['incomplete', 'negative', 'missing', 'tieSecond', 'tieFirst', 'quick', 'long'],
      },
      {
        sort_by: 'end',
        sort_order: 'asc',
        names: ['quick', 'tieFirst', 'tieSecond', 'long', 'missing', 'negative', 'incomplete'],
      },
      {
        sort_by: 'end',
        sort_order: 'desc',
        names: ['long', 'tieSecond', 'tieFirst', 'quick', 'incomplete', 'negative', 'missing'],
      },
    ];

    for (const { names, ...sorting } of modes) {
      it(`sorts by ${sorting.sort_by} ${sorting.sort_order} before offset pagination`, async () => {
        const expected = names.map((name) => entries[name].id);
        const received: number[] = [];
        for (let page = 1; page <= 4; page++) {
          const response = await listAuditLogs(adminSessionToken, {
            ...sorting,
            page,
            pageSize: 2,
          }).expect(200);
          const payload = response.body.data;
          expect(payload.total).to.equal(expected.length);
          expect(payload.auditLogs.map((entry) => entry.id)).to.deep.equal(
            expected.slice((page - 1) * 2, page * 2),
          );
          received.push(...payload.auditLogs.map((entry) => entry.id));
          if (sorting.sort_by === 'end') {
            for (const entry of payload.auditLogs) {
              if (
                [entries.missing.id, entries.negative.id, entries.incomplete.id].includes(entry.id)
              ) {
                expect(entry.finishedAt).to.be.null;
              }
            }
          }
        }
        expect(received).to.deep.equal(expected);
      });

      it(`paginates by cursor without gaps or duplicates for ${sorting.sort_by} ${sorting.sort_order}`, async () => {
        let cursor: string | undefined;
        const received: number[] = [];
        for (const [index, name] of names.entries()) {
          const response = await listAuditLogs(adminSessionToken, {
            ...sorting,
            limit: 1,
            ...(cursor ? { cursor } : {}),
          }).expect(200);
          const payload = response.body.data;
          expect(payload.total).to.equal(names.length - index);
          expect(payload.auditLogs.map((entry) => entry.id)).to.deep.equal([entries[name].id]);
          const [entry] = payload.auditLogs;
          received.push(entry.id);
          const timestamp = sorting.sort_by === 'start' ? entry.startedAt : entry.finishedAt;
          cursor = `${timestamp}:${entry.id}`;
        }
        const lastPage = await listAuditLogs(adminSessionToken, {
          ...sorting,
          limit: 1,
          cursor,
        }).expect(200);
        expect(lastPage.body.data.total).to.equal(0);
        expect(lastPage.body.data.auditLogs).to.deep.equal([]);
        expect(received).to.deep.equal(names.map((name) => entries[name].id));
      });
    }

    it('keeps start descending as the default, including deterministic timestamp ties', async () => {
      const response = await listAuditLogs(adminSessionToken, { limit: 0 }).expect(200);
      expect(response.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal(
        modes[1].names.map((name) => entries[name].id),
      );
    });

    it('defaults each omitted sorting parameter independently', async () => {
      const byEnd = await listAuditLogs(adminSessionToken, { sort_by: 'end' }).expect(200);
      expect(byEnd.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal(
        modes[3].names.map((name) => entries[name].id),
      );
      const ascending = await listAuditLogs(adminSessionToken, { sort_order: 'asc' }).expect(200);
      expect(ascending.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal(
        modes[0].names.map((name) => entries[name].id),
      );
    });

    it('combines end sorting with all existing filters and accurate pagination counts', async () => {
      const filters = {
        sort_by: 'end',
        sort_order: 'asc',
        event_type: 'modification',
        started_at_from: '2024-01-01T00:00:00Z',
        started_at_to: '2024-01-01T00:00:02.500Z',
        user_name: regularUser.username,
        session_id: String(regularSessionNumeric),
        fwcloud_id: 101,
        fwcloud_name: 'sorting',
        firewall_id: 201,
        firewall_name: 'sorting',
        cluster_id: 301,
        cluster_name: 'sorting',
        source_ip: '198.51.100.50',
        limit: 2,
      };
      const first = await listAuditLogs(adminSessionToken, filters).expect(200);
      const second = await listAuditLogs(adminSessionToken, { ...filters, page: 2 }).expect(200);
      expect(first.body.data.total).to.equal(4);
      expect(second.body.data.total).to.equal(4);
      expect(first.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal([
        entries.quick.id,
        entries.tieFirst.id,
      ]);
      expect(second.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal([
        entries.tieSecond.id,
        entries.long.id,
      ]);
      const pivot = first.body.data.auditLogs[1];
      const next = await listAuditLogs(adminSessionToken, {
        ...filters,
        cursor: `${pivot.finishedAt}:${pivot.id}`,
      }).expect(200);
      expect(next.body.data.total).to.equal(2);
      expect(next.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal([
        entries.tieSecond.id,
        entries.long.id,
      ]);
    });

    it('preserves regular-user access restrictions when sorting by end time', async () => {
      const response = await listAuditLogs(regularSessionToken, {
        sort_by: 'end',
        sort_order: 'desc',
      }).expect(200);
      expect(response.body.data.total).to.equal(5);
      expect(response.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal(
        ['long', 'tieSecond', 'tieFirst', 'quick', 'missing'].map((name) => entries[name].id),
      );
    });

    for (const query of [
      { sort_by: 'timestamp' },
      { sort_by: 'START' },
      { sort_by: '' },
      { sort_by: ['start', 'end'] },
      { sort_by: 'end; DROP TABLE audit_logs' },
      { sort_order: 'ascending' },
      { sort_order: 'DESC' },
      { sort_order: '' },
      { sort_order: ['asc', 'desc'] },
    ]) {
      it(`rejects unsupported sorting parameters ${JSON.stringify(query)}`, async () => {
        await listAuditLogs(adminSessionToken, query).expect(422);
      });
    }
  });

  describe('event categories', () => {
    beforeEach(async () => {
      await repository.update(userOwnedLog.id, { eventType: AuditEventType.Creation });
      await repository.update(sessionOwnedLog.id, { eventType: AuditEventType.Modification });
      await repository.update(adminOwnedLog.id, { eventType: AuditEventType.Installation });
    });

    for (const eventType of Object.values(AuditEventType)) {
      it(`filters ${eventType} in the database`, async () => {
        await repository.update(userOwnedLog.id, { eventType });
        const response = await listAuditLogs(adminSessionToken, { event_type: eventType }).expect(
          200,
        );
        expect(response.body.data.auditLogs).not.to.have.length(0);
        expect(
          response.body.data.auditLogs.every((entry) => entry.eventType === eventType),
        ).to.equal(true);
      });
    }

    it('combines multiple categories with pagination and accurate counts', async () => {
      const filters = { event_type: 'creation,modification', limit: 1 };
      const first = await listAuditLogs(adminSessionToken, filters).expect(200);
      const second = await listAuditLogs(adminSessionToken, { ...filters, page: 2 }).expect(200);
      expect(first.body.data.total).to.equal(2);
      expect(second.body.data.total).to.equal(2);
      expect(first.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal([
        sessionOwnedLog.id,
      ]);
      expect(second.body.data.auditLogs.map((entry) => entry.id)).to.deep.equal([userOwnedLog.id]);
      const cursor = `${first.body.data.auditLogs[0].startedAt}:${sessionOwnedLog.id}`;
      const next = await listAuditLogs(adminSessionToken, { ...filters, cursor }).expect(200);
      expect(next.body.data.total).to.equal(1);
      expect(next.body.data.auditLogs[0].id).to.equal(userOwnedLog.id);
    });

    it('combines repeated categories with existing date, user, session, cloud, firewall, cluster and IP filters', async () => {
      await repository.update(userOwnedLog.id, {
        sessionId: regularSessionNumeric,
        firewallId: 201,
        clusterId: 301,
      });
      const response = await listAuditLogs(adminSessionToken, {
        event_type: ['creation', 'modification'],
        started_at_from: '2024-01-02T00:00:00Z',
        started_at_to: '2024-01-03T00:00:00Z',
        user_name: regularUser.username,
        session_id: String(regularSessionNumeric),
        fwcloud_id: 101,
        fwcloud_name: 'User',
        firewall_id: 201,
        firewall_name: 'User',
        cluster_id: 301,
        cluster_name: 'User',
        source_ip: '198.51.100.10',
      }).expect(200);
      expect(response.body.data.total).to.equal(1);
      expect(response.body.data.auditLogs[0].id).to.equal(userOwnedLog.id);
    });

    it('preserves historical entries with a null category without guessing from their call', async () => {
      const response = await listAuditLogs(adminSessionToken).expect(200);
      const historical = response.body.data.auditLogs.find((entry) => entry.id === foreignLog.id);
      expect(historical.eventType).to.be.null;
      expect(historical.outcome).to.be.null;
      const detail = await getAuditLog(adminSessionToken, foreignLog.id).expect(200);
      expect(detail.body.data.auditLog.eventType).to.be.null;
      const filtered = await listAuditLogs(adminSessionToken, { event_type: 'other' }).expect(200);
      expect(filtered.body.data.auditLogs.some((entry) => entry.id === foreignLog.id)).to.equal(
        false,
      );
    });

    for (const value of ['invalid', 'login,invalid', '', 'login,']) {
      it(`rejects invalid category ${JSON.stringify(value)}`, async () => {
        await listAuditLogs(adminSessionToken, { event_type: value }).expect(422);
      });
    }

    it('restricts anonymous and unrelated authentication entries even if they share the current session', async () => {
      const anonymous = await persistAuditLog({
        eventType: AuditEventType.Login,
        outcome: 'failure',
        sessionId: regularSessionNumeric,
      });
      const unrelated = await persistAuditLog({
        eventType: AuditEventType.Login,
        outcome: 'success',
        userId: adminUser.id,
        sessionId: regularSessionNumeric,
      });
      const own = await persistAuditLog({
        eventType: AuditEventType.Logout,
        outcome: 'success',
        userId: regularUser.id,
        userName: regularUser.username,
      });
      const response = await listAuditLogs(regularSessionToken, {
        event_type: 'login,logout',
      }).expect(200);
      expect(response.body.data.total).to.equal(1);
      expect(response.body.data.auditLogs[0].id).to.equal(own.id);
      expect(response.body.data.auditLogs[0].outcome).to.equal('success');
      for (const hidden of [anonymous, unrelated]) {
        await getAuditLog(regularSessionToken, hidden.id).expect(404);
        await getAuditLog(adminSessionToken, hidden.id).expect(200);
      }
      await request(app.express).get(`/auditlogs/${anonymous.id}`).expect(401);
      const adminResponse = await listAuditLogs(adminSessionToken, { event_type: 'login' }).expect(
        200,
      );
      expect(adminResponse.body.data.total).to.equal(2);
      const unchanged = await repository.findOneByOrFail({ id: anonymous.id });
      expect(unchanged.userId).to.be.null;
    });
  });
});
