# FWCloud-API

This is the repository for the API REST of the <a href="https://fwcloud.net">FWCloud</a> project.<br>
Please, go to our main website for full information about it:<br>
https://fwcloud.net

FWCloud's source code is published under the free software license <a href="http://www.gnu.org/licenses/agpl-3.0.en.html">GNU AGPL, v3</a> and thus is freely available for download, use and share.<br>

## Replication profile import and export

`GET /fwclouds/:fwcloud/assistant/profiles/:code/export` downloads a portable JSON template with `Content-Type: application/json` and an attachment filename. `POST /fwclouds/:fwcloud/assistant/profiles/import` accepts that document as an `application/json` request body and returns the created profile with HTTP `201`. Both routes also accept the existing `/fwclouds/:fwcloud/profiles/` prefix. Normal authentication, FWCloud access and mutation confirmation rules apply.

The version 1 document format is:

```json
{
  "format": "fwcloud-replication-profile",
  "formatVersion": 1,
  "profile": {
    "code": "office-template",
    "name": "Office Template",
    "description": "Office firewall configuration",
    "scope": "generic",
    "category": "Custom",
    "targetKind": "firewall"
  },
  "versions": {
    "latest": {
      "model": {
        "compatibility": { "target_kinds": ["firewall"] },
        "provision": {
          "interfaces": [{ "name": "eth0", "role": "wan" }],
          "rules": []
        }
      }
    }
  }
}
```

`profile.code`, `profile.name`, `profile.targetKind` and `versions.latest.model` are required. `targetKind` supports `firewall` and `cluster`. Omitted scope defaults to `generic`; description and category default to `null`. `versions.previous` may be absent or `null`, or contain another complete `model`. Export includes `previous.metadata` with the same portable fields as `profile` to preserve that revision's deployment settings; when omitted on import, the previous version inherits `profile`. Its code must match the profile code. Only `latest` and `previous` are supported. Models retain their full configuration and extension fields and pass the existing profile validator. Unknown document, version and metadata fields are rejected.

Export includes stored external object snapshots and stable `referenceId` relationships. Source database IDs and response-only object resolution data are removed. Import validates snapshots through the existing object validators without querying or creating destination objects. Missing objects are resolved or recreated through the normal confirmed apply operation. Credentials and secret fields are rejected by the profile validator.

Imported templates are always custom templates owned by the authenticated user, including copies of built-in templates. They are available from every FWCloud their owner can access and are private to that owner. Paths are generated under `config/templates/custom/users/<user>/` by default, using the existing configurable custom template directory. Both versions are persisted in one transaction with filesystem compensation on failure. Existing records and files are never overwritten by import.

Names must be nonempty, at most 255 characters, and cannot contain dots, path separators, control characters or unsafe filesystem characters. A duplicate code or name in the owner's namespace returns HTTP `409` with portable conflicting metadata in `errors.conflicts`; edit `profile.code` or `profile.name` before retrying. Unsupported formats, unsupported versions and invalid definitions return `422`; malformed JSON returns `400`. Imports exceeding `REPLICATION_PROFILES_IMPORT_MAX_SIZE` (default `2097152` uncompressed bytes, config key `replication_profiles.import_max_size`) return `413`. The size limit applies while reading the request body, including compressed requests.

## Assisted Profile agent transport

`AgentHttpClient` is the single production transport for Assisted Profile generation. It connects directly to the configured agent's `POST /generate` endpoint and authenticates every request with `X-API-Key`. Agent traffic does not use application intermediaries, and proxy environment variables such as `HTTP_PROXY` and `HTTPS_PROXY` are ignored for this connection.

Production deployments must use an `https:` agent URL. Certificate verification is always enabled; `ASSISTED_PROFILE_AGENT_CA_FILE` may point to a PEM CA bundle for deployments using a private CA. In Compose, configure the agent service name as the URL host (for example, `https://fwcloud-ai-agent:8443`) and place both services on a network that permits this direct connection.

| Variable                                      | Default  | Purpose                                   |
| --------------------------------------------- | -------- | ----------------------------------------- |
| `ASSISTED_PROFILE_AGENT_URL`                  | none     | Required direct agent base URL            |
| `ASSISTED_PROFILE_AGENT_API_KEY`              | none     | Required service key; never logged        |
| `ASSISTED_PROFILE_AGENT_CONNECT_TIMEOUT_MS`   | `10000`  | TCP/TLS establishment timeout             |
| `ASSISTED_PROFILE_AGENT_READ_TIMEOUT_MS`      | `180000` | Response/read timeout for local inference |
| `ASSISTED_PROFILE_AGENT_CA_FILE`              | none     | Optional readable PEM CA bundle           |
| `ASSISTED_PROFILE_GENERATION_QUEUE_MAX_DEPTH` | `3`      | Maximum waiting generations               |

Initialization rejects a missing URL or API key, an unsupported protocol, non-positive or invalid timeout values, an invalid CA path/bundle, and non-HTTPS URLs in production.

Only a failure proven to occur before request establishment is retried, exactly once (two attempts total). Avoiding duplicate inference takes precedence over automatic recovery.

| Result                                                                      | Automatic retry |
| --------------------------------------------------------------------------- | --------------- |
| Connection-establishment failure before the request can reach the agent     | Exactly once    |
| Read timeout or cancellation                                                | Never           |
| HTTP `429`, any other `4xx`, or any `5xx`                                   | Never           |
| TLS handshake/certificate failure before a secure connection is established | Exactly once    |
| Response parsing, invalid HTTP response, or API-1 contract/version failure  | Never           |
| Unclassified transport failure after request establishment                  | Never           |

Every successful HTTP response is parsed as untrusted input and validated by the vendored API-1 contract gateway before application code can receive it. Response bodies and credentials are not logged by default.

## Assisted Profile generation queue

`GenerationQueue` is the process-local admission boundary that generation orchestration must use before calling `AgentHttpClient`. It is a FIFO queue with one active slot. `ASSISTED_PROFILE_GENERATION_QUEUE_MAX_DEPTH` limits waiting requests only, so the default permits one active plus three waiting generations. A value of `0` permits one active generation and rejects every request that would need to wait. Negative, fractional, and unsupported values fail configuration validation.

The queue rejects a full waiting list with HTTP `503` and code `ASSISTED_PROFILE_GENERATION_QUEUE_SATURATED`. It also reserves each accepted `user_id + fwcloud_id` pair until the job succeeds or fails. A duplicate receives HTTP `409`, code `ASSISTED_PROFILE_GENERATION_ALREADY_IN_PROGRESS`, and the existing `generation_id`. The guard is released on every terminal path before the next FIFO job starts.

Queue lifecycle updates use the request-scoped `Channel` created after normal FWCloud authorization. They are delivered only on the requesting user's channel:

| Event                                   | Meaning                        |
| --------------------------------------- | ------------------------------ |
| `assistant.generation.queued`           | Accepted with initial position |
| `assistant.generation.position_changed` | Moved forward in the wait list |
| `assistant.generation.started`          | Entered the sole active slot   |
| `assistant.generation.completed`        | Generation completed           |
| `assistant.generation.failed`           | Generation failed              |

Each payload includes its stable `generation_id`, FWCloud and user identifiers, status, number of waiting jobs, and timestamp. Position `0` is the active slot, position `1` is next, and position `2` is the second waiting request. Events never contain prompts or generated proposals. Operational logs expose queue depth, active generation id, and wait/execution durations; the queue's safe `stats` snapshot exposes enqueue, rejection, completion, and failure counters. Neither includes request or proposal bodies.

Client disconnection is not user-facing cancellation. The initial implementation lets an accepted job finish normally: queued work remains queued and an active request is never retried or duplicated. Regardless of how its execution callback settles, the queue releases the user/FWCloud guard. Cancellation can be added later at the orchestration boundary when disconnect propagation is reliable.

> The in-process queue guarantees strict serialization only inside one `fwcloud-api` instance.

It is not a distributed lock. For multi-instance deployment, keep this queue for local backpressure and UX, but move the authoritative limit to a semaphore in `fwcloud-ai-agent`: the agent accepts at most one active inference, returns a deterministic busy response to additional callers, and every API instance continues classifying that response through `AgentHttpClient`. Introduce a shared external coordinator separately only if distributed queueing becomes necessary.
