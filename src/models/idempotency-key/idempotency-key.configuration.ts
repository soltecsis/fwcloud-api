import {
  configurationError,
  resolvePositiveIntegerMs,
} from '../../communications/assistant-agent/assistant-agent-configuration.utils';

export const DEFAULT_IDEMPOTENCY_KEY_TTL_SECONDS = 86_400; // 24 hours
// `resolvePositiveIntegerMs` is unit-agnostic (it just bounds a positive
// integer); this value is expressed in seconds, not milliseconds.
export const MAX_IDEMPOTENCY_KEY_TTL_SECONDS = 315_360_000; // 10 years

export interface IdempotencyKeyConfigurationInput {
  readonly ttlSeconds?: number | string;
}

export interface IdempotencyKeyConfiguration {
  readonly ttlSeconds: number;
}

/**
 * Resolves already-loaded application configuration. Convict remains the
 * authority for environment access, while this function also protects direct
 * construction in tests and tools.
 */
export function resolveIdempotencyKeyConfiguration(
  input: IdempotencyKeyConfigurationInput = {},
): IdempotencyKeyConfiguration {
  if (!input || typeof input !== 'object') {
    throw configurationError('Assisted Profile idempotency key configuration must be defined');
  }

  return {
    ttlSeconds: resolvePositiveIntegerMs(
      input.ttlSeconds,
      DEFAULT_IDEMPOTENCY_KEY_TTL_SECONDS,
      MAX_IDEMPOTENCY_KEY_TTL_SECONDS,
      'Assisted Profile idempotency key TTL (seconds)',
    ),
  };
}
