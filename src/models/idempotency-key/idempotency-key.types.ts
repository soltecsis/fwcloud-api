export const IDEMPOTENCY_KEY_STATUSES = ['in_progress', 'completed'] as const;

export type IdempotencyKeyStatus = (typeof IDEMPOTENCY_KEY_STATUSES)[number];

/**
 * Everything `IdempotencyKeyStore.acquire()` needs to resolve or create the
 * authoritative row. `payload` is the effective operation payload the caller
 * has already assembled (draft id, confirmed preview_hash, apply options,
 * ...) — the store never decides which HTTP fields belong in it, it only
 * hashes whatever is handed to it.
 */
export interface AcquireIdempotencyKeyInput {
  readonly operation: string;
  readonly fwCloudId: number;
  readonly userId: number;
  readonly idempotencyKey: string;
  readonly payload: unknown;
  readonly requestId?: string | null;
}

/** Minimal, replayable record of the protected operation's HTTP result. */
export interface IdempotencyResponseSnapshot {
  readonly statusCode: number;
  readonly body: unknown;
  readonly headers?: Record<string, string>;
}

export type IdempotencyKeyAcquisition =
  | {
      readonly outcome: 'acquired';
      readonly recordId: number;
    }
  | {
      readonly outcome: 'cached';
      readonly recordId: number;
      readonly response: IdempotencyResponseSnapshot;
    }
  | {
      readonly outcome: 'in_progress';
      readonly recordId: number;
    }
  | {
      readonly outcome: 'payload_mismatch';
      readonly recordId: number;
      readonly storedPayloadHash: string;
      readonly receivedPayloadHash: string;
    };
