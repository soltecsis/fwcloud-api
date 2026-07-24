import { expect } from 'chai';
import { AbstractApplication } from '../../../../src/fonaments/abstract-application';
import { ServiceContainer } from '../../../../src/fonaments/services/service-container';
import { ValidatedAssistedProfileProposal } from '../../../../src/models/assistant-contract/assistant-contract-customs';
import {
  DEFAULT_GENERATION_QUEUE_MAX_DEPTH,
  MAX_GENERATION_QUEUE_DEPTH,
  resolveGenerationQueueConfiguration,
} from '../../../../src/communications/assistant-agent/generation-queue.configuration';
import {
  ASSISTED_PROFILE_GENERATION_ALREADY_IN_PROGRESS,
  ASSISTED_PROFILE_GENERATION_QUEUE_SATURATED,
  GenerationAlreadyInProgressError,
  GenerationQueueSaturatedError,
} from '../../../../src/communications/assistant-agent/generation-queue.errors';
import { GenerationQueueProvider } from '../../../../src/communications/assistant-agent/generation-queue.provider';
import { GenerationQueue } from '../../../../src/communications/assistant-agent/generation-queue';
import {
  GENERATION_COMPLETED_EVENT,
  GENERATION_FAILED_EVENT,
  GENERATION_POSITION_CHANGED_EVENT,
  GENERATION_QUEUED_EVENT,
  GENERATION_STARTED_EVENT,
  GenerationQueueEvent,
  GenerationQueueObservation,
  GenerationQueueRequest,
} from '../../../../src/communications/assistant-agent/generation-queue.types';
import { ConfigurationErrorException } from '../../../../src/config/exceptions/configuration-error.exception';
import { expectRejectedAs } from '../../../utils/assertions';

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

function proposal(marker: number): ValidatedAssistedProfileProposal {
  return { marker } as unknown as ValidatedAssistedProfileProposal;
}

function queueRequest(
  generationId: string,
  userId: number,
  fwcloudId: number,
  execute: GenerationQueueRequest['execute'],
  channel?: GenerationQueueRequest['channel'],
): GenerationQueueRequest {
  return {
    generationId,
    userId,
    fwcloudId,
    requestId: `request-${generationId}`,
    execute,
    channel,
  };
}

describe('GenerationQueue unit tests', () => {
  it('strictly serializes concurrent callbacks in FIFO order', async () => {
    const queue = await GenerationQueue.create({ configuration: { maxDepth: 4 } });
    const gates = Array.from({ length: 5 }, () => deferred<ValidatedAssistedProfileProposal>());
    const startOrder: number[] = [];
    let active = 0;
    let maximumActive = 0;

    const completions = gates.map((gate, index) =>
      queue.enqueue(
        queueRequest(`gen-fifo-${index}`, index + 1, 20, async () => {
          startOrder.push(index);
          active += 1;
          maximumActive = Math.max(maximumActive, active);
          try {
            return await gate.promise;
          } finally {
            active -= 1;
          }
        }),
      ),
    );

    expect(startOrder).to.deep.equal([0]);
    expect(queue.queueDepth).to.equal(4);

    for (let index = 0; index < gates.length; index += 1) {
      gates[index].resolve(proposal(index));
      const result = await completions[index];
      expect(result.generationId).to.equal(`gen-fifo-${index}`);
      expect(result.proposal).to.deep.equal(proposal(index));
    }

    expect(startOrder).to.deep.equal([0, 1, 2, 3, 4]);
    expect(maximumActive).to.equal(1);
    expect(queue.stats).to.include({
      queueDepth: 0,
      activeGenerationId: null,
      enqueueCount: 5,
      completedCount: 5,
      failedCount: 0,
    });
  });

  it('rejects overflow immediately without executing the rejected callback', async () => {
    const queue = await GenerationQueue.create({ configuration: { maxDepth: 1 } });
    const firstGate = deferred<ValidatedAssistedProfileProposal>();
    const secondGate = deferred<ValidatedAssistedProfileProposal>();
    let rejectedExecutionCount = 0;

    const first = queue.enqueue(queueRequest('gen-overflow-active', 1, 1, () => firstGate.promise));
    const second = queue.enqueue(
      queueRequest('gen-overflow-waiting', 2, 1, () => secondGate.promise),
    );
    const thrown = await expectRejectedAs(
      queue.enqueue(
        queueRequest('gen-overflow-rejected', 3, 1, async () => {
          rejectedExecutionCount += 1;
          return proposal(3);
        }),
      ),
      GenerationQueueSaturatedError,
    );

    expect(thrown.code).to.equal(ASSISTED_PROFILE_GENERATION_QUEUE_SATURATED);
    expect(thrown.status).to.equal(503);
    expect(thrown.httpStatus).to.equal(503);
    expect(thrown.maxDepth).to.equal(1);
    expect(thrown.toResponse()).to.include({
      code: ASSISTED_PROFILE_GENERATION_QUEUE_SATURATED,
      maxDepth: 1,
    });
    expect(rejectedExecutionCount).to.equal(0);
    expect(queue.stats.overflowRejectionCount).to.equal(1);

    firstGate.resolve(proposal(1));
    await first;
    secondGate.resolve(proposal(2));
    await second;
  });

  it('defines depth zero as one active generation with no waiting jobs', async () => {
    const queue = await GenerationQueue.create({ configuration: { maxDepth: 0 } });
    const gate = deferred<ValidatedAssistedProfileProposal>();
    const active = queue.enqueue(queueRequest('gen-depth-zero', 1, 1, () => gate.promise));

    await expectRejectedAs(
      queue.enqueue(queueRequest('gen-no-waiting', 2, 1, async () => proposal(2))),
      GenerationQueueSaturatedError,
    );

    gate.resolve(proposal(1));
    await active;
  });

  it('returns the existing generation id for duplicate active and waiting jobs', async () => {
    const queue = await GenerationQueue.create({ configuration: { maxDepth: 2 } });
    const activeGate = deferred<ValidatedAssistedProfileProposal>();
    const waitingGate = deferred<ValidatedAssistedProfileProposal>();
    let duplicateExecutionCount = 0;

    const active = queue.enqueue(
      queueRequest('gen-duplicate-active', 10, 3, () => activeGate.promise),
    );
    const activeDuplicate = await expectRejectedAs(
      queue.enqueue(
        queueRequest('gen-never-active', 10, 3, async () => {
          duplicateExecutionCount += 1;
          return proposal(10);
        }),
      ),
      GenerationAlreadyInProgressError,
    );

    expect(activeDuplicate.code).to.equal(ASSISTED_PROFILE_GENERATION_ALREADY_IN_PROGRESS);
    expect(activeDuplicate.status).to.equal(409);
    expect(activeDuplicate.httpStatus).to.equal(409);
    expect(activeDuplicate.generationId).to.equal('gen-duplicate-active');
    expect(activeDuplicate.userId).to.equal(10);
    expect(activeDuplicate.fwcloudId).to.equal(3);
    expect(activeDuplicate.toResponse()).to.include({
      code: ASSISTED_PROFILE_GENERATION_ALREADY_IN_PROGRESS,
      generation_id: 'gen-duplicate-active',
    });

    const waiting = queue.enqueue(
      queueRequest('gen-duplicate-waiting', 11, 3, () => waitingGate.promise),
    );
    const waitingDuplicate = await expectRejectedAs(
      queue.enqueue(
        queueRequest('gen-never-waiting', 11, 3, async () => {
          duplicateExecutionCount += 1;
          return proposal(11);
        }),
      ),
      GenerationAlreadyInProgressError,
    );

    expect(waitingDuplicate.generationId).to.equal('gen-duplicate-waiting');
    expect(duplicateExecutionCount).to.equal(0);
    expect(queue.queueDepth).to.equal(1);
    expect(queue.stats.duplicateRejectionCount).to.equal(2);

    activeGate.resolve(proposal(10));
    await active;
    waitingGate.resolve(proposal(11));
    await waiting;
  });

  it('allows the same user in different FWClouds while keeping global serialization', async () => {
    const queue = await GenerationQueue.create({ configuration: { maxDepth: 1 } });
    const firstGate = deferred<ValidatedAssistedProfileProposal>();
    let secondStarted = false;

    const first = queue.enqueue(queueRequest('gen-cloud-one', 10, 1, () => firstGate.promise));
    const second = queue.enqueue(
      queueRequest('gen-cloud-two', 10, 2, async () => {
        secondStarted = true;
        return proposal(2);
      }),
    );

    expect(secondStarted).to.be.false;
    firstGate.resolve(proposal(1));
    await first;
    await second;
    expect(secondStarted).to.be.true;
  });

  it('releases the guard and starts the next job after any execution failure', async () => {
    const queue = await GenerationQueue.create({ configuration: { maxDepth: 2 } });
    const failureGate = deferred<ValidatedAssistedProfileProposal>();
    const nextGate = deferred<ValidatedAssistedProfileProposal>();
    const expectedFailure = Object.assign(new Error('safe unit failure'), {
      code: 'AGENT_READ_TIMEOUT',
    });
    let nextStarted = false;

    const failed = queue.enqueue(queueRequest('gen-failed', 10, 3, () => failureGate.promise)).then(
      () => null,
      (error: unknown) => error,
    );
    const next = queue.enqueue(
      queueRequest('gen-after-failure', 20, 3, async () => {
        nextStarted = true;
        return nextGate.promise;
      }),
    );

    failureGate.reject(expectedFailure);
    expect(await failed).to.equal(expectedFailure);
    expect(nextStarted).to.be.true;

    const retry = queue.enqueue(
      queueRequest('gen-retry-after-failure', 10, 3, async () => proposal(3)),
    );
    expect(queue.queueDepth).to.equal(1);

    nextGate.resolve(proposal(2));
    await next;
    await retry;
    expect(queue.stats.failedCount).to.equal(1);
    expect(queue.stats.completedCount).to.equal(2);
  });

  it('emits isolated lifecycle and FIFO position events on each request channel', async () => {
    const now = new Date('2026-07-24T08:00:00.000Z');
    const queue = await GenerationQueue.create({
      configuration: { maxDepth: 2 },
      now: () => now,
    });
    const gates = Array.from({ length: 3 }, () => deferred<ValidatedAssistedProfileProposal>());
    const events: GenerationQueueEvent[][] = [[], [], []];
    const channels = events.map((captured) => ({
      emit: (event: 'message', payload: GenerationQueueEvent): boolean => {
        expect(event).to.equal('message');
        captured.push(payload);
        return true;
      },
    }));

    const completions = gates.map((gate, index) =>
      queue.enqueue(
        queueRequest(`gen-events-${index}`, index + 1, 7, () => gate.promise, channels[index]),
      ),
    );

    expect(events[0].map((event) => event.event)).to.deep.equal([
      GENERATION_QUEUED_EVENT,
      GENERATION_STARTED_EVENT,
    ]);
    expect(events[0][0]).to.include({ position: 0, queue_depth: 0, status: 'queued' });
    expect(events[1][0]).to.include({ position: 1, queue_depth: 1, status: 'queued' });
    expect(events[2][0]).to.include({ position: 2, queue_depth: 2, status: 'queued' });

    gates[0].resolve(proposal(0));
    await completions[0];
    expect(events[0].at(-1)).to.include({
      event: GENERATION_COMPLETED_EVENT,
      status: 'completed',
      queue_depth: 2,
    });
    expect(events[1].at(-1)).to.include({
      event: GENERATION_STARTED_EVENT,
      position: 0,
      queue_depth: 1,
    });
    expect(events[2].at(-1)).to.include({
      event: GENERATION_POSITION_CHANGED_EVENT,
      position: 1,
      queue_depth: 1,
    });

    gates[1].reject(new Error('expected event failure'));
    await expectRejectedAs(completions[1], Error);
    expect(events[1].at(-1)).to.include({
      event: GENERATION_FAILED_EVENT,
      status: 'failed',
      queue_depth: 1,
    });
    expect(events[2].at(-1)).to.include({
      event: GENERATION_STARTED_EVENT,
      position: 0,
      queue_depth: 0,
    });

    gates[2].resolve(proposal(2));
    await completions[2];

    for (let index = 0; index < events.length; index += 1) {
      for (const event of events[index]) {
        expect(event.generation_id).to.equal(`gen-events-${index}`);
        expect(event.fwcloud_id).to.equal(7);
        expect(event.user_id).to.equal(index + 1);
        expect(event.timestamp).to.equal(now.toISOString());
      }
    }
  });

  it('contains Channel and observer failures without changing generation outcomes', async () => {
    const observations: GenerationQueueObservation[] = [];
    const queue = await GenerationQueue.create({
      observer: {
        record: (observation) => {
          observations.push(observation);
          throw new Error('observer unavailable');
        },
      },
    });
    const result = await queue.enqueue(
      queueRequest('gen-observer-resilience', 1, 1, async () => proposal(1), {
        emit: () => {
          throw new Error('channel unavailable');
        },
      }),
    );

    expect(result.proposal).to.deep.equal(proposal(1));
    expect(observations.map((observation) => observation.type)).to.deep.equal([
      'enqueued',
      'started',
      'completed',
    ]);
  });

  it('never exposes proposal, error-message, or credential-like values to observations', async () => {
    const observations: GenerationQueueObservation[] = [];
    const queue = await GenerationQueue.create({
      observer: { record: (observation) => observations.push(observation) },
    });
    const proposalSecret = 'proposal-secret-never-observe';
    const errorSecret = 'agent-api-key-never-observe';

    await queue.enqueue(
      queueRequest('gen-safe-success-observation', 1, 1, async () => {
        return { proposalSecret } as unknown as ValidatedAssistedProfileProposal;
      }),
    );
    const expectedFailure = Object.assign(new Error(errorSecret), { code: errorSecret });
    await expectRejectedAs(
      queue.enqueue(
        queueRequest('gen-safe-failed-observation', 2, 1, async () => {
          throw expectedFailure;
        }),
      ),
      Error,
    );

    const serialized = JSON.stringify(observations);
    expect(serialized).to.not.contain(proposalSecret);
    expect(serialized).to.not.contain(errorSecret);
    expect(observations.at(-1)?.errorCode).to.equal('GENERATION_EXECUTION_FAILED');
  });

  it('reserves the active slot before synchronous Channel callbacks can re-enter enqueue', async () => {
    const queue = await GenerationQueue.create({ configuration: { maxDepth: 1 } });
    const firstGate = deferred<ValidatedAssistedProfileProposal>();
    let nestedCompletion: Promise<unknown>;
    let firstStarted = false;
    let nestedStarted = false;
    const channel = {
      emit: (event: 'message', payload: GenerationQueueEvent): boolean => {
        if (payload.event === GENERATION_QUEUED_EVENT && !nestedCompletion) {
          nestedCompletion = queue.enqueue(
            queueRequest('gen-reentrant-second', 2, 1, async () => {
              nestedStarted = true;
              return proposal(2);
            }),
          );
        }
        return event === 'message';
      },
    };

    const first = queue.enqueue(
      queueRequest(
        'gen-reentrant-first',
        1,
        1,
        async () => {
          firstStarted = true;
          return firstGate.promise;
        },
        channel,
      ),
    );

    expect(firstStarted).to.be.true;
    expect(nestedStarted).to.be.false;
    expect(queue.queueDepth).to.equal(1);

    firstGate.resolve(proposal(1));
    await first;
    await nestedCompletion;
    expect(nestedStarted).to.be.true;
  });

  it('generates a stable prefixed id before an accepted job starts', async () => {
    const queue = await GenerationQueue.create({
      generationIdFactory: () => 'gen_generated-unit-id',
    });
    let activeId: string | null = null;
    let executionId: string | null = null;
    const completion = queue.enqueue({
      userId: 1,
      fwcloudId: 1,
      execute: async ({ generationId }) => {
        activeId = queue.activeGenerationId;
        executionId = generationId;
        return proposal(1);
      },
    });

    const result = await completion;
    expect(activeId).to.equal('gen_generated-unit-id');
    expect(executionId).to.equal('gen_generated-unit-id');
    expect(result.generationId).to.equal('gen_generated-unit-id');
  });
});

describe('GenerationQueue configuration unit tests', () => {
  it('defaults to three waiting jobs and accepts zero', () => {
    expect(resolveGenerationQueueConfiguration().maxDepth).to.equal(
      DEFAULT_GENERATION_QUEUE_MAX_DEPTH,
    );
    expect(resolveGenerationQueueConfiguration({ maxDepth: 0 }).maxDepth).to.equal(0);
    expect(resolveGenerationQueueConfiguration({ maxDepth: '4' }).maxDepth).to.equal(4);
  });

  for (const invalid of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '', '1.5', 'many']) {
    it(`rejects invalid maximum depth ${String(invalid)}`, () => {
      expect(() => resolveGenerationQueueConfiguration({ maxDepth: invalid })).to.throw(
        ConfigurationErrorException,
      );
    });
  }

  it('rejects depths beyond the supported bound', () => {
    expect(() =>
      resolveGenerationQueueConfiguration({ maxDepth: MAX_GENERATION_QUEUE_DEPTH + 1 }),
    ).to.throw(ConfigurationErrorException);
  });
});

describe('GenerationQueue provider unit tests', () => {
  it('returns one configured in-flight singleton to concurrent first callers', async () => {
    const logObservations: string[] = [];
    const application = {
      config: {
        get: (key: string): unknown => {
          if (key === 'assisted_profile.generation_queue') {
            return { max_depth: 5 };
          }
          return undefined;
        },
      },
      logger: () => ({
        info: (message: string) => logObservations.push(message),
        warn: (message: string) => logObservations.push(message),
      }),
    } as unknown as AbstractApplication;
    const container = new ServiceContainer(application);
    new GenerationQueueProvider(application).register(container);

    const [first, second] = await Promise.all([
      container.get<GenerationQueue>(GenerationQueue.name),
      container.get<GenerationQueue>(GenerationQueue.name),
    ]);

    expect(first).to.equal(second);
    expect(first.maxDepth).to.equal(5);
    expect(container.services[0].instance).to.equal(first);
    await container.close();
  });
});
