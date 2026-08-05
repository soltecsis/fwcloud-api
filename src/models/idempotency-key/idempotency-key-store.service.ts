import { DataSource, QueryFailedError, type EntityManager, type Repository } from 'typeorm';
import type { AbstractApplication } from '../../fonaments/abstract-application';
import { logger } from '../../fonaments/abstract-application';
import { Service } from '../../fonaments/services/service';
import { DatabaseService } from '../../database/database.service';
import { IdempotencyKey } from './idempotency-key.model';
import { IdempotencyPayloadHasher, digestIdempotencyKey } from './idempotency-payload.hasher';
import { sanitizeIdempotencyResponseHeaders } from './idempotency-response.sanitizer';
import {
  resolveIdempotencyKeyConfiguration,
  type IdempotencyKeyConfiguration,
  type IdempotencyKeyConfigurationInput,
} from './idempotency-key.configuration';
import {
  IdempotencyKeyInProgressError,
  IdempotencyKeyPayloadMismatchError,
} from './idempotency-key.errors';
import type {
  AcquireIdempotencyKeyInput,
  IdempotencyKeyAcquisition,
  IdempotencyResponseSnapshot,
} from './idempotency-key.types';

export interface IdempotencyKeyStoreCreateOptions {
  readonly configuration?: IdempotencyKeyConfigurationInput;
  readonly dataSource?: DataSource;
  readonly hasher?: IdempotencyPayloadHasher;
  /** Wall clock used for created/expires timestamps; overridable for deterministic tests. */
  readonly now?: () => Date;
}

/**
 * Centralized, database-backed `Idempotency-Key` store. Consumers must go
 * through `acquire()`/`complete()`/`getCompletedResponse()` (or the
 * `executeOnce()` convenience wrapper) rather than reading or writing
 * `idempotency_key` rows directly, so this remains the single place the
 * namespace, digest, payload-hash and TTL rules are enforced.
 *
 * See the ticket for the full contract; the short version:
 * - keys are namespaced by `(operation, fwcloud_id, user_id)`, never global;
 * - the raw key is never stored, only its SHA-256 digest;
 * - every key is bound to a SHA-256 hash of its effective payload
 *   (`IdempotencyPayloadHasher`), computed over a canonical JSON form;
 * - concurrency safety comes from the database (a unique index plus
 *   `SELECT ... FOR UPDATE`), never from in-memory locking;
 * - records expire lazily after a configurable TTL (default 24h) — an
 *   expired key is treated as new, no cleanup job required for correctness.
 */
export class IdempotencyKeyStore extends Service {
  private _configuration: IdempotencyKeyConfiguration;
  private _dataSource: DataSource;
  private _hasher: IdempotencyPayloadHasher;
  private _now: () => Date = () => new Date();

  public constructor(
    app: AbstractApplication | null,
    private readonly _overrides: IdempotencyKeyStoreCreateOptions = {},
  ) {
    super(app);
  }

  /** Creates an initialized store with explicit dependencies (tests/tools). */
  public static async create(
    options: IdempotencyKeyStoreCreateOptions = {},
  ): Promise<IdempotencyKeyStore> {
    return new IdempotencyKeyStore(null, options).build();
  }

  public async build(): Promise<IdempotencyKeyStore> {
    this._configuration = resolveIdempotencyKeyConfiguration(
      this._overrides.configuration ?? this.configurationFromApplication(),
    );
    this._hasher = this._overrides.hasher ?? new IdempotencyPayloadHasher();
    this._now = this._overrides.now ?? this._now;

    this._dataSource =
      this._overrides.dataSource ??
      (await this._app.getService<DatabaseService>(DatabaseService.name)).dataSource;

    return this;
  }

  public get configuration(): IdempotencyKeyConfiguration {
    return this._configuration;
  }

  /**
   * Claims a namespace+key for execution, or resolves it against whatever
   * record already exists there. Two concurrent first-touch calls race on
   * the `UQ_idempotency_key_scope_digest` unique index, not on anything in
   * process memory: exactly one plain `INSERT` succeeds, and the loser
   * recovers by reading the winner's committed row.
   */
  public async acquire(input: AcquireIdempotencyKeyInput): Promise<IdempotencyKeyAcquisition> {
    const keyDigest = digestIdempotencyKey(input.idempotencyKey);
    const payloadHash = this._hasher.calculate(input.payload);

    try {
      const recordId = await this.insertFresh(
        this._dataSource.getRepository(IdempotencyKey),
        input,
        keyDigest,
        payloadHash,
      );
      logger().info(
        `Idempotency key acquired: operation=${input.operation}, fwcloud=${input.fwCloudId}, ` +
          `user=${input.userId}, record=${recordId}.`,
      );
      return { outcome: 'acquired', recordId };
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) {
        throw error;
      }
    }

    return this.resolveExisting(input, keyDigest, payloadHash);
  }

  /**
   * Persists the owner's response and marks the record `completed`. Guarded
   * by `status = 'in_progress'` so a completion can never land on a record
   * whose ownership has since expired and been reset by a later caller — see
   * "Failure and Abandoned Execution": an unexpected failure must never
   * produce a fake successful cached result, and this guard is what keeps a
   * late/duplicate `complete()` call from overwriting a newer owner's record.
   */
  public async complete(recordId: number, response: IdempotencyResponseSnapshot): Promise<void> {
    const now = this._now();
    await this._dataSource
      .getRepository(IdempotencyKey)
      .createQueryBuilder()
      .update(IdempotencyKey)
      .set({
        status: 'completed',
        responseStatusCode: response.statusCode,
        responseBody: response.body ?? null,
        responseHeaders: sanitizeIdempotencyResponseHeaders(response.headers),
        completedAt: now,
        updatedAt: now,
      })
      .where('id = :recordId', { recordId })
      .andWhere('status = :expected', { expected: 'in_progress' })
      .execute();
  }

  public async getCompletedResponse(recordId: number): Promise<IdempotencyResponseSnapshot | null> {
    const record = await this._dataSource.getRepository(IdempotencyKey).findOneBy({ id: recordId });
    if (!record || record.status !== 'completed') {
      return null;
    }

    return this.toResponseSnapshot(record);
  }

  /**
   * High-level acquire/execute/complete cycle for a consumer that just wants
   * "run this once". Not coupled to any particular controller: `execute`
   * only needs to produce the response snapshot to cache. Nothing here
   * releases the record on failure by design — an `in_progress` record left
   * behind by a thrown `execute()` stays bounded by its own TTL (see the
   * class doc); the definitive apply-failure caching policy belongs to the
   * future apply endpoint, not this store.
   */
  public async executeOnce(
    input: AcquireIdempotencyKeyInput,
    execute: () => Promise<IdempotencyResponseSnapshot>,
  ): Promise<IdempotencyResponseSnapshot> {
    const acquisition = await this.acquire(input);

    switch (acquisition.outcome) {
      case 'cached':
        return acquisition.response;
      case 'in_progress':
        throw new IdempotencyKeyInProgressError(input.operation, input.fwCloudId, input.userId);
      case 'payload_mismatch':
        throw new IdempotencyKeyPayloadMismatchError(
          input.operation,
          input.fwCloudId,
          input.userId,
        );
      case 'acquired': {
        const response = await execute();
        await this.complete(acquisition.recordId, response);
        return response;
      }
    }
  }

  /**
   * Runs when a namespace+key row already exists — either still active (in
   * progress, completed, or bound to a different payload) or expired.
   * Serialized with `SELECT ... FOR UPDATE`: a locking read always returns
   * the latest committed row regardless of transaction isolation level, so a
   * second caller unblocked after an expired-reuse reset observes the
   * resetter's fresh `in_progress` row rather than a stale snapshot.
   */
  private async resolveExisting(
    input: AcquireIdempotencyKeyInput,
    keyDigest: string,
    payloadHash: string,
  ): Promise<IdempotencyKeyAcquisition> {
    return this._dataSource.transaction(async (manager: EntityManager) => {
      const repository = manager.getRepository(IdempotencyKey);
      const existing = await repository
        .createQueryBuilder('idempotency_key')
        .setLock('pessimistic_write')
        .where('idempotency_key.operation = :operation', { operation: input.operation })
        .andWhere('idempotency_key.fwcloud_id = :fwCloudId', { fwCloudId: input.fwCloudId })
        .andWhere('idempotency_key.user_id = :userId', { userId: input.userId })
        .andWhere('idempotency_key.key_digest = :keyDigest', { keyDigest })
        .getOne();

      if (!existing) {
        // Nothing in this store ever deletes a row, so the row that made our
        // insert fail must still be here. Surface this loudly rather than
        // silently recovering: quietly re-inserting would mask a real
        // invariant violation (e.g. a future cleanup job deleting rows this
        // store still expects to find).
        throw new Error(
          'IdempotencyKeyStore invariant violated: unique-index insert conflict but no ' +
            'matching row found under lock',
        );
      }

      const now = this._now();
      if (existing.expiresAt.getTime() <= now.getTime()) {
        logger().info(
          `Idempotency key expired and reused: operation=${input.operation}, ` +
            `fwcloud=${input.fwCloudId}, user=${input.userId}, record=${existing.id}.`,
        );
        const expiresAt = new Date(now.getTime() + this._configuration.ttlSeconds * 1000);
        await repository
          .createQueryBuilder()
          .update(IdempotencyKey)
          .set({
            payloadHash,
            status: 'in_progress',
            responseStatusCode: null,
            responseBody: null,
            responseHeaders: null,
            completedAt: null,
            requestId: input.requestId ?? null,
            createdAt: now,
            updatedAt: now,
            expiresAt,
          })
          .where('id = :recordId', { recordId: existing.id })
          .execute();
        return { outcome: 'acquired', recordId: existing.id };
      }

      if (existing.payloadHash !== payloadHash) {
        logger().info(
          `Idempotency key payload mismatch: operation=${input.operation}, ` +
            `fwcloud=${input.fwCloudId}, user=${input.userId}, record=${existing.id}.`,
        );
        return {
          outcome: 'payload_mismatch',
          recordId: existing.id,
          storedPayloadHash: existing.payloadHash,
          receivedPayloadHash: payloadHash,
        };
      }

      if (existing.status === 'completed') {
        logger().info(
          `Idempotency key cache hit: operation=${input.operation}, fwcloud=${input.fwCloudId}, ` +
            `user=${input.userId}, record=${existing.id}.`,
        );
        return {
          outcome: 'cached',
          recordId: existing.id,
          response: this.toResponseSnapshot(existing),
        };
      }

      return { outcome: 'in_progress', recordId: existing.id };
    });
  }

  private async insertFresh(
    repository: Repository<IdempotencyKey>,
    input: AcquireIdempotencyKeyInput,
    keyDigest: string,
    payloadHash: string,
  ): Promise<number> {
    const now = this._now();
    const inserted = await repository.insert({
      operation: input.operation,
      fwCloudId: input.fwCloudId,
      userId: input.userId,
      keyDigest,
      payloadHash,
      status: 'in_progress',
      requestId: input.requestId ?? null,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + this._configuration.ttlSeconds * 1000),
    });
    return Number(inserted.identifiers[0].id);
  }

  private toResponseSnapshot(
    record: Pick<IdempotencyKey, 'responseStatusCode' | 'responseBody' | 'responseHeaders'>,
  ): IdempotencyResponseSnapshot {
    return {
      statusCode: record.responseStatusCode as number,
      body: record.responseBody,
      ...(record.responseHeaders ? { headers: record.responseHeaders } : {}),
    };
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const code = (error as unknown as { code?: string }).code;
    const driverCode = (error as unknown as { driverError?: { code?: string } }).driverError?.code;
    return code === 'ER_DUP_ENTRY' || driverCode === 'ER_DUP_ENTRY';
  }

  private configurationFromApplication(): IdempotencyKeyConfigurationInput {
    if (!this._app) {
      return {};
    }

    const config = this._app.config.get('assisted_profile.idempotency');
    return { ttlSeconds: config.ttl_seconds };
  }
}
