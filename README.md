# FWCloud-API

This is the repository for the API REST of the <a href="https://fwcloud.net">FWCloud</a> project.<br>
Please, go to our main website for full information about it:<br>
https://fwcloud.net

FWCloud's source code is published under the free software license <a href="http://www.gnu.org/licenses/agpl-3.0.en.html">GNU AGPL, v3</a> and thus is freely available for download, use and share.<br>

## Assisted Profile agent transport

`AgentHttpClient` is the single production transport for Assisted Profile generation. It connects directly to the configured agent's `POST /generate` endpoint and authenticates every request with `X-API-Key`. Agent traffic does not use application intermediaries, and proxy environment variables such as `HTTP_PROXY` and `HTTPS_PROXY` are ignored for this connection.

Production deployments must use an `https:` agent URL. Certificate verification is always enabled; `ASSISTED_PROFILE_AGENT_CA_FILE` may point to a PEM CA bundle for deployments using a private CA. In Compose, configure the agent service name as the URL host (for example, `https://fwcloud-ai-agent:8443`) and place both services on a network that permits this direct connection.

| Variable                                    | Default  | Purpose                                   |
| ------------------------------------------- | -------- | ----------------------------------------- |
| `ASSISTED_PROFILE_AGENT_URL`                | none     | Required direct agent base URL            |
| `ASSISTED_PROFILE_AGENT_API_KEY`            | none     | Required service key; never logged        |
| `ASSISTED_PROFILE_AGENT_CONNECT_TIMEOUT_MS` | `10000`  | TCP/TLS establishment timeout             |
| `ASSISTED_PROFILE_AGENT_READ_TIMEOUT_MS`    | `180000` | Response/read timeout for local inference |
| `ASSISTED_PROFILE_AGENT_CA_FILE`            | none     | Optional readable PEM CA bundle           |

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
