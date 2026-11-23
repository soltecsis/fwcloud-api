/** Independent capabilities: exemption from locking is not authorization to read. */
export interface OperationPolicy {
  readonly kind: 'query' | 'mutation' | 'operation' | 'session';
  readonly viewerAllowed: boolean;
  readonly requiresCloudLock: boolean;
  readonly requiresConfirmationToken: boolean;
}

/** Use only after reviewing the handler and its services for writes and secrets. */
export const consultationOperation: Readonly<OperationPolicy> = Object.freeze({
  kind: 'query',
  viewerAllowed: true,
  requiresCloudLock: false,
  requiresConfirmationToken: false,
});

export const sessionOperation: Readonly<OperationPolicy> = Object.freeze({
  ...consultationOperation,
  kind: 'session',
});

/** A lock command manages ownership itself; it must not acquire a lock as a prerequisite. */
export const cloudLockOperation: Readonly<OperationPolicy> = Object.freeze({
  kind: 'operation',
  viewerAllowed: false,
  requiresCloudLock: false,
  requiresConfirmationToken: true,
});

declare module 'express-serve-static-core' {
  interface Request {
    /** Resolved once before role checks, confirmation and lock acquisition. */
    operationPolicy?: Readonly<OperationPolicy>;
  }
}
