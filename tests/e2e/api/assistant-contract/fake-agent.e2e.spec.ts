import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { AssistantContractMismatchException } from '../../../../src/models/assistant-contract/assistant-contract-mismatch.exception';
import { AssistantContractCustomsService } from '../../../../src/models/assistant-contract/assistant-contract-customs.service';

const { createFakeAgentServer } = require('../../fake-agent/server');

interface FakeAgentResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: unknown;
}

interface GenerateOptions {
  timeoutMs?: number;
  useQuery?: boolean;
}

const GENERATION_REQUEST = JSON.stringify({
  text: 'Create a firewall with WAN and LAN',
  mode: 'preview',
  target: { type: 'firewall' },
});

describe(describeName('Assisted Profile fake-agent E2E tests'), () => {
  let server: http.Server;
  let baseUrl: string;
  let customsService: AssistantContractCustomsService;

  before(async () => {
    customsService = await testSuite.app.getService<AssistantContractCustomsService>(
      AssistantContractCustomsService.name,
    );
    server = createFakeAgentServer({ slowDelayMs: 200 });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  function generate(
    behavior: string,
    { timeoutMs = 1000, useQuery = false }: GenerateOptions = {},
  ): Promise<FakeAgentResponse> {
    return new Promise((resolve, reject) => {
      const url = `${baseUrl}/generate${useQuery ? `?behavior=${behavior}` : ''}`;
      const request = http.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(useQuery ? {} : { 'X-Fake-Agent-Behavior': behavior }),
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => {
            const rawBody = Buffer.concat(chunks).toString('utf8');
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: rawBody ? JSON.parse(rawBody) : null,
            });
          });
        },
      );

      request.setTimeout(timeoutMs, () => request.destroy(new Error('fake-agent client timeout')));
      request.once('error', reject);
      request.end(GENERATION_REQUEST);
    });
  }

  async function captureError<T extends Error>(promise: Promise<unknown>): Promise<T> {
    try {
      await promise;
    } catch (error) {
      return error as T;
    }

    throw new Error('Expected operation to fail');
  }

  it('healthy returns a fixture accepted by the API-1 contract gateway', async () => {
    const response = await generate('healthy');

    expect(response.status).to.equal(200);
    expect(response.headers['x-fake-agent-behavior']).to.equal('healthy');
    expect(await customsService.validate(response.body)).to.deep.equal(response.body);
  });

  it('slow delays long enough for the client timeout to abort the request', async () => {
    const thrown = await captureError<Error>(generate('slow', { timeoutMs: 30 }));

    expect(thrown).to.be.instanceOf(Error);
    expect(thrown.message).to.equal('fake-agent client timeout');
  });

  it('down resets the connection without stopping the fake-agent server', async () => {
    const thrown = await captureError<NodeJS.ErrnoException>(generate('down'));

    expect(thrown).to.be.instanceOf(Error);
    expect(thrown.code).to.equal('ECONNRESET');

    // The reset affects only that request; the service remains available.
    expect((await generate('healthy')).status).to.equal(200);
  });

  it('busy returns 429 with stable retry metadata and a readable error', async () => {
    const response = await generate('busy');

    expect(response.status).to.equal(429);
    expect(response.headers['retry-after']).to.equal('2');
    expect(response.body).to.deep.equal({
      code: 'AGENT_BUSY',
      message: 'The fake agent is currently busy.',
    });
  });

  it('malformed returns 200 but the API-1 gateway throws the typed mismatch', async () => {
    const response = await generate('malformed', { useQuery: true });

    expect(response.status).to.equal(200);

    const thrown = await captureError<AssistantContractMismatchException>(
      customsService.validate(response.body),
    );

    expect(thrown).to.be.instanceOf(AssistantContractMismatchException);
    expect(thrown.reason).to.equal('schema_violation');
    expect(thrown.status).to.equal(502);
  });
});
