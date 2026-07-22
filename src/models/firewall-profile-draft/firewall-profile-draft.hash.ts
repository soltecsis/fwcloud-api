import { createHash } from 'crypto';

/**
 * Canonical JSON used by draft hashes: object keys are recursively sorted,
 * array order is retained, and JSON primitives keep their standard encoding.
 * Hashes are lower-case SHA-256 hex strings of the resulting UTF-8 bytes.
 */
export function canonicalizeFirewallProfileDraftValue(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) {
      throw new TypeError('Draft hash input must be JSON-serializable');
    }
    return encoded;
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeFirewallProfileDraftValue(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const properties = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeFirewallProfileDraftValue(record[key])}`);
  return `{${properties.join(',')}}`;
}

export function hashFirewallProfileDraftValue(value: unknown): string {
  return createHash('sha256')
    .update(canonicalizeFirewallProfileDraftValue(value), 'utf8')
    .digest('hex');
}
