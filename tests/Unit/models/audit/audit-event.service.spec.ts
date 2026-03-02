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

    You should have received a copy of the GNU Affero General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { AuditEventService } from '../../../../src/models/audit/AuditEvent.service';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import db from '../../../../src/database/database-manager';

describe(describeName('AuditEventService unit suite'), () => {
  let service: AuditEventService;
  const restoreInternalAuditConfig = (): void => {
    testSuite.app.config.set('auditLogs.internal.enabled', true);
    testSuite.app.config.set('auditLogs.internal.cron.enabled', true);
    testSuite.app.config.set('auditLogs.internal.worker.enabled', true);
    testSuite.app.config.set('auditLogs.internal.importer.enabled', true);
  };

  beforeEach(async () => {
    restoreInternalAuditConfig();
    service = await testSuite.app.getService<AuditEventService>(AuditEventService.name);
    await db.getSource().manager.getRepository(AuditLog).createQueryBuilder().delete().execute();
  });

  afterEach(() => {
    restoreInternalAuditConfig();
  });

  it('emits a success event with the required structured payload fields', async () => {
    const eventId = service.startEvent({
      source: 'cron',
      operation: 'cleanup',
      entity: 'audit_logs',
      details: {
        job: 'audit-log-retention',
      },
    });

    const created = await service.finishEvent(eventId, {
      affectedCount: 14,
      status: 'success',
    });

    expect(created).to.not.be.null;

    const persisted = await db
      .getSource()
      .manager.getRepository(AuditLog)
      .findOneOrFail({ where: { id: created.id } });

    const payload = JSON.parse(persisted.data);

    expect(persisted.call).to.equal('INTERNAL:cron:cleanup');
    expect(persisted.userName).to.equal('system');

    expect(payload.source).to.equal('cron');
    expect(payload.operation).to.equal('cleanup');
    expect(payload.entity).to.equal('audit_logs');
    expect(payload.affectedCount).to.equal(14);
    expect(payload.status).to.equal('success');
    expect(payload.error).to.equal(null);

    expect(payload).to.have.property('startedAt');
    expect(payload).to.have.property('finishedAt');
    expect(Number.isNaN(new Date(payload.startedAt).getTime())).to.be.false;
    expect(Number.isNaN(new Date(payload.finishedAt).getTime())).to.be.false;
  });

  it('emits a failed event and persists contextual identifiers', async () => {
    const eventId = service.startEvent({
      source: 'worker',
      operation: 'sync',
      entity: 'openvpn_status_history',
      context: {
        fwCloudId: 700,
        firewallId: 22,
      },
    });

    const created = await service.finishEvent(eventId, {
      affectedCount: 3,
      status: 'failed',
      error: new Error(`sync failed ${'x'.repeat(2048)}`),
      context: {
        fwCloudName: 'edge-fwc',
      },
    });

    expect(created).to.not.be.null;

    const persisted = await db
      .getSource()
      .manager.getRepository(AuditLog)
      .findOneOrFail({ where: { id: created.id } });

    const payload = JSON.parse(persisted.data);

    expect(persisted.call).to.equal('INTERNAL:worker:sync');
    expect(persisted.fwCloudId).to.equal(700);
    expect(persisted.fwCloudName).to.equal('edge-fwc');
    expect(persisted.firewallId).to.equal(22);

    expect(payload.status).to.equal('failed');
    expect(payload.error).to.be.a('string');
    expect(payload.error.length).to.be.at.most(1024);
    expect(payload.error).to.not.contain('Error:');
  });

  it('does not persist internal events when global internal auditing is disabled', async () => {
    testSuite.app.config.set('auditLogs.internal.enabled', false);

    const eventId = service.startEvent({
      source: 'cron',
      operation: 'cleanup',
      entity: 'audit_logs',
    });

    const created = await service.finishEvent(eventId, {
      affectedCount: 5,
      status: 'success',
    });

    const persistedCount = await db.getSource().manager.getRepository(AuditLog).count();

    expect(created).to.equal(null);
    expect(persistedCount).to.equal(0);
  });

  it('supports per-source internal audit toggles', async () => {
    testSuite.app.config.set('auditLogs.internal.worker.enabled', false);

    const workerEventId = service.startEvent({
      source: 'worker',
      operation: 'sync',
      entity: 'openvpn_status_history',
    });

    const workerCreated = await service.finishEvent(workerEventId, {
      affectedCount: 7,
      status: 'success',
    });

    const cronEventId = service.startEvent({
      source: 'cron',
      operation: 'cleanup',
      entity: 'audit_logs',
    });

    const cronCreated = await service.finishEvent(cronEventId, {
      affectedCount: 2,
      status: 'success',
    });

    const persistedEntries = await db
      .getSource()
      .manager.getRepository(AuditLog)
      .find({
        order: {
          id: 'ASC',
        },
      });

    expect(workerCreated).to.equal(null);
    expect(cronCreated).to.not.equal(null);
    expect(persistedEntries).to.have.length(1);
    expect(persistedEntries[0].call).to.equal('INTERNAL:cron:cleanup');
  });
});
