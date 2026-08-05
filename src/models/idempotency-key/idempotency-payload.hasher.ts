import { createHash } from 'crypto';

/**
 * Canonical JSON used to hash an `Idempotency-Key`-bound payload: object keys
 * are recursively sorted so property insertion order cannot change the hash,
 * array order is retained because it can be semantically significant in a
 * payload, `undefined`-valued properties are dropped while explicit `null` is
 * kept, and every value is encoded as standard JSON UTF-8 text. Equivalent
 * payloads therefore always hash the same, and a semantic change always hashes
 * differently.
 *
 * Deliberately independent from `canonicalizeFirewallProfileDraftValue`
 * (same shape, different module): this store is not Assisted-Profile-specific
 * and must not depend on the `firewall-profile-draft` bounded context.
 */
function canonicalizeIdempotencyPayload(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) {
      throw new TypeError('Idempotency payload must be JSON-serializable');
    }
    return encoded;
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeIdempotencyPayload(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const properties = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeIdempotencyPayload(record[key])}`);
  return `{${properties.join(',')}}`;
}

/**
 * The single place an `Idempotency-Key`'s bound payload hash is produced.
 * Every `IdempotencyKeyStore` acquisition goes through this, so it is also
 * the contract a future consumer must reuse if it ever needs to recompute or
 * verify a payload hash outside the store.
 */
export class IdempotencyPayloadHasher {
  public calculate(payload: unknown): string {
    return createHash('sha256')
      .update(canonicalizeIdempotencyPayload(payload), 'utf8')
      .digest('hex');
  }
}

/** Digest stored in place of the raw `Idempotency-Key` header value. */
export function digestIdempotencyKey(rawKey: string): string {
  return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}
