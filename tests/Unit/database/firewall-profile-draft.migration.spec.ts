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

  it('creates all required columns and the FWCloud/status index and rolls back cleanly', async () => {
    const runner = dataSource.createQueryRunner();
    const migration = new CreateFirewallProfileDraft1784721600000();
    try {
      const table = await runner.getTable('firewall_profile_draft');
      expect(table).to.be.instanceOf(Table);
      expect(table?.columns.map((column) => column.name)).to.include.members([
        'proposal',
        'contract_version',
        'proposal_hash',
        'preview_hash',
        'apply_hash',
        'step_log',
        'target_ids',
        'idempotency_key_ref',
        'request_id',
        'apply_pending_at',
      ]);
      expect(
        table?.indices.find((index) => index.name === 'IDX_firewall_profile_draft_fwcloud_status'),
      ).to.deep.include({ columnNames: ['fwcloud_id', 'status'] });

      await migration.down(runner);
      expect(await runner.getTable('firewall_profile_draft')).to.equal(undefined);
      await migration.up(runner);
      expect(await runner.getTable('firewall_profile_draft')).to.be.instanceOf(Table);
    } finally {
      await runner.release();
    }
  });
});
