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
import {
  configurationError,
  resolveBooleanSetting,
  resolvePositiveIntegerMs,
} from '../../communications/assistant-agent/assistant-agent-configuration.utils';

/** Convict path holding every setting this module reads. */
export const ASSISTED_PROFILE_REJECTED_PROPOSAL_CONFIG_KEY =
  'assisted_profile.rejected_proposal_capture';

/**
 * Capture is off unless a pilot operator turns it on deliberately. An absent
 * setting must therefore behave exactly like `false`, which is what this
 * default guarantees for both Convict and direct construction.
 */
export const DEFAULT_REJECTED_PROPOSAL_CAPTURE_ENABLED = false;
/** Pilot retention: short by design, and never unlimited. */
export const DEFAULT_REJECTED_PROPOSAL_RETENTION_DAYS = 14;
export const DEFAULT_REJECTED_PROPOSAL_PURGE_JOB_ENABLED = true;
export const DEFAULT_REJECTED_PROPOSAL_PURGE_INTERVAL_SECONDS = 3_600; // 1 hour
export const DEFAULT_REJECTED_PROPOSAL_PURGE_BATCH_SIZE = 500;

/** A retention window beyond this is treated as a configuration mistake. */
export const MAX_REJECTED_PROPOSAL_RETENTION_DAYS = 90;
// Node's setTimeout delay is capped at ~2^31-1 ms and the interval is
// converted to milliseconds for scheduling.
export const MAX_REJECTED_PROPOSAL_PURGE_INTERVAL_SECONDS = 2_147_483;
export const MAX_REJECTED_PROPOSAL_PURGE_BATCH_SIZE = 10_000;

export interface AssistedProfileRejectedProposalConfigurationInput {
  readonly captureEnabled?: boolean | string;
  readonly retentionDays?: number | string;
  readonly purgeEnabled?: boolean | string;
  readonly purgeIntervalSeconds?: number | string;
  readonly purgeBatchSize?: number | string;
}

export interface AssistedProfileRejectedProposalConfiguration {
  readonly captureEnabled: boolean;
  readonly retentionDays: number;
  readonly purgeEnabled: boolean;
  readonly purgeIntervalSeconds: number;
  readonly purgeBatchSize: number;
}

/**
 * Reads the raw settings out of already-loaded application configuration. Both
 * the capture service and the retention job need exactly the same block, so
 * the mapping from Convict keys to this module's input shape lives here rather
 * than being repeated in each of them.
 */
export function readAssistedProfileRejectedProposalConfiguration(
  app: AbstractApplication | null,
): AssistedProfileRejectedProposalConfigurationInput {
  if (!app) {
    return {};
  }

  const config = app.config.get(ASSISTED_PROFILE_REJECTED_PROPOSAL_CONFIG_KEY);
  return {
    captureEnabled: config?.enabled,
    retentionDays: config?.retention_days,
    purgeEnabled: config?.purge_job?.enabled,
    purgeIntervalSeconds: config?.purge_job?.interval_seconds,
    purgeBatchSize: config?.purge_job?.batch_size,
  };
}

/**
 * Resolves already-loaded application configuration. Convict remains the
 * authority for environment access, while this function also protects direct
 * construction in tests and tools.
 */
export function resolveAssistedProfileRejectedProposalConfiguration(
  input: AssistedProfileRejectedProposalConfigurationInput = {},
): AssistedProfileRejectedProposalConfiguration {
  if (!input || typeof input !== 'object') {
    throw configurationError(
      'Assisted Profile rejected-proposal capture configuration must be defined',
    );
  }

  return {
    captureEnabled: resolveBooleanSetting(
      input.captureEnabled,
      DEFAULT_REJECTED_PROPOSAL_CAPTURE_ENABLED,
      'Assisted Profile rejected-proposal capture flag',
      // "Absence behaves exactly as false" covers an env var that is present
      // but empty, not only one that is missing altogether.
      { emptyAsFalse: true },
    ),
    retentionDays: resolvePositiveIntegerMs(
      input.retentionDays,
      DEFAULT_REJECTED_PROPOSAL_RETENTION_DAYS,
      MAX_REJECTED_PROPOSAL_RETENTION_DAYS,
      'Assisted Profile rejected-proposal retention (days)',
    ),
    purgeEnabled: resolveBooleanSetting(
      input.purgeEnabled,
      DEFAULT_REJECTED_PROPOSAL_PURGE_JOB_ENABLED,
      'Assisted Profile rejected-proposal purge job enabled flag',
    ),
    purgeIntervalSeconds: resolvePositiveIntegerMs(
      input.purgeIntervalSeconds,
      DEFAULT_REJECTED_PROPOSAL_PURGE_INTERVAL_SECONDS,
      MAX_REJECTED_PROPOSAL_PURGE_INTERVAL_SECONDS,
      'Assisted Profile rejected-proposal purge job interval (seconds)',
    ),
    purgeBatchSize: resolvePositiveIntegerMs(
      input.purgeBatchSize,
      DEFAULT_REJECTED_PROPOSAL_PURGE_BATCH_SIZE,
      MAX_REJECTED_PROPOSAL_PURGE_BATCH_SIZE,
      'Assisted Profile rejected-proposal purge job batch size',
    ),
  };
}
