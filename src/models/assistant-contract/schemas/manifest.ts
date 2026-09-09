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

import apgMvpV1Schema from './apg.mvp.v1.schema.json';
import apgMvpV1Schema110 from './apg.mvp.v1-1.1.0.schema.json';
import apgMvpV1Schema120 from './apg.mvp.v1-1.2.0.schema.json';

/**
 * Provenance record for a vendored contract schema artifact. See ../README.md
 * for the update procedure that produces these entries.
 */
export interface VendoredContractSchema {
  /** Wire contract family, e.g. `apg.mvp.v1`. Matches the schema's `x-contract-version`. */
  contractVersion: string;
  /** Payload schema version, e.g. `1.0.0`. Matches `metadata.schemaVersion` in the envelope. */
  schemaVersion: string;
  /** The vendored JSON Schema document (draft 2020-12). */
  schema: object;
  /** Repository the artifact was copied from. */
  sourceRepo: string;
  /** Path of the artifact within the source repository. */
  sourcePath: string;
  /** Commit SHA of the source repository HEAD at vendoring time. */
  sourceCommit: string;
  /** SHA-256 of the vendored file bytes, to detect silent drift from the origin. */
  sha256: string;
  /** Date (YYYY-MM-DD) the artifact was vendored into this repository. */
  vendoredAt: string;
}

/** Current plus immediately previous schema, per the API-1 retention policy. */
export const ASSISTED_PROFILE_CONTRACT_WINDOW_SIZE = 2;

export function getSupportedContractSchemas(
  manifest: readonly VendoredContractSchema[],
): VendoredContractSchema[] {
  return manifest.slice(-ASSISTED_PROFILE_CONTRACT_WINDOW_SIZE);
}

/**
 * Ordered oldest -> newest. The customs module (../assistant-contract-customs.ts)
 * only accepts payloads whose `metadata.schemaVersion` matches one of the LAST
 * TWO entries here (N = current, N-1 = previous), per [D16b]. Everything older
 * is rejected as an unknown/misaligned contract.
 */
export const VENDORED_CONTRACT_SCHEMAS: VendoredContractSchema[] = [
  {
    contractVersion: 'apg.mvp.v1',
    schemaVersion: '1.0.0',
    schema: apgMvpV1Schema,
    sourceRepo: 'fwcloud-ai-agent',
    sourcePath: 'contracts/apg.mvp.v1.schema.json',
    sourceCommit: '1ca124d462ba9f242c0b0b703cb446472180e457',
    sha256: 'dbfb8c4bde65d9eb90ea69ae51b9dcbd2f6b156d0190ae0a00b1a3b805dad60a',
    vendoredAt: '2026-07-16',
  },
  {
    contractVersion: 'apg.mvp.v1',
    schemaVersion: '1.1.0',
    schema: apgMvpV1Schema110,
    sourceRepo: 'fwcloud-ai-agent',
    sourcePath: 'contracts/apg.mvp.v1.schema.json',
    // PENDING: the agent-side change this artifact was generated from is not
    // committed yet, so there is no SHA to record. Replace this with the real
    // fwcloud-ai-agent commit before merging -- provenance is the whole point
    // of this field, and a placeholder must never reach a release.
    sourceCommit: 'PENDING-UNCOMMITTED-fwcloud-ai-agent',
    sha256: '1bb109e1106e8b0629773b4eb1d10f51852faaf89cc43d00d9d30ff5ea2e2adf',
    vendoredAt: '2026-09-08',
  },
  {
    contractVersion: 'apg.mvp.v1',
    schemaVersion: '1.2.0',
    schema: apgMvpV1Schema120,
    sourceRepo: 'fwcloud-ai-agent',
    sourcePath: 'contracts/apg.mvp.v1.schema.json',
    // PENDING, same as the entry above: the agent-side change is not committed
    // yet. Replace both with real commits before merging.
    sourceCommit: 'PENDING-UNCOMMITTED-fwcloud-ai-agent',
    sha256: '4d7eddf8f11ead26b4dfb6b73df188db6fec0d240f6d7e1358b608b1f3c494f8',
    vendoredAt: '2026-09-09',
  },
];
