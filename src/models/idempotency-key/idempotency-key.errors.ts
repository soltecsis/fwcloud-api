import type { ErrorPayload } from '../../fonaments/http/response-builder';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';

export const IDEMPOTENCY_KEY_PAYLOAD_MISMATCH = 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH' as const;
export const IDEMPOTENCY_KEY_IN_PROGRESS = 'IDEMPOTENCY_KEY_IN_PROGRESS' as const;

interface IdempotencyKeyErrorPayload extends ErrorPayload {
  code: string;
}

/**
 * The key was reused with a payload whose hash does not match the one it was
 * first bound to. Maps to `422 Unprocessable Entity` for the future apply
 * consumer. Never exposes the raw key, the stored/received payloads, or their
 * hashes — only a generic, safe message.
 */
export class IdempotencyKeyPayloadMismatchError extends HttpException {
  public readonly code = IDEMPOTENCY_KEY_PAYLOAD_MISMATCH;

  constructor(
    public readonly operation: string,
    public readonly fwCloudId: number,
    public readonly userId: number,
  ) {
    super('This Idempotency-Key has already been used with a different request payload.', 422);
  }

  public toResponse(): IdempotencyKeyErrorPayload {
    return {
      ...super.toResponse(),
      code: this.code,
    };
  }
}

/**
 * The key's authoritative record is still `in_progress` (another request owns
 * execution). Duplicate execution is forbidden, so this is surfaced rather
 * than silently re-running the protected operation.
 */
export class IdempotencyKeyInProgressError extends HttpException {
  public readonly code = IDEMPOTENCY_KEY_IN_PROGRESS;

  constructor(
    public readonly operation: string,
    public readonly fwCloudId: number,
    public readonly userId: number,
  ) {
    super('A request with this Idempotency-Key is already in progress.', 409);
  }

  public toResponse(): IdempotencyKeyErrorPayload {
    return {
      ...super.toResponse(),
      code: this.code,
    };
  }
}
