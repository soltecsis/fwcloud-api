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

import type { AbstractApplication } from '../../fonaments/abstract-application';
import { Service } from '../../fonaments/services/service';
import { AuditLogService } from '../audit/AuditLog.service';
import { AssistedProfileRejectedProposalCaptureService } from '../assisted-profile-rejected-proposal/assisted-profile-rejected-proposal-capture.service';
import {
  AssistantContractCustoms,
  ContractCustomsRejected,
  ValidatedAssistedProfileProposal,
} from './assistant-contract-customs';
import { AssistantContractMismatchException } from './assistant-contract-mismatch.exception';

export const ASSISTANT_CONTRACT_CUSTOMS_AUDIT_CALL = 'assistant.contract.reject';

export interface AssistantContractValidationContext {
  fwCloudId?: number | null;
  userId?: number | null;
  userName?: string | null;
  sessionId?: number | null;
  sourceIp?: string | null;
  requestId?: string | null;
  correlationId?: string | null;
  agentEndpoint?: string | null;
  /** Values that must be redacted if an untrusted version field echoes them. */
  sensitiveValues?: readonly string[];
}

export const REDACTED_ASSISTANT_CONTRACT_VALUE = '<redacted>' as const;

const SAFE_SCHEMA_VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/;

export interface AssistantContractCustomsServiceCreateOptions {
  readonly customs?: AssistantContractCustoms;
  readonly auditLogService?: Pick<AuditLogService, 'logMutation'>;
  readonly rejectedProposalCapture?: Pick<AssistedProfileRejectedProposalCaptureService, 'capture'>;
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
 *
 * This is also the only place where a contract-rejected payload still exists,
 * so it is where the optional (default-off) anonymized rejected-proposal
 * capture hooks in. Capture receives the payload, anonymizes it and persists
 * only the result; nothing about the rejection itself changes.
 */
export class AssistantContractCustomsService extends Service {
  protected _customs: AssistantContractCustoms;
  protected _auditLogService: Pick<AuditLogService, 'logMutation'>;
  protected _rejectedProposalCapture: Pick<
    AssistedProfileRejectedProposalCaptureService,
    'capture'
  >;

  public constructor(
    app: AbstractApplication | null,
    private readonly _overrides: AssistantContractCustomsServiceCreateOptions = {},
  ) {
    super(app);
  }

  /** Creates an initialized service with explicit dependencies (tests/tools). */
  public static async create(
    options: AssistantContractCustomsServiceCreateOptions = {},
  ): Promise<AssistantContractCustomsService> {
    return new AssistantContractCustomsService(null, options).build();
  }

  public async build(): Promise<AssistantContractCustomsService> {
    this._customs = this._overrides.customs ?? new AssistantContractCustoms();
    this._auditLogService =
      this._overrides.auditLogService ??
      (await this._app.getService<AuditLogService>(AuditLogService.name));
    this._rejectedProposalCapture =
      this._overrides.rejectedProposalCapture ??
      (await this._app.getService<AssistedProfileRejectedProposalCaptureService>(
        AssistedProfileRejectedProposalCaptureService.name,
      ));

    return this;
  }

  /** Schema versions currently accepted (N and, when it exists, N-1). */
  public get acceptedSchemaVersions(): string[] {
    return this._customs.acceptedSchemaVersions;
  }

  public async validate(
    payload: unknown,
    context: AssistantContractValidationContext = {},
  ): Promise<ValidatedAssistedProfileProposal> {
    const result = this._customs.check(payload);

    if (result.ok === true) {
      return result.payload;
    }

    const schemaVersion = this.safeSchemaVersion(
      result.schemaVersion,
      context.sensitiveValues ?? [],
    );
    const message = this.safeRejectionMessage(result, schemaVersion);

    await this._auditLogService.logMutation({
      call: ASSISTANT_CONTRACT_CUSTOMS_AUDIT_CALL,
      description: message,
      status: 502,
      data: {
        reason: result.reason,
        contractVersion: result.contractVersion,
        schemaVersion,
        acceptedSchemaVersions: this._customs.acceptedSchemaVersions,
        errors: result.errors,
        requestId: context.requestId,
        correlationId: context.correlationId,
        agentEndpoint: context.agentEndpoint,
      },
      userId: context.userId,
      userName: context.userName,
      sessionId: context.sessionId,
      sourceIp: context.sourceIp,
      fwCloudId: context.fwCloudId,
    });

    await this.captureRejectedPayload(payload, result, context);

    throw new AssistantContractMismatchException(
      message,
      result.reason,
      result.contractVersion,
      schemaVersion,
      result.errors,
    );
  }

  /**
   * Optional, opt-in evaluation capture of the *anonymized* form of the payload
   * that was just rejected. Disabled by default, and the capture service
   * resolves rather than throws for every failure it knows about; the guard
   * here makes sure that not even an unexpected one can turn this contract
   * rejection into an unrelated server failure. The raw payload never leaves
   * this method.
   */
  private async captureRejectedPayload(
    payload: unknown,
    result: ContractCustomsRejected,
    context: AssistantContractValidationContext,
  ): Promise<void> {
    try {
      await this._rejectedProposalCapture.capture({
        proposal: payload,
        rejectionCategory: 'contract_mismatch',
        rejectionCode: result.reason,
        contractVersion: result.contractVersion,
        requestId: context.requestId ?? null,
      });
    } catch {
      // Evaluation capture must never affect the contract rejection.
    }
  }

  private safeSchemaVersion(
    schemaVersion: string | null,
    sensitiveValues: readonly string[],
  ): string | null {
    if (schemaVersion === null) {
      return null;
    }

    const containsSensitiveValue = sensitiveValues.some(
      (value) => value.length > 0 && schemaVersion.includes(value),
    );
    if (!SAFE_SCHEMA_VERSION_PATTERN.test(schemaVersion) || containsSensitiveValue) {
      return REDACTED_ASSISTANT_CONTRACT_VALUE;
    }

    return schemaVersion;
  }

  private safeRejectionMessage(
    result: ContractCustomsRejected,
    schemaVersion: string | null,
  ): string {
    switch (result.reason) {
      case 'malformed_payload':
        return 'Agent response is not a JSON object';
      case 'unknown_schema_version':
        if (schemaVersion === null) {
          return 'Agent response is missing metadata.schemaVersion';
        }
        if (schemaVersion === REDACTED_ASSISTANT_CONTRACT_VALUE) {
          return `Unsupported contract schema version; accepted: ${this._customs.acceptedSchemaVersions.join(', ')}`;
        }
        return `Unsupported contract schema version "${schemaVersion}"; accepted: ${this._customs.acceptedSchemaVersions.join(', ')}`;
      case 'schema_violation':
        return schemaVersion === REDACTED_ASSISTANT_CONTRACT_VALUE
          ? 'Agent response does not conform to a supported contract schema'
          : `Agent response does not conform to contract schema version "${schemaVersion}"`;
    }
  }
}
