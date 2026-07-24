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
} from './assistant-agent-configuration.utils';

export const DEFAULT_HEALTH_POLL_ENABLED = true;
export const DEFAULT_HEALTH_POLL_INTERVAL_MS = 30_000;
export const DEFAULT_HEALTH_TIMEOUT_MS = 5_000;
export const DEFAULT_HEALTH_PATH = '/health';
export const MAX_HEALTH_TIMER_MS = 2_147_483_647;

export interface AssistedProfileHealthConfigurationInput {
  readonly enabled?: boolean | string;
  readonly pollIntervalMs?: number | string;
  readonly timeoutMs?: number | string;
  readonly path?: string;
}

export interface AssistedProfileHealthConfiguration {
  readonly enabled: boolean;
  readonly pollIntervalMs: number;
  readonly timeoutMs: number;
  readonly path: string;
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

function resolvePath(value: string | undefined, fallback: string): string {
  const candidate = (value ?? fallback).trim();

  if (candidate.length === 0 || !candidate.startsWith('/')) {
    throw configurationError(
      'Assisted Profile agent health path must be a non-empty string starting with "/"',
    );
  }

  return candidate;
}

/**
 * Resolves already-loaded application configuration. Convict remains the
 * authority for environment access, while this function also protects direct
 * construction in tests and tools.
 */
export function resolveAssistedProfileHealthConfiguration(
  input: AssistedProfileHealthConfigurationInput = {},
): AssistedProfileHealthConfiguration {
  if (!input || typeof input !== 'object') {
    throw configurationError('Assisted Profile health configuration must be defined');
  }

  return {
    enabled: resolveBoolean(
      input.enabled,
      DEFAULT_HEALTH_POLL_ENABLED,
      'Assisted Profile health poll enabled flag',
    ),
    pollIntervalMs: resolvePositiveIntegerMs(
      input.pollIntervalMs,
      DEFAULT_HEALTH_POLL_INTERVAL_MS,
      MAX_HEALTH_TIMER_MS,
      'Assisted Profile health poll interval',
    ),
    timeoutMs: resolvePositiveIntegerMs(
      input.timeoutMs,
      DEFAULT_HEALTH_TIMEOUT_MS,
      MAX_HEALTH_TIMER_MS,
      'Assisted Profile health timeout',
    ),
    path: resolvePath(input.path, DEFAULT_HEALTH_PATH),
  };
}
