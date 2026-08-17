# Assisted Profile — anonymized rejected-proposal capture

> **Pilot opt-in, disabled by default.** Enabling this makes `fwcloud-api`
> store a sanitized copy of model output that failed validation. Turn it on
> deliberately, for a bounded pilot, only when production rejection data is
> actually needed — and turn it off again when the pilot ends.

---

## 1. Why it exists

When Assisted Profile validation rejects a proposal, no `FirewallProfileDraft`
is created and the proposal disappears with the request. Correct for production,
but it also means there is no production-derived corpus for later evaluation of:

- recurring model mistakes;
- contract-generation regressions;
- normalization (mapper) failures;
- domain-validation failure patterns;
- whether a future prompt or model change actually improves anything.

Capturing every rejection by default would be an unnecessary privacy and
retention liability, so capture is an explicit opt-in that stores only an
anonymized representation with minimal metadata.

## 2. Default

```env
ASSISTED_PROFILE_CAPTURE_REJECTED_PROPOSALS=false
```

**Disabled.** An absent setting behaves exactly as `false`. While disabled the
persistence layer is never invoked — a rejected proposal is discarded exactly as
it was before this feature existed, and the anonymizer does not even run.

Enabling it requires an `fwcloud-api` restart: it is deployment-time
configuration, not a runtime toggle.

## 3. Configuration

| Variable                                                   | Default | Meaning                                                                  |
| ---------------------------------------------------------- | ------- | ------------------------------------------------------------------------ |
| `ASSISTED_PROFILE_CAPTURE_REJECTED_PROPOSALS`               | `false` | The opt-in capture flag.                                                 |
| `ASSISTED_PROFILE_REJECTED_PROPOSAL_RETENTION_DAYS`         | `14`    | Retention window written into each sample as its expiration. Max `90`.   |
| `ASSISTED_PROFILE_REJECTED_PROPOSAL_PURGE_JOB_ENABLED`      | `true`  | The job that physically deletes expired samples.                         |
| `ASSISTED_PROFILE_REJECTED_PROPOSAL_PURGE_INTERVAL_SECONDS` | `3600`  | Delay between the end of one purge sweep and the start of the next.      |
| `ASSISTED_PROFILE_REJECTED_PROPOSAL_PURGE_BATCH_SIZE`       | `500`   | Samples deleted per batch (at most 10 batches per sweep).                |

The pilot's retention value must be chosen and written down **before** capture
is switched on. Retention is never unlimited: the configuration refuses a value
above 90 days, and refuses zero, negative or fractional values.

## 4. What is captured, and when

Only rejections *of the proposal's content*, and only where a proposal actually
exists:

| Rejection category         | Meaning                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `contract_mismatch`        | API-1 schema customs rejected the agent payload (`malformed_payload`, `unknown_schema_version`, `schema_violation`). |
| `mapping_failed`           | The payload crossed the contract gate but could not be normalized into the FWCloud domain model. |
| `domain_validation_failed` | The mapped proposal was rejected by the FWCloud domain validator. |

**Never captured:**

- accepted proposals — they follow the normal draft lifecycle and are explicitly
  outside this dataset;
- requests that fail before a proposal exists;
- agent unavailable, connection failure, TLS failure or read timeout;
- a busy agent, a saturated queue or a duplicate generation;
- authentication/authorization failures and rate-limited requests;
- generations still awaiting (or having exhausted) a clarification round;
- anything at all while the flag is disabled.

Capture always runs **after** the rejection and its audit record have been
decided, and can never change them (§8).

## 5. Data captured

One row per captured rejection, in `assisted_profile_rejected_proposal`:

| Column                  | Content                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `id`                    | Surrogate key.                                                          |
| `rejection_category`    | One of the three categories above.                                      |
| `rejection_code`        | The taxonomy code behind it, e.g. `schema_violation`.                   |
| `contract_version`      | Contract/schema version involved.                                       |
| `anonymized_proposal`   | The anonymizer's output — **the only representation that exists**.      |
| `anonymization_version` | The rule version that produced it, e.g. `rejected-proposal-anonymization.v1`. |
| `proposal_fingerprint`  | SHA-256 of the canonicalized **anonymized** payload, to spot repeats.   |
| `request_id`            | `fwcloud-api`'s own generated request UUID (never a client-supplied value). |
| `captured_at`           | Capture timestamp.                                                      |
| `expires_at`            | `captured_at + retention days`.                                         |

## 6. Data excluded

Never stored by this feature:

- the raw rejected proposal (there is no column for it, and none may be added);
- the user's natural-language instruction, original or clarified;
- user id, user name, e-mail, source IP, session id, any authentication data;
- FWCloud id or name, firewall or cluster hostname;
- raw request headers or raw audit payloads;
- any original-to-anonymized mapping.

The table has no foreign key to `fwcloud` or `user` — a sample deliberately
cannot be attributed to who or which FWCloud produced it. If a future field is
ever considered necessary, its privacy rationale must be documented before it is
added.

## 7. Anonymization

Rule version: **`rejected-proposal-anonymization.v1`**, stored with every
sample. Changing what any rule *means* produces a new version; an existing
version always describes exactly the transformations that produced the samples
already stored under it.

Summary of the transformations (the complete, authoritative policy — including
the field-by-field table — is in
`src/models/assisted-profile-rejected-proposal/README.md`):

- **Free text** (summaries, plan steps, descriptions, error/warning messages,
  clarification questions and their options) is **removed**, replaced by
  `<redacted-text>`. It is never "sanitized in place".
- **Names** (target, profile, interfaces, nodes) are **replaced** by stable
  pseudonyms — `resource-1`, `iface-2`, `node-3` — so relationships between
  them stay analyzable while the labels do not exist. The lookup table lives
  only inside the call and is never persisted.
- **IP addresses, networks and MAC addresses** are **generalized** into
  documentation-only ranges (RFC 5737 / RFC 3849), preserving prefix length and
  which addresses were equal. RFC1918 addresses are **not** treated as
  non-sensitive; they are replaced like any other.
- **Hostnames, domains, e-mail addresses and URLs** are removed wherever they
  appear, including in fields the policy would otherwise keep — a field name
  never authorizes a value on its own.
- **Secret-like values** (passwords, API keys, tokens, bearer/basic headers,
  private keys, connection strings, credentials embedded in text) are removed,
  by key *and* by value shape. A secret-like key removes its whole subtree.
- **Structurally safe values are preserved**: status, target kind, roles, rule
  actions, service tokens, severities, error codes, schema/contract versions,
  confidences, counts and array shapes. That is what keeps a sample useful for
  evaluation.
- **Anything the policy does not know** — unexpected properties, arbitrary
  `fwcloudPayload.payload` content, whatever a malformed payload holds — keeps
  its structure but not its content: strings are redacted unless they are
  exactly a contract enum literal, and object keys that are not safe tokens
  become `key-N`.

The privacy rule always takes precedence over evaluation convenience.

## 8. Failure behaviour

Capture is secondary to the request that produced the rejection, always:

- if anonymization fails, **nothing is persisted** — there is no fallback to
  storing the raw proposal;
- if persistence fails, the validation rejection the client already earned is
  returned unchanged; a contract or domain validation error is never turned into
  an unrelated server failure because optional capture failed;
- failures are logged as
  `Assisted Profile rejected proposal capture failed during <stage> …` with
  non-sensitive diagnostics only (stage, category, error identity) — never the
  payload.

## 9. Retention and purge

Every sample gets `expires_at` at capture time. Expiry means exactly
`now >= expires_at`, evaluated in one place.

`PurgeAssistedProfileRejectedProposalsJob` starts with the application and, once
per `..._PURGE_INTERVAL_SECONDS`, physically deletes expired samples in bounded
batches, leaving non-expired ones untouched. It runs **even while capture is
disabled**, so samples from a finished pilot still age out.

Retention correctness does not depend on anyone running SQL by hand.

### Verifying it runs

Every sweep logs, whether or not it removed anything:

```text
Assisted Profile expired rejected proposals purged: count=N (scanned=N, batches=1).
```

A sweep that actually removed samples also writes one **summarized** audit
event, `CRON assisted-profile.rejected-proposal.purge`, with counts, the
configured retention and a job run id — never one entry per sample, and never
any sample content.

### Triggering it in development or testing

`PurgeAssistedProfileRejectedProposalsJob.run()` performs exactly one sweep and
returns its statistics (`scanned`, `purged`, `batches`, `jobRunId`). It ignores
both the schedule and the enabled flag, which is how the automated tests assert
the retention boundary and the purge itself.

## 10. Auditing and observability

- **Feature enablement.** The flag is deployment-time environment
  configuration, so the application cannot observe *who* changed it and no
  user-attributed audit event is fabricated. Instead, every startup records the
  state:

  ```text
  Assisted Profile rejected-proposal capture: disabled.
  Assisted Profile rejected-proposal capture: enabled. Anonymized samples of rejected proposals will be retained for N day(s).
  ```

  (The enabled line is logged at warning level, so an accidentally enabled pilot
  is visible in normal operation.)

- **Capture usage.** Each stored sample writes an
  `assistant.rejected-proposal.capture` audit event carrying the capture id,
  rejection category and code, contract version, anonymization version,
  fingerprint, request id, retention and expiration — plus per-rule redaction
  *counts*. It carries no proposal body, anonymized or otherwise, no
  instruction, no PII and no credentials.

- **Purge.** See §9.

## 11. Access to the corpus

There is deliberately **no API** for browsing, exporting or analyzing captured
samples: the repository is an internal persistence abstraction and no route
exposes it. Production corpus extraction must be designed separately, with its
own authorization and privacy controls.

## 12. Pilot checklist

1. Confirm the pilot actually needs production rejection data.
2. Choose and document the retention window; set
   `ASSISTED_PROFILE_REJECTED_PROPOSAL_RETENTION_DAYS`.
3. Set `ASSISTED_PROFILE_CAPTURE_REJECTED_PROPOSALS=true` and restart
   `fwcloud-api`.
4. Confirm the startup log line reports capture as enabled.
5. Keep the purge job enabled and confirm its sweep log appears.
6. When the pilot ends, set the flag back to `false` and restart. Already
   captured samples keep aging out on their own; deleting them earlier is a
   plain `DELETE` on `assisted_profile_rejected_proposal`.
