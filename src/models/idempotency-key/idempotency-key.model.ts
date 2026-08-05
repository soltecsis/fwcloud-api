import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import Model from '../Model';
import type { IdempotencyKeyStatus } from './idempotency-key.types';

export const IDEMPOTENCY_KEY_TABLE = 'idempotency_key';

@Entity(IDEMPOTENCY_KEY_TABLE)
@Index('UQ_idempotency_key_scope_digest', ['operation', 'fwCloudId', 'userId', 'keyDigest'], {
  unique: true,
})
@Index('IDX_idempotency_key_status_expires_at', ['status', 'expiresAt'])
export class IdempotencyKey extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  /** Namespace segment identifying the protected operation, e.g. `assisted-profile.apply`. */
  @Column({ type: 'varchar', length: 128 })
  operation: string;

  @Column({ name: 'fwcloud_id', type: 'int' })
  fwCloudId: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  /** SHA-256 digest of the raw `Idempotency-Key` header; the raw value is never persisted. */
  @Column({ name: 'key_digest', type: 'char', length: 64 })
  keyDigest: string;

  @Column({ name: 'payload_hash', type: 'char', length: 64 })
  payloadHash: string;

  @Column({ type: 'varchar', length: 16 })
  status: IdempotencyKeyStatus;

  @Column({ name: 'response_status_code', type: 'int', nullable: true })
  responseStatusCode: number | null;

  @Column({ name: 'response_body', type: 'simple-json', nullable: true })
  responseBody: unknown;

  @Column({ name: 'response_headers', type: 'simple-json', nullable: true })
  responseHeaders: Record<string, string> | null;

  @Column({ name: 'request_id', type: 'varchar', length: 255, nullable: true })
  requestId: string | null;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  public getTableName(): string {
    return IDEMPOTENCY_KEY_TABLE;
  }
}
