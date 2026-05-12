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
    const auditLogs =
      options.isAdmin || !currentUser
        ? results.auditLogs
        : await this._auditLogService.syncEntriesWithUser(results.auditLogs, currentUser);

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

    const scopedFwCloudId = this.parsePositiveInteger(request.params.fwcloud);
    const auditLog = await this._auditLogService.getAuditLog(id, {
      isAdmin: AuditLogHelper.isAdmin(currentUser),
      sessionId: AuditLogHelper.resolveSessionId(request),
      userId: currentUser?.id ?? null,
      fwCloudId: scopedFwCloudId,
    });

    if (!auditLog) {
      throw new NotFoundException('Audit log not found');
    }

    const syncedAuditLogs =
      AuditLogHelper.isAdmin(currentUser) || !currentUser
        ? [auditLog]
        : await this._auditLogService.syncEntriesWithUser([auditLog], currentUser);

    return ResponseBuilder.buildResponse()
      .status(200)
      .body({ auditLog: this.formatDetail(syncedAuditLogs[0]) });
  }

  protected buildOptions(request: Request, currentUser: User | null): ListAuditLogsOptions {
    const options: ListAuditLogsOptions = {
      isAdmin: AuditLogHelper.isAdmin(currentUser),
      sessionId: AuditLogHelper.resolveSessionId(request),
      userId: currentUser?.id ?? null,
    };

    const requestedLimit =
      this.parseNonNegativeInteger(request.query.limit) ??
      this.parseNonNegativeInteger(request.query.pageSize);

    if (requestedLimit === undefined) {
      options.take = Math.min(AuditLogController.DEFAULT_LIMIT, AuditLogController.MAX_LIMIT);
    } else if (requestedLimit === 0) {
      options.take = undefined;
    } else {
      options.take = Math.min(requestedLimit, AuditLogController.MAX_LIMIT);
    }

    const startedAtFrom = this.parseIsoDate(request.query.started_at_from);
    if (startedAtFrom) {
      options.startedAtFrom = startedAtFrom;
    }

    const startedAtTo = this.parseIsoDate(request.query.started_at_to);
    if (startedAtTo) {
      options.startedAtTo = startedAtTo;
    }

    const userName = this.parseString(request.query.user_name);
    if (userName) {
      options.userName = userName;
    }

    const sessionFilter = this.parseNonNegativeInteger(request.query.session_id);
    if (sessionFilter !== undefined) {
      options.sessionIdFilter = sessionFilter;
    }

    const fwCloudName = this.parseString(request.query.fwcloud_name);
    if (fwCloudName) {
      options.fwCloudName = fwCloudName;
    }

    const fwCloudId = this.parsePositiveInteger(request.query.fwcloud_id);
    if (fwCloudId !== undefined) {
      options.fwCloudId = fwCloudId;
    }

    const firewallName = this.parseString(request.query.firewall_name);
    if (firewallName) {
      options.firewallName = firewallName;
    }

    const firewallId = this.parsePositiveInteger(request.query.firewall_id);
    if (firewallId !== undefined) {
      options.firewallId = firewallId;
    }

    const clusterName = this.parseString(request.query.cluster_name);
    if (clusterName) {
      options.clusterName = clusterName;
    }

    const clusterId = this.parsePositiveInteger(request.query.cluster_id);
    if (clusterId !== undefined) {
      options.clusterId = clusterId;
    }

    const sourceIp = this.parseString(request.query.source_ip);
    if (sourceIp) {
      options.sourceIp = sourceIp;
    }

    const cursor = this.parseCursor(request.query.cursor);
    if (cursor) {
      options.cursor = cursor;
    }

    const page = this.parsePositiveInteger(request.query.page) ?? 1;
    if (page > 1 && typeof options.take === 'number' && options.take > 0) {
      options.skip = (page - 1) * options.take;
    }

    return options;
  }

  private parseNonNegativeInteger(value: unknown): number | undefined {
    const parsed = AuditLogHelper.getNumeric(value);
    return parsed !== null && parsed >= 0 ? parsed : undefined;
  }

  private parsePositiveInteger(value: unknown): number | undefined {
    const parsed = AuditLogHelper.getNumeric(value);
    return parsed !== null && parsed > 0 ? parsed : undefined;
  }

  private parseIsoDate(value: unknown): Date | undefined {
    if (typeof value !== 'string' || value.trim() === '') {
      return undefined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private parseString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  private parseCursor(value: unknown): ListAuditLogsCursor | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    if (trimmed === '') {
      return undefined;
    }

    try {
      const separatorIndex = trimmed.lastIndexOf(':');
      if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
        return undefined;
      }

      const startedAtPart = trimmed.slice(0, separatorIndex);
      const idPart = trimmed.slice(separatorIndex + 1);
      const startedAt = new Date(startedAtPart);
      const id = Number.parseInt(idPart, 10);

      if (Number.isNaN(startedAt.getTime()) || Number.isNaN(id) || id <= 0) {
        return undefined;
      }

      return { startedAt, id };
    } catch {
      return undefined;
    }
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
      description: entry.description,
    };
  }

  private formatDetail(entry: AuditLog): Record<string, unknown> {
    const data = this._auditLogService.parseAuditLogData(entry.data);
    const payload = this.asPayloadRecord(data);
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

    if (payload && payload.context !== undefined) {
      detail['context'] = payload.context;
    }

    return detail;
  }

  private formatFinishedAt(
    entry: Pick<AuditLogSummary, 'startedAt' | 'durationMs'>,
  ): string | null {
    if (!(entry.startedAt instanceof Date) || entry.durationMs === null) {
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

  private asPayloadRecord(data: unknown): Record<string, unknown> | null {
    return data !== null && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  }

  private extractRequestDetails(
    payload: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!payload) {
      return null;
    }

    const requestKeys = ['method', 'url', 'ip', 'headers', 'query', 'params', 'body'];
    if (!requestKeys.some((key) => Object.prototype.hasOwnProperty.call(payload, key))) {
      return null;
    }

    return {
      method: payload.method ?? null,
      url: payload.url ?? null,
      ip: payload.ip ?? null,
      headers: payload.headers ?? null,
      query: payload.query ?? null,
      params: payload.params ?? null,
      body: payload.body ?? null,
    };
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
