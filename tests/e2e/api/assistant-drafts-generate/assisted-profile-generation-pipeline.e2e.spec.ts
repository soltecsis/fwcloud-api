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

/**
 * Full-pipeline E2E coverage for AssistedProfileGenerationService: real
 * GenerationQueue, real AgentHttpClient/API-1 contract gateway talking to a
 * locally started fake agent, real AssistedProfileProposalMapper, the real
 * ReplicationProfileValidationService domain validator, and real
 * FirewallProfileDraft/AuditLog persistence against the test database.
 *
 * This deliberately does NOT go through raw HTTP: the shared `testSuite.app`
 * DI container's own AgentHttpClient singleton is unusable in this test
 * environment (ASSISTED_PROFILE_AGENT_URL is intentionally unset, and
 * ServiceContainer.singleFlight() caches that failure permanently — see
 * assistant-availability.e2e.spec.ts). This file instead builds a standalone
 * AssistedProfileGenerationService (via `.create()`), reusing only the safe,
 * agent-independent app services (contract gateway, domain validator, draft
 * persistence, audit) and a from-scratch AgentHttpClient/GenerationQueue
 * pointed at a local fake agent, exactly like fake-agent.e2e.spec.ts already
 * does for AgentHttpClient itself. HTTP-layer concerns (auth, DTO
 * validation, the 202 response, rate limiting) are covered separately in
 * draft-generate.e2e.spec.ts, which do not require a working agent.
 *
 * A caller-supplied fake Channel captures every emitted progress payload in
 * order; it is the same minimal `emit('message', payload)` contract the real
 * Channel/Socket.IO wrapper implements, so it faithfully exercises this
 * service's Channel-emission behavior without needing a live socket.
 */

import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import type { Repository } from 'typeorm';
import { AgentHttpClient } from '../../../../src/communications/assistant-agent/agent-http-client';
import { GenerationQueue } from '../../../../src/communications/assistant-agent/generation-queue';
import {
  ASSISTED_PROFILE_GENERATION_AUDIT_CALL,
  AssistedProfileGenerationService,
} from '../../../../src/communications/assistant-agent/assisted-profile-generation.service';
import type { AssistedProfileGenerationProgressPayload } from '../../../../src/communications/assistant-agent/assisted-profile-generation-progress.types';
import { AssistantContractCustomsService } from '../../../../src/models/assistant-contract/assistant-contract-customs.service';
import { ReplicationProfileValidationService } from '../../../../src/models/replication-profile/replication-profile-validation.service';
import { FirewallProfileDraftStateService } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-state.service';
import { FirewallProfileDraft } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.model';
import { AuditLogService } from '../../../../src/models/audit/AuditLog.service';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { User } from '../../../../src/models/user/User';
import db from '../../../../src/database/database-manager';
import StringHelper from '../../../../src/utils/string.helper';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { createUser } from '../../../utils/utils';
import { waitFor } from '../../../utils/wait-for';
// Statically imported (in addition to the require.resolve() path lookups
// below) so tsc includes these fixtures in its program and copies them into
// dist/ — a plain string path is not enough for tsc to know to emit them.
import validSuccessFirewallFixture from '../../../Unit/models/assistant-contract/fixtures/valid-success-firewall.json';
import validDomainInvalidFixture from '../../../Unit/models/assistant-contract/fixtures/valid-domain-invalid.json';
import { AssistedProfileRejectedProposalCaptureService } from '../../../../src/models/assisted-profile-rejected-proposal/assisted-profile-rejected-proposal-capture.service';
import { AssistedProfileRejectedProposal } from '../../../../src/models/assisted-profile-rejected-proposal/assisted-profile-rejected-proposal.model';

const { createFakeAgentServer } = require('../../fake-agent/server');

const EXPECTED_API_KEY = 'assisted-profile-generation-e2e-key';
const FIXTURE_DIR = '../../../Unit/models/assistant-contract/fixtures';

interface FakeChannel {
  events: AssistedProfileGenerationProgressPayload[];
  emit: (event: 'message', payload: object) => boolean;
}

function fakeChannel(): FakeChannel {
  const events: AssistedProfileGenerationProgressPayload[] = [];
  return {
    events,
    emit: (_event, payload) => {
      events.push(payload as AssistedProfileGenerationProgressPayload);
      return true;
    },
  };
}

// This suite exercises real DB/HTTP round trips, so it uses a longer default
// timeout than wait-for's own (2000ms), matching this file's prior behavior.
const E2E_WAIT_TIMEOUT_MS = 5000;

/**
 * `needs_clarification` is a stopping point for that specific accept() call
 * just like `completed`/`failed`: no more events follow it until a caller
 * submits the clarification answer as a brand-new accept() call.
 */
function waitForTerminalEvent(channel: FakeChannel): Promise<void> {
  return waitFor(
    () =>
      channel.events.some((event) =>
        ['completed', 'failed', 'needs_clarification'].includes(event.stage),
      ),
    E2E_WAIT_TIMEOUT_MS,
  );
}

describe(describeName('Assisted Profile generation pipeline E2E tests'), () => {
  let customsService: AssistantContractCustomsService;
  let validationService: ReplicationProfileValidationService;
  let draftStateService: FirewallProfileDraftStateService;
  let auditLogService: AuditLogService;
  let rejectedProposalCaptureService: AssistedProfileRejectedProposalCaptureService;
  let draftRepository: Repository<FirewallProfileDraft>;
  let rejectedProposalRepository: Repository<AssistedProfileRejectedProposal>;
  let auditRepository: Repository<AuditLog>;
  let fwCloudRepository: Repository<FwCloud>;
  let fwCloud: FwCloud;
  let userA: User;
  let userB: User;

  const activeServers: http.Server[] = [];
  const draftIds: number[] = [];
  let generationCounter = 0;

  before(async () => {
    customsService = await testSuite.app.getService<AssistantContractCustomsService>(
      AssistantContractCustomsService.name,
    );
    validationService = await testSuite.app.getService<ReplicationProfileValidationService>(
      ReplicationProfileValidationService.name,
    );
    draftStateService = await testSuite.app.getService<FirewallProfileDraftStateService>(
      FirewallProfileDraftStateService.name,
    );
    auditLogService = await testSuite.app.getService<AuditLogService>(AuditLogService.name);
    rejectedProposalCaptureService =
      await testSuite.app.getService<AssistedProfileRejectedProposalCaptureService>(
        AssistedProfileRejectedProposalCaptureService.name,
      );
    draftRepository = db.getSource().manager.getRepository(FirewallProfileDraft);
    rejectedProposalRepository = db
      .getSource()
      .manager.getRepository(AssistedProfileRejectedProposal);
    auditRepository = db.getSource().manager.getRepository(AuditLog);
    fwCloudRepository = db.getSource().manager.getRepository(FwCloud);
  });

  beforeEach(async () => {
    fwCloud = await fwCloudRepository.save({
      name: StringHelper.randomize(10),
      locked: false,
      locked_by: null,
    });
    // created_by has a foreign key to `user`, so a real row is required.
    userA = await createUser({ role: 0 });
    userB = await createUser({ role: 0 });
  });

  afterEach(async () => {
    await Promise.allSettled(activeServers.splice(0).map(closeServer));
    await auditRepository.delete({
      call: ASSISTED_PROFILE_GENERATION_AUDIT_CALL,
      fwCloudId: fwCloud.id,
    });
    const ids = draftIds.splice(0);
    if (ids.length > 0) {
      await draftRepository.delete(ids);
    }
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

  async function startFakeAgent(
    options: Record<string, unknown> = {},
  ): Promise<{ baseUrl: string; server: http.Server }> {
    // No fixtureDirectory override: the fake-agent server already defaults it
    // to tests/Unit/models/assistant-contract/fixtures relative to its own
    // location, which is where every fixture used below already lives.
    const server: http.Server = createFakeAgentServer({
      expectedApiKey: EXPECTED_API_KEY,
      ...options,
    });
    const address = await listen(server);
    activeServers.push(server);
    return { baseUrl: `http://127.0.0.1:${address.port}`, server };
  }

  async function buildService(baseUrl: string): Promise<AssistedProfileGenerationService> {
    const queue = await GenerationQueue.create({ configuration: { maxDepth: 3 } });
    const agentClient = await AgentHttpClient.create({
      configuration: {
        url: baseUrl,
        apiKey: EXPECTED_API_KEY,
        connectTimeoutMs: 250,
        readTimeoutMs: 1000,
        allowInsecureHttp: true,
      },
      contractGateway: customsService,
    });

    return AssistedProfileGenerationService.create({
      queue,
      agentClient,
      validationService,
      draftStateService,
      auditLogService,
      // The real, application-wired capture service — not a stub. In the test
      // environment the capture flag keeps its production default (off), which
      // is exactly what the rejection tests below assert end-to-end.
      rejectedProposalCapture: rejectedProposalCaptureService,
      rateLimit: { maxRequests: 1000, windowMs: 60_000 },
      clarificationTtlMs: 60_000,
      generationIdFactory: () => `gen_pipeline_${++generationCounter}`,
      requestIdFactory: () => `req_pipeline_${generationCounter}`,
    });
  }

  function countRejectedProposals(): Promise<number> {
    return rejectedProposalRepository.count();
  }

  async function auditsFor(generationId: string): Promise<Array<Record<string, unknown>>> {
    const entries = await auditRepository.find({
      where: { call: ASSISTED_PROFILE_GENERATION_AUDIT_CALL, fwCloudId: fwCloud.id },
      order: { id: 'ASC' },
    });
    return entries
      .map((entry) => JSON.parse(entry.data) as Record<string, unknown>)
      .filter((data) => data.generationId === generationId);
  }

  /**
   * The audit write happens after the Channel `failed`/`completed` event is
   * emitted (see AssistedProfileGenerationService.run()), so a terminal
   * Channel event alone does not guarantee the audit row is already visible
   * to a fresh query. Poll for it explicitly instead of racing.
   */
  async function waitForAuditCount(generationId: string, expected: number): Promise<void> {
    await waitFor(
      async () => (await auditsFor(generationId)).length >= expected,
      E2E_WAIT_TIMEOUT_MS,
    );
  }

  it('persists a validated draft end-to-end against a healthy fake agent', async () => {
    const fakeAgent = await startFakeAgent({
      defaultBehavior: 'healthy',
      healthyFixturePath: require.resolve(`${FIXTURE_DIR}/valid-success-firewall.json`),
    });
    const service = await buildService(fakeAgent.baseUrl);
    const channel = fakeChannel();

    const { generationId } = await service.accept({
      fwCloudId: fwCloud.id,
      userId: userA.id,
      instruction: 'Create a firewall with WAN and LAN, allow LAN to WAN on https',
      channel,
    });
    await waitForTerminalEvent(channel);

    // The same Channel also carries GenerationQueue's own queued/started/
    // completed events (no `stage` field, an `event` field instead) — both
    // streams are expected to coexist, distinguished structurally.
    const progressEvents = channel.events.filter((event) => event.stage !== undefined);
    const queueEvents = channel.events.filter(
      (event) => (event as unknown as { event?: string }).event !== undefined,
    );
    const stages = progressEvents.map((event) => event.stage);
    expect(stages).to.deep.equal([
      'generating',
      'validating_contract',
      'mapping',
      'validating_domain',
      'persisting_draft',
      'completed',
    ]);
    expect(queueEvents.map((event) => (event as unknown as { event: string }).event)).to.include(
      'assistant.generation.queued',
    );
    for (const event of channel.events) {
      expect(event.generation_id).to.equal(generationId);
    }
    const completed = progressEvents[progressEvents.length - 1];
    expect(completed.draft_id).to.be.a('number');

    const draft = await draftRepository.findOneOrFail({ where: { id: completed.draft_id } });
    draftIds.push(draft.id);
    expect(draft.status).to.equal('validated');
    expect(draft.fwCloudId).to.equal(fwCloud.id);
    expect(draft.createdBy).to.equal(userA.id);
    expect(draft.contractVersion).to.equal('1.0.0');
    expect(draft.proposalHash).to.match(/^[0-9a-f]{64}$/);
    expect(draft.instructionOriginal).to.equal(
      'Create a firewall with WAN and LAN, allow LAN to WAN on https',
    );
    const proposal = draft.proposal as Record<string, unknown>;
    expect(proposal.targetKind).to.equal('firewall');
    expect(proposal.code).to.equal(validSuccessFirewallFixture.generated.profile.code);

    await waitForAuditCount(generationId, 1);
    const audits = await auditsFor(generationId);
    expect(audits).to.have.length(1);
    expect(audits[0].result).to.equal('draft_created');
    expect(audits[0].draftId).to.equal(draft.id);
    expect(JSON.stringify(audits[0])).to.not.contain(EXPECTED_API_KEY);
  });

  it('completes a generation after exactly one clarification round', async () => {
    const fakeAgent = await startFakeAgent({
      defaultBehavior: 'clarification',
      // The mappable fixture is used once the test flips behavior to
      // 'healthy' for round 2; the shared default valid-success.json fixture
      // has a null target and cannot be mapped.
      healthyFixturePath: require.resolve(`${FIXTURE_DIR}/valid-success-firewall.json`),
    });
    const service = await buildService(fakeAgent.baseUrl);
    const channel = fakeChannel();

    const first = await service.accept({
      fwCloudId: fwCloud.id,
      userId: userA.id,
      instruction: 'Open some ports',
      channel,
    });
    await waitForTerminalEvent(channel);

    const clarificationEvent = channel.events.find(
      (event) => event.stage === 'needs_clarification',
    );
    expect(clarificationEvent).to.exist;
    expect(clarificationEvent!.clarification!.question).to.equal(
      'Which service should be allowed?',
    );

    (fakeAgent.server as unknown as { behavior: string }).behavior = 'healthy';

    const secondChannel = fakeChannel();
    await service.accept({
      fwCloudId: fwCloud.id,
      userId: userA.id,
      clarification: { generationId: first.generationId, answer: 'https' },
      channel: secondChannel,
    });
    await waitForTerminalEvent(secondChannel);

    const completed = secondChannel.events[secondChannel.events.length - 1];
    expect(completed.stage).to.equal('completed');
    expect(completed.draft_id).to.be.a('number');
    draftIds.push(completed.draft_id!);

    await waitForAuditCount(first.generationId, 2);
    const audits = await auditsFor(first.generationId);
    expect(audits.map((entry) => entry.result)).to.deep.equal([
      'clarification_requested',
      'draft_created',
    ]);
  });

  it('ends without a draft when the second round also needs clarification', async () => {
    const fakeAgent = await startFakeAgent({ defaultBehavior: 'clarification' });
    const service = await buildService(fakeAgent.baseUrl);
    const channel = fakeChannel();

    const first = await service.accept({
      fwCloudId: fwCloud.id,
      userId: userA.id,
      instruction: 'Open some ports',
      channel,
    });
    await waitForTerminalEvent(channel);

    const secondChannel = fakeChannel();
    await service.accept({
      fwCloudId: fwCloud.id,
      userId: userA.id,
      clarification: { generationId: first.generationId, answer: 'still unclear' },
      channel: secondChannel,
    });
    await waitForTerminalEvent(secondChannel);

    const failedEvent = secondChannel.events[secondChannel.events.length - 1];
    expect(failedEvent.stage).to.equal('failed');
    expect(failedEvent.error!.code).to.equal('ASSISTED_PROFILE_CLARIFICATION_LIMIT_REACHED');

    const draftsForFwCloud = await draftRepository.find({ where: { fwCloudId: fwCloud.id } });
    expect(draftsForFwCloud).to.have.length(0);

    await waitForAuditCount(first.generationId, 2);
    const audits = await auditsFor(first.generationId);
    expect(audits.map((entry) => entry.result)).to.deep.equal([
      'clarification_requested',
      'clarification_limit_reached',
    ]);
  });

  it('rejects a schema-valid proposal that fails domain validation, with no draft created', async () => {
    const fakeAgent = await startFakeAgent({
      defaultBehavior: 'healthy',
      healthyFixturePath: require.resolve(`${FIXTURE_DIR}/valid-domain-invalid.json`),
    });
    const service = await buildService(fakeAgent.baseUrl);
    const channel = fakeChannel();

    const { generationId } = await service.accept({
      fwCloudId: fwCloud.id,
      userId: userA.id,
      instruction: 'Create a firewall and publish HTTPS to a role that was never defined',
      channel,
    });
    await waitForTerminalEvent(channel);

    const failedEvent = channel.events[channel.events.length - 1];
    expect(failedEvent.stage).to.equal('failed');
    expect(failedEvent.error!.code).to.equal('ASSISTED_PROFILE_DOMAIN_VALIDATION_FAILED');
    expect(failedEvent.error!.errors).to.be.an('array').with.length.greaterThan(0);
    expect(
      failedEvent.error!.errors!.some((item) =>
        item.message.includes(validDomainInvalidFixture.generated.rules[1].destinationRole),
      ),
    ).to.equal(true);

    const draftsForFwCloud = await draftRepository.find({ where: { fwCloudId: fwCloud.id } });
    expect(draftsForFwCloud).to.have.length(0);

    await waitForAuditCount(generationId, 1);
    const audits = await auditsFor(generationId);
    expect(audits[0].result).to.equal('domain_validation_failed');
  });

  describe('rejected-proposal capture, default configuration', () => {
    it('has capture disabled unless a deployment opts in', () => {
      expect(rejectedProposalCaptureService.enabled).to.equal(false);
      expect(rejectedProposalCaptureService.configuration.captureEnabled).to.equal(false);
    });

    it('writes no rejected-proposal record for a domain-validation rejection', async () => {
      const before = await countRejectedProposals();
      const fakeAgent = await startFakeAgent({
        defaultBehavior: 'healthy',
        healthyFixturePath: require.resolve(`${FIXTURE_DIR}/valid-domain-invalid.json`),
      });
      const service = await buildService(fakeAgent.baseUrl);
      const channel = fakeChannel();

      const { generationId } = await service.accept({
        fwCloudId: fwCloud.id,
        userId: userA.id,
        instruction: 'Create a firewall and publish HTTPS to a role that was never defined',
        channel,
      });
      await waitForTerminalEvent(channel);
      await waitForAuditCount(generationId, 1);

      // The client-visible rejection is unchanged, and nothing was captured.
      const failedEvent = channel.events[channel.events.length - 1];
      expect(failedEvent.error!.code).to.equal('ASSISTED_PROFILE_DOMAIN_VALIDATION_FAILED');
      expect(await countRejectedProposals()).to.equal(before);
      expect(await draftRepository.count({ where: { fwCloudId: fwCloud.id } })).to.equal(0);
    });

    it('writes no rejected-proposal record for a contract mismatch', async () => {
      const before = await countRejectedProposals();
      const fakeAgent = await startFakeAgent({ defaultBehavior: 'malformed' });
      const service = await buildService(fakeAgent.baseUrl);
      const channel = fakeChannel();

      const { generationId } = await service.accept({
        fwCloudId: fwCloud.id,
        userId: userA.id,
        instruction: 'Create a firewall',
        channel,
      });
      await waitForTerminalEvent(channel);
      await waitForAuditCount(generationId, 1);

      const failedEvent = channel.events[channel.events.length - 1];
      expect(failedEvent.error!.code).to.equal('ASSISTED_PROFILE_CONTRACT_MISMATCH');
      expect(await countRejectedProposals()).to.equal(before);
    });

    it('writes no rejected-proposal record for an accepted proposal', async () => {
      const before = await countRejectedProposals();
      const fakeAgent = await startFakeAgent({
        defaultBehavior: 'healthy',
        healthyFixturePath: require.resolve(`${FIXTURE_DIR}/valid-success-firewall.json`),
      });
      const service = await buildService(fakeAgent.baseUrl);
      const channel = fakeChannel();

      const { generationId } = await service.accept({
        fwCloudId: fwCloud.id,
        userId: userA.id,
        instruction: 'Create a firewall with WAN and LAN, allow LAN to WAN on https',
        channel,
      });
      await waitForTerminalEvent(channel);
      await waitForAuditCount(generationId, 1);

      const drafts = await draftRepository.find({ where: { fwCloudId: fwCloud.id } });
      expect(drafts).to.have.length(1);
      draftIds.push(drafts[0].id);
      expect(await countRejectedProposals()).to.equal(before);
    });
  });

  const fakeAgentFailureCases: Array<{
    behavior: string;
    expectedCode: string;
    expectedAuditOutcome: string;
  }> = [
    {
      behavior: 'down',
      expectedCode: 'AGENT_UNKNOWN_ERROR',
      expectedAuditOutcome: 'agent_connection_failed',
    },
    {
      behavior: 'busy',
      expectedCode: 'AGENT_BUSY',
      expectedAuditOutcome: 'agent_busy',
    },
    {
      behavior: 'malformed',
      expectedCode: 'ASSISTED_PROFILE_CONTRACT_MISMATCH',
      expectedAuditOutcome: 'contract_mismatch',
    },
  ];

  for (const testCase of fakeAgentFailureCases) {
    it(`produces a typed ${testCase.behavior} failure, no draft, an audit entry, and lets the queue continue`, async () => {
      const fakeAgent = await startFakeAgent({
        defaultBehavior: testCase.behavior,
        // Used once the test flips behavior to 'healthy' for the recovery
        // request; the shared default valid-success.json fixture has a null
        // target and cannot be mapped.
        healthyFixturePath: require.resolve(`${FIXTURE_DIR}/valid-success-firewall.json`),
      });
      const service = await buildService(fakeAgent.baseUrl);
      const channel = fakeChannel();

      const { generationId } = await service.accept({
        fwCloudId: fwCloud.id,
        userId: userA.id,
        instruction: 'Create a firewall',
        channel,
      });
      await waitForTerminalEvent(channel);

      const failedEvent = channel.events[channel.events.length - 1];
      expect(failedEvent.stage).to.equal('failed');
      expect(failedEvent.error!.code).to.equal(testCase.expectedCode);

      const draftsForFwCloud = await draftRepository.find({ where: { fwCloudId: fwCloud.id } });
      expect(draftsForFwCloud).to.have.length(0);

      await waitForAuditCount(generationId, 1);
      const audits = await auditsFor(generationId);
      expect(audits).to.have.length(1);
      expect(audits[0].result).to.equal(testCase.expectedAuditOutcome);

      // The queue must keep processing later requests after a failure.
      (fakeAgent.server as unknown as { behavior: string }).behavior = 'healthy';
      const recoveryChannel = fakeChannel();
      await service.accept({
        fwCloudId: fwCloud.id,
        userId: userB.id,
        instruction: 'Create another firewall',
        channel: recoveryChannel,
      });
      await waitForTerminalEvent(recoveryChannel);

      const recoveryCompleted = recoveryChannel.events[recoveryChannel.events.length - 1];
      expect(recoveryCompleted.stage).to.equal('completed');
      draftIds.push(recoveryCompleted.draft_id!);
    });
  }

  it('times out without retrying against a slow fake agent', async () => {
    const fakeAgent = await startFakeAgent({ defaultBehavior: 'slow', slowDelayMs: 300 });
    // A dedicated client with a readTimeoutMs well below slowDelayMs.
    const fastAgentClient = await AgentHttpClient.create({
      configuration: {
        url: fakeAgent.baseUrl,
        apiKey: EXPECTED_API_KEY,
        connectTimeoutMs: 250,
        readTimeoutMs: 50,
        allowInsecureHttp: true,
      },
      contractGateway: customsService,
    });
    const timeoutService = await AssistedProfileGenerationService.create({
      queue: await GenerationQueue.create({ configuration: { maxDepth: 3 } }),
      agentClient: fastAgentClient,
      validationService,
      draftStateService,
      auditLogService,
      rejectedProposalCapture: rejectedProposalCaptureService,
      rateLimit: { maxRequests: 1000, windowMs: 60_000 },
      generationIdFactory: () => `gen_pipeline_${++generationCounter}`,
      requestIdFactory: () => `req_pipeline_${generationCounter}`,
    });
    const channel = fakeChannel();

    const { generationId } = await timeoutService.accept({
      fwCloudId: fwCloud.id,
      userId: userA.id,
      instruction: 'Create a firewall',
      channel,
    });
    await waitForTerminalEvent(channel);

    const failedEvent = channel.events[channel.events.length - 1];
    expect(failedEvent.stage).to.equal('failed');
    expect(failedEvent.error!.code).to.equal('AGENT_READ_TIMEOUT');

    await waitForAuditCount(generationId, 1);
    const audits = await auditsFor(generationId);
    expect(audits[0].result).to.equal('agent_timeout');
  });
});
