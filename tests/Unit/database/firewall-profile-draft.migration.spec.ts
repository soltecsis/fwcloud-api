import { Table } from 'typeorm';
import type { DataSource } from 'typeorm';
import { DatabaseService } from '../../../src/database/database.service';
import { CreateFirewallProfileDraft1784721600000 } from '../../../src/database/migrations/1.0.0/1784721600000-create_firewall_profile_draft';
import { describeName, expect, testSuite } from '../../mocha/global-setup';

describe(describeName('Firewall Profile draft migration tests'), () => {
  let dataSource: DataSource;

  before(async () => {
    dataSource = (await testSuite.app.getService<DatabaseService>(DatabaseService.name)).dataSource;
  });

  it('creates all required columns and indexes and rolls back cleanly', async () => {
    const runner = dataSource.createQueryRunner();
    const migration = new CreateFirewallProfileDraft1784721600000();
    const expectSchema = async (): Promise<void> => {
      const table = await runner.getTable('firewall_profile_draft');
      expect(table).to.be.instanceOf(Table);
      expect(table?.columns.map((column) => column.name)).to.include.members([
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
        table?.indices.find((index) => index.name === 'IDX_firewall_profile_draft_fwcloud_status'),
      ).to.deep.include({ columnNames: ['fwcloud_id', 'status'] });
      expect(
        table?.indices.find(
          (index) => index.name === 'IDX_firewall_profile_draft_status_updated_at',
        ),
      ).to.deep.include({ columnNames: ['status', 'updated_at'] });
    };

    try {
      await expectSchema();

      await migration.down(runner);
      expect(await runner.getTable('firewall_profile_draft')).to.equal(undefined);

      await migration.up(runner);
      await expectSchema();
    } finally {
      await runner.release();
    }
  });
});
