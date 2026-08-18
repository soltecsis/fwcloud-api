# assisted-profile-metrics — pilot adoption and funnel counters

Aggregate, anonymous counters for the whole Assisted Profile funnel (API-17), so
later phase gates can rest on measurable usage instead of anecdote.

```text
generation admitted            ── generation_started_total{attempt}
    ↓
generation run outcome         ── generation_total{outcome,reason}
    ↓  (success)
draft persisted as validated   ── draft_validated_total
    ↓
validated -> preview_ok        ── preview_total  /  preview_failed_total{reason}
    ↓
apply_pending -> applied
                 apply_failed  ── apply_total{result}

side exits: -> discarded       ── draft_discarded_total
            -> expired         ── draft_expired_total
```

Operator-facing documentation — every counter, when it increments, allowed label
values, the classification tables, privacy and cardinality guarantees, the
`GET /assisted-profile/metrics` endpoint and the ratios a pilot review wants —
lives in `docs/assisted-profile-adoption-metrics.md`.

## Files

| File | Role |
| --- | --- |
| `assisted-profile-metrics.types.ts` | The closed vocabulary and the exhaustive series list. The cardinality contract. |
| `counter-registry.ts` | A closed in-process counter store. Cannot create an undeclared series. |
| `assisted-profile-metrics.service.ts` | The single instrumentation abstraction, plus the recorder interface and its no-op. |
| `assisted-profile-metrics.provider.ts` | Registers the process-local singleton. |

## Three invariants

1. **Authoritative.** Callers record at the point the backend already knows the
   event happened — after a guarded transition committed, after a row was
   inserted — never on request receipt. Retries, conflicts, rejected requests
   and API-13 idempotency replays cannot inflate adoption data because none of
   them reach those points.
2. **Bounded and anonymous.** Every argument is a closed union, and
   `CounterRegistry` materializes the declared series at zero and refuses to
   create any other. No method accepts free text, an identifier or an error
   object, so no caller can widen cardinality or leak content.
3. **Never load-bearing.** Every `record*` method swallows and logs whatever the
   registry could raise, including when there is no application logger to raise
   it to. A metrics failure must never turn a successful apply into a `500`.

## Where the increments live

Instrumentation is deliberately concentrated at chokepoints rather than spread
across controllers:

| Event | Call site |
| --- | --- |
| Admitted generation, outcome, clarification | `AssistedProfileGenerationService` |
| Validated draft persisted | `FirewallProfileDraftStateService.create()` |
| Preview, apply, discard, expiration | `FirewallProfileDraftStateService.transition()`, after commit |
| Preview failure classes | `FirewallProfileDraftPreviewService` |

`ADOPTION_EVENT_BY_STATUS` in the state service maps an arrived-at status to the
counter it stands for; statuses absent from it (`validated`, `apply_pending`)
are deliberately not adoption events. The generation taxonomy is decided once,
in `classifyFailure()`, together with the Channel error code and the audit
outcome, so the audit trail and the metrics cannot describe the same failure
differently.

## Relationship with audit

Different jobs. `AuditLog` traces individual operations and may hold identifiers
because it is access-controlled and deliberately retained. These counters answer
aggregate questions and must stay safe to aggregate, so an identifier is never
added to them merely because it already exists in audit.
