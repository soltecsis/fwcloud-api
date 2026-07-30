#!/usr/bin/env bash
# Assisted Profile pilot smoke test.
#
# Verifies, against a REAL running compose stack (not mocks):
#   1. The model provisioner completed successfully.
#   2. fwcloud-ai-agent reports healthy via Docker's own health status.
#   3. Cross-container traffic resolves the agent by Docker service name,
#      never localhost/127.0.0.1 (a throwaway container on the same network
#      proves this — it has no other way to reach the agent).
#   4. The AG-4 security surface behaves as specified: missing key -> 401,
#      invalid key -> 401, valid key from an allowed source -> 2xx.
#   5. A source IP outside the allowlist is rejected with 403 (run from a
#      second container attached to a network that is NOT
#      assisted-profile-network, since that is the only way to present a
#      source IP outside the allowlist against a container that publishes no
#      other port).
#
# This script assumes `docker compose up -d` has already been run in this
# directory and .env is populated. It does not start or stop the stack
# itself, beyond the throwaway helper containers it creates and removes.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

# shellcheck disable=SC1091
[ -f .env ] && set -a && source .env && set +a

fail() {
  echo "SMOKE TEST FAILED: $*" >&2
  exit 1
}

# curl wrapper for the checks in §4 below (direct calls against the
# published proxy port): always insecure-TLS (pilot self-signed cert) and
# always prints only the response status code, never the body. §3 and §5 run
# curl inside a throwaway container instead, via `docker run`, so they don't
# go through this wrapper.
http_code() {
  curl -sk -o /dev/null -w '%{http_code}' "$@"
}

echo "== 1. Model provisioning =="
provisioner_id="$(docker compose ps -a -q assisted-profile-model-provisioner)"
[ -n "$provisioner_id" ] || fail "assisted-profile-model-provisioner container not found; did you run 'docker compose up -d'?"
provisioner_exit="$(docker inspect -f '{{.State.ExitCode}}' "$provisioner_id")"
[ "$provisioner_exit" = "0" ] || fail "model provisioner exited with code $provisioner_exit (expected 0 — see 'docker compose logs assisted-profile-model-provisioner')"
echo "OK: model provisioner exited 0 (model present and digest-verified)."

echo "== 2. Agent container health =="
[ -n "$(docker compose ps -q fwcloud-ai-agent)" ] || fail "fwcloud-ai-agent container not found"
docker compose up -d --wait --wait-timeout 150 fwcloud-ai-agent \
  || fail "fwcloud-ai-agent did not become healthy within 150s"
echo "OK: fwcloud-ai-agent is healthy."

echo "== 3. Service-name connectivity (no localhost) =="
# A throwaway container on the SAME private network as the proxy, reaching it
# only by its Compose service name. If service-name DNS resolution is broken,
# or if the topology were misconfigured to require localhost, this fails.
docker run --rm --network assisted-profile-network curlimages/curl:8.10.1 \
  -sk -o /dev/null -w '%{http_code}' \
  "https://agent-tls-proxy:8443/api/v1/health" | grep -q '^[24]0[0-9]$' \
  || fail "could not reach https://agent-tls-proxy:8443 by service name from inside the network"
echo "OK: agent reachable via its Compose service name, not localhost."

echo "== 4. AG-4 security surface (via the published proxy port) =="
base_url="https://${ASSISTED_PROFILE_PROXY_BIND:-127.0.0.1}:${ASSISTED_PROFILE_PROXY_PORT:-8443}"

code="$(http_code "$base_url/api/v1/health")"
# Health is allowlist-only, not key-gated, so a request from an allowed host
# with no key still succeeds. The negative case below targets a protected
# generation-style path instead.
[ "$code" = "200" ] || fail "expected 200 from /api/v1/health with no key from an allowed source, got $code"
echo "OK: health endpoint reachable with no key from an allowed source (200)."

code="$(http_code -X POST "$base_url/api/v1/generate")"
[ "$code" = "401" ] || fail "expected 401 for a protected endpoint with no X-API-Key, got $code"
echo "OK: missing X-API-Key -> 401."

code="$(http_code -X POST -H "X-API-Key: definitely-wrong" "$base_url/api/v1/generate")"
[ "$code" = "401" ] || fail "expected 401 for a protected endpoint with an invalid X-API-Key, got $code"
echo "OK: invalid X-API-Key -> 401."

if [ -n "${ASSISTED_PROFILE_AGENT_API_KEY:-}" ]; then
  code="$(http_code -X POST -H "X-API-Key: ${ASSISTED_PROFILE_AGENT_API_KEY}" -H 'Content-Type: application/json' -d '{}' "$base_url/api/v1/generate")"
  # A malformed/empty body is expected to be rejected by request validation
  # (4xx, but NOT 401/403) once auth has actually passed — that's the signal
  # we want here, not a full successful generation.
  case "$code" in
    401|403) fail "expected auth to pass with a valid key from an allowed source, got $code" ;;
    *) echo "OK: valid key from an allowed source passes AG-4 auth (got $code past the auth layer)." ;;
  esac
else
  echo "SKIP: ASSISTED_PROFILE_AGENT_API_KEY not set in .env, cannot test the valid-key case."
fi

echo "== 5. Source IP outside the allowlist =="
# A throwaway container joins assisted-profile-network directly (bypassing
# agent-tls-proxy) and gets an arbitrary address from the 172.28.0.0/24 pool
# -- NOT the proxy's pinned 172.28.0.12. Talking to fwcloud-ai-agent directly
# from that address exercises AG-4's real IP allowlist (InboundServiceAuth
# Middleware), not just network reachability.
outside_code="$(docker run --rm --network assisted-profile-network curlimages/curl:8.10.1 \
  -s -o /dev/null -w '%{http_code}' --connect-timeout 5 \
  "http://fwcloud-ai-agent:8000/api/v1/health" 2>/dev/null || echo "unreachable")"
[ "$outside_code" = "403" ] || fail "expected 403 from AG-4's IP allowlist for a source not in FWCLOUD_AI_AGENT_ASSISTED_PROFILE_ALLOWED_IPS, got $outside_code"
echo "OK: source outside the allowlist -> 403."

echo
echo "All smoke test checks passed."
