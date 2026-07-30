# assistant-agent — transport, queue, and health

fwcloud-api's process-local boundary with the untrusted, stateless
fwcloud-ai-agent service. Generation traffic (`AgentHttpClient.generate` /
`GenerationQueue`) and health traffic (`AgentHttpClient.getHealth` /
`AssistedProfileHealthService`) are deliberately separate paths: a health
probe never goes through the API-1 contract gateway, and generation never
goes through the health poller.

## Health polling (`AssistedProfileHealthService`)

fwcloud-api periodically polls the agent's AG-3 health endpoint and keeps a
single in-memory snapshot describing whether the Assisted Profile feature can
currently accept work. The UI reads this snapshot through
`GET /fwclouds/:fwcloud/assistant/availability` instead of guessing from a
failed generation.

### Agent contract

```
GET <agent base URL><path>        # path defaults to /health
```

Expected response:

```json
{ "alive": true, "busy": false, "model": { "ready": true } }
```

`AgentHttpClient.getHealth()` is the only thing that ever calls this
endpoint. It never runs the response through `AssistantContractCustomsService`
— an AG-3 health payload is not an `apg.mvp.v1` proposal — and it never
retries: a failed health check just waits for the next scheduled poll.

### Configuration

| Env var | Config key | Default | Meaning |
| --- | --- | --- | --- |
| `ASSISTED_PROFILE_HEALTH_POLL_ENABLED` | `assisted_profile.health.poll_enabled` | `true` | Master on/off switch for the poller. |
| `ASSISTED_PROFILE_HEALTH_POLL_INTERVAL_MS` | `assisted_profile.health.poll_interval_ms` | `30000` | Delay between the end of one check and the start of the next (not a fixed-rate tick — see below). |
| `ASSISTED_PROFILE_HEALTH_TIMEOUT_MS` | `assisted_profile.health.timeout_ms` | `5000` | Connect+read timeout for a single health request. |
| `ASSISTED_PROFILE_HEALTH_PATH` | `assisted_profile.health.path` | `/health` | Path appended to the agent base URL (`ASSISTED_PROFILE_AGENT_URL`). |

`resolveAssistedProfileHealthConfiguration()` rejects non-integer, zero, or
negative intervals/timeouts, unsupported boolean spellings, and a path that
doesn't start with `/`. There is no separate failure/success debounce
threshold: the snapshot flips on the very next check result, in both
directions. If a threshold is ever added, it must be validated and tested the
same way and documented here.

### Derived availability

The global deployment opt-in (`assisted_profile.enabled` /
`ASSISTED_PROFILE_ENABLED`, see `assisted-profile-deployment.config.ts`) is
composed with the runtime snapshot above at the controller, not inside this
service: when the flag is off, `AssistantAvailabilityController` returns a
fixed `deploymentEnabled: false, status: 'disabled'` payload without ever
resolving `AssistedProfileHealthService`, and `start()` becomes a no-op (see
"Scheduling and overlap" below). When the flag is on, the rules below apply
as before, with `deploymentEnabled: true` added to the response.

```
alive && model.ready         -> available
!alive                       -> unavailable (status: unavailable)
alive && !model.ready        -> unavailable, failureCode: model_not_ready
alive && model.ready && busy -> available, status: busy (busy is informational,
                                  not a reason to hide the feature)
```

A transport/parse/shape failure (`AgentHealthCheckError`) always yields
`available: false`, `alive: false`, `modelReady: false`, `status:
unavailable`, with `failureCode` one of `connection_error`, `timeout`, or
`invalid_response` — never a raw exception message, response body, or the
agent URL/API key.

Before the very first check completes, the snapshot is the same
`unavailable` shape with no `lastCheckedAt`/`lastSuccessfulCheckAt` — the API
never optimistically reports the Assistant as available.

### Scheduling and overlap

`start()` runs the first check immediately (not after waiting a full
interval) and reschedules the next one only after the current one's promise
settles — success or failure. This means the interval is a *gap between*
checks, not a fixed-rate timer, which makes "never run two health requests at
once" true by construction rather than by a separate lock. `checkNow()` is
additionally single-flight: concurrent callers (the scheduler and, e.g., a
manual trigger) observe the same in-flight result instead of firing a second
request. `stop()`/`close()` clear the pending timer so tests and shutdown
never leave a dangling `setTimeout` (it is also `.unref()`'d, so it can never
by itself keep the process alive).

An unconfigured or unreachable agent (for example a deployment without
`ASSISTED_PROFILE_AGENT_URL`) does not crash startup or stop the loop: every
failure — including "the agent isn't configured at all" — is caught inside
one poll and turned into the same `unavailable`/`connection_error` snapshot.

`start()` additionally no-ops when the global deployment flag
(`assisted_profile.enabled`) is off, in addition to its existing
`poll_enabled` check — both are read once, at `build()` time, via
`configurationFromApplication()`. Flipping the flag at runtime (e.g. in a
test via `app.config.set('assisted_profile.enabled', ...)`) does not
retroactively start/stop an already-built service; a real deployment picks up
a flag change on the next process restart, same as `poll_enabled`.

### Logging vs. metrics

The observer (`AssistedProfileHealthObserver`) receives one observation per
check, always, with `durationMs`/`outcome`/`transitioned` — that's the hook
for success/failure counters and gauges. The default logger built on top of
it only writes a line when `transitioned` is true, so a down (or up) agent
produces one log line, not one every `poll_interval_ms`.

### Audit exclusion

Health polling never touches `AuditLogService`/`AuditEventService`. There is
no code path from `AgentHttpClient.getHealth()` or
`AssistedProfileHealthService` into the audit log, so this holds by
construction rather than by a feature flag. The UI-facing
`GET .../assistant/availability` route is exempt from the mutating-route audit
manifest (`tests/Unit/fonaments/http/router/audit-expectations.ts`) the same
way every other `GET` route is: `AuditLogMiddleware` never persists `GET`
requests.

### UI-facing endpoint

```
GET /fwclouds/:fwcloud/assistant/availability
```

Authorization follows `FwCloudPolicy.userCanAccessFwCloud`, same as the
sibling drafts/profiles routes under `/fwclouds/:fwcloud/assistant/*`. The
snapshot itself is process-global (there is one poller and one agent per
`fwcloud-api` process), so the `:fwcloud` scoping exists only to reuse the
existing FWCloud-membership check — it is not evidence that availability
could ever differ per FWCloud. The response is intentionally narrower than
the internal snapshot:

```json
{
  "deploymentEnabled": true,
  "available": true,
  "busy": false,
  "alive": true,
  "modelReady": true,
  "status": "ready",
  "lastCheckedAt": "2026-07-24T09:30:00.000Z"
}
```

When `deploymentEnabled` is `false`, every other field is fixed
(`available/busy/alive/modelReady: false`, `status: "disabled"`,
`lastCheckedAt: null`) regardless of any runtime health state — see
`assisted-profile-deployment.config.ts` and
`docs/assisted-profile-pilot-deployment.md` at the repo root for the full
deployment-flag contract, including route gating for `/assistant/drafts`.

`failureCode` and `lastSuccessfulCheckAt` stay internal; the agent URL, API
key, TLS configuration, and any raw upstream error never leave
`AgentHttpClient`/`AssistedProfileHealthService`.

The global deployment opt-in flag is a product/deployment switch;
`deploymentEnabled: true` plus a live health snapshot is a runtime signal.
Neither should be inferred from the other — that's why they're both present
in every response instead of collapsing to one boolean.
