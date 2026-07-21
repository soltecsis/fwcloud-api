FROM node:20-alpine

WORKDIR /opt/fake-agent

COPY e2e/fake-agent/server.js ./server.js
COPY Unit/models/assistant-contract/fixtures ./fixtures

ENV PORT=8080 \
    FIXTURE_DIRECTORY=/opt/fake-agent/fixtures \
    DEFAULT_BEHAVIOR=healthy \
    SLOW_DELAY_MS=5000

EXPOSE 8080

USER node

CMD ["node", "server.js"]
