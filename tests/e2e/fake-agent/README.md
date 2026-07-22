# Assisted Profile fake agent

This is a test-only HTTP service for deterministic Assisted Profile end-to-end tests. It does not run inference and must not be deployed as a production agent.

## Start it

From the repository root:

```sh
docker compose -f tests/docker-compose.yaml up --build fake-agent
```

Other containers in that Compose project reach it directly at `http://fake-agent:8080`. Port 8080 is intentionally only exposed to the internal Compose network, so the URL is not reachable from the host unless a test explicitly publishes a port. The generation endpoint is `POST /generate`; `GET /health` is public and available for readiness checks.

Compose configures the test-only key `fwcloud-fake-agent-test-key` through `EXPECTED_API_KEY`. Every `POST /generate` request must therefore include `X-API-Key`; a missing or different value returns `401`. When the standalone server is created without `expectedApiKey` and `EXPECTED_API_KEY` is unset, authentication is disabled for compatibility with focused tests. Never use this test key outside the test environment.

## Select a behavior

Selection is stateless and per request. Set the `X-Fake-Agent-Behavior` header (preferred), or use the `behavior` query parameter. The header wins when both are present. If neither is provided, `DEFAULT_BEHAVIOR` is used (`healthy` in Compose).

From another container attached to the same Compose project network:

```sh
curl -X POST http://fake-agent:8080/generate \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: fwcloud-fake-agent-test-key' \
  -H 'X-Fake-Agent-Behavior: busy' \
  -d '{"text":"Create a firewall with WAN and LAN","mode":"preview","target":{"type":"firewall"}}'
```

| Behavior    | Result                                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `healthy`   | `200 application/json` with API-1's `valid-success.json` fixture.                                                                                                                                |
| `slow`      | Waits `SLOW_DELAY_MS` (5000 ms in Compose), then returns the healthy response. Configure the API client timeout below that value, for example 2000 ms. Aborted clients cancel the pending timer. |
| `down`      | Accepts the selected HTTP request and then resets its TCP connection. The container stays healthy, so the result is deterministic and requires no shared state or manual container stop.         |
| `busy`      | `429 application/json`, `Retry-After: 2`, and an `AGENT_BUSY` body.                                                                                                                              |
| `malformed` | `200 application/json` with API-1's `invalid-missing-field.json`; transport succeeds and `AgentHttpClient` returns `AgentContractMismatchError`.                                                 |

An unsupported behavior returns `400`. Request bodies are accepted and drained but are not interpreted.

The `down` behavior is a **reset after accept**: the request may already have reached the agent. It is therefore not a safe connection-establishment retry scenario and must not be used to assert the client's one safe retry. Use an unreachable endpoint (for example, a closed port) when testing failure before request establishment.

Tests may pass `onGenerateRequest` to `createFakeAgentServer` to observe attempts. The callback receives only `{ behavior, authenticated }`; it never receives the API key, headers, or body.

## Fixtures

The Docker build copies the API-1 gateway fixtures directly from:

- `tests/Unit/models/assistant-contract/fixtures/valid-success.json`
- `tests/Unit/models/assistant-contract/fixtures/invalid-missing-field.json`

The standalone server resolves the same source directory by default. `FIXTURE_DIRECTORY`, `HEALTHY_FIXTURE_PATH`, and `MALFORMED_FIXTURE_PATH` can override those locations for a test, while `SLOW_DELAY_MS` controls the slow delay and `EXPECTED_API_KEY` enables authentication.

## Add a behavior

Add its name to `BEHAVIORS` in `server.js`, implement its request-local branch, document its exact status/body/timing here, and add an example to `fake-agent.e2e.spec.ts`. Do not add mutable service-wide selection state: parallel tests must remain isolated.
