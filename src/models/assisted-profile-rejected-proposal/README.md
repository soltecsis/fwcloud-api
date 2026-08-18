# assisted-profile-rejected-proposal — opt-in anonymized rejection corpus

When Assisted Profile validation rejects a proposal, no draft is created and the
proposal disappears with the request. That is the right production behaviour,
but it also means a pilot has no way to study *why* generations get rejected.

This module adds an **explicitly opt-in**, default-off capability: while the
capture flag is enabled, an eligible rejection stores an **anonymized** copy of
the proposal for a bounded time. The original is never persisted, by this
feature or any other.

```text
rejected proposal
    ↓
normal rejection handling + audit        ← unchanged, always happens first
    ↓
capture flag?  ── off ──► proposal discarded
    │ on
    ▼
AssistedProfileProposalAnonymizer
    ↓ (anonymized payload only)
AssistedProfileRejectedProposalRepository
    ↓
purge at expires_at
```

Operator-facing documentation (what is stored, what is excluded, retention,
verification, pilot guidance) lives in
`docs/assisted-profile-rejected-proposal-capture.md`.

## Files

| File                                                   | Role                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `assisted-profile-proposal-anonymizer.ts`               | The whole anonymization policy. Pure, self-verifying.      |
| `assisted-profile-rejected-proposal-capture.service.ts` | The opt-in gate, fingerprint, expiry and capture audit.    |
| `assisted-profile-rejected-proposal.repository.ts`      | Internal persistence abstraction. No route ever exposes it.|
| `assisted-profile-rejected-proposal-retention.service.ts` | The purge job that enforces retention.                   |
| `assisted-profile-rejected-proposal.model.ts`           | The entity, with the last-line-of-defence insert guard.    |
| `assisted-profile-rejected-proposal.configuration.ts`   | Flag, retention and purge settings, default-off.           |

The table is created by `1784721600000-create_assisted_profile_schema`, the
single migration holding the whole Assisted Profile schema. The purge job's
scheduling comes from the shared `PeriodicSweep`, and the sample fingerprint
reuses the drafts' canonicalize-then-SHA-256 procedure
(`hashFirewallProfileDraftValue`), so neither is defined twice.

## Capture boundary

Only rejections *of the proposal's content* qualify, and only where a proposal
actually exists. `ASSISTED_PROFILE_REJECTION_CATEGORIES` is the authoritative
list:

| Category                   | Where it is raised                                  | Code stored                |
| -------------------------- | --------------------------------------------------- | -------------------------- |
| `contract_mismatch`        | `AssistantContractCustomsService.validate()` (API-1) | `malformed_payload`, `unknown_schema_version`, `schema_violation` |
| `mapping_failed`           | API-8 run loop, mapper/normalization failure         | `ASSISTED_PROFILE_MAPPING_FAILED` |
| `domain_validation_failed` | API-8 run loop, ReplicationProfile domain validator  | `ASSISTED_PROFILE_DOMAIN_VALIDATION_FAILED` |

Never captured: accepted proposals (they follow the normal draft lifecycle),
requests that fail before a proposal exists, agent connection failures, read
timeouts, a busy agent, queue saturation, duplicate generations, rate limiting,
authentication/authorization failures, outstanding or exhausted clarification
rounds, and everything else classified as an unexpected error.

Both integration points call capture **after** the client-visible outcome and
its audit record are decided, and both wrap the call so that not even an
unexpected throw can change that outcome.

## Anonymization policy — `rejected-proposal-anonymization.v1`

`ASSISTED_PROFILE_ANONYMIZATION_FIELD_RULES` maps every known contract path to
one rule. Array elements use a `[]` path segment. The version identifier is
stored with every sample: **changing what a rule means requires a new version**,
never a silent redefinition of an existing one.

| Rule            | Applied to                                                                                              | Result                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `preserve`      | `status`, `intent.detectedTarget`/`confidence`/`language`, `plan[].step`, `*.code`, `*.severity`, roles, `action`, `service`, `metadata.*`, `fwcloudPayload.operation`/`targetType` | verbatim **only** if the value passes every value-level check below |
| `text`          | `intent.summary`, `plan[].title`/`description`, `*.message`, all `description` fields, clarification questions and options | `<redacted-text>` (an explicit `null` stays `null`)                 |
| `resource`      | `generated.profile.code`/`name`, `generated.target.name`                                                 | `resource-N`                                                        |
| `iface`         | interface names and `interfaceRoles[].interfaceName`                                                     | `iface-N`                                                           |
| `node`          | node names, `interfaces[].node`, `nodeRoles[].nodeName`                                                  | `node-N`                                                            |
| `contract_path` | `errors[].field`                                                                                         | the canonical path if it names a real contract field, else `<redacted-value>` |
| `drop`          | the agent's own top-level `requestId`                                                                    | property removed                                                    |
| *(unlisted)*    | anything else, including all of `fwcloudPayload.payload`                                                 | default-deny — see below                                            |

### Value-level checks (they outrank the field name)

A field name never authorizes a value on its own. Every string that a rule would
otherwise keep also passes through, in order:

1. **Secret-like** — key matches the shared `isSecretLikeKey()` list plus
   `authorization`, `bearer`, `cookie`, `session`, connection strings, `jwt`,
   `signature`; or the *value* looks like a credential (`Bearer …`, `Basic …`,
   a PEM private key block, `password=…`, a URL with embedded credentials, a
   `sk-`/`ghp_`/`xoxb-` style token, a long base64/hex blob). A secret-like key
   redacts its **whole subtree**. Result: `<redacted-secret>`.
2. **Address** — IPv4, IPv6, CIDR or MAC. See the IP rule below.
3. **Structurally safe token** — `isStructurallySafeToken()`: at most 64
   characters, charset `[A-Za-z0-9._:+/-]` (so no whitespace and no `@`), not a
   URL, not a hostname/domain, not an address, not credential-shaped. Only these
   are kept verbatim.
4. Anything else becomes `<redacted-text>`.

### IP rule

Every address is replaced, RFC1918 included — private addressing is not treated
as automatically non-sensitive. Replacements come from documentation-only space
(RFC 5737 `198.51.100.0/24`, RFC 3849 `2001:db8::/32`, a locally administered
MAC prefix) and are allocated sequentially, so equal originals stay equal and
different originals stay different within one proposal. Prefix length is
preserved because it carries structure, not identity:

```text
192.168.73.12/24  →  198.51.100.1/24
10.20.30.40       →  198.51.100.2
2001:41d0:…::1/64 →  2001:db8::1/64
00:1B:44:11:3A:B7 →  02:00:00:00:00:01
```

Once the documentation pool is exhausted (254 distinct addresses), further
addresses become `<redacted-address>`.

### Stable replacement

Pseudonyms are stable per *(field class, original value)* inside one run, so the
relationships evaluation depends on survive: `interfaceRoles[].interfaceName`
still points at the same interface as `target.interfaces[].name`, and a node
still links its role assignment and its member interfaces. Keying by class as
well as by value keeps each prefix truthful and avoids inventing links between
unrelated fields that happen to share a label.

The lookup table lives inside the call and is discarded on return. **No
original-to-anonymized mapping is ever persisted**, so no substitution can be
reversed from stored data.

### Default-deny for unknown shapes

Anything outside the rule table — extra properties, arbitrary
`fwcloudPayload.payload` content, whatever a malformed payload contains — keeps
its structure but not its content: numbers, booleans and `null` survive, strings
become `<redacted-value>` unless they are exactly a contract enum literal
(`success`, `firewall`, `allow`, …), which is non-identifying by construction.
Object **keys** are content too, so a key that is not a safe token becomes
`key-N`. A payload that is not a JSON object at all is reduced to
`{ nonObjectPayload: true, valueType: … }`.

### Structural limits

Depth > 12, arrays > 200 items, objects > 200 keys, more than 5 000 values, and
anything that is not JSON data (functions, `Date`, `NaN`, class instances) fail
anonymization instead of being partially sanitized.

### Self-verification

`anonymize()` finishes by asserting its own output with
`assertAnonymizedProposalIsSafe()`: every string must be a placeholder, a
pseudonym, a documentation address, a contract field path, or a structurally
safe token, and no secret-like key may hold anything but `<redacted-secret>`.
The entity repeats the same assertion in `@BeforeInsert`/`@BeforeUpdate`, so a
payload that has not been through the anonymizer cannot reach the table even if
a future caller tries.

**A failed assertion means the sample is dropped.** Anonymization failure is
never a reason to store the original.

## Retention

`expires_at` is written at capture time as `capturedAt + retention_days` and is
the single definition of expiry (`now >= expires_at`, evaluated only in
`AssistedProfileRejectedProposalRepository.findExpired()`).
`PurgeAssistedProfileRejectedProposalsJob` physically deletes expired rows in
bounded batches, logs a count every sweep and writes one summarized audit event
per sweep that removed something — never one per sample, and never any content.
The job runs even while capture is disabled, so a finished pilot's samples still
age out.

## Not in scope here

No HTTP route exposes this table. Extracting the corpus for evaluation is a
separate design with its own authorization and privacy controls; this module is
persistence only.
