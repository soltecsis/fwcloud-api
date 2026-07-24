/*!
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { Repository } from 'typeorm';
import { AgentHttpClient } from '../../../../src/communications/assistant-agent/agent-http-client';
import { AssistedProfileHealthService } from '../../../../src/communications/assistant-agent/assisted-profile-health.service';
import { AssistantContractCustomsService } from '../../../../src/models/assistant-contract/assistant-contract-customs.service';
import db from '../../../../src/database/database-manager';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';

const { createFakeAgentServer } = require('../../fake-agent/server');

interface FakeAgentHealthState {
  reachable: boolean;
  status: number;
  alive: boolean;
  busy: boolean;
  modelReady: boolean;
  raw?: unknown;
}

type FakeAgentServer = http.Server & { health: FakeAgentHealthState };

interface RunningFakeAgent {
  server: http.Server;
  baseUrl: string;
  health: FakeAgentHealthState;
}

const EXPECTED_API_KEY = 'fake-agent-health-e2e-service-key';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe(describeName('Assisted Profile agent health fake-agent E2E tests'), () => {
  let customsService: AssistantContractCustomsService;
  let auditRepository: Repository<AuditLog>;
  const activeClients: AgentHttpClient[] = [];
  const activeServices: AssistedProfileHealthService[] = [];
  const activeServers: http.Server[] = [];

  before(async () => {
    customsService = await testSuite.app.getService<AssistantContractCustomsService>(
      AssistantContractCustomsService.name,
    );
    auditRepository = db.getSource().manager.getRepository(AuditLog);
  });

  afterEach(async () => {
    activeServices.splice(0).forEach((service) => service.stop());
    await Promise.allSettled(activeClients.splice(0).map((client) => client.close()));
    await Promise.allSettled(activeServers.splice(0).map((server) => closeServer(server)));
  });

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
      server.closeAllConnections();
    });
  }

  async function startFakeAgent(): Promise<RunningFakeAgent> {
    const server: FakeAgentServer = createFakeAgentServer({
      defaultBehavior: 'healthy',
      expectedApiKey: EXPECTED_API_KEY,
    });
    const address = await listen(server);
    activeServers.push(server);

    return { server, baseUrl: `http://127.0.0.1:${address.port}`, health: server.health };
  }

  async function createClient(baseUrl: string): Promise<AgentHttpClient> {
    const client = await AgentHttpClient.create({
      configuration: {
        url: baseUrl,
        apiKey: EXPECTED_API_KEY,
        connectTimeoutMs: 250,
        readTimeoutMs: 1_000,
        allowInsecureHttp: true,
      },
      contractGateway: customsService,
    });
    activeClients.push(client);
    return client;
  }

  async function createHealthService(
    client: AgentHttpClient,
    pollIntervalMs = 3_600_000,
  ): Promise<AssistedProfileHealthService> {
    const service = await AssistedProfileHealthService.create({
      agentHealthClient: client,
      configuration: { pollIntervalMs },
    });
    activeServices.push(service);
    return service;
  }

  it('reports ready for a healthy, idle agent over a real HTTP round trip', async () => {
    const fakeAgent = await startFakeAgent();
    const client = await createClient(fakeAgent.baseUrl);
    const service = await createHealthService(client);

    const snapshot = await service.checkNow();

    expect(snapshot).to.include({
      available: true,
      busy: false,
      alive: true,
      modelReady: true,
      status: 'ready',
    });
  });

  it('reports busy but available when the agent is processing a generation', async () => {
    const fakeAgent = await startFakeAgent();
    fakeAgent.health.busy = true;
    const client = await createClient(fakeAgent.baseUrl);
    const service = await createHealthService(client);

    const snapshot = await service.checkNow();

    expect(snapshot).to.include({ available: true, busy: true, status: 'busy' });
  });

  it('reports unavailable with model_not_ready when the model is not ready', async () => {
    const fakeAgent = await startFakeAgent();
    fakeAgent.health.modelReady = false;
    const client = await createClient(fakeAgent.baseUrl);
    const service = await createHealthService(client);

    const snapshot = await service.checkNow();

    expect(snapshot).to.include({
      available: false,
      status: 'unavailable',
      failureCode: 'model_not_ready',
    });
  });

  it('reports unavailable and keeps the loop alive when the agent is unreachable', async () => {
    const fakeAgent = await startFakeAgent();
    fakeAgent.health.reachable = false;
    const client = await createClient(fakeAgent.baseUrl);
    const service = await createHealthService(client);

    const snapshot = await service.checkNow();

    expect(snapshot.available).to.be.false;
    expect(snapshot.failureCode).to.equal('connection_error');

    // The loop is still usable: a second call does not throw or hang.
    const secondSnapshot = await service.checkNow();
    expect(secondSnapshot.failureCode).to.equal('connection_error');
  });

  it('classifies a malformed health payload as invalid_response without crashing', async () => {
    const fakeAgent = await startFakeAgent();
    fakeAgent.health.raw = { unexpected: 'shape' };
    const client = await createClient(fakeAgent.baseUrl);
    const service = await createHealthService(client);

    const snapshot = await service.checkNow();

    expect(snapshot.available).to.be.false;
    expect(snapshot.failureCode).to.equal('invalid_response');
  });

  it('recovers to ready after the agent comes back, with no restart and no manual reset', async () => {
    const fakeAgent = await startFakeAgent();
    fakeAgent.health.reachable = false;
    const client = await createClient(fakeAgent.baseUrl);
    const service = await createHealthService(client);

    const down = await service.checkNow();
    expect(down.available).to.be.false;
    expect(down.status).to.equal('unavailable');

    fakeAgent.health.reachable = true;
    const recovered = await service.checkNow();

    expect(recovered.available).to.be.true;
    expect(recovered.status).to.equal('ready');
  });

  it('polls automatically on a real interval and reflects a live agent recovery', async () => {
    const fakeAgent = await startFakeAgent();
    fakeAgent.health.reachable = false;
    const client = await createClient(fakeAgent.baseUrl);
    const service = await createHealthService(client, 25);

    service.start();
    await sleep(60);
    expect(service.snapshot.status).to.equal('unavailable');

    fakeAgent.health.reachable = true;
    await sleep(120);
    service.stop();

    expect(service.snapshot.status).to.equal('ready');
    expect(service.stats.checkCount).to.be.greaterThan(1);
  });

  it('does not create an audit log event for healthy, failing, or recovering polls', async () => {
    const fakeAgent = await startFakeAgent();
    const client = await createClient(fakeAgent.baseUrl);
    const service = await createHealthService(client);
    const auditCountBefore = await auditRepository.count();

    await service.checkNow();
    fakeAgent.health.reachable = false;
    await service.checkNow();
    fakeAgent.health.modelReady = false;
    fakeAgent.health.reachable = true;
    await service.checkNow();
    fakeAgent.health.modelReady = true;
    await service.checkNow();

    expect(await auditRepository.count()).to.equal(auditCountBefore);
  });

  it('sends the configured X-API-Key header on every health poll', async () => {
    const observedAuth: boolean[] = [];
    const server: http.Server = createFakeAgentServer({
      defaultBehavior: 'healthy',
      expectedApiKey: EXPECTED_API_KEY,
      onHealthRequest: ({ authenticated }: { authenticated: boolean }) =>
        observedAuth.push(authenticated),
    });
    const address = await listen(server);
    activeServers.push(server);
    const client = await createClient(`http://127.0.0.1:${address.port}`);
    const service = await createHealthService(client);

    await service.checkNow();

    expect(observedAuth).to.deep.equal([true]);
  });
});
