# Assisted Profile — pilot deployment

> **Pilot / experimental.** This document and the Compose stack it describes
> (`deploy/assisted-profile/`) are **not the standard FWCloud installer**.
> They exist to let an operator reproducibly evaluate the Assisted Profile
> feature — natural-language instruction → firewall profile draft, backed by
> `fwcloud-ai-agent` and Ollama — in a controlled environment. Do not use
> this as a template for the rest of FWCloud's deployment, and do not expose
> it beyond a trusted operator's own host without re-reading the "TLS" and
> "IP allowlist" sections below.

The feature is disabled by default in `fwcloud-api` (`ASSISTED_PROFILE_ENABLED=false`).
Nothing in this document changes that default on its own — enabling it is a
deliberate, separate step (§8).

---

## 1. Prerequisites

- Docker Engine with the Compose v2 plugin (`docker compose version` ≥ `v2.20`).
  The Compose file uses the long-form `depends_on: condition: service_healthy
  / service_completed_successfully` syntax, which the legacy standalone
  `docker-compose` v1 binary does not support.
- A built, versioned `fwcloud-ai-agent` image (AG-6 output). This pilot does
  not build that image — see `fwcloud-ai-agent/scripts/build-image.sh` in
  that repo.
- Hardware sized for the pinned model (from that image's own
  `config/models/assisted-profile-model.yaml`, currently `qwen2.5:7b-instruct-q4_K_M`):
  - **RAM:** 8 GB minimum, 16 GB recommended.
  - **Disk:** 4.7 GB for the model weights alone, plus normal container/image overhead.
- `openssl` (for the pilot TLS certificate, §7).

## 2. Agent image version

Pin an explicit version or digest — never `latest`:

```env
FWCLOUD_AI_AGENT_IMAGE=fwcloud-ai-agent
FWCLOUD_AI_AGENT_VERSION=<version-or-digest>
```

`deploy/assisted-profile/docker-compose.yml` refuses to start if
`FWCLOUD_AI_AGENT_VERSION` is unset (a Compose interpolation error, not a
silent fallback to `latest`).

## 3. Ollama / model pin relationship

Ollama's version (`OLLAMA_VERSION`, default `0.30.8` in
`deploy/assisted-profile/.env.example`) must match the version pinned inside
the agent image's `config/models/assisted-profile-model.yaml` — that file,
not this Compose file, is the source of truth (AG-6 owns it). If you bump the
agent image, check that manifest before touching `OLLAMA_VERSION` here.

The model itself (name + exact digest) is likewise pinned in that manifest
and is not configurable from this repo — the provisioner (§4) fails loudly
(`MODEL_DIGEST_MISMATCH`) rather than silently accepting a different digest.

## 4. Model provisioning

`assisted-profile-model-provisioner` is a one-shot Compose service that runs
the agent image's own `scripts/provision-model.sh` (→ `python -m
app.model_ops provision`) against the `ollama` service, and exits only once:

1. Ollama is reachable and its server version matches the manifest.
2. The pinned model is present (pulling it if not).
3. Its installed digest exactly matches the manifest's pinned digest.

`fwcloud-ai-agent` will not start until this container reports exit code 0
(`depends_on: ... condition: service_completed_successfully`), so **the
first real generation request never triggers a model download**.

Re-run provisioning independently (e.g. after wiping the volume) with:

```bash
cd deploy/assisted-profile
./provision-model.sh
```

## 5. Persistent model storage

Model weights live in the named volume `assisted-profile-ollama-data`,
mounted at `/root/.ollama` inside the `ollama` container. It survives
`docker compose down` / container recreation; it does **not** survive
`docker compose down -v`. There is no committed backup mechanism — treat
re-provisioning (§4) as the recovery path, not a volume backup, since the
weights are reproducible from the pinned digest.

To remove and reprovision the model:

```bash
docker compose down -v
docker compose up -d
```

## 6. Environment variables

Two separate `.env` files are involved — do not confuse them:

| File | Scope |
| --- | --- |
| `deploy/assisted-profile/.env` (from `.env.example` in that directory) | Compose stack: image pins, the AG-4 API key/allowlist, TLS proxy binding. |
| Root `.env` (from the repo root `.env.example`) | `fwcloud-api` itself: `ASSISTED_PROFILE_ENABLED`, `ASSISTED_PROFILE_AGENT_URL`, `ASSISTED_PROFILE_AGENT_API_KEY`, `ASSISTED_PROFILE_AGENT_CA_FILE`. |

`ASSISTED_PROFILE_AGENT_API_KEY` must be **the same value** in both files —
it is the shared secret fwcloud-api and the agent both need for the AG-4
channel (§7). Nothing else needs to match between the two files.

The root `.env` also carries the optional, default-off rejected-proposal
capture settings (`ASSISTED_PROFILE_CAPTURE_REJECTED_PROPOSALS`,
`ASSISTED_PROFILE_REJECTED_PROPOSAL_RETENTION_DAYS` and the purge job's
settings). They are **not** part of a normal pilot bring-up — see §18 before
touching them.

## 7. API key and IP allowlist (AG-4)

The agent requires both, with no insecure fallback — it refuses to start
without them:

- `FWCLOUD_AI_AGENT_ASSISTED_PROFILE_API_KEY` — checked via the `X-API-Key`
  header on every request except health.
- `FWCLOUD_AI_AGENT_ASSISTED_PROFILE_ALLOWED_IPS` — comma-separated exact
  IPs/CIDRs. **Never `0.0.0.0/0`.**

This Compose file pins a deterministic subnet (`172.28.0.0/24`) precisely
because the allowlist has no hostname support — a container's IP has to be
known in advance. The default allowlist,
`127.0.0.1/32,172.28.0.12/32`, covers exactly two legitimate callers:

- `127.0.0.1/32` — the agent's own baked-in container `HEALTHCHECK`, which
  calls `http://127.0.0.1:8000/api/v1/health` **from inside the same
  container** (loopback, not cross-container traffic). Omitting this makes
  the container perpetually unhealthy.
- `172.28.0.12/32` — `agent-tls-proxy`, the only other component with a
  route to the agent.

If you change the network topology (different subnet, additional proxy
hop, `fwcloud-api` joining the network directly instead of via the proxy),
update `ASSISTED_PROFILE_AGENT_ALLOWED_IPS` accordingly — a stale allowlist
fails closed (403), it does not silently widen.

## 8. TLS

`fwcloud-ai-agent` does **not** terminate TLS itself (by that repo's own
design — there are no cert/key env vars or TLS server flags in it at all).
This pilot terminates TLS at a dedicated `agent-tls-proxy` (nginx) service:

```
fwcloud-api --HTTPS+X-API-Key--> agent-tls-proxy --HTTP--> fwcloud-ai-agent --HTTP--> ollama
```

- **Termination point:** `agent-tls-proxy`, config in
  `deploy/assisted-profile/nginx/agent-proxy.conf`.
- **Certificates:** a pilot self-signed CA + leaf certificate — see
  `deploy/assisted-profile/certificates/README.md` for the exact `openssl`
  commands. Certificate material is git-ignored; never commit it.
- **CA trust in fwcloud-api:** `ASSISTED_PROFILE_AGENT_CA_FILE` must point at
  the generated `pilot-ca.crt`. Certificate verification is never disabled —
  there is no "skip TLS verify" setting on the fwcloud-api side, by design.
- **Hostname / SAN:** the leaf certificate's SAN list covers both connection
  modes below (`agent-tls-proxy`, `fwcloud-ai-agent`, `localhost`, `127.0.0.1`).
- **Internal hop:** `agent-tls-proxy` → `fwcloud-ai-agent` → `ollama` is
  plaintext HTTP. This is considered trusted because it never leaves the
  private, non-published `assisted-profile-network` Docker bridge — nothing
  outside the Docker host can observe or inject into that traffic. If that
  assumption doesn't hold for your environment (e.g. a multi-host Docker
  Swarm/overlay setup), do not use this pilot topology as-is.
- **Renewal:** see `certificates/README.md` §4 — regenerate the leaf cert and
  `docker compose restart agent-tls-proxy`; no fwcloud-api-side change is
  needed unless the CA itself rotated.

### Connecting `fwcloud-api`

`fwcloud-api` is **not** a service in this Compose file (its own deployment
path — see `docker/Dockerfile` — fetches a released build and is a separate
concern from this pilot). Two supported ways to reach the agent channel:

1. **Host-run `fwcloud-api`** (the default assumed by `.env.example`):
   `agent-tls-proxy` publishes its port to `127.0.0.1` only. Point
   `fwcloud-api` at `ASSISTED_PROFILE_AGENT_URL=https://localhost:8443`. This
   is the one legitimate use of `localhost` in this whole setup — it's the
   *host* reaching a *published* port, not one container reaching another by
   the wrong name.
2. **Containerized `fwcloud-api`** joining `assisted-profile-network` as an
   external network: reach `https://agent-tls-proxy:8443` by Compose service
   name instead, and drop the host port publish if it's no longer needed.

## 9. Compose networking topology

```
                         assisted-profile-network (172.28.0.0/24, private)
                         ┌───────────────────────────────────────────────┐
 fwcloud-api  ──HTTPS──▶ │ agent-tls-proxy (.12, published 127.0.0.1:8443)│
 (host or container)     │        │ HTTP                                 │
                         │        ▼                                     │
                         │ fwcloud-ai-agent (.11, no published port)     │
                         │        │ HTTP                                 │
                         │        ▼                                     │
                         │ ollama (.10, no published port)               │
                         └───────────────────────────────────────────────┘
```

All cross-container calls use Compose service names
(`http://ollama:11434`, `http://fwcloud-ai-agent:8000`,
`https://agent-tls-proxy:8443`) — never `localhost`/`127.0.0.1` for
cross-container traffic. `ollama` and `fwcloud-ai-agent` publish no host
ports at all; only `agent-tls-proxy` does.

## 10. Startup sequence

```
ollama starts, OLLAMA_HOST=0.0.0.0:11434
    │  (healthcheck: `ollama list`)
    ▼
ollama reports healthy
    │
    ▼
assisted-profile-model-provisioner runs, verifies/pulls the pinned digest
    │  (exits 0 only once verified)
    ▼
fwcloud-ai-agent starts (depends_on: ollama healthy + provisioner completed)
    │  (container HEALTHCHECK: GET /api/v1/health, requires model.ready)
    ▼
fwcloud-ai-agent reports healthy
    │
    ▼
agent-tls-proxy starts (depends_on: agent healthy)
    │
    ▼
fwcloud-api's health poller (§11) observes a ready agent
```

Start it:

```bash
cd deploy/assisted-profile
cp .env.example .env   # fill in real values
# generate certificates — see certificates/README.md
docker compose up -d
```

## 11. Smoke test

```bash
cd deploy/assisted-profile
./smoke-test.sh
```

Checks, against the real running stack: the provisioner exited 0; the agent
container is healthy; the agent is reachable by its Compose service name
(not `localhost`) from another container on the network; and the security
checks in §12. It fails loudly rather than silently skipping any of these.

## 12. Security verification (AG-4)

Also covered by `smoke-test.sh`, and summarized here for manual/CI use:

| Request | Expected |
| --- | --- |
| Protected endpoint, no `X-API-Key` | `401` |
| Protected endpoint, invalid `X-API-Key` | `401` |
| Direct agent access from an IP outside `ASSISTED_PROFILE_AGENT_ALLOWED_IPS` | `403` |
| Valid key, allowed source | `2xx` past the auth layer |

The 403 case is triggered against `fwcloud-ai-agent` directly (bypassing
`agent-tls-proxy`) from a throwaway container that gets an arbitrary address
on `assisted-profile-network` — not the proxy's pinned `172.28.0.12` — so it
exercises the agent's real `InboundServiceAuthMiddleware`, not just Docker
network reachability.

## 13. Health and availability interpretation

`fwcloud-api` exposes `GET /fwclouds/:fwcloud/assistant/availability`. Two
independent dimensions, never inferred from each other:

```
deploymentEnabled = ASSISTED_PROFILE_ENABLED opt-in (this doc, §14)
runtimeAvailable  = agent alive && model ready (this pilot's own health)
```

| `deploymentEnabled` | Agent health | `status` | `available` |
| --- | --- | --- | --- |
| `false` | any | `disabled` | `false` |
| `true` | ready | `ready` | `true` |
| `true` | busy, model ready | `busy` | `true` |
| `true` | down / model not ready | `unavailable` | `false` |

See `src/communications/assistant-agent/README.md` for the full
runtime-health derivation and the exact response shape.

## 14. Enabling the feature in fwcloud-api

```env
ASSISTED_PROFILE_ENABLED=true
ASSISTED_PROFILE_AGENT_URL=https://localhost:8443   # or https://agent-tls-proxy:8443 — see §8
ASSISTED_PROFILE_AGENT_API_KEY=<same value as deploy/assisted-profile/.env>
ASSISTED_PROFILE_AGENT_CA_FILE=<path to certificates/pilot-ca.crt>
```

`fwcloud-api` reads its configuration once at process startup. **Changing
`ASSISTED_PROFILE_ENABLED` requires an API restart** — this is not a live
toggle, and there is no dynamic feature-flag admin UI (out of scope for this
pilot). After a restart:

- `false → true`: `/fwclouds/:fwcloud/assistant/drafts/*` routes become
  reachable (subject to normal authorization), and the health poller starts.
  Availability stays `unavailable` until the first successful health check —
  it never optimistically reports ready.
- `true → false`: those routes return `404` again, the poller stops, and
  availability immediately reports `disabled` regardless of any cached
  health state.

## 15. Degraded mode

The deployment flag being `true` does not guarantee the agent stack is
healthy. `fwcloud-api` stays fully operational in every case below —
unrelated FWCloud features are unaffected:

| Condition | Effective status | What still works |
| --- | --- | --- |
| Agent container down | `unavailable` | Listing/reading/discarding existing drafts (no agent call needed). `generate` fails with a typed error, never a 500. |
| Ollama down | `unavailable` | Same as above — the agent's own health check reflects this. |
| Model not provisioned / digest mismatch | `unavailable`, `failureCode: model_not_ready` internally (never exposed raw) | Same as above. |
| TLS validation fails | `unavailable` (health poll itself fails as a `connection_error`) | Same as above. Certificate verification is never silently disabled to "fix" this — fix the certificate instead (§8). |
| API key misconfigured/mismatched | `unavailable` | Same as above. |
| Agent reports busy | `busy`, `available: true` | Everything — busy is informational, not a block. |

**Recovery is automatic**: the health poller (default: every 30s, see
`ASSISTED_PROFILE_HEALTH_POLL_INTERVAL_MS`) picks up a recovered agent on its
own; no `fwcloud-api` restart is needed for ordinary agent recovery (only a
flag *change* needs a restart, per §14).

Draft operations that never touch the agent (list, show, discard, reading
applied/failed history) work regardless of runtime health, as long as
`deploymentEnabled` is `true` — only `generate` (and any future
agent-dependent clarification) requires `runtimeAvailable`.

## 16. Shutdown, upgrade, rollback

```bash
# Shutdown, keep the model volume
docker compose down

# Shutdown, also delete the model volume (forces reprovisioning next start)
docker compose down -v

# Upgrade: bump the pin, pull, recreate
#   (edit FWCLOUD_AI_AGENT_VERSION in deploy/assisted-profile/.env first)
docker compose pull fwcloud-ai-agent assisted-profile-model-provisioner
docker compose up -d

# Rollback: point FWCLOUD_AI_AGENT_VERSION back at the previous pin and repeat
```

If an upgrade also changes the pinned model (a new
`config/models/assisted-profile-model.yaml` inside the new agent image), the
provisioner re-runs automatically on `docker compose up -d` and will
pull/verify the new digest before the agent is allowed to start.

## 17. Troubleshooting

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| `fwcloud-ai-agent` container never becomes healthy | Model not provisioned yet, or provisioner failed | `docker compose logs assisted-profile-model-provisioner` |
| Agent's own healthcheck fails immediately | `127.0.0.1/32` missing from `ASSISTED_PROFILE_AGENT_ALLOWED_IPS` | §7 |
| `fwcloud-api` availability stuck at `unavailable` with the flag on | TLS/CA mismatch, wrong API key, or agent actually down | `docker compose logs fwcloud-ai-agent`; confirm `ASSISTED_PROFILE_AGENT_CA_FILE` matches the leaf cert's issuing CA |
| `403` from the agent for a request you expected to succeed | Source IP not in `ASSISTED_PROFILE_AGENT_ALLOWED_IPS` — check which network hop is actually connecting | §7, §12 |
| `smoke-test.sh` fails at the service-name check | Something is using `localhost`/`127.0.0.1` for cross-container traffic instead of a Compose service name | §9 |
| Draft routes 404 even though the stack is healthy | `ASSISTED_PROFILE_ENABLED` is still `false`, or `fwcloud-api` wasn't restarted after flipping it | §14 |
| `assisted_profile_rejected_proposal` is filling up | Rejected-proposal capture was enabled for this deployment | §18 |

## 18. Optional: anonymized rejected-proposal capture

Off by default, and **not** needed to run a pilot. When explicitly enabled, an
Assisted Profile proposal rejected by contract, mapping or domain validation is
stored in anonymized form for a bounded retention window, so the rejection can
be evaluated later. The raw proposal, the user's instruction and any
actor/FWCloud identity are never stored, and accepted proposals are never
captured.

```env
ASSISTED_PROFILE_CAPTURE_REJECTED_PROPOSALS=false   # default; absent behaves the same
```

Enabling it is a deliberate decision with privacy consequences. Read
[`assisted-profile-rejected-proposal-capture.md`](assisted-profile-rejected-proposal-capture.md)
first: it documents exactly which rejections qualify, every field that is and is
not stored, the anonymization rules and their version, the retention window and
purge job, and how to verify both. Like `ASSISTED_PROFILE_ENABLED`, this flag is
read once at startup, so changing it requires an API restart; the startup log
reports which state is in force.

---

**This is not the standard FWCloud installer.** It does not integrate with
`instalador/`, does not manage FWCloud's own database/backup lifecycle, and
is scoped entirely to the Assisted Profile pilot described above.
