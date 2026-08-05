import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Database-backed `Idempotency-Key` store, scoped by `(operation, fwcloud_id,
 * user_id, key_digest)`. The unique index on that tuple is the concurrency
 * guard: two simultaneous inserts for the same namespace and key can never
 * both create an authoritative row, and `IdempotencyKeyStore` recovers the
 * losing insert into a `cached` / `in_progress` / `payload_mismatch` outcome
 * instead of retrying blindly.
 */
export class CreateIdempotencyKey1785974400000 implements MigrationInterface {
  private readonly tableName = 'idempotency_key';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: this.tableName,
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'operation', type: 'varchar', length: '128' },
          { name: 'fwcloud_id', type: 'int' },
          { name: 'user_id', type: 'int' },
          { name: 'key_digest', type: 'char', length: '64' },
          { name: 'payload_hash', type: 'char', length: '64' },
          { name: 'status', type: 'varchar', length: '16' },
          { name: 'response_status_code', type: 'int', isNullable: true, default: null },
          { name: 'response_body', type: 'longtext', isNullable: true, default: null },
          { name: 'response_headers', type: 'longtext', isNullable: true, default: null },
          {
            name: 'request_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
            default: null,
          },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          { name: 'completed_at', type: 'timestamp', isNullable: true, default: null },
          // Every insert/update always sets this explicitly (see
          // IdempotencyKeyStore); the default only exists so CREATE TABLE
          // doesn't fall back to an implicit zero-date default, which some
          // servers' sql_mode (e.g. NO_ZERO_DATE) rejects outright.
          { name: 'expires_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys(this.tableName, [
      new TableForeignKey({
        name: 'FK_idempotency_key_fwcloud',
        columnNames: ['fwcloud_id'],
        referencedTableName: 'fwcloud',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_idempotency_key_user',
        columnNames: ['user_id'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createIndices(this.tableName, [
      // The namespace guard: at most one authoritative row per operation +
      // scope + key. Concurrent first-touch inserts race on this index rather
      // than on any in-memory lock.
      new TableIndex({
        name: 'UQ_idempotency_key_scope_digest',
        columnNames: ['operation', 'fwcloud_id', 'user_id', 'key_digest'],
        isUnique: true,
      }),
      // Drives lazy expiration lookups and any future cleanup sweep.
      new TableIndex({
        name: 'IDX_idempotency_key_status_expires_at',
        columnNames: ['status', 'expires_at'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // TypeORM drops this table's indexes and foreign keys before the table.
    await queryRunner.dropTable(this.tableName, true, true, true);
  }
}
