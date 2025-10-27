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
  AuditLogService,
  ListAuditLogsOptions,
  ListAuditLogsCursor,
} from '../../models/audit/AuditLog.service';
import { AuditLogHelper } from '../../models/audit/audit-log.helper';
import { AuditLogListQueryDto } from './dtos/audit-log-query.dto';
import { AuditLogPolicy } from '../../policies/auditlog.policy';
import { User } from '../../models/user/User';

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

    return ResponseBuilder.buildResponse().status(200).body({ auditLogs, total: results.total });
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

    const timestampFrom = this.parseIsoDate(request.query.ts_from);
    if (timestampFrom) {
      options.timestampFrom = timestampFrom;
    }

    const timestampTo = this.parseIsoDate(request.query.ts_to);
    if (timestampTo) {
      options.timestampTo = timestampTo;
    }

    const userName = this.parseString(request.query.user_name);
    if (userName) {
      options.userName = userName;
    }

    const sessionFilter = this.parsePositiveInteger(request.query.session_id);
    if (sessionFilter !== undefined) {
      options.sessionIdFilter = sessionFilter;
    }

    const fwCloudName = this.parseString(request.query.fwcloud_name);
    if (fwCloudName) {
      options.fwCloudName = fwCloudName;
    }

    const firewallName = this.parseString(request.query.firewall_name);
    if (firewallName) {
      options.firewallName = firewallName;
    }

    const clusterName = this.parseString(request.query.cluster_name);
    if (clusterName) {
      options.clusterName = clusterName;
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

      const timestampPart = trimmed.slice(0, separatorIndex);
      const idPart = trimmed.slice(separatorIndex + 1);
      const timestamp = new Date(timestampPart);
      const id = Number.parseInt(idPart, 10);

      if (Number.isNaN(timestamp.getTime()) || Number.isNaN(id) || id <= 0) {
        return undefined;
      }

      return { timestamp, id };
    } catch {
      return undefined;
    }
  }
}
