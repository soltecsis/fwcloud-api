# Assisted Profile — pilot deployment

> **This is a PILOT, not the standard FWCloud installer.** It exists to
> reproducibly evaluate the Assisted Profile feature (natural language →
> firewall profile draft, via `fwcloud-ai-agent` + Ollama). Do not treat it
> as production-grade orchestration guidance for the rest of FWCloud.

Full documentation, including prerequisites, security verification, degraded
mode, and troubleshooting: **[`../../docs/assisted-profile-pilot-deployment.md`](../../docs/assisted-profile-pilot-deployment.md)**.

## Quick start

```bash
cd deploy/assisted-profile
cp .env.example .env               # then fill in real values
```

1. Follow `certificates/README.md` to generate a pilot self-signed CA and
   the `agent-tls-proxy` certificate.
2. Fill in `.env` — at minimum `FWCLOUD_AI_AGENT_VERSION` and
   `ASSISTED_PROFILE_AGENT_API_KEY`.
3. Start the stack:
   ```bash
   docker compose up -d
   ```
4. Watch `assisted-profile-model-provisioner` finish (it exits once the
   pinned model's digest is verified against `ollama`):
   ```bash
   docker compose logs -f assisted-profile-model-provisioner
   ```
5. Confirm the agent is healthy:
   ```bash
   docker compose ps fwcloud-ai-agent
   ```
6. On the `fwcloud-api` side, set (see the root `.env.example`):
   ```env
   ASSISTED_PROFILE_ENABLED=true
   ASSISTED_PROFILE_AGENT_URL=https://localhost:8443
   ASSISTED_PROFILE_AGENT_API_KEY=<same value as ASSISTED_PROFILE_AGENT_API_KEY above>
   ASSISTED_PROFILE_AGENT_CA_FILE=<path to certificates/pilot-ca.crt>
   ```
   and restart `fwcloud-api` (the deployment flag and agent transport are
   read once at startup).
7. Run `./smoke-test.sh` to verify service-name connectivity and the AG-4
   security surface end-to-end.

## Files

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | The pilot stack: `ollama`, `assisted-profile-model-provisioner`, `fwcloud-ai-agent`, `agent-tls-proxy`. |
| `.env.example` | Non-secret configuration template — copy to `.env`. |
| `certificates/README.md` | How to generate the pilot TLS CA/certificate (material itself is git-ignored). |
| `nginx/agent-proxy.conf` | TLS termination in front of `fwcloud-ai-agent`. |
| `provision-model.sh` | Re-run model provisioning without restarting the whole stack. |
| `smoke-test.sh` | Automated service-name connectivity + AG-4 security checks against a running stack. |

## Shutdown

```bash
docker compose down          # stop, keep the ollama model volume
docker compose down -v       # stop and delete the model volume (forces reprovisioning)
```
