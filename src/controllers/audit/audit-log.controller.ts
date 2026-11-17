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

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Request } from 'express';
import { Validate, ValidateQuery } from '../../decorators/validate.decorator';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import {
  AuditLogAccessOptions,
  AuditLogSummary,
  AuditLogService,
  ListAuditLogsOptions,
  ListAuditLogsCursor,
} from '../../models/audit/AuditLog.service';
import { AuditLogHelper } from '../../models/audit/audit-log.helper';
import { AuditLogListQueryDto } from './dtos/audit-log-query.dto';
import { AuditLogPolicy } from '../../policies/auditlog.policy';
import { User } from '../../models/user/User';
import { NotFoundException } from '../../fonaments/exceptions/not-found-exception';
import { AuditLog } from '../../models/audit/AuditLog';
import { AuditEventType, parseAuditEventTypes } from '../../models/audit/audit-event-type';

const TEXT_FILTER_OPTIONS = [
  ['user_name', 'userName'],
  ['fwcloud_name', 'fwCloudName'],
  ['firewall_name', 'firewallName'],
  ['cluster_name', 'clusterName'],
  ['source_ip', 'sourceIp'],
] as const;

const ENTITY_ID_FILTER_OPTIONS = [
  ['fwcloud_id', 'fwCloudId'],
  ['firewall_id', 'firewallId'],
  ['cluster_id', 'clusterId'],
] as const;

const REQUEST_DETAIL_KEYS = ['method', 'url', 'ip', 'headers', 'query', 'params', 'body'] as const;

export class AuditLogController extends Controller {
  private static readonly DEFAULT_LIMIT = 50;
  private static readonly MAX_LIMIT = 200;

  protected _auditLogService: AuditLogService;

  public async make(_request: Request): Promise<void> {
    this._auditLogService = await this._app.getService<AuditLogService>(AuditLogService.name);
  }

  @Validate()
  @ValidateQuery(AuditLogListQueryDto)
  public async list(request: Request): Promise<ResponseBuilder> {
    (await AuditLogPolicy.list(request)).authorize();

    const currentUser = AuditLogHelper.getSessionUser(request);
    const options = this.buildOptions(request, currentUser);

    const results = await this._auditLogService.listAuditLogs(options);
    const auditLogs = await this.syncWithCurrentUser(
      results.auditLogs,
      currentUser,
      options.isAdmin,
    );

    const auditLogsResponse = auditLogs.map((entry) => this.formatSummary(entry));

    return ResponseBuilder.buildResponse()
      .status(200)
      .body({ auditLogs: auditLogsResponse, total: results.total });
  }

  @Validate()
  public async show(request: Request): Promise<ResponseBuilder> {
    (await AuditLogPolicy.show(request)).authorize();

    const currentUser = AuditLogHelper.getSessionUser(request);
    const id = this.parsePositiveInteger(request.params.auditlog);

    if (id === undefined) {
      throw new NotFoundException('Audit log not found');
    }

    const accessOptions = {
      ...this.buildAccessOptions(request, currentUser),
      fwCloudId: this.parsePositiveInteger(request.params.fwcloud),
    };
    const auditLog = await this._auditLogService.getAuditLog(id, accessOptions);

    if (!auditLog) {
      throw new NotFoundException('Audit log not found');
    }

    const [syncedAuditLog] = await this.syncWithCurrentUser(
      [auditLog],
      currentUser,
      accessOptions.isAdmin,
    );

    return ResponseBuilder.buildResponse()
      .status(200)
      .body({ auditLog: this.formatDetail(syncedAuditLog) });
  }

  protected buildOptions(request: Request, currentUser: User | null): ListAuditLogsOptions {
    const options: ListAuditLogsOptions = this.buildAccessOptions(request, currentUser);

    const requestedLimit =
      this.parseNonNegativeInteger(request.query.limit) ??
      this.parseNonNegativeInteger(request.query.pageSize);

    // A limit of 0 disables paging.
    options.take =
      requestedLimit === 0
        ? undefined
        : Math.min(
            requestedLimit ?? AuditLogController.DEFAULT_LIMIT,
            AuditLogController.MAX_LIMIT,
          );

    const startedAtFrom = this.parseIsoDate(request.query.started_at_from);
    if (startedAtFrom) {
      options.startedAtFrom = startedAtFrom;
    }

    const startedAtTo = this.parseIsoDate(request.query.started_at_to);
    if (startedAtTo) {
      options.startedAtTo = startedAtTo;
    }

    for (const [queryKey, optionKey] of TEXT_FILTER_OPTIONS) {
      const value = this.parseString(request.query[queryKey]);
      if (value) options[optionKey] = value;
    }

    const sessionFilter = this.parseNonNegativeInteger(request.query.session_id);
    if (sessionFilter !== undefined) {
      options.sessionIdFilter = sessionFilter;
    }

    for (const [queryKey, optionKey] of ENTITY_ID_FILTER_OPTIONS) {
      const value = this.parsePositiveInteger(request.query[queryKey]);
      if (value !== undefined) options[optionKey] = value;
    }

    if (request.query.event_type !== undefined) {
      options.eventTypes = parseAuditEventTypes(request.query.event_type) as AuditEventType[];
    }

    const cursor = this.parseCursor(request.query.cursor);
    if (cursor) {
      options.cursor = cursor;
    }

    const page = this.parsePositiveInteger(request.query.page) ?? 1;
    if (page > 1 && options.take) {
      options.skip = (page - 1) * options.take;
    }

    return options;
  }

  private buildAccessOptions(request: Request, currentUser: User | null): AuditLogAccessOptions {
    return {
      isAdmin: AuditLogHelper.isAdmin(currentUser),
      sessionId: AuditLogHelper.resolveSessionId(request),
      userId: currentUser?.id ?? null,
    };
  }

  private async syncWithCurrentUser<T extends AuditLogSummary>(
    entries: T[],
    currentUser: User | null,
    isAdmin: boolean,
  ): Promise<T[]> {
    return isAdmin || !currentUser
      ? entries
      : this._auditLogService.syncEntriesWithUser(entries, currentUser);
  }

  private parseNonNegativeInteger(value: unknown): number | undefined {
    const parsed = AuditLogHelper.getNumeric(value);
    return parsed !== null && parsed >= 0 ? parsed : undefined;
  }

  private parsePositiveInteger(value: unknown): number | undefined {
    return AuditLogHelper.getPositiveNumeric(value) ?? undefined;
  }

  private parseIsoDate(value: unknown): Date | undefined {
    if (typeof value !== 'string' || value.trim() === '') {
      return undefined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private parseString(value: unknown): string | undefined {
    return AuditLogHelper.getTrimmedString(value) ?? undefined;
  }

  private parseCursor(value: unknown): ListAuditLogsCursor | undefined {
    const cursor = this.parseString(value);
    if (!cursor) {
      return undefined;
    }

    const separatorIndex = cursor.lastIndexOf(':');
    if (separatorIndex <= 0 || separatorIndex === cursor.length - 1) {
      return undefined;
    }

    const startedAt = new Date(cursor.slice(0, separatorIndex));
    const id = Number.parseInt(cursor.slice(separatorIndex + 1), 10);

    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(id) || id <= 0) {
      return undefined;
    }

    return { startedAt, id };
  }

  private formatSummary(entry: AuditLogSummary): Record<string, unknown> {
    return {
      id: entry.id,
      startedAt: AuditLogHelper.toUtcISOString(entry.startedAt),
      finishedAt: this.formatFinishedAt(entry),
      durationMs: entry.durationMs,
      userId: entry.userId,
      userName: entry.userName,
      sessionId: entry.sessionId,
      sourceIp: entry.sourceIp,
      fwCloudId: entry.fwCloudId,
      fwCloudName: entry.fwCloudName,
      fwCloud: this.formatEntityRef(entry.fwCloudId, entry.fwCloudName),
      firewallId: entry.firewallId,
      firewallName: entry.firewallName,
      firewall: this.formatEntityRef(entry.firewallId, entry.firewallName),
      clusterId: entry.clusterId,
      clusterName: entry.clusterName,
      cluster: this.formatEntityRef(entry.clusterId, entry.clusterName),
      call: entry.call,
      status: entry.status,
      eventType: entry.eventType ?? null,
      outcome: entry.outcome ?? null,
      description: entry.description,
    };
  }

  private formatDetail(entry: AuditLog): Record<string, unknown> {
    const data = this._auditLogService.parseAuditLogData(entry.data);
    const payload = AuditLogHelper.asRecord(data);
    const detail: Record<string, unknown> = {
      ...this.formatSummary(entry),
      data,
    };

    const requestDetails = this.extractRequestDetails(payload);
    if (requestDetails) {
      detail['request'] = requestDetails;
    }

    const responseDetails = this.extractResponseDetails(payload, entry);
    if (responseDetails) {
      detail['response'] = responseDetails;
    }

    if (payload?.context !== undefined) {
      detail['context'] = payload.context;
    }

    return detail;
  }

  private formatFinishedAt(
    entry: Pick<AuditLogSummary, 'startedAt' | 'durationMs'>,
  ): string | null {
    if (!(entry.startedAt instanceof Date) || entry.durationMs === null || entry.durationMs < 0) {
      return null;
    }

    return new Date(entry.startedAt.getTime() + entry.durationMs).toISOString();
  }

  private formatEntityRef(
    id: number | null,
    name: string | null,
  ): { id: number | null; name: string | null } | null {
    return id !== null || name !== null ? { id, name } : null;
  }

  private extractRequestDetails(
    payload: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (
      !payload ||
      !REQUEST_DETAIL_KEYS.some((key) => Object.prototype.hasOwnProperty.call(payload, key))
    ) {
      return null;
    }

    return Object.fromEntries(REQUEST_DETAIL_KEYS.map((key) => [key, payload[key] ?? null]));
  }

  private extractResponseDetails(
    payload: Record<string, unknown> | null,
    entry: AuditLog,
  ): Record<string, unknown> | null {
    const statusCode = payload?.statusCode ?? entry.status;
    const durationMs = payload?.durationMs ?? entry.durationMs;

    return statusCode !== null || durationMs !== null
      ? {
          statusCode,
          durationMs,
        }
      : null;
  }
}
