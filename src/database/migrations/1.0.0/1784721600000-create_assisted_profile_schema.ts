import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * The whole Assisted Profile schema, as one migration on purpose: none of these
 * tables has ever shipped in a release, so they are consolidated here rather
 * than accumulating a trail of create/alter migrations for tables nobody has
 * ever created. A change made *after* this schema ships must be a new migration.
 *
 * Three tables, three different jobs:
 *
 * | Table                               | Holds                                              |
 * | ----------------------------------- | -------------------------------------------------- |
 * | `firewall_profile_draft`            | generated proposals awaiting human review          |
 * | `idempotency_key`                   | replayable results of protected mutating operations |
 * | `assisted_profile_rejected_proposal`| opt-in anonymized samples of rejected proposals     |
 */
export class CreateAssistedProfileSchema1784721600000 implements MigrationInterface {
  private readonly draftTable = 'firewall_profile_draft';
  private readonly idempotencyTable = 'idempotency_key';
  private readonly rejectedProposalTable = 'assisted_profile_rejected_proposal';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createDraftTable(queryRunner);
    await this.createIdempotencyKeyTable(queryRunner);
    await this.createRejectedProposalTable(queryRunner);
  }

  /**
   * Each table is created only when it is missing, foreign keys and indexes
   * included. This migration supersedes the three per-table migrations the
   * Assisted Profile branches used before it shipped, so a database created by
   * those still has some or all of these tables while not having *this*
   * migration recorded: it therefore runs here, and must be a no-op for
   * whatever already exists rather than failing on a duplicate constraint name.
   */
  private async isMissing(queryRunner: QueryRunner, table: string): Promise<boolean> {
    return !(await queryRunner.hasTable(table));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse creation order, and TypeORM drops each table's indexes and
    // foreign keys before the table itself.
    for (const table of [this.rejectedProposalTable, this.idempotencyTable, this.draftTable]) {
      await queryRunner.dropTable(table, true, true, true);
    }
  }

  private async createDraftTable(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.isMissing(queryRunner, this.draftTable))) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: this.draftTable,
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'fwcloud_id', type: 'int' },
          { name: 'created_by', type: 'int', isNullable: true, default: null },
          { name: 'updated_by', type: 'int', isNullable: true, default: null },
          { name: 'status', type: 'varchar', length: '32' },
          { name: 'contract_version', type: 'varchar', length: '64' },
          { name: 'proposal', type: 'longtext' },
          { name: 'proposal_hash', type: 'char', length: '64' },
          { name: 'assumptions', type: 'longtext', isNullable: true, default: null },
          { name: 'preview_hash', type: 'char', length: '64', isNullable: true, default: null },
          { name: 'apply_hash', type: 'char', length: '64', isNullable: true, default: null },
          { name: 'step_log', type: 'longtext', isNullable: true, default: null },
          { name: 'target_ids', type: 'longtext', isNullable: true, default: null },
          {
            name: 'idempotency_key_ref',
            type: 'varchar',
            length: '255',
            isNullable: true,
            default: null,
          },
          {
            name: 'request_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
            default: null,
          },
          { name: 'instruction_original', type: 'text', isNullable: true, default: null },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          { name: 'validated_at', type: 'timestamp', isNullable: true, default: null },
          { name: 'previewed_at', type: 'timestamp', isNullable: true, default: null },
          { name: 'apply_pending_at', type: 'timestamp', isNullable: true, default: null },
          { name: 'applied_at', type: 'timestamp', isNullable: true, default: null },
          { name: 'failed_at', type: 'timestamp', isNullable: true, default: null },
          { name: 'discarded_at', type: 'timestamp', isNullable: true, default: null },
          { name: 'expired_at', type: 'timestamp', isNullable: true, default: null },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys(this.draftTable, [
      new TableForeignKey({
        name: 'FK_firewall_profile_draft_fwcloud',
        columnNames: ['fwcloud_id'],
        referencedTableName: 'fwcloud',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_firewall_profile_draft_created_by',
        columnNames: ['created_by'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'FK_firewall_profile_draft_updated_by',
        columnNames: ['updated_by'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.createIndices(this.draftTable, [
      new TableIndex({
        name: 'IDX_firewall_profile_draft_fwcloud_status',
        columnNames: ['fwcloud_id', 'status'],
      }),
      // Drives the inactivity-expiration sweep, which scans by status and age.
      new TableIndex({
        name: 'IDX_firewall_profile_draft_status_updated_at',
        columnNames: ['status', 'updated_at'],
      }),
    ]);
  }

  /**
   * Database-backed `Idempotency-Key` store, scoped by `(operation, fwcloud_id,
   * user_id, key_digest)`. The unique index on that tuple is the concurrency
   * guard: two simultaneous inserts for the same namespace and key can never
   * both create an authoritative row, and `IdempotencyKeyStore` recovers the
   * losing insert into a `cached` / `in_progress` / `payload_mismatch` outcome
   * instead of retrying blindly.
   */
  private async createIdempotencyKeyTable(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.isMissing(queryRunner, this.idempotencyTable))) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: this.idempotencyTable,
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

    await queryRunner.createForeignKeys(this.idempotencyTable, [
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

    await queryRunner.createIndices(this.idempotencyTable, [
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

  /**
   * Storage for the optional, opt-in corpus of **anonymized** Assisted Profile
   * proposals rejected by validation.
   *
   * Three deliberate absences:
   *
   * - there is no column for the original rejected proposal, and none may ever
   *   be added: only the anonymizer's output is persisted;
   * - there is no `fwcloud_id`/`user_id` (and therefore no foreign key),
   *   because a sample must not identify who or which FWCloud produced it;
   * - there is no status column, because a rejected proposal is not a draft and
   *   takes no part in the `firewall_profile_draft` state machine.
   *
   * The only index is on `expires_at`, which is what the retention purge scans.
   */
  private async createRejectedProposalTable(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.isMissing(queryRunner, this.rejectedProposalTable))) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: this.rejectedProposalTable,
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'rejection_category', type: 'varchar', length: '64' },
          {
            name: 'rejection_code',
            type: 'varchar',
            length: '128',
            isNullable: true,
            default: null,
          },
          {
            name: 'contract_version',
            type: 'varchar',
            length: '64',
            isNullable: true,
            default: null,
          },
          { name: 'anonymized_proposal', type: 'longtext' },
          { name: 'anonymization_version', type: 'varchar', length: '64' },
          {
            name: 'proposal_fingerprint',
            type: 'char',
            length: '64',
            isNullable: true,
            default: null,
          },
          { name: 'request_id', type: 'varchar', length: '255', isNullable: true, default: null },
          { name: 'captured_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          // Always written explicitly by the capture service; the default only
          // exists so CREATE TABLE does not fall back to an implicit zero-date
          // default, which some servers' sql_mode (NO_ZERO_DATE) rejects.
          { name: 'expires_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndices(this.rejectedProposalTable, [
      // Drives the retention sweep, which selects by `expires_at <= now`.
      new TableIndex({
        name: 'IDX_assisted_profile_rejected_proposal_expires_at',
        columnNames: ['expires_at'],
      }),
    ]);
  }
}
