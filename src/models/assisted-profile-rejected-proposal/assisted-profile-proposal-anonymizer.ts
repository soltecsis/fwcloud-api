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

import { isSecretLikeKey } from '../replication-profile/replication-profile-secret.guard';

/**
 * Anonymization rule version persisted next to every captured sample. Changing
 * what any rule below *means* requires a new version identifier: an existing
 * version must always describe exactly the transformations that produced the
 * samples already stored under it.
 */
export const ASSISTED_PROFILE_ANONYMIZATION_VERSION = 'rejected-proposal-anonymization.v1';

/** The only literal strings the anonymizer may emit in place of a value. */
export const REDACTED_TEXT = '<redacted-text>';
export const REDACTED_SECRET = '<redacted-secret>';
export const REDACTED_VALUE = '<redacted-value>';
export const REDACTED_ADDRESS = '<redacted-address>';

const PLACEHOLDERS: ReadonlySet<string> = new Set([
  REDACTED_TEXT,
  REDACTED_SECRET,
  REDACTED_VALUE,
  REDACTED_ADDRESS,
]);

/** Stable, per-proposal pseudonyms. Never derived from the original value. */
const PSEUDONYM_PATTERN = /^(?:resource|iface|node|key)-\d+$/;

type AddressKind = 'ipv4' | 'ipv6' | 'mac';

/** Size of each documentation pool; beyond it, addresses are simply redacted. */
const MAX_ADDRESS_PLACEHOLDERS = 254;

const toHexByte = (value: number): string => value.toString(16).padStart(2, '0');

/**
 * The nth replacement address of each family (`n` starts at 1), drawn from
 * documentation-only space: RFC 5737 TEST-NET-2 for IPv4, RFC 3849 for IPv6,
 * and a locally administered MAC prefix. Allocating sequentially is what makes
 * two occurrences of one original address stay equal — and two different
 * originals stay different — inside a proposal, without either identifying
 * anything. `DOC_*_PATTERN` below recognizes exactly what these produce, which
 * is how the output guard tells a replacement from a leaked address.
 */
const ADDRESS_PLACEHOLDER_FORMATS: Readonly<Record<AddressKind, (index: number) => string>> = {
  ipv4: (index) => `198.51.100.${index}`,
  ipv6: (index) => `2001:db8::${index.toString(16)}`,
  mac: (index) => `02:00:00:00:${toHexByte(Math.floor(index / 256))}:${toHexByte(index % 256)}`,
};

const DOC_IPV4_PATTERN = /^198\.51\.100\.\d{1,3}(?:\/\d{1,3})?$/;
const DOC_IPV6_PATTERN = /^2001:db8::[0-9a-f]{1,4}(?:\/\d{1,3})?$/;
const DOC_MAC_PATTERN = /^02:00:00:00:[0-9a-f]{2}:[0-9a-f]{2}$/;

/** Structural limits. A payload beyond any of them fails anonymization rather
 * than being partially sanitized: capture is optional, correctness is not. */
const MAX_DEPTH = 12;
const MAX_ARRAY_ITEMS = 200;
const MAX_OBJECT_KEYS = 200;
const MAX_NODES = 5_000;
const MAX_SAFE_TOKEN_LENGTH = 64;

/**
 * Additional secret-like key fragments on top of the shared
 * `isSecretLikeKey()` list, which is written for FWCloud profile definitions
 * rather than for arbitrary rejected model output.
 */
const EXTRA_SECRET_KEY_PATTERNS = [
  'authorization',
  'bearer',
  'cookie',
  'session',
  'connectionstring',
  'connection_string',
  'jwt',
  'signature',
];

/**
 * Values that look like credentials even when their key does not. Rejected
 * agent output is untrusted: the contract has no credential field, so anything
 * shaped like one is a defect and must never be persisted.
 */
const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/i,
  /^bearer\s+\S+/i,
  /^basic\s+[A-Za-z0-9+/=]+$/i,
  /(?:password|passwd|pwd|secret|token|api[_-]?key|apikey)\s*[=:]\s*\S+/i,
  /^[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i,
  /^(?:sk|pk|ghp|gho|xox[abpr])[-_][A-Za-z0-9]{8,}/i,
  /^[A-Za-z0-9+/]{32,}={0,2}$/,
  /^[A-Fa-f0-9]{32,}$/,
];

const IPV4_PATTERN = /^(\d{1,3}(?:\.\d{1,3}){3})(\/\d{1,2})?$/;
const IPV6_PATTERN = /^([0-9A-Fa-f:]*:[0-9A-Fa-f:]*:[0-9A-Fa-f:]*)(\/\d{1,3})?$/;
const MAC_PATTERN = /^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
/** Whole-token hostname/domain shape: at least one label plus an alphabetic TLD. */
const DOMAIN_PATTERN = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}\.?$/;
/**
 * Charset of a value that may be persisted verbatim. Deliberately excludes
 * whitespace (free text), `@` (e-mail addresses) and quotes, and is bounded in
 * length, so "structurally safe" can never accidentally mean "a sentence".
 */
const SAFE_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:+/-]*$/;

/**
 * Closed set of contract enum literals. A value equal to one of these is
 * non-identifying by construction, so it survives even at paths the policy
 * does not know (arbitrary `fwcloudPayload.payload` content, unexpected extra
 * properties, malformed payloads), where every other string is redacted.
 */
const CONTRACT_SAFE_VALUES: ReadonlySet<string> = new Set([
  'success',
  'needs_clarification',
  'validation_failed',
  'firewall',
  'cluster',
  'unknown',
  'allow',
  'deny',
  'create_firewall',
  'create_cluster',
  'preview',
  'apply',
  'text',
  'number',
  'choice',
  'boolean',
]);

/**
 * What the policy does with each known contract field:
 *
 * - `preserve`: kept verbatim *only* if the value passes every value-level
 *   check (see `preserveString()`); addresses are generalized, credentials and
 *   free text are redacted even here. Field names alone never authorize a
 *   value.
 * - `text`: always replaced by a placeholder. Free text is the highest
 *   re-identification risk and is never sanitized "in place".
 * - `resource` / `iface` / `node`: replaced by a stable per-proposal pseudonym,
 *   so relationships between names (interface ↔ role assignment, node ↔ member
 *   interface) remain analyzable while the original label does not exist.
 * - `contract_path`: kept only when the value is one of the contract's own
 *   field paths (a closed, code-defined set), redacted otherwise.
 * - `drop`: the property is removed entirely.
 *
 * Array elements use a `[]` path segment. Any path missing from this map falls
 * back to the default-deny rules in `sanitizeUnknownString()`.
 */
type FieldRule = 'preserve' | 'text' | 'resource' | 'iface' | 'node' | 'contract_path' | 'drop';

export const ASSISTED_PROFILE_ANONYMIZATION_FIELD_RULES: Readonly<Record<string, FieldRule>> = {
  status: 'preserve',
  // The agent's own correlation id: arbitrary agent-controlled text, and
  // fwcloud-api already stores its own safe request id in its own column.
  requestId: 'drop',
  'intent.detectedTarget': 'preserve',
  'intent.confidence': 'preserve',
  'intent.language': 'preserve',
  'intent.summary': 'text',
  'plan[].step': 'preserve',
  'plan[].title': 'text',
  'plan[].description': 'text',
  'warnings[].code': 'preserve',
  'warnings[].severity': 'preserve',
  'warnings[].message': 'text',
  'errors[].code': 'preserve',
  'errors[].severity': 'preserve',
  // A dotted field path is indistinguishable from a hostname by shape alone,
  // so it survives only when it names an actual contract field.
  'errors[].field': 'contract_path',
  'errors[].message': 'text',
  'clarification.questions[].code': 'preserve',
  'clarification.questions[].required': 'preserve',
  'clarification.questions[].expectedAnswerType': 'preserve',
  'clarification.questions[].question': 'text',
  'clarification.questions[].options[]': 'text',
  'metadata.schemaVersion': 'preserve',
  'metadata.modelProvider': 'preserve',
  'metadata.generatedAt': 'preserve',
  'fwcloudPayload.operation': 'preserve',
  'fwcloudPayload.targetType': 'preserve',
  // `fwcloudPayload.payload` is intentionally absent: the contract declares it
  // as a free-form object, so it is sanitized by the default-deny rules.
  'generated.profile.code': 'resource',
  'generated.profile.name': 'resource',
  'generated.profile.description': 'text',
  'generated.profile.requiredRoles[]': 'preserve',
  'generated.profile.targetTypes[]': 'preserve',
  'generated.profile.version': 'preserve',
  'generated.roleAssignments.interfaceRoles[].interfaceName': 'iface',
  'generated.roleAssignments.interfaceRoles[].role': 'preserve',
  'generated.roleAssignments.interfaceRoles[].node': 'node',
  'generated.roleAssignments.nodeRoles[].nodeName': 'node',
  'generated.roleAssignments.nodeRoles[].role': 'preserve',
  'generated.target.type': 'preserve',
  'generated.target.name': 'resource',
  'generated.target.interfaces[].name': 'iface',
  'generated.target.interfaces[].role': 'preserve',
  'generated.target.interfaces[].address': 'preserve',
  'generated.target.interfaces[].description': 'text',
  'generated.target.interfaces[].node': 'node',
  'generated.target.nodes[].name': 'node',
  'generated.target.nodes[].role': 'preserve',
  'generated.rules[].action': 'preserve',
  'generated.rules[].sourceRole': 'preserve',
  'generated.rules[].destinationRole': 'preserve',
  'generated.rules[].service': 'preserve',
  'generated.rules[].description': 'text',
};

/**
 * Every field path the contract defines, including the container paths on the
 * way to each leaf. Derived from the rule table itself so it can never drift.
 * A value belonging to this closed set is a schema identifier, not user
 * content, which is what makes `contract_path` safe.
 */
export const ASSISTED_PROFILE_CONTRACT_PATHS: ReadonlySet<string> = new Set(
  Object.keys(ASSISTED_PROFILE_ANONYMIZATION_FIELD_RULES).flatMap((path) => {
    const paths: string[] = [];
    let current = '';
    for (const segment of path.split('.')) {
      current = current ? `${current}.${segment}` : segment;
      if (current.endsWith('[]')) {
        paths.push(current.slice(0, -2));
      }
      paths.push(current);
    }
    return paths;
  }),
);

/**
 * Accepts the contract path as written, as a JSON-pointer-ish variant
 * (`/generated/target/name`) and with numeric array indices, always returning
 * the canonical dotted form so the persisted value comes from the closed set
 * rather than from the agent's string.
 */
function canonicalContractPath(value: string): string | undefined {
  const normalized = value
    .trim()
    .replace(/^[./]+/, '')
    .replace(/\//g, '.')
    .replace(/\[\d+\]/g, '[]')
    .replace(/\.\d+(?=\.|$)/g, '[]');

  return ASSISTED_PROFILE_CONTRACT_PATHS.has(normalized) ? normalized : undefined;
}

/** Counters describing what the anonymizer did. Counts only, never values. */
export type AnonymizationRedactionCounts = Readonly<Record<string, number>>;

export interface AnonymizedRejectedProposal {
  /** Rule version that produced `payload`. */
  readonly anonymizationVersion: string;
  /** The only representation of the rejected proposal that may be persisted. */
  readonly payload: unknown;
  /** Per-rule counts, safe for logs and audit records. */
  readonly redactions: AnonymizationRedactionCounts;
}

/**
 * Raised when a proposal cannot be anonymized with confidence. Callers must
 * treat it as "do not persist this sample" — never as a reason to store the
 * raw proposal, and never as a reason to change the validation response the
 * client already earned.
 */
export class AssistedProfileProposalAnonymizationError extends Error {
  public readonly code = 'ASSISTED_PROFILE_ANONYMIZATION_FAILED' as const;

  constructor(reason: string) {
    super(`The rejected Assisted Profile proposal could not be anonymized: ${reason}`);
    this.name = AssistedProfileProposalAnonymizationError.name;
    Object.setPrototypeOf(this, AssistedProfileProposalAnonymizationError.prototype);
  }
}

interface AnonymizationRun {
  readonly pseudonyms: Map<string, string>;
  readonly counters: Map<string, number>;
  readonly redactions: Map<string, number>;
  nodes: number;
}

function isSecretLikeName(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    isSecretLikeKey(normalized) ||
    EXTRA_SECRET_KEY_PATTERNS.some((pattern) => normalized.includes(pattern))
  );
}

function looksLikeSecretValue(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function isIpv4Like(value: string): boolean {
  const match = IPV4_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const octetsValid = match[1]
    .split('.')
    .every((octet) => octet.length <= 3 && Number(octet) <= 255);
  const prefixValid = match[2] === undefined || Number(match[2].slice(1)) <= 32;
  return octetsValid && prefixValid;
}

function isIpv6Like(value: string): boolean {
  const match = IPV6_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const address = match[1];
  // Require a real IPv6 shape: either the `::` compression or the full eight
  // groups. This keeps timestamps such as `2026-07-16T10:00:00Z` (which carry
  // colon-separated digits) from being mistaken for addresses.
  const groups = address.split(':');
  const compressed = address.includes('::');
  if (!compressed && groups.length !== 8) {
    return false;
  }
  const prefixValid = match[2] === undefined || Number(match[2].slice(1)) <= 128;
  return prefixValid && groups.every((group) => group.length <= 4);
}

/**
 * A string that may be persisted verbatim. This is the single definition of
 * "structurally safe": both the `preserve` rule and the post-condition guard
 * use it, so nothing can be preserved that the guard would reject.
 */
export function isStructurallySafeToken(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_SAFE_TOKEN_LENGTH &&
    SAFE_TOKEN_PATTERN.test(value) &&
    !value.includes('://') &&
    !DOMAIN_PATTERN.test(value) &&
    !isIpv4Like(value) &&
    !isIpv6Like(value) &&
    !MAC_PATTERN.test(value) &&
    !looksLikeSecretValue(value)
  );
}

function isDocumentationAddress(value: string): boolean {
  return (
    DOC_IPV4_PATTERN.test(value) || DOC_IPV6_PATTERN.test(value) || DOC_MAC_PATTERN.test(value)
  );
}

/** Objects the anonymizer may walk: JSON data, never a class instance. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * The one predicate describing a string that may be persisted: a placeholder,
 * a pseudonym, a documentation address, a contract field path, or a
 * structurally safe token. Nothing else can survive anonymization.
 */
function isPersistableAnonymizedString(value: string): boolean {
  return (
    PLACEHOLDERS.has(value) ||
    PSEUDONYM_PATTERN.test(value) ||
    isDocumentationAddress(value) ||
    ASSISTED_PROFILE_CONTRACT_PATHS.has(value) ||
    isStructurallySafeToken(value)
  );
}

/**
 * The invariant every persisted sample satisfies. Violating it means a rule is
 * wrong, so the sample is dropped instead of stored.
 */
export function assertAnonymizedProposalIsSafe(payload: unknown, path = ''): void {
  const where = path || '<root>';

  if (typeof payload === 'string') {
    if (!isPersistableAnonymizedString(payload)) {
      throw new AssistedProfileProposalAnonymizationError(
        `the anonymized payload still holds an unsafe string at '${where}'`,
      );
    }
    return;
  }

  if (payload === null || typeof payload === 'boolean') {
    return;
  }

  if (typeof payload === 'number') {
    if (!Number.isFinite(payload)) {
      throw new AssistedProfileProposalAnonymizationError(
        `the anonymized payload holds a non-finite number at '${where}'`,
      );
    }
    return;
  }

  if (Array.isArray(payload)) {
    payload.forEach((item, index) => assertAnonymizedProposalIsSafe(item, `${path}[${index}]`));
    return;
  }

  if (typeof payload !== 'object') {
    throw new AssistedProfileProposalAnonymizationError(
      `the anonymized payload holds a ${typeof payload} at '${where}'`,
    );
  }

  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    if (isSecretLikeName(key) && value !== REDACTED_SECRET && value !== null) {
      throw new AssistedProfileProposalAnonymizationError(
        `the anonymized payload still holds a secret-like field at '${childPath}'`,
      );
    }
    assertAnonymizedProposalIsSafe(value, childPath);
  }
}

/**
 * The single place where Assisted Profile anonymization rules live. Pure and
 * stateless between calls: every invocation allocates its own pseudonym table
 * and discards it on return, so no original-to-replacement mapping outlives
 * the operation and nothing persisted can be reversed through stored data.
 *
 * The full policy — every field class, the IP rule, the free-text rule, the
 * secret rule and what is deliberately preserved — is documented in this
 * directory's README.
 */
export class AssistedProfileProposalAnonymizer {
  public anonymize(proposal: unknown): AnonymizedRejectedProposal {
    const run: AnonymizationRun = {
      pseudonyms: new Map(),
      counters: new Map(),
      redactions: new Map(),
      nodes: 0,
    };

    const payload = isPlainObject(proposal)
      ? this.sanitizeObject(proposal, '', run, 0)
      : this.describeNonObjectPayload(proposal, run);

    // Self-verification: the rules above are only trustworthy if their output
    // provably contains nothing identifying. A violation fails the capture.
    assertAnonymizedProposalIsSafe(payload);

    return {
      anonymizationVersion: ASSISTED_PROFILE_ANONYMIZATION_VERSION,
      payload,
      redactions: Object.fromEntries(
        [...run.redactions.entries()].sort(([left], [right]) => left.localeCompare(right)),
      ),
    };
  }

  /**
   * A payload that is not even a JSON object (the `malformed_payload`
   * rejection reason) has no structure worth keeping and may be an arbitrary
   * response body, so only its JavaScript type is recorded.
   */
  private describeNonObjectPayload(proposal: unknown, run: AnonymizationRun): unknown {
    this.count(run, 'non_object_payload');
    return {
      nonObjectPayload: true,
      valueType: Array.isArray(proposal) ? 'array' : typeof proposal,
    };
  }

  private sanitizeObject(
    source: Record<string, unknown>,
    path: string,
    run: AnonymizationRun,
    depth: number,
  ): Record<string, unknown> {
    const keys = Object.keys(source);
    if (keys.length > MAX_OBJECT_KEYS) {
      throw new AssistedProfileProposalAnonymizationError(
        `an object at '${path || '<root>'}' has more than ${MAX_OBJECT_KEYS} properties`,
      );
    }

    const sanitized: Record<string, unknown> = {};
    for (const key of keys) {
      const value = source[key];
      if (value === undefined) {
        continue;
      }

      const childPath = path ? `${path}.${key}` : key;
      const rule = ASSISTED_PROFILE_ANONYMIZATION_FIELD_RULES[childPath];

      if (rule === 'drop') {
        this.count(run, 'dropped');
        continue;
      }

      // A secret-like key redacts its whole subtree, whatever the rule says:
      // a credential must not survive as structure either.
      if (isSecretLikeName(key)) {
        sanitized[this.sanitizeKey(key, run)] = this.redact(run, 'secret', REDACTED_SECRET);
        continue;
      }

      sanitized[this.sanitizeKey(key, run)] = this.sanitizeValue(
        value,
        childPath,
        rule,
        run,
        depth + 1,
      );
    }

    return sanitized;
  }

  /**
   * Keys of unknown objects are content too: a map keyed by e-mail address
   * would otherwise leak through the key side. Known contract keys are fixed
   * identifiers and always pass the token check.
   */
  private sanitizeKey(key: string, run: AnonymizationRun): string {
    if (isStructurallySafeToken(key)) {
      return key;
    }
    this.count(run, 'key_pseudonym');
    return this.pseudonym('key', key, run);
  }

  private sanitizeValue(
    value: unknown,
    path: string,
    rule: FieldRule | undefined,
    run: AnonymizationRun,
    depth: number,
  ): unknown {
    this.trackNode(run, path);

    if (depth > MAX_DEPTH) {
      throw new AssistedProfileProposalAnonymizationError(
        `the payload nests deeper than ${MAX_DEPTH} levels at '${path}'`,
      );
    }

    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY_ITEMS) {
        throw new AssistedProfileProposalAnonymizationError(
          `an array at '${path}' has more than ${MAX_ARRAY_ITEMS} items`,
        );
      }
      const itemPath = `${path}[]`;
      const itemRule = ASSISTED_PROFILE_ANONYMIZATION_FIELD_RULES[itemPath];
      return value.map((item) => this.sanitizeValue(item, itemPath, itemRule, run, depth + 1));
    }

    if (isPlainObject(value)) {
      return this.sanitizeObject(value, path, run, depth);
    }

    if (value === null) {
      return null;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new AssistedProfileProposalAnonymizationError(
          `a non-finite number at '${path}' cannot be anonymized`,
        );
      }
      // Numbers in this contract are ports, steps, versions and confidences.
      // Identity-bearing positions (`resource`/`iface`/`node`) still get a
      // pseudonym even when the agent sent a number instead of a string.
      return rule === 'resource' || rule === 'iface' || rule === 'node'
        ? this.pseudonymize(rule, String(value), run)
        : value;
    }

    if (typeof value !== 'string') {
      throw new AssistedProfileProposalAnonymizationError(
        `a ${typeof value} value at '${path}' is not JSON data`,
      );
    }

    return this.sanitizeString(value, rule, run);
  }

  /** Every string rule works on the trimmed value; leading/trailing
   * whitespace is never itself content worth preserving. */
  private sanitizeString(
    value: string,
    rule: FieldRule | undefined,
    run: AnonymizationRun,
  ): string {
    const trimmed = value.trim();

    if (looksLikeSecretValue(trimmed)) {
      return this.redact(run, 'secret', REDACTED_SECRET);
    }

    switch (rule) {
      case 'text':
        return this.redact(run, 'free_text', REDACTED_TEXT);
      case 'resource':
      case 'iface':
      case 'node':
        return this.pseudonymize(rule, trimmed, run);
      case 'contract_path':
        return canonicalContractPath(trimmed) ?? this.redact(run, 'unclassified', REDACTED_VALUE);
      case 'preserve':
        return this.preserveString(trimmed, run);
      default:
        return this.sanitizeUnknownString(trimmed, run);
    }
  }

  /**
   * `preserve` is a *candidate* for verbatim persistence, not a guarantee:
   * addresses are generalized and anything that is not a structurally safe
   * token becomes free text. This is what keeps the policy from depending on
   * field names alone.
   */
  private preserveString(trimmed: string, run: AnonymizationRun): string {
    return (
      this.addressPlaceholder(trimmed, run) ??
      (isStructurallySafeToken(trimmed) ? trimmed : this.redact(run, 'free_text', REDACTED_TEXT))
    );
  }

  /** Default-deny for every path the policy does not know. */
  private sanitizeUnknownString(trimmed: string, run: AnonymizationRun): string {
    if (CONTRACT_SAFE_VALUES.has(trimmed)) {
      return trimmed;
    }

    return (
      this.addressPlaceholder(trimmed, run) ?? this.redact(run, 'unclassified', REDACTED_VALUE)
    );
  }

  /**
   * The IP rule. Every address — public, RFC1918, IPv6 or MAC alike — is
   * replaced by a documentation-space address. Prefix length is preserved
   * because it is structurally meaningful and carries no identity, and equal
   * originals keep mapping to equal placeholders within the proposal.
   *
   * Returns `undefined` when the value is not an address at all, which is how
   * callers know to fall through to their own rule.
   */
  private addressPlaceholder(value: string, run: AnonymizationRun): string | undefined {
    const kind = this.addressKind(value);
    if (kind === undefined) {
      return undefined;
    }

    const slash = value.indexOf('/');
    const address = slash === -1 ? value : value.slice(0, slash);
    // MAC addresses are matched case-insensitively, so their lookup key is
    // normalized; IP literals are keyed exactly as the agent wrote them.
    const host = this.allocateAddress(kind, kind === 'mac' ? address.toLowerCase() : address, run);

    // An exhausted pool yields a bare placeholder: appending a prefix to it
    // would produce a string that is neither a placeholder nor an address.
    return slash === -1 || host === REDACTED_ADDRESS ? host : `${host}${value.slice(slash)}`;
  }

  private addressKind(value: string): AddressKind | undefined {
    if (isIpv4Like(value)) {
      return 'ipv4';
    }
    if (isIpv6Like(value)) {
      return 'ipv6';
    }
    return MAC_PATTERN.test(value) ? 'mac' : undefined;
  }

  private allocateAddress(kind: AddressKind, original: string, run: AnonymizationRun): string {
    const mapKey = `${kind}:${original}`;
    const existing = run.pseudonyms.get(mapKey);
    if (existing !== undefined) {
      return existing;
    }

    const index = (run.counters.get(kind) ?? 0) + 1;
    if (index > MAX_ADDRESS_PLACEHOLDERS) {
      return this.redact(run, 'address', REDACTED_ADDRESS);
    }

    run.counters.set(kind, index);
    const placeholder = ADDRESS_PLACEHOLDER_FORMATS[kind](index);
    run.pseudonyms.set(mapKey, placeholder);
    this.count(run, 'address');
    return placeholder;
  }

  private pseudonymize(
    kind: 'resource' | 'iface' | 'node',
    value: string,
    run: AnonymizationRun,
  ): string {
    this.count(run, 'pseudonym');
    return this.pseudonym(kind, value, run);
  }

  /**
   * Stable replacement: within one anonymization run, the same original value
   * in the same field class always receives the same placeholder, so the
   * relationships evaluation depends on (interface ↔ role assignment, node ↔
   * member interface, target ↔ profile) survive intact.
   *
   * Keying by class as well as by value is deliberate: it keeps every
   * placeholder's prefix truthful, and one label reused across unrelated
   * classes becomes two independent pseudonyms rather than one link. The table
   * is local to the run and never persisted, so no substitution is reversible
   * from stored data.
   */
  private pseudonym(
    kind: 'resource' | 'iface' | 'node' | 'key',
    original: string,
    run: AnonymizationRun,
  ): string {
    const mapKey = `${kind}:${original}`;
    const existing = run.pseudonyms.get(mapKey);
    if (existing !== undefined) {
      return existing;
    }

    const index = (run.counters.get('name') ?? 0) + 1;
    run.counters.set('name', index);
    const placeholder = `${kind}-${index}`;
    run.pseudonyms.set(mapKey, placeholder);
    return placeholder;
  }

  private redact(run: AnonymizationRun, counter: string, placeholder: string): string {
    this.count(run, counter);
    return placeholder;
  }

  private count(run: AnonymizationRun, counter: string): void {
    run.redactions.set(counter, (run.redactions.get(counter) ?? 0) + 1);
  }

  private trackNode(run: AnonymizationRun, path: string): void {
    run.nodes += 1;
    if (run.nodes > MAX_NODES) {
      throw new AssistedProfileProposalAnonymizationError(
        `the payload holds more than ${MAX_NODES} values (reached at '${path}')`,
      );
    }
  }
}
