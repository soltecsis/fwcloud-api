# Assisted Profile fake agent

This is a test-only HTTP service for deterministic Assisted Profile end-to-end tests. It does not run inference and must not be deployed as a production agent.

## Start it

From the repository root:

```sh
docker compose -f tests/docker-compose.yaml up --build fake-agent
```

Other containers in that Compose project reach it at `http://fake-agent:8080`. The generation endpoint is `POST /generate`; `GET /health` is available for readiness checks. Port 8080 is intentionally only exposed to the Compose network.

## Select a behavior

Selection is stateless and per request. Set the `X-Fake-Agent-Behavior` header (preferred), or use the `behavior` query parameter. The header wins when both are present. If neither is provided, `DEFAULT_BEHAVIOR` is used (`healthy` in Compose).

```sh
curl -X POST http://fake-agent:8080/generate \
  -H 'Content-Type: application/json' \
  -H 'X-Fake-Agent-Behavior: busy' \
  -d '{"text":"Create a firewall with WAN and LAN","mode":"preview","target":{"type":"firewall"}}'
```

| Behavior    | Result                                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `healthy`   | `200 application/json` with API-1's `valid-success.json` fixture.                                                                                                                                |
| `slow`      | Waits `SLOW_DELAY_MS` (5000 ms in Compose), then returns the healthy response. Configure the API client timeout below that value, for example 2000 ms. Aborted clients cancel the pending timer. |
| `down`      | Resets the selected request's TCP connection. The container stays healthy, so the result is deterministic and requires no shared state or manual container stop.                                 |
| `busy`      | `429 application/json`, `Retry-After: 2`, and an `AGENT_BUSY` body.                                                                                                                              |
| `malformed` | `200 application/json` with API-1's `invalid-missing-field.json`; transport succeeds and contract validation fails with `AssistantContractMismatchException`.                                    |

An unsupported behavior returns `400`. Request bodies are accepted and drained but are not interpreted.

## Fixtures

The Docker build copies the API-1 gateway fixtures directly from:

- `tests/Unit/models/assistant-contract/fixtures/valid-success.json`
- `tests/Unit/models/assistant-contract/fixtures/invalid-missing-field.json`

The standalone server resolves the same source directory by default. `FIXTURE_DIRECTORY`, `HEALTHY_FIXTURE_PATH`, and `MALFORMED_FIXTURE_PATH` can override those locations for a test, while `SLOW_DELAY_MS` controls the slow delay.

## Add a behavior

Add its name to `BEHAVIORS` in `server.js`, implement its request-local branch, document its exact status/body/timing here, and add an example to `fake-agent.e2e.spec.ts`. Do not add mutable service-wide selection state: parallel tests must remain isolated.
