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

import Ajv2020, { ValidateFunction } from 'ajv/dist/2020';
import {
  getSupportedContractSchemas,
  VendoredContractSchema,
  VENDORED_CONTRACT_SCHEMAS,
} from './schemas/manifest';

export type ContractCustomsRejectionReason =
  'malformed_payload' | 'unknown_schema_version' | 'schema_violation';

export interface ContractCustomsErrorDetail {
  instancePath: string;
  message: string;
}

export interface ContractCustomsAccepted {
  ok: true;
  contractVersion: string;
  schemaVersion: string;
  payload: ValidatedAssistedProfileProposal;
}

export interface ContractCustomsRejected {
  ok: false;
  reason: ContractCustomsRejectionReason;
  message: string;
  contractVersion: string;
  schemaVersion: string | null;
  errors?: ContractCustomsErrorDetail[];
}

export type ContractCustomsResult = ContractCustomsAccepted | ContractCustomsRejected;

declare const validatedAssistedProfileProposal: unique symbol;

/**
 * An agent proposal that has crossed the API-1 JSON Schema gateway. The brand
 * deliberately has no runtime representation: only AssistantContractCustoms
 * can create this type, which prevents downstream mappers from accepting an
 * arbitrary agent response by accident.
 */
export type ValidatedAssistedProfileProposal = Record<string, unknown> & {
  readonly [validatedAssistedProfileProposal]: true;
};

/** Reads the version discriminator without trusting the surrounding payload. */
export function extractAssistantContractSchemaVersion(
  payload: Record<string, unknown>,
): string | undefined {
  const metadata = payload.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const schemaVersion = (metadata as Record<string, unknown>).schemaVersion;
  return typeof schemaVersion === 'string' ? schemaVersion : undefined;
}

/**
 * The "aduana" (customs) gate [D8]: validates any payload received from the
 * untrusted assistant agent against the vendored `apg.mvp.v1` JSON Schema
 * before fwcloud-api touches it. Accepts the current schema version (N) and
 * the immediately previous one (N-1) [D16b], since the two repositories are
 * not deployed atomically.
 *
 * Pure/stateless: no I/O, no DI. Wrapped by AssistantContractCustomsService,
 * which adds audit logging on rejection.
 */
export class AssistantContractCustoms {
  private readonly validators: Map<string, ValidateFunction> = new Map();
  private readonly contractVersion: string;
  private readonly _acceptedSchemaVersions: string[];

  constructor(manifest: VendoredContractSchema[] = VENDORED_CONTRACT_SCHEMAS) {
    if (manifest.length === 0) {
      throw new Error('AssistantContractCustoms requires at least one vendored contract schema');
    }

    const acceptedWindow = getSupportedContractSchemas(manifest);
    this.contractVersion = manifest[manifest.length - 1].contractVersion;

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    for (const entry of acceptedWindow) {
      this.validators.set(entry.schemaVersion, ajv.compile(entry.schema));
    }

    this._acceptedSchemaVersions = Array.from(this.validators.keys());
  }

  /** Schema versions currently accepted (N and, when it exists, N-1). */
  public get acceptedSchemaVersions(): string[] {
    return this._acceptedSchemaVersions;
  }

  public check(payload: unknown): ContractCustomsResult {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return this.reject('malformed_payload', 'Agent response is not a JSON object', null);
    }

    const record = payload as Record<string, unknown>;
    const schemaVersion = extractAssistantContractSchemaVersion(record);
    const validate = schemaVersion !== undefined ? this.validators.get(schemaVersion) : undefined;

    if (!validate) {
      return this.reject(
        'unknown_schema_version',
        schemaVersion !== undefined
          ? `Unsupported contract schema version "${schemaVersion}"; accepted: ${this._acceptedSchemaVersions.join(', ')}`
          : 'Agent response is missing metadata.schemaVersion',
        schemaVersion ?? null,
      );
    }

    if (!validate(record)) {
      return this.reject(
        'schema_violation',
        `Agent response does not conform to contract schema version "${schemaVersion}"`,
        schemaVersion,
        (validate.errors ?? []).map((error) => ({
          instancePath: error.instancePath,
          message: error.message ?? 'invalid',
        })),
      );
    }

    return {
      ok: true,
      contractVersion: this.contractVersion,
      schemaVersion,
      payload: record as ValidatedAssistedProfileProposal,
    };
  }

  private reject(
    reason: ContractCustomsRejectionReason,
    message: string,
    schemaVersion: string | null,
    errors?: ContractCustomsErrorDetail[],
  ): ContractCustomsRejected {
    return {
      ok: false,
      reason,
      message,
      contractVersion: this.contractVersion,
      schemaVersion,
      errors,
    };
  }
}
