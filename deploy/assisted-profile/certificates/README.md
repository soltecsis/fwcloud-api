# Pilot TLS certificates

`agent-tls-proxy` terminates TLS for the `fwcloud-api` → agent channel. This
directory holds that certificate material. **Nothing in this directory
should ever be committed** — it's git-ignored on purpose (see the repo's
`.gitignore`); only this README is tracked.

The commands below produce a **self-signed pilot CA and a leaf certificate**
suitable for a controlled pilot/evaluation environment only — not for a
production deployment reachable from anywhere but a trusted operator's own
host.

## 1. Generate a pilot CA

```bash
openssl genrsa -out pilot-ca.key 4096
openssl req -x509 -new -nodes -key pilot-ca.key -sha256 -days 825 \
  -subj "/CN=Assisted Profile Pilot CA" \
  -out pilot-ca.crt
```

## 2. Generate the agent's leaf certificate

The certificate's Subject Alternative Name (SAN) **must** match the hostname
`fwcloud-api` uses to reach the proxy. In this compose topology that's the
Docker service name `agent-tls-proxy` (if `fwcloud-api` also joins the
Compose network) or `localhost` (if `fwcloud-api` reaches the proxy via its
published host port, per the default topology documented in
`../../../docs/assisted-profile-pilot-deployment.md`). Include both to cover
either connection mode:

```bash
openssl genrsa -out agent.key 2048

cat > agent-san.cnf <<'EOF'
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = agent-tls-proxy

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = agent-tls-proxy
DNS.2 = fwcloud-ai-agent
DNS.3 = localhost
IP.1  = 127.0.0.1
EOF

openssl req -new -key agent.key -out agent.csr -config agent-san.cnf

openssl x509 -req -in agent.csr -CA pilot-ca.crt -CAkey pilot-ca.key \
  -CAcreateserial -out agent.crt -days 397 -sha256 \
  -extfile agent-san.cnf -extensions v3_req

rm agent.csr agent-san.cnf
```

You should now have `agent.crt` and `agent.key` in this directory — exactly
what `docker-compose.yml` mounts into `agent-tls-proxy`.

## 3. Trust the pilot CA from fwcloud-api

Point the fwcloud-api side at the CA you just generated (never disable
certificate verification):

```env
ASSISTED_PROFILE_AGENT_CA_FILE=/path/to/deploy/assisted-profile/certificates/pilot-ca.crt
```

## 4. Renewal / replacement

The leaf cert above expires after 397 days (the CA after 825). To rotate
before expiry, or immediately if a key is suspected compromised: repeat step
2 with a fresh key (the CA from step 1 can be reused unless it is itself
being rotated), then `docker compose restart agent-tls-proxy`. No change is
needed on the fwcloud-api side unless the CA itself was rotated.
