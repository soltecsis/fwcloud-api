/*
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

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Service } from '../../fonaments/services/service';
import { AuditLogService } from '../audit/AuditLog.service';
import { AssistantContractCustoms } from './assistant-contract-customs';
import { AssistantContractMismatchException } from './assistant-contract-mismatch.exception';

export const ASSISTANT_CONTRACT_CUSTOMS_AUDIT_CALL = 'assistant.contract.reject';

export interface AssistantContractValidationContext {
  fwCloudId?: number | null;
  userId?: number | null;
  userName?: string | null;
  sessionId?: number | null;
  sourceIp?: string | null;
}

/**
 * Secured entry point of the schema customs gate [D8]: validates a payload
 * received from the untrusted assistant agent against the vendored
 * `apg.mvp.v1` schema (accepting N and N-1 [D16b]) and, on rejection, leaves
 * an audit trail with the reason before throwing
 * AssistantContractMismatchException ("contrato desalineado").
 *
 * The raw agent payload is never written to the audit log: only the
 * rejection reason, versions involved and schema error paths/messages are
 * persisted, to avoid recording arbitrary/untrusted agent content verbatim.
 */
export class AssistantContractCustomsService extends Service {
  protected _customs: AssistantContractCustoms;
  protected _auditLogService: AuditLogService;

  public async build(): Promise<AssistantContractCustomsService> {
    this._customs = new AssistantContractCustoms();
    this._auditLogService = await this._app.getService<AuditLogService>(AuditLogService.name);

    return this;
  }

  /** Schema versions currently accepted (N and, when it exists, N-1). */
  public get acceptedSchemaVersions(): string[] {
    return this._customs.acceptedSchemaVersions;
  }

  public async validate(
    payload: unknown,
    context: AssistantContractValidationContext = {},
  ): Promise<Record<string, unknown>> {
    const result = this._customs.check(payload);

    if (result.ok === true) {
      return result.payload;
    }

    await this._auditLogService.logMutation({
      call: ASSISTANT_CONTRACT_CUSTOMS_AUDIT_CALL,
      description: result.message,
      status: 502,
      data: {
        reason: result.reason,
        contractVersion: result.contractVersion,
        schemaVersion: result.schemaVersion,
        acceptedSchemaVersions: this._customs.acceptedSchemaVersions,
        errors: result.errors,
      },
      userId: context.userId,
      userName: context.userName,
      sessionId: context.sessionId,
      sourceIp: context.sourceIp,
      fwCloudId: context.fwCloudId,
    });

    throw new AssistantContractMismatchException(
      result.message,
      result.reason,
      result.contractVersion,
      result.schemaVersion,
      result.errors,
    );
  }
}
