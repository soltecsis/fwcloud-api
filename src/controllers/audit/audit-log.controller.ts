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
import { Validate } from '../../decorators/validate.decorator';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { AuditLogService } from '../../models/audit/AuditLog.service';
import { AuditLogHelper } from '../../models/audit/audit-log.helper';

export class AuditLogController extends Controller {
  protected _auditLogService: AuditLogService;

  public async make(_request: Request): Promise<void> {
    this._auditLogService = await this._app.getService<AuditLogService>(AuditLogService.name);
  }

  @Validate()
  public async list(request: Request): Promise<ResponseBuilder> {
    const currentUser = AuditLogHelper.getSessionUser(request);
    const isAdmin = AuditLogHelper.isAdmin(currentUser);
    const sessionId = AuditLogHelper.resolveSessionId(request);
    const userId = currentUser?.id ?? AuditLogHelper.getNumeric(request.session?.user_id);

    const { auditLogs, total } = await this._auditLogService.listAuditLogs({
      isAdmin,
      sessionId: isAdmin ? undefined : sessionId,
      userId: isAdmin ? undefined : userId,
    });

    const sanitizedAuditLogs = isAdmin
      ? auditLogs
      : await this._auditLogService.syncEntriesWithUser(auditLogs, currentUser);

    return ResponseBuilder.buildResponse().status(200).body({
      total,
      auditLogs: sanitizedAuditLogs,
    });
  }
}
