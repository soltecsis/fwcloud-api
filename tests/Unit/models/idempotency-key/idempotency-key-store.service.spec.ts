import type { DataSource } from 'typeorm';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { DatabaseService } from '../../../../src/database/database.service';
import { IdempotencyKey } from '../../../../src/models/idempotency-key/idempotency-key.model';
import {
  IdempotencyKeyStore,
  type IdempotencyKeyStoreCreateOptions,
} from '../../../../src/models/idempotency-key/idempotency-key-store.service';
import {
  IdempotencyKeyInProgressError,
  IdempotencyKeyPayloadMismatchError,
} from '../../../../src/models/idempotency-key/idempotency-key.errors';
import type {
  AcquireIdempotencyKeyInput,
  IdempotencyKeyAcquisition,
  IdempotencyResponseSnapshot,
} from '../../../../src/models/idempotency-key/idempotency-key.types';
import { createUser } from '../../../utils/utils';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let uniqueKeyCounter = 0;
function uniqueKey(prefix: string): string {
  uniqueKeyCounter += 1;
  return `${prefix}-${Date.now()}-${uniqueKeyCounter}`;
}

/** Shared assert+narrow for the common "this acquisition must succeed" case. */
async function acquireAcquired(
  store: IdempotencyKeyStore,
  request: AcquireIdempotencyKeyInput,
): Promise<Extract<IdempotencyKeyAcquisition, { outcome: 'acquired' }>> {
  const acquisition = await store.acquire(request);
  expect(acquisition.outcome).to.equal('acquired');
  if (acquisition.outcome !== 'acquired') {
    throw new Error(`expected 'acquired', got '${acquisition.outcome}'`);
  }
  return acquisition;
}

describe(describeName('IdempotencyKeyStore Unit Tests'), () => {
  let dataSource: DataSource;
  let fwCloudId: number;
  let otherFwCloudId: number;
  let ownsFwCloud = false;
  let ownsOtherFwCloud = false;
  let userId: number;
  let otherUserId: number;
  const recordIds: number[] = [];

  before(async () => {
    dataSource = (await testSuite.app.getService<DatabaseService>(DatabaseService.name)).dataSource;

    const ensureFwCloud = async (name: string): Promise<{ id: number; owned: boolean }> => {
      const [existing] = await dataSource.query('SELECT id FROM fwcloud ORDER BY id LIMIT 1');
      if (existing) {
        return { id: Number(existing.id), owned: false };
      }
      const result = await dataSource.query('INSERT INTO fwcloud (name) VALUES (?)', [name]);
      return { id: Number(result.insertId), owned: true };
    };

    // Resolved first and awaited on its own: it starts with a conditional
    // SELECT, so it must not race the unconditional insert below (which
    // could otherwise be mistaken for the pre-existing row it looks for).
    const primary = await ensureFwCloud('Idempotency key tests');
    fwCloudId = primary.id;
    ownsFwCloud = primary.owned;

    // These three have no ordering dependency on each other.
    const [otherResult, primaryUser, secondaryUser] = await Promise.all([
      dataSource.query('INSERT INTO fwcloud (name) VALUES (?)', [
        'Idempotency key tests (other namespace)',
      ]),
      createUser({}),
      createUser({}),
    ]);
    otherFwCloudId = Number(otherResult.insertId);
    ownsOtherFwCloud = true;
    userId = primaryUser.id;
    otherUserId = secondaryUser.id;
  });

  after(async () => {
    if (ownsFwCloud) {
      await dataSource.query('DELETE FROM fwcloud WHERE id = ?', [fwCloudId]);
    }
    if (ownsOtherFwCloud) {
      await dataSource.query('DELETE FROM fwcloud WHERE id = ?', [otherFwCloudId]);
    }
  });

  afterEach(async () => {
    if (recordIds.length === 0) return;
    await dataSource.getRepository(IdempotencyKey).delete(recordIds.splice(0));
  });

  function track(recordId: number): number {
    recordIds.push(recordId);
    return recordId;
  }

  function createStore(
    overrides: Partial<IdempotencyKeyStoreCreateOptions> = {},
  ): Promise<IdempotencyKeyStore> {
    return IdempotencyKeyStore.create({
      dataSource,
      configuration: { ttlSeconds: 86_400 },
      ...overrides,
    });
  }

  function input(overrides: Partial<AcquireIdempotencyKeyInput> = {}): AcquireIdempotencyKeyInput {
    return {
      operation: 'assisted-profile.apply',
      fwCloudId,
      userId,
      idempotencyKey: uniqueKey('key'),
      payload: { draftId: 1, previewHash: 'a'.repeat(64) },
      ...overrides,
    };
  }

  const response: IdempotencyResponseSnapshot = {
    statusCode: 200,
    body: { applied: true, targetId: 42 },
  };

  it('registers a first request: acquired, digest+payloadHash stored, in_progress, ~TTL expiry', async () => {
    const store = await createStore();
    const acquisition = await acquireAcquired(
      store,
      input({ idempotencyKey: 'raw-key-should-not-be-stored' }),
    );
    track(acquisition.recordId);

    const record = await dataSource
      .getRepository(IdempotencyKey)
      .findOneByOrFail({ id: acquisition.recordId });
    expect(record.status).to.equal('in_progress');
    expect(record.keyDigest).to.match(/^[a-f0-9]{64}$/);
    expect(record.keyDigest).to.not.equal('raw-key-should-not-be-stored');
    expect(record.payloadHash).to.match(/^[a-f0-9]{64}$/);
    expect(record.fwCloudId).to.equal(fwCloudId);
    expect(record.userId).to.equal(userId);
    expect(record.expiresAt.getTime() - record.createdAt.getTime()).to.equal(86_400_000);
  });

  it('completes an acquired record: status completed, completedAt set, response persisted', async () => {
    const store = await createStore();
    const acquisition = await acquireAcquired(store, input());
    track(acquisition.recordId);

    await store.complete(acquisition.recordId, response);

    const record = await dataSource
      .getRepository(IdempotencyKey)
      .findOneByOrFail({ id: acquisition.recordId });
    expect(record.status).to.equal('completed');
    expect(record.completedAt).to.not.equal(null);
    expect(record.responseStatusCode).to.equal(200);
    expect(record.responseBody).to.deep.equal(response.body);
  });

  it('returns the cached response for the same key and payload, without re-executing', async () => {
    const store = await createStore();
    const request = input();
    let executions = 0;

    const first = await store.executeOnce(request, async () => {
      executions += 1;
      return response;
    });
    expect(first).to.deep.equal(response);

    const second = await store.executeOnce(request, async () => {
      executions += 1;
      return { statusCode: 500, body: 'must not be returned' };
    });
    expect(second).to.deep.equal(response);
    expect(executions).to.equal(1);

    const acquisition = await store.acquire(request);
    expect(acquisition.outcome).to.equal('cached');
    if (acquisition.outcome === 'cached') track(acquisition.recordId);
  });

  it('reports in_progress for the same key+payload while the owner has not completed yet', async () => {
    const store = await createStore();
    const request = input();

    const first = await acquireAcquired(store, request);
    track(first.recordId);

    const second = await store.acquire(request);
    expect(second.outcome).to.equal('in_progress');
    expect(second.recordId).to.equal(first.recordId);
  });

  it('rejects reuse with a different payload and leaves the original record unchanged', async () => {
    const store = await createStore();
    const request = input();

    const first = await acquireAcquired(store, request);
    track(first.recordId);
    await store.complete(first.recordId, response);

    const mismatch = await store.acquire({
      ...request,
      payload: { draftId: 1, previewHash: 'b'.repeat(64) },
    });
    expect(mismatch.outcome).to.equal('payload_mismatch');
    if (mismatch.outcome === 'payload_mismatch') {
      expect(mismatch.recordId).to.equal(first.recordId);
      expect(mismatch.storedPayloadHash).to.not.equal(mismatch.receivedPayloadHash);
    }

    const record = await dataSource
      .getRepository(IdempotencyKey)
      .findOneByOrFail({ id: first.recordId });
    expect(record.status).to.equal('completed');
    expect(record.responseBody).to.deep.equal(response.body);
  });

  it('throws a typed 422 via executeOnce for a payload mismatch, without invoking the callback', async () => {
    const store = await createStore();
    const request = input();

    const cleanupAcquisition = await store.acquire(request);
    if (cleanupAcquisition.outcome === 'acquired') {
      track(cleanupAcquisition.recordId);
      await store.complete(cleanupAcquisition.recordId, response);
    }

    let executed = false;
    let error: unknown;
    try {
      await store.executeOnce({ ...request, payload: { draftId: 999 } }, async () => {
        executed = true;
        return response;
      });
    } catch (caught) {
      error = caught;
    }

    expect(executed).to.equal(false);
    expect(error).to.be.instanceOf(IdempotencyKeyPayloadMismatchError);
    const mismatchError = error as IdempotencyKeyPayloadMismatchError;
    expect(mismatchError.status).to.equal(422);
    expect(mismatchError.code).to.equal('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH');
    expect(mismatchError.toResponse()).to.not.have.any.keys(
      'storedPayloadHash',
      'receivedPayloadHash',
    );
  });

  it('has exactly one execution for a concurrent duplicate submit with the same key and payload', async () => {
    const store = await createStore();
    const request = input();
    let executions = 0;
    const execute = async (): Promise<IdempotencyResponseSnapshot> => {
      executions += 1;
      await sleep(30);
      return response;
    };

    const results = await Promise.allSettled([
      store.executeOnce(request, execute),
      store.executeOnce(request, execute),
    ]);

    expect(executions).to.equal(1);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<IdempotencyResponseSnapshot> =>
        result.status === 'fulfilled',
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(fulfilled).to.have.length(1);
    expect(fulfilled[0].value).to.deep.equal(response);
    expect(rejected).to.have.length(1);
    expect(rejected[0].reason).to.be.instanceOf(IdempotencyKeyInProgressError);

    const finalAcquisition = await store.acquire(request);
    expect(finalAcquisition.outcome).to.equal('cached');
    if (finalAcquisition.outcome === 'cached') track(finalAcquisition.recordId);
  });

  it('acquires unrelated keys independently (no global serialization)', async () => {
    const store = await createStore();
    const [first, second] = await Promise.all([
      acquireAcquired(store, input({ idempotencyKey: uniqueKey('independent-a') })),
      acquireAcquired(store, input({ idempotencyKey: uniqueKey('independent-b') })),
    ]);

    track(first.recordId);
    track(second.recordId);
    expect(first.recordId).to.not.equal(second.recordId);
  });

  it('does not collide when the same raw key is reused in a different operation, fwcloud, or user', async () => {
    const store = await createStore();
    const sharedKey = uniqueKey('shared');
    const base = input({ idempotencyKey: sharedKey });

    const scoped = await acquireAcquired(store, base);
    track(scoped.recordId);

    const differentOperation = await acquireAcquired(store, {
      ...base,
      operation: 'assisted-profile.other',
    });
    const differentFwCloud = await acquireAcquired(store, { ...base, fwCloudId: otherFwCloudId });
    const differentUser = await acquireAcquired(store, { ...base, userId: otherUserId });

    track(differentOperation.recordId);
    track(differentFwCloud.recordId);
    track(differentUser.recordId);
  });

  it('treats an expired key as new and allows it to bind to a different payload', async () => {
    let now = new Date('2026-08-05T10:00:00.000Z');
    const store = await createStore({ now: () => now, configuration: { ttlSeconds: 60 } });
    const request = input({ payload: { draftId: 1 } });

    const first = await acquireAcquired(store, request);
    track(first.recordId);
    await store.complete(first.recordId, response);

    now = new Date(now.getTime() + 61_000);
    const second = await acquireAcquired(store, { ...request, payload: { draftId: 2 } });
    expect(second.recordId).to.equal(first.recordId);

    const record = await dataSource
      .getRepository(IdempotencyKey)
      .findOneByOrFail({ id: second.recordId });
    expect(record.status).to.equal('in_progress');
    expect(record.responseStatusCode).to.equal(null);
    expect(record.responseBody).to.equal(null);
    expect(record.expiresAt.getTime()).to.equal(now.getTime() + 60_000);
  });

  it('treats now == expires_at as expired (exact TTL boundary)', async () => {
    let now = new Date('2026-08-05T11:00:00.000Z');
    const store = await createStore({ now: () => now, configuration: { ttlSeconds: 100 } });
    const request = input();

    const first = await acquireAcquired(store, request);
    track(first.recordId);
    await store.complete(first.recordId, response);

    now = new Date(now.getTime() + 100_000); // exactly expires_at
    await acquireAcquired(store, request);
  });

  it('uses the configured TTL rather than a hardcoded 24h', async () => {
    const store = await createStore({ configuration: { ttlSeconds: 5 } });
    const acquisition = await acquireAcquired(store, input());
    track(acquisition.recordId);

    const record = await dataSource
      .getRepository(IdempotencyKey)
      .findOneByOrFail({ id: acquisition.recordId });
    expect(record.expiresAt.getTime() - record.createdAt.getTime()).to.equal(5000);
  });

  it('never persists or replays unsafe response headers', async () => {
    const store = await createStore();
    const acquisition = await acquireAcquired(store, input());
    track(acquisition.recordId);

    await store.complete(acquisition.recordId, {
      statusCode: 200,
      body: { ok: true },
      headers: {
        'Set-Cookie': 'session=abc123',
        Authorization: 'Bearer secret-token',
        'Content-Type': 'application/json',
      },
    });

    const cached = await store.getCompletedResponse(acquisition.recordId);
    expect(cached?.headers).to.deep.equal({ 'Content-Type': 'application/json' });

    const record = await dataSource
      .getRepository(IdempotencyKey)
      .findOneByOrFail({ id: acquisition.recordId });
    const serialized = JSON.stringify(record.responseHeaders ?? {});
    expect(serialized).to.not.include('session=abc123');
    expect(serialized).to.not.include('secret-token');
  });

  it('getCompletedResponse returns null for an in_progress or unknown record', async () => {
    const store = await createStore();
    const acquisition = await acquireAcquired(store, input());
    track(acquisition.recordId);

    expect(await store.getCompletedResponse(acquisition.recordId)).to.equal(null);
    expect(await store.getCompletedResponse(-1)).to.equal(null);
  });
});
