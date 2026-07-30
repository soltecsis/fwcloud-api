#!/usr/bin/env bash
# Runs the AG-6 model provisioning step against this pilot's `ollama`
# service, without starting the rest of the stack. Useful for reprovisioning
# after wiping the assisted-profile-ollama-data volume, or for re-verifying
# the pinned model digest.
#
# This does not reimplement provisioning logic: it just runs the same
# one-shot `assisted-profile-model-provisioner` service defined in
# docker-compose.yml (which wraps the agent image's own
# scripts/provision-model.sh / `python -m app.model_ops provision`).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "Starting ollama (if not already running) and waiting for it to report healthy..."
docker compose up -d --wait ollama

echo "Provisioning the pinned model..."
docker compose run --rm assisted-profile-model-provisioner "$@"

echo "Model provisioning complete."
