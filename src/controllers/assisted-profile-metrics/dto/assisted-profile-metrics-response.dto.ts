/*!
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

export interface AssistedProfileMetricSampleDto {
  /** Only bounded, documented label values. Never an identifier or free text. */
  readonly labels: Readonly<Record<string, string>>;
  readonly value: number;
}

export interface AssistedProfileMetricFamilyDto {
  readonly name: string;
  readonly type: 'counter';
  readonly help: string;
  readonly label_names: readonly string[];
  /** Every declared series, including the ones still at zero. */
  readonly samples: readonly AssistedProfileMetricSampleDto[];
}

/**
 * Operator-facing adoption metrics payload.
 *
 * Counters are cumulative within one API process and reset when it restarts,
 * so `collection_started_at` is part of the contract: without it the numbers
 * describe an unknown window. The payload carries no draft, generation, user,
 * FWCloud, target or request identifier, and no instruction, proposal fragment
 * or backend error message — see `docs/assisted-profile-adoption-metrics.md`.
 *
 * The shapes below deliberately mirror `AssistedProfileMetricsSnapshot`, whose
 * families are already freshly built per call; only the key names are adapted
 * to the API's snake_case convention, so no defensive re-copying is needed.
 */
export interface AssistedProfileMetricsDto {
  readonly deployment_enabled: boolean;
  readonly collection_started_at: string;
  readonly collected_at: string;
  readonly families: readonly AssistedProfileMetricFamilyDto[];
}
