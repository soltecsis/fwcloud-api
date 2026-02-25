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

import { Snapshot } from '../../snapshots/snapshot';
import { FwCloud } from '../../models/fwcloud/FwCloud';
import { ExporterResult } from '../database-exporter/exporter-result';
import { InsertResult, QueryRunner } from 'typeorm';
import { app } from '../../fonaments/abstract-application';
import { DatabaseService } from '../../database/database.service';
import { IdManager } from './terraformer/mapper/id-manager';
import { ImportMapping } from './terraformer/mapper/import-mapping';
import * as path from 'path';
import { Firewall } from '../../models/firewall/Firewall';
import { FSHelper } from '../../utils/fs-helper';
import { PathHelper } from '../../utils/path-helpers';
import { Ca } from '../../models/vpn/pki/Ca';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { InputData, OutputData } from './terraform_table.worker';
import { ProgressNoticePayload } from '../../sockets/messages/socket-message';
import db from '../../database/database-manager';
import { AuditEventService } from '../../models/audit/AuditEvent.service';
import { randomUUID } from 'crypto';

type ImportTableCounts = {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
};

type ImportTotals = {
  inserted: number;
  updated: number;
  failed: number;
};

type ImportPhase = 'start' | 'table_processed' | 'transaction' | 'final_summary';
type ImportStatus = 'success' | 'failed';

const IMPORT_AUDIT_ENTITY = 'bulk_import';
const IMPORT_OPERATION = 'import';
const IMPORT_SOURCE = 'importer';
const IMPORT_CHUNK_SIZE = 10000;
const MAX_AUDIT_ERROR_LENGTH = 512;

export class DatabaseImporter {
  protected _mapper: ImportMapping;
  protected _idManager: IdManager;

  constructor(protected readonly eventEmitter: EventEmitter = new EventEmitter()) {}

  get mapper(): ImportMapping {
    return this._mapper;
  }

  get idManager(): IdManager {
    return this._idManager;
  }

  public async import(snapshot: Snapshot): Promise<FwCloud> {
    const auditEventService: AuditEventService = await app().getService<AuditEventService>(
      AuditEventService.name,
    );
    const importId = randomUUID();
    const importStartedAt = new Date();
    const queryRunner: QueryRunner = (
      await app().getService<DatabaseService>(DatabaseService.name)
    ).dataSource.createQueryRunner();
    const data: ExporterResult = new ExporterResult(
      JSON.parse(fs.readFileSync(path.join(snapshot.path, Snapshot.DATA_FILENAME)).toString()),
    );
    const tableNames = data.getTableNames();
    const totals: ImportTotals = {
      inserted: 0,
      updated: 0,
      failed: 0,
    };
    let fwCloudId: number = null;
    let fwCloudName: string = null;
    let txStartedAt: Date = importStartedAt;
    let txOutcomeEmitted = false;
    let txCommitted = false;
    let foreignKeyChecksDisabled = false;

    await this.beginImportAudit(auditEventService, importId, importStartedAt, snapshot, tableNames);

    try {
      txStartedAt = new Date();
      await queryRunner.startTransaction();
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
      foreignKeyChecksDisabled = true;

      this._idManager = await IdManager.make(queryRunner, tableNames);
      this._mapper = new ImportMapping(this._idManager, data);
      let index: number = 1;
      for (const tableName of tableNames) {
        this.eventEmitter.emit(
          'message',
          new ProgressNoticePayload(`${index}/${tableNames.length}`),
        );

        const sourceRows: object[] = data.getTableResults(tableName) ?? [];
        const tableStartedAt = new Date();
        const tableCounts: ImportTableCounts = {
          inserted: 0,
          updated: 0,
          skipped: 0,
          failed: 0,
        };
        let tableRowsToPersist = sourceRows.length;
        let tableError: unknown = null;

        try {
          const outputData: OutputData =
            sourceRows.length === 0
              ? {
                  result: [],
                  idMaps: this._mapper.maps,
                  idState: this._idManager.getIdState(),
                }
              : await this.handleTableResultTerraform(
                  tableName,
                  this._mapper,
                  this._idManager,
                  data,
                );

          // Update mapper and id manager after worker run
          this._mapper.maps = outputData.idMaps;
          this._idManager = IdManager.restore(outputData.idState);

          // Get the data terraformed by the worker
          const terraformedData: object[] = [...(outputData.result ?? [])];
          tableRowsToPersist = terraformedData.length;

          if (tableName === FwCloud._getTableName() && terraformedData.length > 0) {
            fwCloudId = (terraformedData as any)[0].id;
          }

          while (terraformedData.length > 0) {
            const chunk = terraformedData.splice(0, IMPORT_CHUNK_SIZE);
            const insertResult = (await queryRunner.manager
              .createQueryBuilder()
              .insert()
              .into(tableName)
              .values(chunk)
              .execute()) as InsertResult;

            tableCounts.inserted += this.getInsertAffectedRows(insertResult);
          }
        } catch (error) {
          tableError = error;
        }

        tableCounts.failed = Math.max(0, tableRowsToPersist - tableCounts.inserted);
        totals.inserted += tableCounts.inserted;
        totals.updated += tableCounts.updated;
        totals.failed += tableCounts.failed;

        await this.emitTableAudit(
          auditEventService,
          importId,
          tableName,
          tableCounts,
          index,
          tableNames.length,
          tableStartedAt,
          tableError,
        );

        if (tableError) {
          throw tableError;
        }

        index++;
      }

      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
      foreignKeyChecksDisabled = false;
      await queryRunner.commitTransaction();
      txCommitted = true;
      await this.emitTxOutcome(auditEventService, importId, txStartedAt, true, totals);
      txOutcomeEmitted = true;

      const fwCloud: FwCloud = await FwCloud.findOne({
        where: { id: fwCloudId },
      });
      fwCloudName = fwCloud?.name ?? null;

      if (!snapshot.isHashCompatible()) {
        const updateResult = await db.getSource().manager.getRepository(Firewall).update(
          { fwCloudId: fwCloud.id },
          {
            install_user: null,
            install_pass: null,
          },
        );
        totals.updated += this.normalizeCount(updateResult?.affected);
      }

      await DatabaseImporter.importDataDirectories(snapshot.path, fwCloud, this._mapper);

      await this.finishImportAudit(auditEventService, {
        importId,
        startedAt: importStartedAt,
        status: 'success',
        totals,
        context: {
          fwCloudId: fwCloud.id,
          fwCloudName: fwCloud.name,
        },
      });

      return fwCloud;
    } catch (error) {
      if (!txOutcomeEmitted && !txCommitted) {
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }

        await this.emitTxOutcome(auditEventService, importId, txStartedAt, false, totals, error);
      } else if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      await this.finishImportAudit(auditEventService, {
        importId,
        startedAt: importStartedAt,
        status: 'failed',
        totals,
        error,
        context: fwCloudId
          ? {
              fwCloudId,
              fwCloudName,
            }
          : undefined,
      });

      throw error;
    } finally {
      if (foreignKeyChecksDisabled && !queryRunner.isReleased) {
        try {
          await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
        } catch {
          // Ignore cleanup errors to preserve the original import error.
        }
      }

      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }

  protected async beginImportAudit(
    auditEventService: AuditEventService,
    importId: string,
    startedAt: Date,
    snapshot: Snapshot,
    tableNames: string[],
  ): Promise<void> {
    const snapshotFilePath = path.join(snapshot.path, Snapshot.DATA_FILENAME);
    await this.emitImportAuditEvent(auditEventService, {
      importId,
      phase: 'start',
      entity: IMPORT_AUDIT_ENTITY,
      startedAt,
      status: 'success',
      affectedCount: 0,
      data: {
        actor: 'system',
        importType: 'snapshot',
        importSource: IMPORT_SOURCE,
        snapshotId: snapshot.id,
        snapshotName: snapshot.name,
        snapshotPath: snapshot.path,
        fileName: path.basename(snapshotFilePath),
        hashCompatible: snapshot.isHashCompatible(),
        tableCount: tableNames.length,
      },
    });
  }

  protected async emitTableAudit(
    auditEventService: AuditEventService,
    importId: string,
    tableName: string,
    counts: ImportTableCounts,
    tableIndex: number,
    tableCount: number,
    startedAt: Date,
    error: unknown = null,
  ): Promise<void> {
    const finishedAt = new Date();
    const status: ImportStatus = error ? 'failed' : 'success';
    await this.emitImportAuditEvent(auditEventService, {
      importId,
      phase: 'table_processed',
      entity: tableName,
      startedAt,
      finishedAt,
      status,
      error,
      affectedCount: counts.inserted + counts.updated,
      data: {
        tableName,
        tableIndex,
        tableCount,
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
        counts: {
          inserted: counts.inserted,
          updated: counts.updated,
          skipped: counts.skipped,
          failed: counts.failed,
        },
      },
    });
  }

  protected async emitTxOutcome(
    auditEventService: AuditEventService,
    importId: string,
    startedAt: Date,
    committed: boolean,
    totals: ImportTotals,
    error: unknown = null,
  ): Promise<void> {
    await this.emitImportAuditEvent(auditEventService, {
      importId,
      phase: 'transaction',
      entity: IMPORT_AUDIT_ENTITY,
      startedAt,
      finishedAt: new Date(),
      status: committed ? 'success' : 'failed',
      error,
      affectedCount: totals.inserted + totals.updated,
      data: {
        committed,
        rolledBack: !committed,
        totals: {
          inserted: totals.inserted,
          updated: totals.updated,
          failed: totals.failed,
        },
        error: this.summarizeError(error),
      },
    });
  }

  protected async finishImportAudit(
    auditEventService: AuditEventService,
    input: {
      importId: string;
      startedAt: Date;
      status: ImportStatus;
      totals: ImportTotals;
      error?: unknown;
      context?: {
        fwCloudId?: number | null;
        fwCloudName?: string | null;
      };
    },
  ): Promise<void> {
    await this.emitImportAuditEvent(auditEventService, {
      importId: input.importId,
      phase: 'final_summary',
      entity: IMPORT_AUDIT_ENTITY,
      startedAt: input.startedAt,
      finishedAt: new Date(),
      status: input.status,
      error: input.error,
      affectedCount: input.totals.inserted + input.totals.updated,
      context: input.context,
      data: {
        status: input.status,
        totals: {
          inserted: input.totals.inserted,
          updated: input.totals.updated,
          failed: input.totals.failed,
        },
        error: this.summarizeError(input.error),
      },
    });
  }

  protected async emitImportAuditEvent(
    auditEventService: AuditEventService,
    input: {
      importId: string;
      phase: ImportPhase;
      entity: string;
      startedAt: Date;
      finishedAt?: Date;
      status: ImportStatus;
      affectedCount: number;
      error?: unknown;
      context?: {
        fwCloudId?: number | null;
        fwCloudName?: string | null;
      };
      data?: Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      await auditEventService.emitEvent({
        source: IMPORT_SOURCE,
        operation: IMPORT_OPERATION,
        entity: input.entity,
        startedAt: input.startedAt,
        finishedAt: input.finishedAt ?? new Date(),
        status: input.status,
        error: input.error,
        affectedCount: input.affectedCount,
        context: input.context,
        details: {
          importId: input.importId,
          phase: input.phase,
          data: input.data ?? {},
        },
      });
    } catch {
      // Internal audit failures should not break the import operation.
    }
  }

  protected getInsertAffectedRows(result: InsertResult): number {
    const directAffected = this.readCountCandidate((result as any)?.affected);
    if (directAffected !== null) {
      return directAffected;
    }

    const raw: any = (result as any)?.raw;
    if (raw !== null && raw !== undefined) {
      const rawAffected = this.readCountCandidate(
        raw?.affectedRows ?? raw?.rowCount ?? raw?.changes ?? raw?.affected,
      );
      if (rawAffected !== null) {
        return rawAffected;
      }
    }

    const identifierCount = this.readCountCandidate((result as any)?.identifiers?.length);
    if (identifierCount !== null) {
      return identifierCount;
    }

    return 0;
  }

  protected normalizeCount(value: unknown): number {
    return this.readCountCandidate(value) ?? 0;
  }

  protected readCountCandidate(value: unknown): number | null {
    let numeric = Number.NaN;

    if (typeof value === 'number') {
      numeric = value;
    } else if (typeof value === 'bigint') {
      numeric = Number(value);
    } else if (typeof value === 'string' && value.trim() !== '') {
      numeric = Number.parseInt(value, 10);
    }

    if (!Number.isFinite(numeric)) {
      return null;
    }

    return Math.max(0, Math.trunc(numeric));
  }

  protected summarizeError(error: unknown): string | null {
    if (error === null || error === undefined) {
      return null;
    }

    let message = '';

    if (typeof error === 'string') {
      message = error;
    } else if (error instanceof Error) {
      message = error.message;
    } else if (
      typeof error === 'number' ||
      typeof error === 'boolean' ||
      typeof error === 'bigint'
    ) {
      message = String(error);
    } else {
      try {
        message = JSON.stringify(error);
      } catch {
        message = '';
      }
    }

    const normalized = message.replace(/\s+/g, ' ').trim();

    if (!normalized) {
      return null;
    }

    if (normalized.length <= MAX_AUDIT_ERROR_LENGTH) {
      return normalized;
    }

    return `${normalized.substring(0, MAX_AUDIT_ERROR_LENGTH - 3)}...`;
  }

  /**
   * Spawns a worker to terraform table records.
   * It returns mapper state, id manager state and the table records terraformed
   *
   * @param tableName
   * @param mapper
   * @param idManager
   * @param data
   * @returns
   */
  protected async handleTableResultTerraform(
    tableName: string,
    mapper: ImportMapping,
    idManager: IdManager,
    data: ExporterResult,
  ): Promise<OutputData> {
    return new Promise<OutputData>((resolve, reject) => {
      const wData: InputData = {
        tableName: tableName,
        data: data.getAll(),
        idMaps: mapper.maps,
        idState: idManager.getIdState(),
      };

      const worker = new Worker(path.join(__dirname, 'terraform_table.worker.js'), {
        workerData: wData,
      });

      worker.on('message', (data: OutputData) => {
        if (data.error) {
          const error = new Error(data.error.message);
          error.stack = data.error.stack;
          return reject(error);
        }
        return resolve(data);
      });

      worker.on('error', (err) => {
        return reject(err);
      });
    });
  }

  protected static async importDataDirectories(
    snapshotPath: string,
    fwCloud: FwCloud,
    mapper: ImportMapping,
  ): Promise<void> {
    FSHelper.rmDirectorySync(fwCloud.getPkiDirectoryPath());
    FSHelper.rmDirectorySync(fwCloud.getPolicyDirectoryPath());
    FSHelper.rmDirectorySync(fwCloud.getSnapshotDirectoryPath());

    if (FSHelper.directoryExistsSync(path.join(snapshotPath, Snapshot.PKI_DIRECTORY))) {
      await this.importPKIDirectory(
        path.join(snapshotPath, Snapshot.PKI_DIRECTORY),
        fwCloud,
        mapper,
      );
    }

    if (FSHelper.directoryExistsSync(path.join(snapshotPath, Snapshot.POLICY_DIRECTORY))) {
      await this.importPolicyDirectory(
        path.join(snapshotPath, Snapshot.POLICY_DIRECTORY),
        fwCloud,
        mapper,
      );
    }
  }

  protected static async importPKIDirectory(
    directoryPath: string,
    fwCloud: FwCloud,
    mapper: ImportMapping,
  ): Promise<void> {
    const directories: Array<string> = await FSHelper.directories(directoryPath);

    for (let i = 0; i < directories.length; i++) {
      const directory: string = directories[i];
      const oldCaId: number = parseInt(PathHelper.directoryName(directory));
      const newCaId: number = mapper.getMappedId(
        Ca._getTableName(),
        Ca.getPrimaryKeys()[0].propertyName,
        oldCaId,
      );
      const importDirectory: string = path.join(
        path.join(app().config.get('pki').data_dir, fwCloud.id.toString(), newCaId.toString()),
      );
      await FSHelper.copy(directory, importDirectory);
    }
  }

  protected static async importPolicyDirectory(
    directoryPath: string,
    fwCloud: FwCloud,
    mapper: ImportMapping,
  ): Promise<void> {
    const directories: Array<string> = await FSHelper.directories(directoryPath);

    for (let i = 0; i < directories.length; i++) {
      const directory: string = directories[i];
      const oldFirewallId: number = parseInt(PathHelper.directoryName(directory));
      const newFirewallId: number = mapper.getMappedId(
        Firewall._getTableName(),
        Firewall.getPrimaryKeys()[0].propertyName,
        oldFirewallId,
      );
      const importDirectory: string = path.join(
        path.join(
          app().config.get('policy').data_dir,
          fwCloud.id.toString(),
          newFirewallId.toString(),
        ),
      );
      await FSHelper.copy(directory, importDirectory);
    }
  }
}
