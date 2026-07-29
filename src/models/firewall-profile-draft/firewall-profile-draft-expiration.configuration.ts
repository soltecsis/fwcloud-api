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

import {
  configurationError,
  resolvePositiveIntegerMs,
} from '../../communications/assistant-agent/assistant-agent-configuration.utils';

export const DEFAULT_DRAFT_TTL_SECONDS = 604_800; // 7 days
export const DEFAULT_EXPIRATION_JOB_ENABLED = true;
export const DEFAULT_EXPIRATION_JOB_INTERVAL_SECONDS = 3_600; // 1 hour
export const DEFAULT_EXPIRATION_BATCH_SIZE = 100;

// `resolvePositiveIntegerMs` is unit-agnostic (it just bounds a positive
// integer); every value here is expressed in seconds, not milliseconds.
export const MAX_DRAFT_TTL_SECONDS = 315_360_000; // 10 years
// Node's setTimeout delay is capped at ~2^31-1 ms; the interval is converted
// to ms for scheduling, so it must stay under that once multiplied by 1000.
export const MAX_EXPIRATION_JOB_INTERVAL_SECONDS = 2_147_483;
export const MAX_EXPIRATION_BATCH_SIZE = 10_000;

export interface FirewallProfileDraftExpirationConfigurationInput {
  readonly enabled?: boolean | string;
  readonly ttlSeconds?: number | string;
  readonly intervalSeconds?: number | string;
  readonly batchSize?: number | string;
}

export interface FirewallProfileDraftExpirationConfiguration {
  readonly enabled: boolean;
  readonly ttlSeconds: number;
  readonly intervalSeconds: number;
  readonly batchSize: number;
}

function resolveBoolean(
  value: boolean | string | undefined,
  fallback: boolean,
  name: string,
): boolean {
  const candidate = value ?? fallback;

  if (typeof candidate === 'boolean') {
    return candidate;
  }

  if (typeof candidate === 'string') {
    const normalized = candidate.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  throw configurationError(`${name} must be a boolean`);
}

/**
 * Resolves already-loaded application configuration. Convict remains the
 * authority for environment access, while this function also protects direct
 * construction in tests and tools.
 */
export function resolveFirewallProfileDraftExpirationConfiguration(
  input: FirewallProfileDraftExpirationConfigurationInput = {},
): FirewallProfileDraftExpirationConfiguration {
  if (!input || typeof input !== 'object') {
    throw configurationError('Assisted Profile draft expiration configuration must be defined');
  }

  return {
    enabled: resolveBoolean(
      input.enabled,
      DEFAULT_EXPIRATION_JOB_ENABLED,
      'Assisted Profile draft expiration job enabled flag',
    ),
    ttlSeconds: resolvePositiveIntegerMs(
      input.ttlSeconds,
      DEFAULT_DRAFT_TTL_SECONDS,
      MAX_DRAFT_TTL_SECONDS,
      'Assisted Profile draft inactivity TTL (seconds)',
    ),
    intervalSeconds: resolvePositiveIntegerMs(
      input.intervalSeconds,
      DEFAULT_EXPIRATION_JOB_INTERVAL_SECONDS,
      MAX_EXPIRATION_JOB_INTERVAL_SECONDS,
      'Assisted Profile draft expiration job interval (seconds)',
    ),
    batchSize: resolvePositiveIntegerMs(
      input.batchSize,
      DEFAULT_EXPIRATION_BATCH_SIZE,
      MAX_EXPIRATION_BATCH_SIZE,
      'Assisted Profile draft expiration job batch size',
    ),
  };
}
