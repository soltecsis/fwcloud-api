import { Table } from 'typeorm';
import type { DataSource, QueryRunner } from 'typeorm';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { DatabaseService } from '../../../../src/database/database.service';
import { CreateAssistedProfileSchema1784721600000 } from '../../../../src/database/migrations/1.0.0/1784721600000-create_assisted_profile_schema';

const DRAFT_TABLE = 'firewall_profile_draft';
const IDEMPOTENCY_TABLE = 'idempotency_key';
const REJECTED_PROPOSAL_TABLE = 'assisted_profile_rejected_proposal';
const ALL_TABLES = [DRAFT_TABLE, IDEMPOTENCY_TABLE, REJECTED_PROPOSAL_TABLE];

const REJECTED_PROPOSAL_EXPIRES_INDEX = 'IDX_assisted_profile_rejected_proposal_expires_at';

/**
 * The whole Assisted Profile schema ships as one migration, so one spec covers
 * it: every table's columns, indexes and constraints, plus a single
 * down()/up() cycle proving the migration is reversible as a unit.
 */
describe(describeName('Assisted Profile schema migration tests'), () => {
  let databaseService: DatabaseService;
  let dataSource: DataSource;

  before(async () => {
    databaseService = await testSuite.app.getService<DatabaseService>(DatabaseService.name);
    dataSource = databaseService.dataSource;
  });

  it('is applied as a single migration by the normal migration run', async () => {
    const names = (await databaseService.getExecutedMigrations()).map(
      (migration) => migration.name,
    );

    expect(names).to.contain('CreateAssistedProfileSchema1784721600000');
    // The per-table migrations it replaces must not come back: the whole
    // Assisted Profile schema is created by exactly one migration.
    expect(names).to.not.contain('CreateFirewallProfileDraft1784721600000');
    expect(names).to.not.contain('CreateIdempotencyKey1785974400000');
    expect(names).to.not.contain('CreateAssistedProfileRejectedProposal1786924800000');
  });

  it('creates every Assisted Profile table with its full schema', async () => {
    await withQueryRunner(expectSchema);
  });

  it('reverts and re-applies cleanly, as one unit', async () => {
    const migration = new CreateAssistedProfileSchema1784721600000();

    await withQueryRunner(async (queryRunner) => {
      await migration.down(queryRunner);
      for (const table of ALL_TABLES) {
        expect(await queryRunner.getTable(table)).to.equal(undefined);
      }

      await migration.up(queryRunner);
      await expectSchema(queryRunner);
    });
  });

  it('is a no-op over tables that already exist', async () => {
    // A database created by the three per-table migrations this one supersedes
    // still runs it (its name is not in the migrations table) while already
    // holding some or all of these tables. Re-creating a foreign key that
    // exists would fail, so every table it already finds must be left alone.
    const migration = new CreateAssistedProfileSchema1784721600000();

    await withQueryRunner(async (queryRunner) => {
      await migration.up(queryRunner);
      await expectSchema(queryRunner);

      // Partially migrated: only one table missing, the rest untouched.
      await queryRunner.dropTable(REJECTED_PROPOSAL_TABLE, true, true, true);
      expect(await queryRunner.getTable(REJECTED_PROPOSAL_TABLE)).to.equal(undefined);

      await migration.up(queryRunner);
      await expectSchema(queryRunner);
    });
  });

  async function expectSchema(queryRunner: QueryRunner): Promise<void> {
    await expectDraftSchema(queryRunner);
    await expectIdempotencyKeySchema(queryRunner);
    await expectRejectedProposalSchema(queryRunner);
  }

  async function expectDraftSchema(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable(DRAFT_TABLE);
    expect(table).to.be.instanceOf(Table);
    expect(table!.columns.map((column) => column.name)).to.include.members([
      'proposal',
      'contract_version',
      'proposal_hash',
      'assumptions',
      'preview_hash',
      'apply_hash',
      'step_log',
      'target_ids',
      'idempotency_key_ref',
      'request_id',
      'instruction_original',
      'apply_pending_at',
    ]);
    expect(
      table!.indices.find((index) => index.name === 'IDX_firewall_profile_draft_fwcloud_status'),
    ).to.deep.include({ columnNames: ['fwcloud_id', 'status'] });
    expect(
      table!.indices.find((index) => index.name === 'IDX_firewall_profile_draft_status_updated_at'),
    ).to.deep.include({ columnNames: ['status', 'updated_at'] });
    expect(table!.foreignKeys.map((key) => key.name)).to.have.members([
      'FK_firewall_profile_draft_fwcloud',
      'FK_firewall_profile_draft_created_by',
      'FK_firewall_profile_draft_updated_by',
    ]);
  }

  async function expectIdempotencyKeySchema(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable(IDEMPOTENCY_TABLE);
    expect(table).to.be.instanceOf(Table);
    expect(table!.columns.map((column) => column.name)).to.include.members([
      'id',
      'operation',
      'fwcloud_id',
      'user_id',
      'key_digest',
      'payload_hash',
      'status',
      'response_status_code',
      'response_body',
      'response_headers',
      'request_id',
      'created_at',
      'updated_at',
      'completed_at',
      'expires_at',
    ]);

    const namespaceUnique =
      table!.uniques.find((unique) => unique.name === 'UQ_idempotency_key_scope_digest') ??
      table!.indices.find(
        (index) => index.isUnique && index.name === 'UQ_idempotency_key_scope_digest',
      );
    expect(namespaceUnique).to.not.equal(undefined);
    expect([...namespaceUnique!.columnNames].sort()).to.deep.equal(
      ['fwcloud_id', 'key_digest', 'operation', 'user_id'].sort(),
    );

    expect(
      table!.indices.find((index) => index.name === 'IDX_idempotency_key_status_expires_at'),
    ).to.deep.include({ columnNames: ['status', 'expires_at'] });
    expect(table!.foreignKeys.map((key) => key.name)).to.have.members([
      'FK_idempotency_key_fwcloud',
      'FK_idempotency_key_user',
    ]);
  }

  async function expectRejectedProposalSchema(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable(REJECTED_PROPOSAL_TABLE);
    expect(table).to.be.instanceOf(Table);

    const columns = table!.columns.map((column) => column.name);
    expect(columns).to.include.members([
      'id',
      'rejection_category',
      'rejection_code',
      'contract_version',
      'anonymized_proposal',
      'anonymization_version',
      'proposal_fingerprint',
      'request_id',
      'captured_at',
      'expires_at',
    ]);
    // No column can ever carry the original rejected proposal, the instruction
    // that produced it, or the identity behind it.
    for (const forbidden of [
      'raw_proposal',
      'original_proposal',
      'proposal',
      'instruction',
      'instruction_original',
      'user_id',
      'fwcloud_id',
    ]) {
      expect(columns).to.not.contain(forbidden);
    }

    expect(
      table!.indices.find((index) => index.name === REJECTED_PROPOSAL_EXPIRES_INDEX),
    ).to.deep.include({ columnNames: ['expires_at'] });
    // A sample belongs to no FWCloud and no user, so there is nothing to
    // reference and no foreign key to create.
    expect(table!.foreignKeys).to.have.length(0);
  }

  async function withQueryRunner<T>(work: (queryRunner: QueryRunner) => Promise<T>): Promise<T> {
    const queryRunner = dataSource.createQueryRunner();
    try {
      return await work(queryRunner);
    } finally {
      await queryRunner.release();
    }
  }
});
