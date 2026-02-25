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

import { Brackets, SelectQueryBuilder } from 'typeorm';
import db from '../../database/database-manager';
import { Service } from '../../fonaments/services/service';
import { User } from '../user/User';
import { AuditLog } from './AuditLog';
import { AuditLogHelper } from './audit-log.helper';
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

export type ListAuditLogsCursor = {
  timestamp: Date;
  id: number;
};

export type ListAuditLogsOptions = {
  isAdmin: boolean;
  sessionId?: number | null;
  userId?: number | null;
  skip?: number;
  take?: number;
  timestampFrom?: Date;
  timestampTo?: Date;
  userName?: string;
  sessionIdFilter?: number | null;
  fwCloudId?: number;
  fwCloudName?: string;
  firewallId?: number;
  firewallName?: string;
  clusterId?: number;
  clusterName?: string;
  sourceIp?: string;
  cursor?: ListAuditLogsCursor;
};

export type AuditLogMutationInput = {
  call: string;
  description: string;
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
};

const MAX_CALL_LENGTH = 255;
const MAX_DATA_LENGTH = 64 * 1024; // 64KB to avoid oversized entries
const MAX_SOURCE_IP_LENGTH = 45;

const SENSITIVE_KEY_PATTERNS = [
  'password',
  'passcode',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'accesskey',
  'access_key',
  'auth',
  'credential',
  'otp',
];

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
    auditLogs: AuditLog[];
    total: number;
  }> {
    const query = this.auditLogRepository
      .createQueryBuilder('auditLog')
      .orderBy('auditLog.timestamp', 'DESC')
      .addOrderBy('auditLog.id', 'DESC');

    if (!options.isAdmin) {
      const accessRestrictions: Array<{ clause: string; params: Record<string, unknown> }> = [];

      if (options.sessionId !== null && options.sessionId !== undefined) {
        accessRestrictions.push({
          clause: 'auditLog.sessionId = :currentSessionId',
          params: { currentSessionId: options.sessionId },
        });
      }

      if (options.userId !== null && options.userId !== undefined) {
        accessRestrictions.push({
          clause: 'auditLog.userId = :currentUserId',
          params: { currentUserId: options.userId },
        });
      }

      if (!accessRestrictions.length) {
        return { auditLogs: [], total: 0 };
      }

      query.andWhere(
        new Brackets((qb) => {
          accessRestrictions.forEach((restriction, index) => {
            if (index === 0) {
              qb.where(restriction.clause, restriction.params);
            } else {
              qb.orWhere(restriction.clause, restriction.params);
            }
          });
        }),
      );
    }

    if (options.timestampFrom instanceof Date) {
      query.andWhere('auditLog.timestamp >= :timestampFrom', {
        timestampFrom: options.timestampFrom,
      });
    }

    if (options.timestampTo instanceof Date) {
      query.andWhere('auditLog.timestamp <= :timestampTo', {
        timestampTo: options.timestampTo,
      });
    }

    const applyTextFilter = (field: string, param: string, value: string) => {
      query.andWhere(`LOWER(${field}) LIKE :${param}`, {
        [param]: `%${value.toLowerCase()}%`,
      });
    };

    if (typeof options.userName === 'string' && options.userName.trim() !== '') {
      applyTextFilter('auditLog.userName', 'userName', options.userName);
    }

    if (typeof options.fwCloudId === 'number' && Number.isFinite(options.fwCloudId)) {
      query.andWhere('auditLog.fwCloudId = :fwCloudId', { fwCloudId: options.fwCloudId });
    }

    if (typeof options.fwCloudName === 'string' && options.fwCloudName.trim() !== '') {
      applyTextFilter('auditLog.fwCloudName', 'fwCloudName', options.fwCloudName);
    }

    if (typeof options.firewallId === 'number' && Number.isFinite(options.firewallId)) {
      query.andWhere('auditLog.firewallId = :firewallId', { firewallId: options.firewallId });
    }

    if (typeof options.firewallName === 'string' && options.firewallName.trim() !== '') {
      applyTextFilter('auditLog.firewallName', 'firewallName', options.firewallName);
    }

    if (typeof options.clusterId === 'number' && Number.isFinite(options.clusterId)) {
      query.andWhere('auditLog.clusterId = :clusterId', { clusterId: options.clusterId });
    }

    if (typeof options.clusterName === 'string' && options.clusterName.trim() !== '') {
      applyTextFilter('auditLog.clusterName', 'clusterName', options.clusterName);
    }

    if (typeof options.sourceIp === 'string' && options.sourceIp.trim() !== '') {
      applyTextFilter('auditLog.sourceIp', 'sourceIp', options.sourceIp);
    }

    if (
      options.sessionIdFilter !== null &&
      options.sessionIdFilter !== undefined &&
      Number.isFinite(options.sessionIdFilter)
    ) {
      query.andWhere('auditLog.sessionId = :filterSessionId', {
        filterSessionId: options.sessionIdFilter,
      });
    }

    if (options.cursor) {
      const cursor = options.cursor;
      const cursorTimestamp = cursor.timestamp.toISOString();
      query.andWhere(
        new Brackets((qb) => {
          qb.where('auditLog.timestamp < :cursorTimestamp', {
            cursorTimestamp,
          }).orWhere(
            new Brackets((inner) => {
              inner
                .where('auditLog.timestamp = :cursorTimestamp', {
                  cursorTimestamp,
                })
                .andWhere('auditLog.id < :cursorId', { cursorId: cursor.id });
            }),
          );
        }),
      );
    }

    if (typeof options.take === 'number' && Number.isFinite(options.take)) {
      query.take(Math.max(0, options.take));
    }

    if (typeof options.skip === 'number' && Number.isFinite(options.skip)) {
      query.skip(Math.max(0, options.skip));
    }

    const [auditLogs, total] = await query.getManyAndCount();

    return { auditLogs, total };
  }

  public async syncEntriesWithUser(entries: AuditLog[], user: User | null): Promise<AuditLog[]> {
    if (!entries.length || !user) {
      return entries;
    }

    const userId = user.id ?? null;
    const userName = user.username ?? user.name ?? null;

    const entriesToUpdate = entries.filter(
      (entry) => entry.userId !== userId || entry.userName !== userName,
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
                .where('auditLog.ts <= :timestamp', { timestamp: expirationDate })
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
        throw new Error('There is another audit log history archiver running', {
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
    return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())} ${this.pad(date.getHours())}:${this.pad(date.getMinutes())}:${this.pad(date.getSeconds())}`;
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

    auditLog.call = this.normalizeCall(input.call);
    auditLog.description = this.normalizeDescription(input.description, auditLog.call);
    auditLog.data = this.serializeData(input.data ?? {});

    auditLog.userId = AuditLogHelper.getNumeric(input.userId);
    auditLog.userName = this.normalizeLabel(input.userName);
    auditLog.sessionId = AuditLogHelper.getNumeric(input.sessionId);

    const sourceIp = this.normalizeLabel(input.sourceIp);
    auditLog.sourceIp =
      sourceIp && sourceIp.length > 0 ? sourceIp.substring(0, MAX_SOURCE_IP_LENGTH) : null;

    auditLog.fwCloudId = AuditLogHelper.getNumeric(input.fwCloudId);
    auditLog.firewallId = AuditLogHelper.getNumeric(input.firewallId);
    auditLog.clusterId = AuditLogHelper.getNumeric(input.clusterId);

    auditLog.fwCloudName = this.normalizeLabel(input.fwCloudName);
    auditLog.firewallName = this.normalizeLabel(input.firewallName);
    auditLog.clusterName = this.normalizeLabel(input.clusterName);

    await this.enrichEntityNames(auditLog);

    return auditLog;
  }

  protected normalizeCall(call: string): string {
    const normalized = typeof call === 'string' ? call.trim() : '';
    const fallback = normalized.length > 0 ? normalized : 'SYSTEM';
    return fallback.length <= MAX_CALL_LENGTH
      ? fallback
      : `${fallback.substring(0, MAX_CALL_LENGTH - 3)}...`;
  }

  protected normalizeDescription(description: string, fallback: string): string {
    const normalized = typeof description === 'string' ? description.trim() : '';
    return normalized.length > 0 ? normalized : fallback;
  }

  protected normalizeLabel(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  protected serializeData(data: unknown): string {
    const serialized = JSON.stringify(this.sanitize(data));

    if (!serialized) {
      return '{}';
    }

    if (serialized.length > MAX_DATA_LENGTH) {
      return `${serialized.substring(0, MAX_DATA_LENGTH)}...[truncated]`;
    }

    return serialized;
  }

  protected sanitize(input: any, seen: WeakSet<object> = new WeakSet()): any {
    if (input === null || input === undefined) {
      return input ?? null;
    }

    if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
      return input;
    }

    if (input instanceof Date) {
      return input.toISOString();
    }

    if (Buffer.isBuffer(input)) {
      return `[buffer:${input.length}]`;
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.sanitize(item, seen));
    }

    if (typeof input === 'object') {
      if (seen.has(input)) {
        return '[circular]';
      }

      seen.add(input);

      const output: Record<string, any> = {};
      for (const key of Object.keys(input)) {
        const value = input[key];
        if (this.isSensitiveKey(key)) {
          output[key] = '[REDACTED]';
          continue;
        }

        try {
          output[key] = this.sanitize(value, seen);
        } catch (error) {
          output[key] = `[unserializable:${error?.message ?? 'error'}]`;
        }
      }

      return output;
    }

    return String(input);
  }

  protected isSensitiveKey(key: string | null | undefined): boolean {
    if (!key) {
      return false;
    }

    const normalized = key.toLowerCase();
    return SENSITIVE_KEY_PATTERNS.some(
      (pattern) => normalized === pattern || normalized.includes(pattern),
    );
  }

  protected async enrichEntityNames(auditLog: AuditLog): Promise<void> {
    const firewall =
      auditLog.firewallId !== null && auditLog.firewallId !== undefined
        ? await Firewall.findOne({ where: { id: auditLog.firewallId } })
        : null;

    const firewallClusterIdCandidate =
      firewall && firewall.clusterId !== undefined
        ? AuditLogHelper.getNumeric(firewall.clusterId)
        : null;

    if (
      (auditLog.clusterId === null || auditLog.clusterId === undefined) &&
      firewallClusterIdCandidate !== null &&
      firewallClusterIdCandidate > 0
    ) {
      auditLog.clusterId = firewallClusterIdCandidate;
    }

    const firewallFwCloudIdCandidate =
      firewall && firewall.fwCloudId !== undefined
        ? AuditLogHelper.getNumeric(firewall.fwCloudId)
        : null;

    if (
      (auditLog.fwCloudId === null || auditLog.fwCloudId === undefined) &&
      firewallFwCloudIdCandidate !== null &&
      firewallFwCloudIdCandidate > 0
    ) {
      auditLog.fwCloudId = firewallFwCloudIdCandidate;
    }

    const [fwCloud, cluster] = await Promise.all([
      auditLog.fwCloudId
        ? FwCloud.findOne({ where: { id: auditLog.fwCloudId } })
        : Promise.resolve(null),
      auditLog.clusterId
        ? Cluster.findOne({ where: { id: auditLog.clusterId } })
        : Promise.resolve(null),
    ]);

    auditLog.fwCloudName = auditLog.fwCloudName ?? fwCloud?.name ?? null;
    auditLog.firewallName = auditLog.firewallName ?? firewall?.name ?? null;
    auditLog.clusterName = auditLog.clusterName ?? cluster?.name ?? null;
  }
}
