/*
 * Test-only deterministic HTTP replacement for the Assisted Profile agent.
 * It intentionally uses only Node.js built-ins so its Docker image has no
 * dependency installation or network access at build time.
 */

'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const BEHAVIORS = new Set(['healthy', 'slow', 'down', 'busy', 'malformed']);
const DEFAULT_FIXTURE_DIRECTORY = path.resolve(
  __dirname,
  '../../Unit/models/assistant-contract/fixtures',
);

function nonNegativeInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function firstHeaderValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function isAuthenticated(request, expectedApiKey) {
  const suppliedApiKey = firstHeaderValue(request.headers['x-api-key']);
  return !expectedApiKey || suppliedApiKey === expectedApiKey;
}

function sendAuthenticationFailure(response) {
  sendJson(response, 401, {
    code: 'AGENT_AUTHENTICATION_FAILED',
    message: 'A valid X-API-Key is required.',
  });
}

function readFixture(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sendJson(response, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  response.end(body);
}

function createFakeAgentServer(options = {}) {
  const fixtureDirectory =
    options.fixtureDirectory || process.env.FIXTURE_DIRECTORY || DEFAULT_FIXTURE_DIRECTORY;
  const healthyFixture = readFixture(
    options.healthyFixturePath ||
      process.env.HEALTHY_FIXTURE_PATH ||
      path.join(fixtureDirectory, 'valid-success.json'),
  );
  const malformedFixture = readFixture(
    options.malformedFixturePath ||
      process.env.MALFORMED_FIXTURE_PATH ||
      path.join(fixtureDirectory, 'invalid-missing-field.json'),
  );
  const defaultBehavior = options.defaultBehavior || process.env.DEFAULT_BEHAVIOR || 'healthy';
  const slowDelayMs = nonNegativeInteger(options.slowDelayMs ?? process.env.SLOW_DELAY_MS, 5000);
  const expectedApiKey = options.expectedApiKey ?? process.env.EXPECTED_API_KEY;
  const onGenerateRequest = options.onGenerateRequest;
  const onGenerateRequestFinished = options.onGenerateRequestFinished;
  const onHealthRequest = options.onHealthRequest;
  // Mutable: tests flip these fields directly (e.g. `fakeAgent.health.reachable = false`)
  // to move the same running server between behaviors without restarting it.
  const health = Object.assign(
    { reachable: true, status: 200, alive: true, busy: false, modelReady: true, raw: undefined },
    options.health,
  );

  if (!BEHAVIORS.has(defaultBehavior)) {
    throw new Error(`Unsupported DEFAULT_BEHAVIOR: ${defaultBehavior}`);
  }

  if (onGenerateRequest !== undefined && typeof onGenerateRequest !== 'function') {
    throw new TypeError('onGenerateRequest must be a function.');
  }
  if (onGenerateRequestFinished !== undefined && typeof onGenerateRequestFinished !== 'function') {
    throw new TypeError('onGenerateRequestFinished must be a function.');
  }

  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://fake-agent');

    if (request.method === 'GET' && url.pathname === '/health') {
      const authenticated = isAuthenticated(request, expectedApiKey);

      if (onHealthRequest) {
        onHealthRequest({ authenticated });
      }

      if (!authenticated) {
        sendAuthenticationFailure(response);
        return;
      }

      if (!health.reachable) {
        request.socket.destroy();
        return;
      }

      if (health.raw !== undefined) {
        sendJson(response, health.status, health.raw);
        return;
      }

      sendJson(response, health.status, {
        alive: health.alive,
        busy: health.busy,
        model: { ready: health.modelReady },
        status: health.alive ? (health.busy ? 'busy' : 'ready') : 'unavailable',
      });
      return;
    }

    if (request.method !== 'POST' || url.pathname !== '/generate') {
      sendJson(response, 404, { code: 'NOT_FOUND', message: 'Use POST /generate.' });
      return;
    }

    // The request body is intentionally ignored, but draining it allows normal
    // keep-alive behavior for callers that send a realistic generation request.
    request.resume();

    const behavior =
      firstHeaderValue(request.headers['x-fake-agent-behavior']) ||
      url.searchParams.get('behavior') ||
      defaultBehavior;

    const authenticated = isAuthenticated(request, expectedApiKey);

    if (onGenerateRequest) {
      onGenerateRequest({ behavior, authenticated });
    }
    if (onGenerateRequestFinished) {
      let notified = false;
      const notifyFinished = () => {
        if (!notified) {
          notified = true;
          onGenerateRequestFinished({ behavior, authenticated });
        }
      };
      response.once('finish', notifyFinished);
      response.once('close', notifyFinished);
    }

    if (!authenticated) {
      sendAuthenticationFailure(response);
      return;
    }

    if (!BEHAVIORS.has(behavior)) {
      sendJson(response, 400, {
        code: 'UNKNOWN_FAKE_AGENT_BEHAVIOR',
        message: `Supported behaviors: ${Array.from(BEHAVIORS).join(', ')}.`,
      });
      return;
    }

    switch (behavior) {
      case 'down':
        request.socket.destroy();
        return;
      case 'busy':
        sendJson(
          response,
          429,
          { code: 'AGENT_BUSY', message: 'The fake agent is currently busy.' },
          { 'Retry-After': '2', 'X-Fake-Agent-Behavior': behavior },
        );
        return;
      case 'malformed':
        sendJson(response, 200, malformedFixture, { 'X-Fake-Agent-Behavior': behavior });
        return;
      case 'slow': {
        const timer = setTimeout(() => {
          if (!response.destroyed) {
            sendJson(response, 200, healthyFixture, { 'X-Fake-Agent-Behavior': behavior });
          }
        }, slowDelayMs);
        response.once('close', () => clearTimeout(timer));
        return;
      }
      default:
        sendJson(response, 200, healthyFixture, { 'X-Fake-Agent-Behavior': behavior });
    }
  });

  // Exposed so a test can flip `.health.reachable`/`.alive`/etc. on an already
  // listening server to simulate the agent going down and recovering.
  server.health = health;
  return server;
}

if (require.main === module) {
  const port = nonNegativeInteger(process.env.PORT, 8080);
  const server = createFakeAgentServer();
  server.listen(port, '0.0.0.0', () => {
    process.stdout.write(`fake-agent listening on 0.0.0.0:${port}\n`);
  });
}

module.exports = { BEHAVIORS, createFakeAgentServer };
