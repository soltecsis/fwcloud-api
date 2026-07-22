import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { Repository } from 'typeorm';
import { AgentHttpClient } from '../../../../src/communications/assistant-agent/agent-http-client';
import {
  AgentBusyError,
  AgentConnectionError,
  AgentContractMismatchError,
  AgentReadTimeoutError,
  AgentUnknownError,
} from '../../../../src/communications/assistant-agent/agent-http-errors';
import db from '../../../../src/database/database-manager';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import {
  ASSISTANT_CONTRACT_CUSTOMS_AUDIT_CALL,
  AssistantContractCustomsService,
} from '../../../../src/models/assistant-contract/assistant-contract-customs.service';
import validSuccess from '../../../Unit/models/assistant-contract/fixtures/valid-success.json';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { expectRejectedAs } from '../../../utils/assertions';

const { createFakeAgentServer } = require('../../fake-agent/server');

type FakeAgentBehavior = 'healthy' | 'slow' | 'down' | 'busy' | 'malformed';

interface FakeAgentRequestObservation {
  behavior: FakeAgentBehavior;
  authenticated: boolean;
}

interface RunningFakeAgent {
  baseUrl: string;
  endpoint: string;
  requests: FakeAgentRequestObservation[];
}

const EXPECTED_API_KEY = 'fake-agent-e2e-service-key';
const GENERATION_REQUEST = {
  text: 'Create a firewall with WAN and LAN',
  mode: 'preview',
  target: { type: 'firewall' },
};

describe(describeName('Assisted Profile AgentHttpClient fake-agent E2E tests'), () => {
  let customsService: AssistantContractCustomsService;
  let auditRepository: Repository<AuditLog>;
  const activeClients: AgentHttpClient[] = [];
  const activeServers: http.Server[] = [];

  before(async () => {
    customsService = await testSuite.app.getService<AssistantContractCustomsService>(
      AssistantContractCustomsService.name,
    );
    auditRepository = db.getSource().manager.getRepository(AuditLog);
  });

  beforeEach(async () => {
    await clearContractAudits();
  });

  afterEach(async () => {
    await Promise.allSettled(activeClients.splice(0).map((client) => client.close()));
    await Promise.allSettled(activeServers.splice(0).map((server) => closeServer(server)));
  });

  after(async () => {
    await clearContractAudits();
  });

  function clearContractAudits(): Promise<unknown> {
    return auditRepository.delete({ call: ASSISTANT_CONTRACT_CUSTOMS_AUDIT_CALL });
  }

  function getContractAudits(): Promise<AuditLog[]> {
    return auditRepository.find({ where: { call: ASSISTANT_CONTRACT_CUSTOMS_AUDIT_CALL } });
  }

  async function listen(server: http.Server): Promise<AddressInfo> {
    await new Promise<void>((resolve, reject) => {
      const handleError = (error: Error): void => reject(error);
      server.once('error', handleError);
      server.listen(0, '127.0.0.1', () => {
        server.removeListener('error', handleError);
        resolve();
      });
    });

    return server.address() as AddressInfo;
  }

  async function closeServer(server: http.Server): Promise<void> {
    if (!server.listening) {
      server.closeAllConnections();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      // In particular, terminate the slow behavior's accepted socket instead
      // of waiting for a delayed response or a keep-alive timeout.
      server.closeAllConnections();
    });
  }

  async function startFakeAgent(behavior: FakeAgentBehavior): Promise<RunningFakeAgent> {
    const requests: FakeAgentRequestObservation[] = [];
    const server: http.Server = createFakeAgentServer({
      defaultBehavior: behavior,
      expectedApiKey: EXPECTED_API_KEY,
      slowDelayMs: 250,
      onGenerateRequest: (request: FakeAgentRequestObservation) => requests.push(request),
    });
    const address = await listen(server);
    activeServers.push(server);

    const baseUrl = `http://127.0.0.1:${address.port}`;
    return {
      baseUrl,
      endpoint: `${baseUrl}/generate`,
      requests,
    };
  }

  async function createClient(
    baseUrl: string,
    readTimeoutMs: number = 1_000,
  ): Promise<AgentHttpClient> {
    const client = await AgentHttpClient.create({
      configuration: {
        url: baseUrl,
        apiKey: EXPECTED_API_KEY,
        connectTimeoutMs: 250,
        readTimeoutMs,
        allowInsecureHttp: true,
      },
      contractGateway: customsService,
    });
    activeClients.push(client);
    return client;
  }

  async function startScenario(
    behavior: FakeAgentBehavior,
    readTimeoutMs?: number,
  ): Promise<RunningFakeAgent & { client: AgentHttpClient }> {
    const fakeAgent = await startFakeAgent(behavior);
    const client = await createClient(fakeAgent.baseUrl, readTimeoutMs);
    return { ...fakeAgent, client };
  }

  function requestContext(name: string): { requestId: string; correlationId: string } {
    return {
      requestId: `e2e-${name}-request`,
      correlationId: `e2e-${name}-correlation`,
    };
  }

  async function releasedLocalPort(): Promise<number> {
    const reservation = http.createServer();
    const address = await listen(reservation);
    await closeServer(reservation);
    return address.port;
  }

  it('sends an authenticated healthy request once and returns the API-1 validated proposal', async () => {
    const fakeAgent = await startScenario('healthy');

    const proposal = await fakeAgent.client.generate(GENERATION_REQUEST, requestContext('healthy'));

    expect(proposal).to.deep.equal(validSuccess);
    expect(fakeAgent.requests).to.deep.equal([{ behavior: 'healthy', authenticated: true }]);
    expect(await getContractAudits()).to.have.length(0);
  });

  it('does not retry when the slow fake agent exceeds the read timeout', async () => {
    const fakeAgent = await startScenario('slow', 30);

    const thrown = await expectRejectedAs(
      fakeAgent.client.generate(GENERATION_REQUEST, requestContext('slow')),
      AgentReadTimeoutError,
    );

    expect(thrown.attempts).to.equal(1);
    expect(fakeAgent.requests).to.deep.equal([{ behavior: 'slow', authenticated: true }]);
  });

  it('classifies busy without retrying and preserves Retry-After', async () => {
    const fakeAgent = await startScenario('busy');

    const thrown = await expectRejectedAs(
      fakeAgent.client.generate(GENERATION_REQUEST, requestContext('busy')),
      AgentBusyError,
    );

    expect(thrown.retryAfterSeconds).to.equal(2);
    expect(thrown.attempts).to.equal(1);
    expect(fakeAgent.requests).to.deep.equal([{ behavior: 'busy', authenticated: true }]);
  });

  it('rejects and safely audits a malformed HTTP 200 response through API-1', async () => {
    const fakeAgent = await startScenario('malformed');
    const { requestId, correlationId } = requestContext('malformed');

    const thrown = await expectRejectedAs(
      fakeAgent.client.generate(GENERATION_REQUEST, { requestId, correlationId }),
      AgentContractMismatchError,
    );

    expect(thrown.reason).to.equal('schema_violation');
    expect(thrown.httpStatus).to.equal(200);
    expect(thrown.attempts).to.equal(1);
    expect(thrown.requestId).to.equal(requestId);
    expect(thrown.correlationId).to.equal(correlationId);
    expect(fakeAgent.requests).to.deep.equal([{ behavior: 'malformed', authenticated: true }]);

    const entries = await getContractAudits();
    expect(entries).to.have.length(1);
    expect(entries[0].status).to.equal(502);

    const auditData = JSON.parse(entries[0].data) as Record<string, unknown>;
    expect(auditData.requestId).to.equal(requestId);
    expect(auditData.correlationId).to.equal(correlationId);
    expect(auditData.agentEndpoint).to.equal(fakeAgent.endpoint);
    expect(auditData).to.not.have.property('payload');
    expect(auditData).to.not.have.property('X-API-Key');

    const serializedAudit = JSON.stringify(auditData);
    expect(serializedAudit).to.not.contain(EXPECTED_API_KEY);
    expect(serializedAudit).to.not.contain('req-missing-intent');
  });

  it('routes an invalid UTF-8 HTTP 200 body through the audited contract gateway', async () => {
    let receivedApiKey: string | string[] | undefined;
    const server = http.createServer((request, response) => {
      request.resume();
      receivedApiKey = request.headers['x-api-key'];
      const invalidUtf8 = Buffer.from([0xc3, 0x28]);
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': invalidUtf8.length,
      });
      response.end(invalidUtf8);
    });
    const address = await listen(server);
    activeServers.push(server);
    const client = await createClient(`http://127.0.0.1:${address.port}`);

    const thrown = await expectRejectedAs(
      client.generate(GENERATION_REQUEST, requestContext('invalid-utf8')),
      AgentContractMismatchError,
    );

    expect(receivedApiKey).to.equal(EXPECTED_API_KEY);
    expect(thrown.reason).to.equal('malformed_payload');
    expect(await getContractAudits()).to.have.length(1);
  });

  it('retries a true pre-establishment connection failure exactly once', async () => {
    const port = await releasedLocalPort();
    const client = await createClient(`http://127.0.0.1:${port}`);

    const thrown = await expectRejectedAs(
      client.generate(GENERATION_REQUEST, requestContext('connection')),
      AgentConnectionError,
    );

    expect(thrown.attempts).to.equal(2);
  });

  it('does not retry the fake down reset after the server accepted the request', async () => {
    const fakeAgent = await startScenario('down');

    const thrown = await expectRejectedAs(
      fakeAgent.client.generate(GENERATION_REQUEST, requestContext('reset')),
      AgentUnknownError,
    );

    expect(thrown.attempts).to.equal(1);
    expect(fakeAgent.requests).to.deep.equal([{ behavior: 'down', authenticated: true }]);
  });
});
