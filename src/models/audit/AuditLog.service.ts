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

import { SelectQueryBuilder } from 'typeorm';
import db from '../../database/database-manager';
import { Service } from '../../fonaments/services/service';
import { User } from '../user/User';
import { AuditLog, formatAuditLogDateForDb, parseAuditLogDateFromDb } from './AuditLog';
import { AuditLogHelper } from './audit-log.helper';
import { maskSensitiveAuditText, sanitizeAuditData } from './audit-log-sanitizer';
import { AuditEventType, AuditOutcome, isAuthenticationEvent } from './audit-event-type';
import * as fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';
import { Mutex, tryAcquire, E_ALREADY_LOCKED } from 'async-mutex';
import { getMetadataArgsStorage } from 'typeorm';
import { ColumnMetadataArgs } from 'typeorm/metadata-args/ColumnMetadataArgs';
import { Zip } from '../../utils/zip';
import ObjectHelpers from '../../utils/object-helpers';
import { logger } from '../../fonaments/abstract-application';
import { FwCloud } from '../fwcloud/FwCloud';
import { Firewall } from '../firewall/Firewall';
import { Cluster } from '../firewall/Cluster';
import {
  ProgressInfoPayload,
  ProgressNoticePayload,
  ProgressPayload,
} from '../../sockets/messages/socket-message';

export type AuditLogArchiveConfig = {
  data_dir: string;
  archive_schedule: string;
  archive_days: number;
  retention_schedule: string;
  retention_days: number;
};

export type AuditLogArchiverUpdateableConfig = {
  archive_days: number;
  retention_days: number;
};

export type AuditLogSortBy = 'start' | 'end';
export type AuditLogSortOrder = 'asc' | 'desc';

export type ListAuditLogsCursor =
  { startedAt: Date; id: number } | { finishedAt: Date | null; id: number };

export type ListAuditLogsOptions = {
  isAdmin: boolean;
  sessionId?: number | null;
  userId?: number | null;
  skip?: number;
  take?: number;
  startedAtFrom?: Date;
  startedAtTo?: Date;
  userName?: string;
  sessionIdFilter?: number | null;
  fwCloudId?: number;
  fwCloudName?: string;
  firewallId?: number;
  firewallName?: string;
  clusterId?: number;
  clusterName?: string;
  sourceIp?: string;
  sortBy?: AuditLogSortBy;
  sortOrder?: AuditLogSortOrder;
  cursor?: ListAuditLogsCursor;
  eventTypes?: AuditEventType[];
  excludeConfirmationTokenRequests?: boolean;
};

export type AuditLogAccessOptions = Pick<
  ListAuditLogsOptions,
  'isAdmin' | 'sessionId' | 'userId'
> & {
  fwCloudId?: number;
};

export type AuditLogSummary = {
  confirmationTokenChallenge: boolean | null;
  eventType: AuditEventType | null;
  outcome: AuditOutcome | null;
  id: number;
  startedAt: Date;
  userId: number | null;
  userName: string | null;
  sessionId: number | null;
  sourceIp: string | null;
  fwCloudId: number | null;
  fwCloudName: string | null;
  firewallId: number | null;
  firewallName: string | null;
  clusterId: number | null;
  clusterName: string | null;
  call: string;
  status: number | null;
  durationMs: number | null;
  description: string;
};

type AuditLogSummaryRow = {
  confirmationTokenChallenge: boolean | number | string | null;
  eventType: AuditEventType | null;
  outcome: AuditOutcome | null;
  id: number | string;
  startedAt: Date | string | null;
  userId: number | string | null;
  userName: string | null;
  sessionId: number | string | null;
  sourceIp: string | null;
  fwCloudId: number | string | null;
  fwCloudName: string | null;
  firewallId: number | string | null;
  firewallName: string | null;
  clusterId: number | string | null;
  clusterName: string | null;
  call: string;
  status: number | string | null;
  durationMs: number | string | null;
  description: string;
};

export type AuditLogMutationInput = {
  eventType?: AuditEventType;
  call: string;
  description: string;
  status?: number | null;
  data?: unknown;
  userId?: number | null;
  userName?: string | null;
  sessionId?: number | null;
  sourceIp?: string | null;
  fwCloudId?: number | null;
  fwCloudName?: string | null;
  firewallId?: number | null;
  firewallName?: string | null;
  clusterId?: number | null;
  clusterName?: string | null;
  startedAt?: Date | string | null;
};

const MAX_CALL_LENGTH = 255;
const MAX_DURATION_MS = 2147483647;
const STARTED_AT_COLUMN = '`auditLog`.`ts`';
// Missing or invalid durations never imply that an operation has finished.
const FINISHED_AT_EXPRESSION =
  'CASE WHEN `auditLog`.`duration_ms` >= 0 THEN TIMESTAMPADD(MICROSECOND, `auditLog`.`duration_ms` * 1000, `auditLog`.`ts`) ELSE NULL END';
const quoteAuditLogDateForSql = (date: Date): string => `'${formatAuditLogDateForDb(date)}'`;

export class AuditLogService extends Service {
  protected _config: AuditLogArchiveConfig;
  protected _archiveMutex = new Mutex();

  private get auditLogRepository() {
    return db.getSource().manager.getRepository(AuditLog);
  }

  public async build(): Promise<AuditLogService> {
    this._config = this.loadCustomizedConfig(this._app.config.get('auditLogs.archive'));

    if (!fs.existsSync(this._config.data_dir)) {
      fs.mkdirpSync(this._config.data_dir);
    }

    return this;
  }

  public async logMutation(input: AuditLogMutationInput): Promise<AuditLog | null> {
    try {
      const auditLog = await this.createMutationEntry(input);
      return await this.auditLogRepository.save(auditLog);
    } catch (error) {
      try {
        logger().error(
          `Unexpected error while creating audit log mutation entry: ${error?.message ?? error}`,
        );
      } catch {
        // ignore logging failures to avoid breaking background task execution
      }
      return null;
    }
  }

  public async listAuditLogs(options: ListAuditLogsOptions): Promise<{
    auditLogs: AuditLogSummary[];
    total: number;
  }> {
    const query = this.auditLogRepository.createQueryBuilder('auditLog');

    if (!this.applyAccessRestrictions(query, options)) {
      return { auditLogs: [], total: 0 };
    }

    if (options.eventTypes?.length) {
      query.andWhere('auditLog.eventType IN (:...eventTypes)', { eventTypes: options.eventTypes });
    }

    if (options.excludeConfirmationTokenRequests === true) {
      query.andWhere(
        '(auditLog.confirmationTokenChallenge IS NULL OR auditLog.confirmationTokenChallenge = :confirmationTokenChallenge)',
        { confirmationTokenChallenge: false },
      );
    }

    if (options.startedAtFrom instanceof Date) {
      query.andWhere(`${STARTED_AT_COLUMN} >= ${quoteAuditLogDateForSql(options.startedAtFrom)}`);
    }

    if (options.startedAtTo instanceof Date) {
      query.andWhere(`${STARTED_AT_COLUMN} <= ${quoteAuditLogDateForSql(options.startedAtTo)}`);
    }

    const applyTextFilter = (
      property: 'userName' | 'fwCloudName' | 'firewallName' | 'clusterName' | 'sourceIp',
    ) => {
      const value = options[property];
      if (typeof value === 'string' && value.trim() !== '') {
        query.andWhere(`LOWER(auditLog.${property}) LIKE :${property}`, {
          [property]: `%${value.toLowerCase()}%`,
        });
      }
    };

    applyTextFilter('userName');
    for (const entity of ['fwCloud', 'firewall', 'cluster'] as const) {
      const property = `${entity}Id` as const;
      const value = options[property];
      if (typeof value === 'number' && Number.isFinite(value)) {
        query.andWhere(`auditLog.${property} = :${property}`, { [property]: value });
      }
      applyTextFilter(`${entity}Name`);
    }
    applyTextFilter('sourceIp');

    if (Number.isFinite(options.sessionIdFilter)) {
      query.andWhere('auditLog.sessionId = :filterSessionId', {
        filterSessionId: options.sessionIdFilter,
      });
    }

    this.applySorting(query, options);

    const total = await query.clone().getCount();
    const listQuery = this.selectSummaryColumns(query.clone());

    if (typeof options.take === 'number' && Number.isFinite(options.take)) {
      listQuery.limit(Math.max(0, options.take));
    }

    if (typeof options.skip === 'number' && Number.isFinite(options.skip)) {
      listQuery.offset(Math.max(0, options.skip));
    }

    const rows = await listQuery.getRawMany<AuditLogSummaryRow>();

    return {
      auditLogs: rows.map((row) => this.toSummary(row)),
      total,
    };
  }

  public async getAuditLog(id: number, options: AuditLogAccessOptions): Promise<AuditLog | null> {
    if (!Number.isFinite(id) || id <= 0) {
      return null;
    }

    const query = this.auditLogRepository
      .createQueryBuilder('auditLog')
      .where('auditLog.id = :id', { id });

    if (!this.applyAccessRestrictions(query, options)) {
      return null;
    }

    if (typeof options.fwCloudId === 'number' && Number.isFinite(options.fwCloudId)) {
      query.andWhere('auditLog.fwCloudId = :fwCloudId', { fwCloudId: options.fwCloudId });
    }

    const auditLog = await query.getOne();
    if (auditLog) {
      auditLog.durationMs =
        auditLog.durationMs == null
          ? this.extractDurationMsFromSerializedData(auditLog.data)
          : this.normalizeDurationMs(auditLog.durationMs);
    }

    return auditLog;
  }

  public parseAuditLogData(data: string | null | undefined): unknown {
    const raw = typeof data === 'string' ? data.trim() : '';
    if (raw.length === 0) {
      return {};
    }

    try {
      return sanitizeAuditData(JSON.parse(raw));
    } catch {
      return {
        raw: maskSensitiveAuditText(raw),
        truncated: raw.endsWith(AuditLogHelper.TRUNCATED_DATA_SUFFIX),
      };
    }
  }

  public async syncEntriesWithUser<T extends Pick<AuditLog, 'id' | 'userId' | 'userName'>>(
    entries: T[],
    user: User | null,
  ): Promise<T[]> {
    if (!entries.length || !user) {
      return entries;
    }

    const userId = user.id ?? null;
    const userName = user.username ?? user.name ?? null;

    const entriesToUpdate = entries.filter(
      (entry) =>
        !isAuthenticationEvent((entry as T & { eventType?: AuditEventType }).eventType) &&
        (entry.userId !== userId || entry.userName !== userName),
    );

    if (!entriesToUpdate.length) {
      return entries;
    }

    await this.auditLogRepository
      .createQueryBuilder()
      .update(AuditLog)
      .set({ userId, userName })
      .whereInIds(entriesToUpdate.map((entry) => entry.id))
      .execute();

    entriesToUpdate.forEach((entry) => {
      entry.userId = userId;
      entry.userName = userName;
    });

    return entries;
  }

  private applyAccessRestrictions(
    query: SelectQueryBuilder<AuditLog>,
    options: AuditLogAccessOptions,
  ): boolean {
    if (options.isAdmin) {
      return true;
    }

    const accessClauses: string[] = [];
    if (options.sessionId != null) {
      accessClauses.push('auditLog.sessionId = :currentSessionId');
    }
    if (options.userId != null) {
      accessClauses.push('auditLog.userId = :currentUserId');
    }

    if (!accessClauses.length) {
      return false;
    }

    // Session ownership alone must never grant access to another user's authentication events,
    // including anonymous failures from a session later used to log in successfully.
    query.andWhere(
      '(auditLog.eventType IS NULL OR auditLog.eventType NOT IN (:...authEventTypes)' +
        (options.userId != null ? ' OR auditLog.userId = :authUserId)' : ')'),
      { authEventTypes: [AuditEventType.Login, AuditEventType.Logout], authUserId: options.userId },
    );

    query.andWhere(`(${accessClauses.join(' OR ')})`, {
      currentSessionId: options.sessionId,
      currentUserId: options.userId,
    });

    return true;
  }

  private applySorting(query: SelectQueryBuilder<AuditLog>, options: ListAuditLogsOptions): void {
    const sortByEnd = options.sortBy === 'end';
    const sortColumn = sortByEnd ? FINISHED_AT_EXPRESSION : STARTED_AT_COLUMN;
    const direction = options.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const unknownEnd = `(${sortColumn}) IS NULL`;

    if (sortByEnd) {
      // Keep unknown end times last in either direction.
      query.orderBy(unknownEnd, 'ASC').addOrderBy(sortColumn, direction);
    } else {
      query.orderBy(sortColumn, direction);
    }
    query.addOrderBy('`auditLog`.`id`', direction);

    const cursor = options.cursor;
    if (!cursor) return;

    const cursorTime = 'finishedAt' in cursor ? cursor.finishedAt : cursor.startedAt;
    const comparison = direction === 'ASC' ? '>' : '<';
    const compareId = `auditLog.id ${comparison} :cursorId`;
    let condition: string;

    if (sortByEnd && cursorTime === null) {
      condition = `${unknownEnd} AND ${compareId}`;
    } else if (cursorTime instanceof Date) {
      const cursorTimestamp = quoteAuditLogDateForSql(cursorTime);
      const afterCursor = `((${sortColumn}) ${comparison} ${cursorTimestamp} OR ((${sortColumn}) = ${cursorTimestamp} AND ${compareId}))`;
      // Preserve the legacy boolean comparison for descending timestamp scans on MariaDB.
      condition = sortByEnd ? `(${afterCursor} OR ${unknownEnd})` : `${afterCursor} = 1`;
    } else {
      return;
    }

    query.andWhere(condition, { cursorId: cursor.id });
  }

  private selectSummaryColumns(query: SelectQueryBuilder<AuditLog>): SelectQueryBuilder<AuditLog> {
    return query
      .select('auditLog.id', 'id')
      .addSelect('auditLog.startedAt', 'startedAt')
      .addSelect('auditLog.userId', 'userId')
      .addSelect('auditLog.userName', 'userName')
      .addSelect('auditLog.sessionId', 'sessionId')
      .addSelect('auditLog.sourceIp', 'sourceIp')
      .addSelect('auditLog.fwCloudId', 'fwCloudId')
      .addSelect('auditLog.fwCloudName', 'fwCloudName')
      .addSelect('auditLog.firewallId', 'firewallId')
      .addSelect('auditLog.firewallName', 'firewallName')
      .addSelect('auditLog.clusterId', 'clusterId')
      .addSelect('auditLog.clusterName', 'clusterName')
      .addSelect('auditLog.call', 'call')
      .addSelect('auditLog.status', 'status')
      .addSelect('auditLog.confirmationTokenChallenge', 'confirmationTokenChallenge')
      .addSelect('auditLog.eventType', 'eventType')
      .addSelect('auditLog.outcome', 'outcome')
      .addSelect('auditLog.durationMs', 'durationMs')
      .addSelect('auditLog.description', 'description');
  }

  private toSummary(auditLog: AuditLogSummaryRow): AuditLogSummary {
    return {
      id: Number(auditLog.id),
      startedAt: this.normalizeSummaryDate(auditLog.startedAt),
      userId: AuditLogHelper.getNumeric(auditLog.userId),
      userName: auditLog.userName,
      sessionId: AuditLogHelper.getNumeric(auditLog.sessionId),
      sourceIp: auditLog.sourceIp,
      fwCloudId: AuditLogHelper.getNumeric(auditLog.fwCloudId),
      fwCloudName: auditLog.fwCloudName,
      firewallId: AuditLogHelper.getNumeric(auditLog.firewallId),
      firewallName: auditLog.firewallName,
      clusterId: AuditLogHelper.getNumeric(auditLog.clusterId),
      clusterName: auditLog.clusterName,
      call: auditLog.call,
      status: AuditLogHelper.normalizeHttpStatus(auditLog.status),
      confirmationTokenChallenge:
        auditLog.confirmationTokenChallenge == null
          ? null
          : auditLog.confirmationTokenChallenge === true ||
            auditLog.confirmationTokenChallenge === 1 ||
            auditLog.confirmationTokenChallenge === '1',
      eventType: auditLog.eventType ?? null,
      outcome: auditLog.outcome ?? null,
      durationMs: this.normalizeDurationMs(auditLog.durationMs),
      description: auditLog.description,
    };
  }

  private normalizeSummaryDate(value: unknown): Date {
    return (
      (value instanceof Date || typeof value === 'string'
        ? parseAuditLogDateFromDb(value)
        : null) ?? new Date(0)
    );
  }

  public getCustomizedConfig(): AuditLogArchiverUpdateableConfig {
    this._config = this.loadCustomizedConfig(this._app.config.get('auditLogs.archive'));

    return {
      archive_days: this._config.archive_days,
      retention_days: this._config.retention_days,
    };
  }

  public async archiveHistory(eventEmitter: EventEmitter = new EventEmitter()): Promise<number> {
    try {
      return await tryAcquire(this._archiveMutex).runExclusive(() => {
        return new Promise<number>(async (resolve, reject) => {
          try {
            this._config = this.loadCustomizedConfig(this._app.config.get('auditLogs.archive'));
            const repository = this.auditLogRepository;

            eventEmitter.emit(
              'message',
              new ProgressInfoPayload('Starting audit log history archiver'),
            );
            eventEmitter.emit(
              'message',
              new ProgressNoticePayload('Checking expired audit log entries'),
            );

            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() - this._config.archive_days);

            const getExpiredAuditLogsQuery = () =>
              repository
                .createQueryBuilder('auditLog')
                .where(`${STARTED_AT_COLUMN} <= ${quoteAuditLogDateForSql(expirationDate)}`)
                .orderBy('auditLog.id', 'ASC');

            const totalExpiredLogs = await getExpiredAuditLogsQuery().getCount();

            if (totalExpiredLogs === 0) {
              eventEmitter.emit('message', new ProgressNoticePayload('Nothing to archive'));
              eventEmitter.emit('message', new ProgressPayload('end', false, ''));
              return resolve(0);
            }

            const now = new Date();
            const yearDir = now.getFullYear().toString();
            const monthDir = this.pad(now.getMonth() + 1);
            const fileName = `audit_logs_history-${this.getDateForFile(now)}.sql`;
            const archiveDir = path.join(this._config.data_dir, yearDir, monthDir);
            const sqlFilePath = path.join(archiveDir, fileName);
            const zipFilePath = `${sqlFilePath}.zip`;

            if (await fs.pathExists(zipFilePath)) {
              eventEmitter.emit(
                'message',
                new ProgressNoticePayload('Decompressing existing audit log archive'),
              );

              await Zip.unzip(zipFilePath, archiveDir);
              await fs.remove(zipFilePath);
            } else {
              fs.mkdirpSync(archiveDir);
            }

            eventEmitter.emit(
              'message',
              new ProgressNoticePayload(
                `Archiving entries older than ${this.getDateForLog(expirationDate)}`,
              ),
            );
            eventEmitter.emit(
              'message',
              new ProgressNoticePayload(`Entries to be archived: ${totalExpiredLogs}`),
            );

            const table =
              getMetadataArgsStorage().tables.find((item) => item.target === AuditLog)?.name ??
              AuditLog.name;
            const columns: ColumnMetadataArgs[] = getMetadataArgsStorage().columns.filter(
              (item) => item.target === AuditLog,
            );
            const insertColumnDef = columns
              .map((item) => `\`${item.options.name ?? item.propertyName}\``)
              .join(',');

            let processed = 0;

            while (true) {
              const logs = await getExpiredAuditLogsQuery().limit(2000).getMany();

              if (!logs.length) {
                eventEmitter.emit(
                  'message',
                  new ProgressNoticePayload('Compressing audit log archive file'),
                );
                await Zip.zip(sqlFilePath);
                await fs.remove(sqlFilePath);
                eventEmitter.emit('message', new ProgressPayload('end', false, ''));
                return resolve(processed);
              }

              const content = `INSERT INTO \`${table}\` (${insertColumnDef}) VALUES \n ${logs
                .map(
                  (log) =>
                    `(${columns
                      .map((column) => this.formatValue(log[column.propertyName]))
                      .join(',')})`,
                )
                .join(',')};\n`;

              await fs.writeFile(sqlFilePath, content, { flag: 'a' });
              await repository.delete(logs.map((log) => log.id));

              processed += logs.length;
              eventEmitter.emit(
                'message',
                new ProgressNoticePayload(`Progress: ${processed} of ${totalExpiredLogs} entries`),
              );
            }
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      if (error === E_ALREADY_LOCKED) {
        eventEmitter.emit(
          'message',
          new ProgressPayload(
            'error',
            false,
            'There is another audit log history archiver running',
          ),
        );
        throw Object.assign(new Error('There is another audit log history archiver running'), {
          cause: error,
        });
      }

      throw error;
    }
  }

  public async removeExpiredFiles(): Promise<number> {
    return new Promise<number>(async (resolve, reject) => {
      try {
        const allFiles: { file: string; path: string }[] = [];
        fs.readdirSync(this._config.data_dir).forEach((dirent) => {
          if (fs.existsSync(path.join(this._config.data_dir, dirent))) {
            fs.readdirSync(path.join(this._config.data_dir, dirent)).forEach((subDirent) => {
              if (fs.existsSync(path.join(this._config.data_dir, dirent, subDirent))) {
                fs.readdirSync(path.join(this._config.data_dir, dirent, subDirent)).forEach(
                  (file) => {
                    allFiles.push({
                      file,
                      path: path.join(this._config.data_dir, dirent, subDirent),
                    });
                  },
                );
              }
            });
          }
        });

        const filesToRemove = allFiles
          .filter((file) => /audit_logs_history-[0-9]{8}\.sql\.zip/.test(file.file))
          .filter((file) => {
            const date = this.getDateFromArchiveFilename(file);
            const limit = new Date();
            limit.setDate(limit.getDate() - this._config.retention_days);
            return date < limit;
          });

        filesToRemove.forEach((file) => fs.unlinkSync(path.join(file.path, file.file)));

        resolve(filesToRemove.length);
      } catch (error) {
        reject(error);
      }
    });
  }

  public async updateArchiveConfig(
    customConfig: AuditLogArchiverUpdateableConfig,
  ): Promise<AuditLogArchiverUpdateableConfig> {
    await this.writeCustomizedConfig(customConfig);
    this._config = this.loadCustomizedConfig(this._app.config.get('auditLogs.archive'));

    return {
      archive_days: this._config.archive_days,
      retention_days: this._config.retention_days,
    };
  }

  protected loadCustomizedConfig(baseConfig: AuditLogArchiveConfig): AuditLogArchiveConfig {
    let config: AuditLogArchiveConfig = baseConfig;

    const customConfigFile = path.join(baseConfig.data_dir, 'config.json');

    if (fs.existsSync(customConfigFile)) {
      const customConfig = JSON.parse(fs.readFileSync(customConfigFile, 'utf8'));
      config = ObjectHelpers.deepMerge<AuditLogArchiveConfig>(config, customConfig);
    }

    return config;
  }

  protected async writeCustomizedConfig(
    customConfig: AuditLogArchiverUpdateableConfig,
  ): Promise<void> {
    if (!fs.existsSync(this._config.data_dir)) {
      await fs.mkdirp(this._config.data_dir);
    }

    const customConfigFile = path.join(this._config.data_dir, 'config.json');
    await fs.writeFile(customConfigFile, JSON.stringify(customConfig), 'utf8');
  }

  protected formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (value instanceof Date) {
      return "'" + this.formatDateTime(value) + "'";
    }

    if (typeof value === 'string') {
      return "'" + this.escapeString(value) + "'";
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
      return value.toString();
    }

    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }

    if (typeof value === 'symbol' || typeof value === 'function') {
      return "'" + this.escapeString(value.toString()) + "'";
    }

    if (typeof value === 'object') {
      const serialized = JSON.stringify(value);
      return "'" + this.escapeString(serialized ?? '') + "'";
    }

    const exhaustiveCheck: never = value as never;
    throw new Error('Unsupported audit log archive value type');
  }

  protected formatDateTime(date: Date): string {
    return `${date.getUTCFullYear()}-${this.pad(date.getUTCMonth() + 1)}-${this.pad(date.getUTCDate())} ${this.pad(date.getUTCHours())}:${this.pad(date.getUTCMinutes())}:${this.pad(date.getUTCSeconds())}`;
  }

  protected getDateForFile(date: Date): string {
    return `${date.getFullYear()}${this.pad(date.getMonth() + 1)}${this.pad(date.getDate())}`;
  }

  protected getDateForLog(date: Date): string {
    return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`;
  }

  protected pad(value: number): string {
    return value.toString().padStart(2, '0');
  }

  protected getDateFromArchiveFilename(filename: { path: string; file: string }): Date {
    const stats = fs.lstatSync(path.join(filename.path, filename.file));
    return stats.birthtime;
  }

  protected escapeString(raw: string): string {
    return raw.replace(/\\/g, '\\\\').replace(/'/g, "''");
  }

  protected async createMutationEntry(input: AuditLogMutationInput): Promise<AuditLog> {
    const auditLog = new AuditLog();

    auditLog.eventType = input.eventType ?? AuditEventType.Other;
    auditLog.outcome = null;
    auditLog.confirmationTokenChallenge = false;
    auditLog.call = this.normalizeCall(input.call);
    auditLog.status = AuditLogHelper.normalizeHttpStatus(input.status);
    auditLog.description = this.normalizeDescription(input.description, auditLog.call);
    auditLog.data = this.serializeData(input.data ?? {});
    auditLog.durationMs = this.extractDurationMsFromData(input.data);
    auditLog.startedAt =
      this.normalizeAuditDate(input.startedAt) ??
      this.extractStartedAtFromData(input.data) ??
      new Date();

    auditLog.userId = AuditLogHelper.getNumeric(input.userId);
    auditLog.userName = AuditLogHelper.getTrimmedString(input.userName);
    auditLog.sessionId = AuditLogHelper.getNumeric(input.sessionId);
    auditLog.sourceIp = AuditLogHelper.normalizeSourceIp(input.sourceIp);

    auditLog.fwCloudId = AuditLogHelper.getNumeric(input.fwCloudId);
    auditLog.firewallId = AuditLogHelper.getNumeric(input.firewallId);
    auditLog.clusterId = AuditLogHelper.getNumeric(input.clusterId);

    auditLog.fwCloudName = AuditLogHelper.getTrimmedString(input.fwCloudName);
    auditLog.firewallName = AuditLogHelper.getTrimmedString(input.firewallName);
    auditLog.clusterName = AuditLogHelper.getTrimmedString(input.clusterName);

    await this.enrichEntityNames(auditLog);

    return auditLog;
  }

  protected normalizeCall(call: string): string {
    const fallback = AuditLogHelper.getTrimmedString(call) ?? 'SYSTEM';
    return fallback.length <= MAX_CALL_LENGTH
      ? fallback
      : `${fallback.substring(0, MAX_CALL_LENGTH - 3)}...`;
  }

  protected normalizeDescription(description: string, fallback: string): string {
    const normalized = typeof description === 'string' ? description.trim() : '';
    const withoutTechnicalStatus = this.stripTechnicalStatusFragments(normalized);
    return withoutTechnicalStatus.length > 0 ? withoutTechnicalStatus : fallback;
  }

  protected stripTechnicalStatusFragments(description: string): string {
    if (!description) {
      return '';
    }

    return description
      .replace(/\s*\|\s*status\s*=\s*[^|.]+/gi, '')
      .replace(/\bHTTP\s+status\s*(?:code\s*)?\d{3}\b\.?/gi, '')
      .replace(/\bStatus\s+\d{3}\b\.?/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+\./g, '.')
      .trim();
  }

  protected serializeData(data: unknown): string {
    const serialized = JSON.stringify(sanitizeAuditData(data));
    return serialized ? AuditLogHelper.truncateData(serialized) : '{}';
  }

  protected extractDurationMsFromData(data: unknown): number | null {
    const record = AuditLogHelper.asRecord(data);
    return this.normalizeDurationMs(record?.durationMs ?? record?.duration_ms);
  }

  protected extractDurationMsFromSerializedData(data: string | null | undefined): number | null {
    try {
      return this.extractDurationMsFromData(JSON.parse(data));
    } catch {
      return null;
    }
  }

  protected extractStartedAtFromData(data: unknown): Date | null {
    const record = AuditLogHelper.asRecord(data);
    return this.normalizeAuditDate(record?.startedAt ?? record?.started_at ?? record?.ts);
  }

  protected normalizeDurationMs(value: unknown): number | null {
    if (
      typeof value !== 'number' &&
      typeof value !== 'bigint' &&
      !(typeof value === 'string' && value.trim() !== '')
    ) {
      return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 && numeric <= MAX_DURATION_MS
      ? Math.trunc(numeric)
      : null;
  }

  protected normalizeAuditDate(value: unknown): Date | null {
    let date: Date | null = null;

    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string' && value.trim() !== '') {
      date = new Date(value);
    }

    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  protected async enrichEntityNames(auditLog: AuditLog): Promise<void> {
    const firewall =
      auditLog.firewallId != null
        ? await Firewall.findOne({ where: { id: auditLog.firewallId } })
        : null;

    auditLog.clusterId ??= AuditLogHelper.getPositiveNumeric(firewall?.clusterId);
    auditLog.fwCloudId ??= AuditLogHelper.getPositiveNumeric(firewall?.fwCloudId);

    const [fwCloud, cluster] = await Promise.all([
      auditLog.fwCloudId ? FwCloud.findOne({ where: { id: auditLog.fwCloudId } }) : null,
      auditLog.clusterId ? Cluster.findOne({ where: { id: auditLog.clusterId } }) : null,
    ]);

    auditLog.fwCloudName = auditLog.fwCloudName ?? fwCloud?.name ?? null;
    auditLog.firewallName = auditLog.firewallName ?? firewall?.name ?? null;
    auditLog.clusterName = auditLog.clusterName ?? cluster?.name ?? null;
  }
}
