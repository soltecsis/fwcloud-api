# firewall-profile-draft — draft lifecycle, preview and integrity binding

An Assisted Profile draft is a generated firewall/cluster proposal waiting for a
human to approve it. Nothing it describes may reach a real firewall, cluster,
interface or rule until a person has reviewed it, so the draft carries its own
state machine, its own integrity hashes, and an audit trail for every move.

## Lifecycle

```text
                 ┌──────────────► discarded / expired
                 │
validated ──► preview_ok ──► apply_pending ──► applied
    ▲            │                   │
    └────────────┘                   └────────► apply_failed ──► apply_pending
  content changed
```

`FIREWALL_PROFILE_DRAFT_TRANSITIONS` in
`firewall-profile-draft-state.service.ts` is the only definition of what is
legal. Every move goes through `transition()`, which:

1. loads the draft scoped to its FWCloud and rejects unsupported contract
   versions before any write;
2. performs a single `UPDATE ... WHERE id = ? AND fwcloud_id = ? AND status = ?`
   — the expected-status predicate is the compare-and-set guard, so concurrent
   API processes cannot both win;
3. appends the step log, writes the `firewall-profile-draft.transition` audit
   row and returns the reloaded draft, all in one transaction;
4. on zero affected rows, reloads the authoritative state and throws
   `FirewallProfileDraftTransitionConflictError` (HTTP 409) carrying it.

## Hashes

Three columns, three different jobs. None of them is a credential.

| Column          | Covers                                    | Written by            |
| --------------- | ----------------------------------------- | --------------------- |
| `proposal_hash` | the proposal alone; enforces immutability | the entity, on insert |
| `preview_hash`  | everything a human reviewed               | the preview flow      |
| `apply_hash`    | the confirmed apply input (API-14)        | the apply flow        |

All three use `canonicalizeFirewallProfileDraftValue` from
`firewall-profile-draft.hash.ts` — the single canonicalization procedure:

- object keys are recursively sorted, so property insertion order (including
  whatever order a JSON column deserializes in) cannot change a hash;
- array order **is** significant, because it is significant in the proposal:
  interface and rule positions are addressable and assumption paths point at
  indexes;
- properties whose value is `undefined` are dropped while explicit `null` is
  kept, so an omitted optional field stays distinguishable from a null one;
- values are encoded as standard JSON and hashed as UTF-8 bytes with SHA-256,
  lower-case hex — nothing locale- or platform-dependent takes part.

### `preview_hash`

`FirewallProfileDraftPreviewHasher.calculatePreviewHash()` is the only producer.
Its input (`FirewallProfileDraftPreviewHashInput`) binds the preview contract
version, draft and FWCloud ids, the proposal contract version, `proposal_hash`,
the complete proposal, the mapped target kind, the domain-validator verdict and
the assumptions. It deliberately excludes every volatile field — timestamps,
`updated_at`, request ids, audit ids — so two previews of unchanged content
produce the same hash and any content change produces a different one.

`FIREWALL_PROFILE_DRAFT_PREVIEW_CONTRACT_VERSION` is the first field of that
input. Bump it whenever the bound field set or its meaning changes: doing so
invalidates every previously issued binding, which is the intent — a hash issued
under different rules must never be accepted as equivalent.

**API-14 must reuse this hasher and this input type as-is.** Recomputing a
preview hash by any other route would compare two different contracts.

### Preview invalidation

A preview binds content, so changing that content must retire it.
`updatePreviewBoundContent()` is the single supported way to modify
preview-bound content (`contract_version`, `assumptions`; the proposal itself is
immutable, guarded by the entity). It writes the content and the invalidation in
one guarded statement: a draft in `preview_ok` is walked back to `validated`
with `preview_hash` and `previewed_at` cleared, so it can never advertise a
review of content it no longer holds. A draft that was still `validated` simply
has any leftover hash cleared.

Never `UPDATE` these columns directly — that is exactly the state the invariant
exists to prevent.

## Assumptions

`assumptions` records every value the user did not ask for: what the API-9
mapper defaulted or normalized, plus what the agent itself flagged. It is
captured once, at generation time, because the mapped `ReplicationProfileStoreDto`
no longer distinguishes a defaulted value from a requested one — the information
is unrecoverable afterwards.

The preview flow therefore **replays** assumptions and never derives them. An
assumption a human acknowledged must be exactly the one that was recorded, so
malformed metadata is a rejection
(`FirewallProfileDraftPreviewAssumptionError`), never a silent drop. See
`../assistant-contract/assisted-profile-assumptions.ts` for the shape.

## Preview side-effect boundary

`FirewallProfileDraftPreviewService` may persist only: `preview_hash`,
`previewed_at`, the draft status transition, step-log entries and audit rows. It
holds no reference to any firewall, cluster, interface, rule or apply service —
the "no mutation before review" invariant is a property of its dependency list,
not of its control flow. Keep it that way.
