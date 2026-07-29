# assistant-contract — schema customs gate [D8][D16b]

fwcloud-api never trusts the shape of a response from the assistant agent
(fwcloud-ai-agent), which is untrusted and stateless. Before any payload it
sends is touched, it must pass through `AssistantContractCustomsService`,
which validates it against the vendored `apg.mvp.v1` JSON Schema.

## What lives here

See each file's own docstring for behavior detail; in short:

- `schemas/apg.mvp.v1.schema.json` — vendored copy of the AG-1 artifact.
  Byte-for-byte identical to the source; never hand-edited.
- `schemas/manifest.ts` — provenance + the ordered version list (see
  `VendoredContractSchema`).
- `assistant-contract-customs.ts` — the pure validator (`AssistantContractCustoms`).
- `assistant-contract-customs.service.ts` — the DI wrapper
  (`AssistantContractCustomsService`) that adds audit-on-rejection.

## N / N-1 compatibility window [D16b]

The two repositories (fwcloud-ai-agent, fwcloud-api) are not deployed
atomically, so during a rollout the gate must accept both the current
contract version and the immediately previous one. `AssistantContractCustoms`
derives that window mechanically from `VENDORED_CONTRACT_SCHEMAS` (last two
entries, oldest -> newest); see its constructor for the exact rule.

## Updating the vendored schema (when AG-1 ships a new version)

1. In `fwcloud-ai-agent`, regenerate the schema (`python -m
   scripts.generate_contract_schema`) and confirm CI published the versioned
   artifact for the target commit.
2. Copy the generated file verbatim into
   `src/models/assistant-contract/schemas/<contractVersion>.schema.json`
   here. Do not reformat or hand-edit it.
3. Append (do not replace) a new entry to `VENDORED_CONTRACT_SCHEMAS` in
   `schemas/manifest.ts`, with the new file's `sha256` (`sha256sum <file>`),
   the `sourceCommit` of fwcloud-ai-agent HEAD at copy time, and today's date.
   Keep the array ordered oldest -> newest — the gate always derives N/N-1
   from the last two entries.
4. Add fixtures for the new schema version under
   `tests/Unit/models/assistant-contract/fixtures/` and extend the mocha
   suite to cover it.
5. Once the new version is confirmed live and no draft still references the
   version that is about to fall out of the N/N-1 window, its entry may be
   removed from the manifest — see the mapper retention rule below first.

## Mapper retention rule

The proposal -> `ReplicationProfileStoreDto` mapper (issue API-9) is keyed on
`contract_version`/`schemaVersion`. **A mapper for a given schema version must
not be retired while any live `FirewallProfileDraft` still carries that
version** (persisted drafts have an inactivity TTL, so the retention window is
bounded). Concretely: do not drop a manifest entry, and do not delete the
corresponding mapper branch, until the TTL has had time to expire every draft
that could have been created against it.

The TTL is enforced by `ExpireFirewallProfileDraftsJob`
(`src/models/firewall-profile-draft/firewall-profile-draft-expiration.service.ts`),
configured via `assisted_profile.draft.ttl_seconds`
(`ASSISTED_PROFILE_DRAFT_TTL_SECONDS`, default 604800 = 7 days) and swept on
`assisted_profile.draft.expiration_job.interval_seconds`
(`ASSISTED_PROFILE_DRAFT_EXPIRATION_JOB_INTERVAL_SECONDS`, default 3600 = 1
hour). The safe grace period before retiring a mapper is therefore at least
`ttl_seconds + expiration_job.interval_seconds`, plus margin for:

- drafts sitting in `apply_pending` — the job deliberately never expires
  those (an apply may still be in progress); they only leave that state via a
  normal `applied`/`apply_failed` transition, handled by a future stuck-apply
  reconciliation job, not this one;
- **do not remove a manifest entry while any non-expired draft still
  references it, even after its TTL has nominally elapsed.**
  `FirewallProfileDraftStateService.loadForProcessing()` — which
  `transition()` calls internally, including from the expiration job itself —
  rejects any draft whose `contract_version` is not in
  `getSupportedContractSchemas()` with
  `UnsupportedFirewallProfileDraftContractVersionError` *before* the CAS
  update runs. If a mapper is retired first, the expiration job can no longer
  transition that draft's leftover rows to `expired` at all — it will report
  them as `failed` on every sweep instead. Retire mappers only after
  confirming (e.g. via the job's `failed`/`expired` counts, or a direct query)
  that no non-terminal draft still carries the version being dropped.
