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

import { configurationError } from './assistant-agent-configuration.utils';

export const DEFAULT_GENERATION_QUEUE_MAX_DEPTH = 3;
export const MAX_GENERATION_QUEUE_DEPTH = 2_147_483_647;

export interface GenerationQueueConfigurationInput {
  readonly maxDepth?: number | string;
}

export interface GenerationQueueConfiguration {
  /**
   * Maximum number of waiting jobs. The single active job is not included.
   * Zero therefore permits one active generation and no waiting generations.
   */
  readonly maxDepth: number;
}

/**
 * Resolves already-loaded application configuration. Convict remains the
 * authority for environment access, while this function also protects direct
 * construction in tests and tools.
 */
export function resolveGenerationQueueConfiguration(
  input: GenerationQueueConfigurationInput = {},
): GenerationQueueConfiguration {
  if (!input || typeof input !== 'object') {
    throw configurationError('Assisted Profile generation queue configuration must be defined');
  }

  const candidate = input.maxDepth ?? DEFAULT_GENERATION_QUEUE_MAX_DEPTH;
  const normalized =
    typeof candidate === 'string' && /^\d+$/.test(candidate.trim()) ? Number(candidate) : candidate;

  if (
    typeof normalized !== 'number' ||
    !Number.isSafeInteger(normalized) ||
    normalized < 0 ||
    normalized > MAX_GENERATION_QUEUE_DEPTH
  ) {
    throw configurationError(
      `Assisted Profile generation queue maximum depth must be a non-negative integer no greater than ${MAX_GENERATION_QUEUE_DEPTH}`,
    );
  }

  return { maxDepth: normalized };
}
