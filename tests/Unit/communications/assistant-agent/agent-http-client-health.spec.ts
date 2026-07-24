import { expect } from 'chai';
import {
  AgentHttpClient,
  AssistedProfileContractGateway,
} from '../../../../src/communications/assistant-agent/agent-http-client';
import { AgentHttpClientConfigurationInput } from '../../../../src/communications/assistant-agent/agent-http-client.configuration';
import {
  AgentHealthCheckError,
  type AgentHealthFailureCode,
} from '../../../../src/communications/assistant-agent/agent-health.types';
import {
  AgentHttpTransport,
  AgentHttpTransportFailure,
  AgentHttpTransportFailureKind,
  AgentHttpTransportRequest,
  AgentHttpTransportResponse,
} from '../../../../src/communications/assistant-agent/agent-http.types';
import { expectRejectedAs } from '../../../utils/assertions';

const API_KEY = 'unit-test-agent-health-key-never-log';
const AGENT_URL = 'http://fake-agent.test:8080';

type TransportOutcome =
  | AgentHttpTransportResponse
  | Error
  | ((request: AgentHttpTransportRequest) => AgentHttpTransportResponse);

class QueueAgentHttpTransport implements AgentHttpTransport {
  public readonly requests: AgentHttpTransportRequest[] = [];
  private readonly outcomes: TransportOutcome[];

  constructor(outcomes: readonly TransportOutcome[]) {
    this.outcomes = [...outcomes];
  }

  public async request(request: AgentHttpTransportRequest): Promise<AgentHttpTransportResponse> {
    this.requests.push(request);
    const outcome = this.outcomes.shift();

    if (outcome === undefined) {
      throw new Error('Unexpected extra transport request');
    }
    if (outcome instanceof Error) {
      throw outcome;
    }
    if (typeof outcome === 'function') {
      return outcome(request);
    }
    return outcome;
  }
}

class UnusedContractGateway implements AssistedProfileContractGateway {
  public readonly acceptedSchemaVersions = ['1.0.0'];
  public async validate(): Promise<never> {
    throw new Error('getHealth must never call the contract gateway');
  }
}

function jsonResponse(status: number, body: unknown): AgentHttpTransportResponse {
  return { status, headers: {}, body: JSON.stringify(body) };
}

async function createClient(transport: AgentHttpTransport): Promise<AgentHttpClient> {
  const configuration: AgentHttpClientConfigurationInput = {
    url: AGENT_URL,
    apiKey: API_KEY,
    allowInsecureHttp: true,
  };
  return AgentHttpClient.create({
    configuration,
    contractGateway: new UnusedContractGateway(),
    transport,
  });
}

describe('AgentHttpClient.getHealth unit tests', () => {
  it('sends an authenticated GET to the configured health endpoint', async () => {
    const transport = new QueueAgentHttpTransport([
      jsonResponse(200, { alive: true, busy: false, model: { ready: true } }),
    ]);
    const client = await createClient(transport);

    const result = await client.getHealth({ timeoutMs: 1_000 });

    expect(result).to.deep.equal({ alive: true, busy: false, modelReady: true });
    expect(transport.requests).to.have.length(1);
    expect(transport.requests[0].method).to.equal('GET');
    expect(transport.requests[0].url.href).to.equal(`${AGENT_URL}/health`);
    expect(transport.requests[0].headers['X-API-Key']).to.equal(API_KEY);
    expect(transport.requests[0].body).to.equal('');
  });

  it('honors a configured healthPath', async () => {
    const transport = new QueueAgentHttpTransport([
      jsonResponse(200, { alive: true, busy: false, model: { ready: true } }),
    ]);
    const client = await AgentHttpClient.create({
      configuration: {
        url: AGENT_URL,
        apiKey: API_KEY,
        allowInsecureHttp: true,
        healthPath: '/api/v1/health',
      },
      contractGateway: new UnusedContractGateway(),
      transport,
    });

    await client.getHealth({ timeoutMs: 1_000 });

    expect(transport.requests[0].url.href).to.equal(`${AGENT_URL}/api/v1/health`);
  });

  it('reports a busy, model-ready agent without throwing', async () => {
    const transport = new QueueAgentHttpTransport([
      jsonResponse(200, { alive: true, busy: true, model: { ready: true } }),
    ]);
    const client = await createClient(transport);

    expect(await client.getHealth({ timeoutMs: 1_000 })).to.deep.equal({
      alive: true,
      busy: true,
      modelReady: true,
    });
  });

  it('reports an alive agent whose model is not ready without throwing', async () => {
    const transport = new QueueAgentHttpTransport([
      jsonResponse(200, { alive: true, busy: false, model: { ready: false } }),
    ]);
    const client = await createClient(transport);

    expect(await client.getHealth({ timeoutMs: 1_000 })).to.deep.equal({
      alive: true,
      busy: false,
      modelReady: false,
    });
  });

  it('reports an explicit alive:false payload without throwing', async () => {
    const transport = new QueueAgentHttpTransport([
      jsonResponse(200, { alive: false, busy: false, model: { ready: false } }),
    ]);
    const client = await createClient(transport);

    expect(await client.getHealth({ timeoutMs: 1_000 })).to.deep.equal({
      alive: false,
      busy: false,
      modelReady: false,
    });
  });

  for (const status of [199, 300, 401, 404, 500]) {
    it(`classifies HTTP ${status} as invalid_response`, async () => {
      const transport = new QueueAgentHttpTransport([jsonResponse(status, { ok: true })]);
      const client = await createClient(transport);

      const thrown = await expectRejectedAs(
        client.getHealth({ timeoutMs: 1_000 }),
        AgentHealthCheckError,
      );
      expect(thrown.failureCode).to.equal('invalid_response');
    });
  }

  it('classifies malformed JSON as invalid_response', async () => {
    const transport = new QueueAgentHttpTransport([
      { status: 200, headers: {}, body: '{not json' },
    ]);
    const client = await createClient(transport);

    const thrown = await expectRejectedAs(
      client.getHealth({ timeoutMs: 1_000 }),
      AgentHealthCheckError,
    );
    expect(thrown.failureCode).to.equal('invalid_response');
  });

  const shapeMismatches: Array<[string, unknown]> = [
    ['missing alive', { busy: false, model: { ready: true } }],
    ['non-boolean busy', { alive: true, busy: 'no', model: { ready: true } }],
    ['missing model', { alive: true, busy: false }],
    ['non-boolean model.ready', { alive: true, busy: false, model: { ready: 'yes' } }],
    ['null payload', null],
    ['array payload', []],
  ];

  for (const [description, payload] of shapeMismatches) {
    it(`classifies a contract shape mismatch (${description}) as invalid_response`, async () => {
      const transport = new QueueAgentHttpTransport([jsonResponse(200, payload)]);
      const client = await createClient(transport);

      const thrown = await expectRejectedAs(
        client.getHealth({ timeoutMs: 1_000 }),
        AgentHealthCheckError,
      );
      expect(thrown.failureCode).to.equal('invalid_response');
    });
  }

  const transportFailures: Array<[AgentHttpTransportFailureKind, AgentHealthFailureCode]> = [
    ['connection', 'connection_error'],
    ['tls', 'connection_error'],
    ['unknown', 'connection_error'],
    ['read_timeout', 'timeout'],
    ['cancelled', 'timeout'],
    ['invalid_http_response', 'invalid_response'],
  ];

  for (const [kind, expectedCode] of transportFailures) {
    it(`maps transport failure "${kind}" to failureCode "${expectedCode}"`, async () => {
      const transport = new QueueAgentHttpTransport([new AgentHttpTransportFailure(kind, false)]);
      const client = await createClient(transport);

      const thrown = await expectRejectedAs(
        client.getHealth({ timeoutMs: 1_000 }),
        AgentHealthCheckError,
      );
      expect(thrown.failureCode).to.equal(expectedCode);
    });
  }

  it('maps a wholly unexpected transport error to connection_error', async () => {
    const transport = new QueueAgentHttpTransport([new Error('unexpected boom')]);
    const client = await createClient(transport);

    const thrown = await expectRejectedAs(
      client.getHealth({ timeoutMs: 1_000 }),
      AgentHealthCheckError,
    );
    expect(thrown.failureCode).to.equal('connection_error');
  });

  it('never calls the contract gateway for a health check', async () => {
    const transport = new QueueAgentHttpTransport([
      jsonResponse(200, { alive: true, busy: false, model: { ready: true } }),
    ]);
    const client = await createClient(transport);

    // UnusedContractGateway.validate throws; a passing test proves getHealth
    // never routes an AG-3 payload through the apg.mvp.v1 gateway.
    await client.getHealth({ timeoutMs: 1_000 });
  });
});
