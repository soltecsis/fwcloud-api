# Assisted Profile — adoption and funnel metrics

> Operator reference for the pilot-adoption counters exposed by `fwcloud-api`
> (API-17). Everything here is aggregate and anonymous: these counters answer
> "is the feature being used", never "who used it".

---

## 1. Why it exists

Later Assisted Profile phases are gated on evidence that pilot users actually
use the feature. Without counters, questions such as *do users get from a
generated draft to an applied one?* can only be answered anecdotally or by
hand-scanning the audit log.

`fwcloud-api` owns the authoritative lifecycle transitions, so it is where the
funnel is instrumented:

```text
generation requested
    ↓
generation outcome ──► success | clarification | rejected | failed
    ↓
validated draft
    ↓
preview
    ↓
apply ──► applied | apply_failed

side exits from a validated / previewed draft: discarded, expired
```

## 2. Operator access

```http
GET /assisted-profile/metrics
```

* **Authentication:** a logged-in **administrator** (`isAdmin` route gate). A
  regular user, or a member of a single FWCloud, gets `401`.
* **Scope:** installation-wide. The route is deliberately not FWCloud-scoped —
  the funnel is a property of the deployment, and no counter carries a
  per-FWCloud dimension.
* **Deployment flag:** unlike the other Assisted Profile routes, this one is
  *not* hidden when `ASSISTED_PROFILE_ENABLED=false`. An operator closing a
  pilot still needs to read what the pilot produced, so the response reports
  `deployment_enabled` instead of returning `404`.
* **Side effects:** none. The read is not audited and mutates nothing.

### Response shape

```json
{
  "status": 200,
  "response": "OK",
  "data": {
    "deployment_enabled": true,
    "collection_started_at": "2026-08-18T09:12:44.118Z",
    "collected_at": "2026-08-18T14:03:02.551Z",
    "families": [
      {
        "name": "assisted_profile_generation_total",
        "type": "counter",
        "help": "Assisted Profile generation runs by terminal outcome and bounded reason class.",
        "label_names": ["outcome", "reason"],
        "samples": [
          { "labels": { "outcome": "success", "reason": "none" }, "value": 84 },
          { "labels": { "outcome": "rejected", "reason": "contract_mismatch" }, "value": 4 }
        ]
      }
    ]
  }
}
```

Every declared series is always present, including the ones still at `0`, so an
operator never has to distinguish "no events" from "series missing".

Read as the equivalent Prometheus exposition, the same data looks like:

```text
assisted_profile_generation_started_total{attempt="initial"} 96
assisted_profile_generation_total{outcome="success",reason="none"} 84
assisted_profile_generation_total{outcome="clarification",reason="none"} 12
assisted_profile_generation_total{outcome="rejected",reason="contract_mismatch"} 4
assisted_profile_generation_total{outcome="failed",reason="unavailable"} 7
assisted_profile_draft_validated_total 84
assisted_profile_preview_total 52
assisted_profile_apply_total{result="applied"} 31
assisted_profile_apply_total{result="apply_failed"} 3
assisted_profile_draft_discarded_total 10
assisted_profile_draft_expired_total 8
```

These values are illustrative only.

## 3. Observation window

Counters live in the API process's memory. They start at zero and **reset when
the process restarts**; there is no metrics table and no external telemetry
system. `collection_started_at` is therefore part of the reading: it says which
window the numbers describe. Compare two reads within one window, and treat a
`collection_started_at` that moved as a new window rather than as a drop.

In a multi-process or multi-instance deployment each process keeps its own
counters, so a reading describes the process that served the request.

## 4. The counters

| Metric | Labels | Increments when |
| --- | --- | --- |
| `assisted_profile_generation_started_total` | `attempt` | A generation request passes admission and enters the pipeline. |
| `assisted_profile_generation_total` | `outcome`, `reason` | One generation run reaches a terminal outcome. |
| `assisted_profile_draft_validated_total` | — | A draft row is persisted in `validated`. |
| `assisted_profile_preview_total` | — | A `validated -> preview_ok` transition commits. |
| `assisted_profile_preview_failed_total` | `reason` | A preview attempt is rejected. |
| `assisted_profile_apply_total` | `result` | A terminal apply transition commits. |
| `assisted_profile_draft_discarded_total` | — | A `-> discarded` transition commits. |
| `assisted_profile_draft_expired_total` | — | A `-> expired` transition commits. |

### `assisted_profile_generation_started_total`

The funnel's entry count.

| `attempt` | Meaning |
| --- | --- |
| `initial` | A new generation request. **This is the funnel entry count.** |
| `clarification_answer` | The user answered a clarification, re-entering the same `generation_id`. |

Requests rejected *before* admission — the per-user rate limit, the 2 KB
instruction limit, authorization, an unknown clarification reference — never
entered the pipeline and are not counted here. They remain visible in the audit
log.

### `assisted_profile_generation_total`

One increment per generation *run*. A generation that asks for clarification and
is then answered produces two runs, and therefore two increments: one
`clarification` and one for whatever the answered run concluded. This is
deliberate — making the outcomes mutually exclusive would lose either the
clarification event or the eventual success.

| `outcome` | `reason` | Meaning |
| --- | --- | --- |
| `success` | `none` | The run produced a persisted, validated draft. |
| `clarification` | `none` | A clarification question was actually emitted to the user. |
| `rejected` | see below | The agent answered and the answer failed a validation gate. |
| `failed` | see below | No proposal could be judged: infrastructure, transport or admission. |

**Rejection reasons** (`outcome="rejected"`):

| `reason` | Boundary that rejected it |
| --- | --- |
| `contract_mismatch` | API-1 schema customs rejected the agent payload. |
| `mapping_failed` | The payload passed customs but API-9's mapper could not normalize it (this also covers an agent-declared `validation_failed` or an unexpected `status`). |
| `domain_validation` | The mapped proposal failed the ReplicationProfile domain validator. |
| `clarification_limit` | Still incomplete after the single allowed clarification round. |

**Failure reasons** (`outcome="failed"`):

| `reason` | Cause |
| --- | --- |
| `unavailable` | The agent could not be reached (connection or TLS establishment). |
| `saturated` | Local generation-queue saturation, or the agent reported itself busy. |
| `timeout` | The agent did not answer within the read timeout. |
| `authentication_failed` | The agent rejected the request credentials. |
| `duplicate_in_progress` | A generation was already running for that user and FWCloud. |
| `transport_error` | Any other classified agent-client failure. |
| `internal_error` | An unclassified error inside the generation pipeline. |

The classification comes from `AssistedProfileGenerationService.classifyFailure()`,
which decides the Channel error code, the audit outcome and the metric class in
one place, so the audit trail and the metrics can never describe the same error
differently. **A backend error message is never used as a label.**

### `assisted_profile_draft_validated_total`

Incremented by `FirewallProfileDraftStateService.create()`, immediately after the
row is inserted — the actual persistence event, not "generation reached the
persistence stage". Reading a draft afterwards does not move it, and neither
does preview invalidation walking a draft back from `preview_ok` to `validated`.

### `assisted_profile_preview_total` / `assisted_profile_preview_failed_total`

The successful counter tracks committed `validated -> preview_ok` transitions
only. Rejected attempts are kept out of it entirely and land in the separate
failure counter instead, so the adoption number is never inflated by retries:

| `reason` | Meaning | HTTP |
| --- | --- | --- |
| `illegal_state` | The draft was not in `validated`. | 409 |
| `domain_validation_failed` | The stored proposal failed the domain validator. | 422 |
| `hash_generation_failed` | The preview hash could not be calculated. | 500 |
| `transition_conflict` | A concurrent transition won the compare-and-set guard. | 409 |

### `assisted_profile_apply_total`

| `result` | Meaning |
| --- | --- |
| `applied` | The `apply_pending -> applied` transition committed. |
| `apply_failed` | The `apply_pending -> apply_failed` transition committed. |

The intermediate `preview_ok -> apply_pending` step is not counted; its outcome
is. An apply rejected before it starts (`409` on a stale `preview_hash`, a draft
not in `preview_ok`, a missing `Idempotency-Key`) moves neither series.

**Idempotency:** a repeated request carrying the same `Idempotency-Key` and
payload is served from API-13's cache and never reaches the apply service, so it
adds `0`. The counter measures real product events, not HTTP deliveries.

### `assisted_profile_draft_discarded_total` / `assisted_profile_draft_expired_total`

Committed `-> discarded` and `-> expired` transitions. Both target states are
terminal in the state machine, so a repeated discard request or a later
expiration sweep observing an already-expired draft is refused as a conflict and
counts nothing.

## 5. Where the increments happen

Metrics are emitted where the backend already knows the event occurred, never on
request receipt:

| Event | Emitted from |
| --- | --- |
| Generation admitted, outcome, clarification | `AssistedProfileGenerationService` |
| Validated draft persisted | `FirewallProfileDraftStateService.create()` |
| Preview, apply, discard, expiration | `FirewallProfileDraftStateService.transition()`, after the transaction commits |
| Preview failure classes | `FirewallProfileDraftPreviewService` |

Because the lifecycle counters hang off the committed compare-and-set
transition, a conflicting, retried or failed request is structurally unable to
increment them — it throws before reaching that point.

Every increment goes through `AssistedProfileMetricsService`; no controller,
service or job names a raw metric string.

## 6. Privacy

No counter, label name or label value carries:

* a natural-language instruction, or any part of one;
* a proposal body or an assumption text;
* a firewall, cluster, interface, FWCloud or profile name;
* a hostname, IP address, email address or username;
* a user, draft, generation, target, FWCloud or request identifier;
* a raw backend error message;
* a raw `Idempotency-Key` or confirmation token.

Every label value is a lower-case identifier drawn from the enumerated lists in
`src/models/assisted-profile-metrics/assisted-profile-metrics.types.ts`, and the
automated tests assert that shape (`^[a-z][a-z0-9_]*$`) against the live
endpoint after driving deliberately identifiable data through the funnel.

Traceability of an individual operation is the **audit log**'s job, not this
endpoint's. The two are separate on purpose: the audit trail may hold
identifiers because it is access-controlled and retained deliberately; these
counters must stay safe to aggregate, so identifiers are never added to them
merely because they exist elsewhere.

## 7. Cardinality

The series set is closed by construction. `CounterRegistry` materializes every
declared series at zero when the process starts and **cannot create another
one**: an increment naming an undeclared series is dropped rather than added,
and rather than throwing. Adding a dimension is a deliberate edit to
`ASSISTED_PROFILE_COUNTER_DECLARATIONS` (and, for the generation family, to the
`GENERATION_REASONS_BY_OUTCOME` table the outcome/reason pairs above are
generated from), reviewable alongside this document.

The complete label vocabulary is `attempt`, `outcome`, `reason` and `result`.
No high-cardinality identifier (`draft_id`, `generation_id`, `user_id`,
`fwcloud_id`, `target_id`, `request_id`) is used anywhere.

## 8. Failure isolation

Observability is never load-bearing. Every `record*` method swallows and logs
whatever the registry could raise, and is called only after the business
transaction has already been decided. A metrics failure cannot turn a successful
apply into a `500`; at worst a counter under-reports and a warning appears in
the application log.

## 9. Deriving pilot indicators

The endpoint exposes raw counters only — no dashboards, no scoring. From one
observation window an operator can compute, for example:

```text
generation → validated draft   = draft_validated_total / generation_started_total{attempt="initial"}
validated draft → preview      = preview_total / draft_validated_total
preview → applied              = apply_total{result="applied"} / preview_total
discard rate                   = draft_discarded_total / draft_validated_total
expiration rate                = draft_expired_total / draft_validated_total
apply failure rate             = apply_total{result="apply_failed"} / (applied + apply_failed)
clarification frequency        = generation_total{outcome="clarification"} / generation_started_total{attempt="initial"}
rejection distribution         = generation_total{outcome="rejected"} split by reason
```

Because the funnel stages are counted at different lifecycle points, a ratio
computed near the start of a window can exceed or undershoot its steady-state
value — drafts previewed in this window may have been generated in the previous
one. Compare over a window long relative to the draft TTL.

## 10. Relationship with API-16

API-16 (opt-in anonymized rejected-proposal capture) and these counters are
independent. With capture disabled — the default — nothing is persisted, but
`assisted_profile_generation_total{outcome="rejected"}` still increments with its
bounded reason: adoption metrics need no proposal content at all.

## 11. Known limitations

* **Not durable.** Counters reset on restart; see §3. Read them within one
  observation window.
* **Per process.** A multi-instance deployment reports per-instance numbers.
* **No target dimension.** Preview and apply are not split by
  `target_kind` (firewall vs cluster). It was left out to keep the label
  surface minimal; the audit log carries the target for any deeper analysis.
* **Counters, not durations.** No latency or model-quality measurement is in
  scope here (that is AG-7's).
* **Runs, not generations.** `assisted_profile_generation_total` counts runs, so
  a clarified generation contributes two increments. Use
  `assisted_profile_generation_started_total{attempt="initial"}` as the
  denominator for per-generation ratios.
