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

import { ConfigurationErrorException } from '../../config/exceptions/configuration-error.exception';

/** Shared by every assistant-agent configuration resolver. */
export function configurationError(message: string): ConfigurationErrorException {
  return new ConfigurationErrorException(`Configuration Error: ${message}`);
}

/**
 * Resolves a boolean setting from already-loaded configuration. Accepts a real
 * boolean or the strings `'true'`/`'false'` (as Convict/env vars and direct
 * test construction both may supply); rejects everything else rather than
 * guessing what `'yes'` or `1` were meant to mean.
 *
 * `emptyAsFalse` opts a setting into treating an empty string as `false`, for
 * flags whose contract is "absence behaves exactly as false".
 */
export function resolveBooleanSetting(
  value: boolean | string | undefined,
  fallback: boolean,
  name: string,
  { emptyAsFalse = false }: { emptyAsFalse?: boolean } = {},
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
    if (normalized === 'false' || (emptyAsFalse && normalized === '')) {
      return false;
    }
  }

  throw configurationError(`${name} must be a boolean`);
}

/**
 * Resolves a positive-integer-millisecond setting from already-loaded
 * configuration. Accepts a number or a digit-only string (as Convict/env vars
 * and direct test construction both may supply); rejects everything else,
 * including zero, negative, fractional, or out-of-range values.
 */
export function resolvePositiveIntegerMs(
  value: number | string | undefined,
  fallback: number,
  maxValue: number,
  name: string,
): number {
  const candidate = value ?? fallback;
  const trimmed = typeof candidate === 'string' ? candidate.trim() : candidate;
  const normalized =
    typeof trimmed === 'string' && /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;

  if (
    typeof normalized !== 'number' ||
    !Number.isInteger(normalized) ||
    normalized <= 0 ||
    normalized > maxValue
  ) {
    throw configurationError(`${name} must be a positive integer no greater than ${maxValue}`);
  }

  return normalized;
}
