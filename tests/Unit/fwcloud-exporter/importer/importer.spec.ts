/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { describeName, testSuite, expect } from '../../../mocha/global-setup';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { Ca } from '../../../../src/models/vpn/pki/Ca';
import { FSHelper } from '../../../../src/utils/fs-helper';
import * as path from 'path';
import * as fs from 'fs';
import { Snapshot } from '../../../../src/snapshots/snapshot';
import { SnapshotService } from '../../../../src/snapshots/snapshot.service';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import StringHelper from '../../../../src/utils/string.helper';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import db from '../../../../src/database/database-manager';
import sinon from 'sinon';
import { DatabaseImporter } from '../../../../src/fwcloud-exporter/database-importer/database-importer';

type ImportAuditPayload = {
  source: string;
  operation: string;
  entity: string;
  affectedCount: number;
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'failed';
  error: string | null;
  details?: {
    importId?: string;
    phase?: string;
    data?: Record<string, any>;
  };
};

describe(describeName('Importer tests'), () => {
  let snapshotService: SnapshotService;
  const setInternalAuditConfig = (enabled: boolean): void => {
    testSuite.app.config.set('auditLogs.internal.enabled', enabled);
    testSuite.app.config.set('auditLogs.internal.cron.enabled', enabled);
    testSuite.app.config.set('auditLogs.internal.worker.enabled', enabled);
    testSuite.app.config.set('auditLogs.internal.importer.enabled', enabled);
  };

  beforeEach(async () => {
    setInternalAuditConfig(true);
    snapshotService = await testSuite.app.getService<SnapshotService>(SnapshotService.name);
    await db.getSource().manager.getRepository(AuditLog).createQueryBuilder().delete().execute();
  });

  afterEach(() => {
    setInternalAuditConfig(false);
  });

  async function getImportAuditPayloads(): Promise<ImportAuditPayload[]> {
    const auditEvents = await db
      .getSource()
      .manager.getRepository(AuditLog)
      .find({
        where: { call: 'INTERNAL:importer:import' },
        order: { id: 'ASC' },
      });

    return auditEvents.map((item) => JSON.parse(item.data) as ImportAuditPayload);
  }

  function findPhaseEvent(
    payloads: ImportAuditPayload[],
    phase: string,
  ): ImportAuditPayload | undefined {
    return payloads.find((payload) => payload.details?.phase === phase);
  }

  describe('import()', () => {
    it('should migrate the pki/CA directories from the snapshot into the DATA directory', async () => {
      const fwCloud: FwCloud = await FwCloud.save(
        FwCloud.create({
          name: StringHelper.randomize(10),
        }),
      );

      const ca: Ca = await Ca.save(
        Ca.create({
          cn: StringHelper.randomize(10),
          days: 1,
          fwCloudId: fwCloud.id,
        }),
      );

      FSHelper.mkdirSync(path.join(fwCloud.getPkiDirectoryPath(), ca.id.toString()));
      fs.writeFileSync(
        path.join(fwCloud.getPkiDirectoryPath(), ca.id.toString(), 'test.txt'),
        'test',
      );

      const snapshot: Snapshot = await Snapshot.create(snapshotService.config.data_dir, fwCloud);

      await snapshot.restore();

      const payloads = await getImportAuditPayloads();
      const startEvent = findPhaseEvent(payloads, 'start');
      const txEvent = findPhaseEvent(payloads, 'transaction');
      const finalEvent = findPhaseEvent(payloads, 'final_summary');
      const tableEvents = payloads.filter(
        (payload) => payload.details?.phase === 'table_processed',
      );

      expect(payloads.length).to.be.greaterThan(3);
      expect(startEvent).to.not.be.undefined;
      expect(txEvent).to.not.be.undefined;
      expect(finalEvent).to.not.be.undefined;

      const importIds = new Set(payloads.map((payload) => payload.details?.importId));
      expect(importIds.size).to.equal(1);
      expect(payloads[0].source).to.equal('importer');
      expect(payloads[0].operation).to.equal('import');
      expect(startEvent.details.data.tableCount).to.equal(tableEvents.length);

      tableEvents.forEach((tableEvent) => {
        expect(tableEvent.entity).to.equal(tableEvent.details.data.tableName);
        expect(tableEvent.details.data.durationMs).to.be.a('number');
        expect(tableEvent.details.data.durationMs).to.be.at.least(0);
      });

      const totalInserted = tableEvents.reduce((acc, event) => {
        return acc + Number(event.details.data.counts.inserted ?? 0);
      }, 0);
      const totalUpdated = tableEvents.reduce((acc, event) => {
        return acc + Number(event.details.data.counts.updated ?? 0);
      }, 0);
      const totalFailed = tableEvents.reduce((acc, event) => {
        return acc + Number(event.details.data.counts.failed ?? 0);
      }, 0);

      expect(txEvent.status).to.equal('success');
      expect(txEvent.details.data.committed).to.equal(true);
      expect(txEvent.details.data.rolledBack).to.equal(false);
      expect(txEvent.details.data.error).to.equal(null);

      expect(finalEvent.status).to.equal('success');
      expect(finalEvent.details.data.status).to.equal('success');
      expect(finalEvent.details.data.totals.inserted).to.equal(totalInserted);
      expect(finalEvent.details.data.totals.updated).to.equal(totalUpdated);
      expect(finalEvent.details.data.totals.failed).to.equal(totalFailed);
      expect(finalEvent.affectedCount).to.equal(totalInserted + totalUpdated);

      const newFwCloud: FwCloud = await FwCloud.findOne({
        where: { name: fwCloud.name },
      });
      const newCA: Ca = await Ca.findOne({ where: { cn: ca.cn } });

      expect(
        FSHelper.directoryExistsSync(
          path.join(newFwCloud.getPkiDirectoryPath(), newCA.id.toString()),
        ),
      ).to.be.true;
    });

    it('should emit failed transaction/final audit events on rollback', async () => {
      const fwCloud: FwCloud = await FwCloud.save(
        FwCloud.create({
          name: StringHelper.randomize(10),
        }),
      );
      const currentFwCloudCount = (await FwCloud.find()).length;
      const snapshot: Snapshot = await Snapshot.create(snapshotService.config.data_dir, fwCloud);
      const importerFailure = new Error('forced importer failure');
      const terraformerStub = sinon.stub(
        DatabaseImporter.prototype as any,
        'handleTableResultTerraform',
      );
      terraformerStub.rejects(importerFailure);

      try {
        await expect(snapshot.restore()).to.be.rejectedWith(importerFailure.message);
        expect((await FwCloud.find()).length).to.equal(currentFwCloudCount);
      } finally {
        terraformerStub.restore();
      }

      const payloads = await getImportAuditPayloads();
      const txEvent = findPhaseEvent(payloads, 'transaction');
      const finalEvent = findPhaseEvent(payloads, 'final_summary');
      const failedTableEvent = payloads.find((payload) => {
        return payload.details?.phase === 'table_processed' && payload.status === 'failed';
      });

      expect(payloads.length).to.be.greaterThan(2);
      expect(txEvent).to.not.be.undefined;
      expect(finalEvent).to.not.be.undefined;
      expect(failedTableEvent).to.not.be.undefined;

      const importIds = new Set(payloads.map((payload) => payload.details?.importId));
      expect(importIds.size).to.equal(1);

      expect(txEvent.status).to.equal('failed');
      expect(txEvent.details.data.committed).to.equal(false);
      expect(txEvent.details.data.rolledBack).to.equal(true);
      expect(txEvent.details.data.error).to.be.a('string');

      expect(finalEvent.status).to.equal('failed');
      expect(finalEvent.details.data.status).to.equal('failed');
      expect(finalEvent.error).to.be.a('string');
      expect(finalEvent.details.data.error).to.be.a('string');
      expect(finalEvent.details.data.totals.failed).to.be.greaterThan(0);
    });

    it('should migrate the policy/firewall directories from the snapshot into the DATA directory', async () => {
      const fwCloud: FwCloud = await FwCloud.save(
        FwCloud.create({
          name: StringHelper.randomize(10),
        }),
      );

      const firewall: Firewall = await Firewall.save(
        Firewall.create({
          name: StringHelper.randomize(10),
          fwCloudId: fwCloud.id,
        }),
      );

      FSHelper.mkdirSync(path.join(fwCloud.getPolicyDirectoryPath(), firewall.id.toString()));
      fs.writeFileSync(
        path.join(fwCloud.getPolicyDirectoryPath(), firewall.id.toString(), 'test.txt'),
        'test',
      );

      const snapshot: Snapshot = await Snapshot.create(snapshotService.config.data_dir, fwCloud);

      await snapshot.restore();

      const newFwCloud: FwCloud = await FwCloud.findOne({
        where: { name: fwCloud.name },
      });
      const newFirewall: Firewall = await Firewall.findOne({
        where: { name: firewall.name },
      });

      expect(
        FSHelper.directoryExistsSync(
          path.join(newFwCloud.getPolicyDirectoryPath(), newFirewall.id.toString()),
        ),
      ).to.be.true;
    });
  });
});
