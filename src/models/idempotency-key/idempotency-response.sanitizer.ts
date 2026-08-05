/**
 * Response headers safe to cache and replay from a completed idempotent
 * execution. Deliberately an allowlist rather than a denylist: an
 * `Idempotency-Key` record can outlive the request that created it by up to
 * the configured TTL, so anything not explicitly reviewed as safe (session
 * identifiers, `Set-Cookie`, `Authorization`, tracing headers, ...) is
 * dropped rather than persisted "just in case" a future header turns out to
 * be sensitive.
 */
const SAFE_RESPONSE_HEADER_NAMES = new Set(['content-type', 'location']);

/** Case-insensitive allowlist filter applied before a response snapshot is persisted. */
export function sanitizeIdempotencyResponseHeaders(
  headers: Record<string, string> | null | undefined,
): Record<string, string> | null {
  if (!headers) {
    return null;
  }

  const sanitized: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (SAFE_RESPONSE_HEADER_NAMES.has(name.toLowerCase())) {
      sanitized[name] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}
