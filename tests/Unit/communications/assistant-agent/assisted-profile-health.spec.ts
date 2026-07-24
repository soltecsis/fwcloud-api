import { expect } from 'chai';
import { AbstractApplication } from '../../../../src/fonaments/abstract-application';
import { ServiceContainer } from '../../../../src/fonaments/services/service-container';
import {
  DEFAULT_HEALTH_PATH,
  DEFAULT_HEALTH_POLL_ENABLED,
  DEFAULT_HEALTH_POLL_INTERVAL_MS,
  DEFAULT_HEALTH_TIMEOUT_MS,
  resolveAssistedProfileHealthConfiguration,
} from '../../../../src/communications/assistant-agent/assisted-profile-health.configuration';
import { ConfigurationErrorException } from '../../../../src/config/exceptions/configuration-error.exception';
import { AssistedProfileHealthService } from '../../../../src/communications/assistant-agent/assisted-profile-health.service';
import { AssistedProfileHealthServiceProvider } from '../../../../src/communications/assistant-agent/assisted-profile-health.provider';
import type { AssistedProfileAgentHealthGateway } from '../../../../src/communications/assistant-agent/agent-http-client';
import {
  AgentHealthCheckError,
  type AgentHealthCheckOptions,
  type AgentHealthCheckResponse,
} from '../../../../src/communications/assistant-agent/agent-health.types';
import type { AssistedProfileHealthObservation } from '../../../../src/communications/assistant-agent/assisted-profile-health.types';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class QueueAgentHealthClient implements AssistedProfileAgentHealthGateway {
  public readonly calls: AgentHealthCheckOptions[] = [];
  private readonly outcomes: Array<
    AgentHealthCheckResponse | Error | Promise<AgentHealthCheckResponse>
  >;

  constructor(
    outcomes: Array<AgentHealthCheckResponse | Error | Promise<AgentHealthCheckResponse>> = [],
  ) {
    this.outcomes = [...outcomes];
  }

  public async getHealth(options: AgentHealthCheckOptions): Promise<AgentHealthCheckResponse> {
    this.calls.push(options);
    const outcome = this.outcomes.shift();
    if (outcome === undefined) {
      throw new Error('Unexpected extra getHealth call');
    }
    if (outcome instanceof Error) {
      throw outcome;
    }
    return outcome;
  }
}

const HEALTHY: AgentHealthCheckResponse = { alive: true, busy: false, modelReady: true };
const BUSY: AgentHealthCheckResponse = { alive: true, busy: true, modelReady: true };
const MODEL_NOT_READY: AgentHealthCheckResponse = { alive: true, busy: false, modelReady: false };
const NOT_ALIVE: AgentHealthCheckResponse = { alive: false, busy: false, modelReady: false };

describe('AssistedProfileHealthService unit tests', () => {
  it('defaults to unavailable before the first check', async () => {
    const service = await AssistedProfileHealthService.create({
      agentHealthClient: new QueueAgentHealthClient([]),
    });

    expect(service.snapshot).to.deep.equal({
      available: false,
      busy: false,
      alive: false,
      modelReady: false,
      status: 'unavailable',
    });
  });

  it('derives ready/available from a healthy, idle agent', async () => {
    const now = new Date('2026-07-24T09:30:00.000Z');
    const service = await AssistedProfileHealthService.create({
      agentHealthClient: new QueueAgentHealthClient([HEALTHY]),
      now: () => now,
    });

    const snapshot = await service.checkNow();

    expect(snapshot).to.deep.equal({
      available: true,
      busy: false,
      alive: true,
      modelReady: true,
      status: 'ready',
      failureCode: null,
      lastCheckedAt: now.toISOString(),
      lastSuccessfulCheckAt: now.toISOString(),
    });
  });

  it('keeps a busy agent available but reports status busy', async () => {
    const service = await AssistedProfileHealthService.create({
      agentHealthClient: new QueueAgentHealthClient([BUSY]),
    });

    const snapshot = await service.checkNow();

    expect(snapshot.available).to.be.true;
    expect(snapshot.busy).to.be.true;
    expect(snapshot.status).to.equal('busy');
  });

  it('reports unavailable with model_not_ready when the model is not ready', async () => {
    const service = await AssistedProfileHealthService.create({
      agentHealthClient: new QueueAgentHealthClient([MODEL_NOT_READY]),
    });

    const snapshot = await service.checkNow();

    expect(snapshot.available).to.be.false;
    expect(snapshot.status).to.equal('unavailable');
    expect(snapshot.failureCode).to.equal('model_not_ready');
  });

  it('reports unavailable when the agent explicitly reports alive:false', async () => {
    const service = await AssistedProfileHealthService.create({
      agentHealthClient: new QueueAgentHealthClient([NOT_ALIVE]),
    });

    const snapshot = await service.checkNow();

    expect(snapshot.available).to.be.false;
    expect(snapshot.alive).to.be.false;
    expect(snapshot.status).to.equal('unavailable');
  });

  it('reports unavailable and keeps polling when the agent is down', async () => {
    const checkedAt = new Date('2026-07-24T09:15:00.000Z');
    const client = new QueueAgentHealthClient([
      new AgentHealthCheckError('connection_error'),
      HEALTHY,
    ]);
    const service = await AssistedProfileHealthService.create({
      agentHealthClient: client,
      now: () => checkedAt,
    });

    const down = await service.checkNow();
    expect(down).to.deep.equal({
      available: false,
      busy: false,
      alive: false,
      modelReady: false,
      status: 'unavailable',
      failureCode: 'connection_error',
      lastCheckedAt: checkedAt.toISOString(),
      lastSuccessfulCheckAt: undefined,
    });

    const recovered = await service.checkNow();
    expect(recovered.available).to.be.true;
    expect(recovered.status).to.equal('ready');
    expect(client.calls).to.have.length(2);
  });

  it('classifies an invalid health response without crashing', async () => {
    const client = new QueueAgentHealthClient([new AgentHealthCheckError('invalid_response')]);
    const service = await AssistedProfileHealthService.create({ agentHealthClient: client });

    const snapshot = await service.checkNow();

    expect(snapshot.available).to.be.false;
    expect(snapshot.failureCode).to.equal('invalid_response');
  });

  it('falls back to connection_error for an unexpected thrown value', async () => {
    const client = new QueueAgentHealthClient([new Error('boom')]);
    const service = await AssistedProfileHealthService.create({ agentHealthClient: client });

    const snapshot = await service.checkNow();

    expect(snapshot.failureCode).to.equal('connection_error');
  });

  it('never throws when built without an app or an agentHealthClient override', async () => {
    const service = await AssistedProfileHealthService.create({});

    const snapshot = await service.checkNow();

    expect(snapshot.available).to.be.false;
    expect(snapshot.failureCode).to.equal('connection_error');
  });

  it('recovers without requiring a restart and preserves the last successful timestamp', async () => {
    const firstSuccess = new Date('2026-07-24T09:00:00.000Z');
    const failureAt = new Date('2026-07-24T09:00:30.000Z');
    const timestamps = [firstSuccess, failureAt];
    const client = new QueueAgentHealthClient([HEALTHY, new AgentHealthCheckError('timeout')]);
    const service = await AssistedProfileHealthService.create({
      agentHealthClient: client,
      now: () => timestamps.shift() ?? failureAt,
    });

    const ready = await service.checkNow();
    expect(ready.status).to.equal('ready');
    expect(ready.lastSuccessfulCheckAt).to.equal(firstSuccess.toISOString());

    const unavailable = await service.checkNow();
    expect(unavailable.status).to.equal('unavailable');
    expect(unavailable.failureCode).to.equal('timeout');
    // The last successful contact is not lost just because this poll failed.
    expect(unavailable.lastSuccessfulCheckAt).to.equal(firstSuccess.toISOString());
  });

  it('does not start a second concurrent health request while one is pending', async () => {
    const gate = deferred<AgentHealthCheckResponse>();
    const client = new QueueAgentHealthClient([gate.promise]);
    const service = await AssistedProfileHealthService.create({ agentHealthClient: client });

    const first = service.checkNow();
    const second = service.checkNow();
    // Let the pending microtasks inside performCheck() reach getHealth().
    await sleep(0);

    expect(client.calls).to.have.length(1);

    gate.resolve(HEALTHY);
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(client.calls).to.have.length(1);
    expect(firstResult).to.deep.equal(secondResult);
  });

  it('allows the next check once the in-flight one settles', async () => {
    const client = new QueueAgentHealthClient([HEALTHY, HEALTHY]);
    const service = await AssistedProfileHealthService.create({ agentHealthClient: client });

    await service.checkNow();
    await service.checkNow();

    expect(client.calls).to.have.length(2);
  });

  it('logs only on state transitions, not on unchanged repeated polls', async () => {
    const observations: AssistedProfileHealthObservation[] = [];
    const client = new QueueAgentHealthClient([HEALTHY, HEALTHY, MODEL_NOT_READY, MODEL_NOT_READY]);
    const service = await AssistedProfileHealthService.create({
      agentHealthClient: client,
      observer: { record: (observation) => observations.push(observation) },
    });

    await service.checkNow(); // unavailable -> ready: transition
    await service.checkNow(); // ready -> ready: no transition
    await service.checkNow(); // ready -> unavailable(model_not_ready): transition
    await service.checkNow(); // unavailable -> unavailable(same code): no transition

    expect(observations.map((observation) => observation.transitioned)).to.deep.equal([
      true,
      false,
      true,
      false,
    ]);
    expect(service.stats).to.include({
      checkCount: 4,
      successCount: 4,
      failureCount: 0,
      transitionCount: 2,
    });
  });

  it('never exposes a health response body or credential-like values to observations', async () => {
    const observations: AssistedProfileHealthObservation[] = [];
    const client = new QueueAgentHealthClient([HEALTHY]);
    const service = await AssistedProfileHealthService.create({
      agentHealthClient: client,
      observer: { record: (observation) => observations.push(observation) },
    });

    await service.checkNow();

    const serialized = JSON.stringify(observations);
    expect(serialized).to.not.contain('api-key');
    expect(serialized).to.not.contain('X-API-Key');
  });

  it('runs the first check at startup without waiting for a full interval', async () => {
    const gate = deferred<AgentHealthCheckResponse>();
    const client = new QueueAgentHealthClient([gate.promise]);
    const service = await AssistedProfileHealthService.create({
      agentHealthClient: client,
      // An interval far longer than the test lets a stray second tick prove
      // itself impossible, instead of racing a short one.
      configuration: { pollIntervalMs: 3_600_000 },
    });

    expect(service.snapshot.status).to.equal('unavailable');
    service.start();

    await sleep(20);
    expect(client.calls).to.have.length(1);

    gate.resolve(HEALTHY);
    await sleep(20);
    expect(service.snapshot.status).to.equal('ready');
    service.stop();
  });

  it('reschedules the next check only after the previous one settles', async () => {
    const first = deferred<AgentHealthCheckResponse>();
    const second = deferred<AgentHealthCheckResponse>();
    const client = new QueueAgentHealthClient([first.promise, second.promise]);
    const service = await AssistedProfileHealthService.create({
      agentHealthClient: client,
      configuration: { pollIntervalMs: 10 },
    });

    service.start();
    await sleep(30);
    // The first check is still pending, so no second attempt was scheduled
    // yet even though several 10ms intervals have elapsed.
    expect(client.calls).to.have.length(1);

    first.resolve(HEALTHY);
    await sleep(30);
    // The second check is itself now in flight (blocked on its own gate), so
    // no matter how many extra intervals elapse a third can never start yet.
    expect(client.calls).to.have.length(2);
    service.stop();
    second.resolve(HEALTHY);
  });

  it('start() is idempotent: three calls trigger exactly one immediate check', async () => {
    const gate = deferred<AgentHealthCheckResponse>();
    const client = new QueueAgentHealthClient([gate.promise]);
    const service = await AssistedProfileHealthService.create({
      agentHealthClient: client,
      configuration: { pollIntervalMs: 3_600_000 },
    });

    service.start();
    service.start();
    service.start();

    await sleep(20);
    expect(client.calls).to.have.length(1);

    gate.resolve(HEALTHY);
    service.stop();
  });

  it('does not poll when disabled', async () => {
    const client = new QueueAgentHealthClient([]);
    const service = await AssistedProfileHealthService.create({
      agentHealthClient: client,
      configuration: { enabled: false, pollIntervalMs: 10 },
    });

    service.start();
    await sleep(30);
    service.stop();

    expect(client.calls).to.have.length(0);
    expect(service.snapshot.status).to.equal('unavailable');
  });

  it('close() stops the polling loop for clean shutdown', async () => {
    const client = new QueueAgentHealthClient([HEALTHY, HEALTHY, HEALTHY]);
    const service = await AssistedProfileHealthService.create({
      agentHealthClient: client,
      configuration: { pollIntervalMs: 10 },
    });

    service.start();
    await sleep(15);
    await service.close();
    const callsAtClose = client.calls.length;

    await sleep(30);
    expect(client.calls.length).to.equal(callsAtClose);
  });
});

describe('AssistedProfileHealthService configuration unit tests', () => {
  it('applies documented defaults', () => {
    const configuration = resolveAssistedProfileHealthConfiguration();
    expect(configuration).to.deep.equal({
      enabled: DEFAULT_HEALTH_POLL_ENABLED,
      pollIntervalMs: DEFAULT_HEALTH_POLL_INTERVAL_MS,
      timeoutMs: DEFAULT_HEALTH_TIMEOUT_MS,
      path: DEFAULT_HEALTH_PATH,
    });
  });

  it('accepts coerced string values', () => {
    const configuration = resolveAssistedProfileHealthConfiguration({
      enabled: 'false',
      pollIntervalMs: '15000',
      timeoutMs: '2000',
      path: '/api/v1/health',
    });
    expect(configuration).to.deep.equal({
      enabled: false,
      pollIntervalMs: 15000,
      timeoutMs: 2000,
      path: '/api/v1/health',
    });
  });

  for (const invalid of [-1, 0, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '', '1.5', 'many']) {
    it(`rejects invalid poll interval ${String(invalid)}`, () => {
      expect(() =>
        resolveAssistedProfileHealthConfiguration({ pollIntervalMs: invalid as never }),
      ).to.throw(ConfigurationErrorException);
    });

    it(`rejects invalid timeout ${String(invalid)}`, () => {
      expect(() =>
        resolveAssistedProfileHealthConfiguration({ timeoutMs: invalid as never }),
      ).to.throw(ConfigurationErrorException);
    });
  }

  for (const invalid of ['yes', 'no', '1', '0', 1, 0, {}, []]) {
    it(`rejects an unsupported boolean value ${JSON.stringify(invalid)}`, () => {
      expect(() =>
        resolveAssistedProfileHealthConfiguration({ enabled: invalid as never }),
      ).to.throw(ConfigurationErrorException);
    });
  }

  for (const invalid of ['', 'health', 'no-leading-slash']) {
    it(`rejects an invalid health path "${invalid}"`, () => {
      expect(() => resolveAssistedProfileHealthConfiguration({ path: invalid })).to.throw(
        ConfigurationErrorException,
      );
    });
  }
});

describe('AssistedProfileHealthService provider unit tests', () => {
  it('returns one configured in-flight singleton to concurrent first callers', async () => {
    const application = {
      config: {
        get: (key: string): unknown => {
          if (key === 'assisted_profile.health') {
            return {
              poll_enabled: false,
              poll_interval_ms: 5_000,
              timeout_ms: 3_000,
              path: '/health',
            };
          }
          return undefined;
        },
      },
      logger: () => ({
        info: () => undefined,
        warn: () => undefined,
      }),
    } as unknown as AbstractApplication;
    const container = new ServiceContainer(application);
    new AssistedProfileHealthServiceProvider(application).register(container);

    const [first, second] = await Promise.all([
      container.get<AssistedProfileHealthService>(AssistedProfileHealthService.name),
      container.get<AssistedProfileHealthService>(AssistedProfileHealthService.name),
    ]);

    expect(first).to.equal(second);
    expect(first.pollIntervalMs).to.equal(5_000);
    await container.close();
  });
});
