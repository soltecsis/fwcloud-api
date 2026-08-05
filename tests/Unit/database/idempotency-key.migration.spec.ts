import { Table } from 'typeorm';
import type { DataSource } from 'typeorm';
import { DatabaseService } from '../../../src/database/database.service';
import { CreateIdempotencyKey1785974400000 } from '../../../src/database/migrations/1.0.0/1785974400000-create_idempotency_key';
import { describeName, expect, testSuite } from '../../mocha/global-setup';

describe(describeName('Idempotency key migration tests'), () => {
  let dataSource: DataSource;

  before(async () => {
    dataSource = (await testSuite.app.getService<DatabaseService>(DatabaseService.name)).dataSource;
  });

  it('creates all required columns, unique constraint and indexes, and rolls back cleanly', async () => {
    const runner = dataSource.createQueryRunner();
    const migration = new CreateIdempotencyKey1785974400000();
    const expectSchema = async (): Promise<void> => {
      const table = await runner.getTable('idempotency_key');
      expect(table).to.be.instanceOf(Table);
      expect(table?.columns.map((column) => column.name)).to.include.members([
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
        table?.uniques.find((unique) => unique.name === 'UQ_idempotency_key_scope_digest') ??
        table?.indices.find(
          (index) => index.isUnique && index.name === 'UQ_idempotency_key_scope_digest',
        );
      expect(namespaceUnique).to.not.equal(undefined);
      expect([...namespaceUnique!.columnNames].sort()).to.deep.equal(
        ['fwcloud_id', 'key_digest', 'operation', 'user_id'].sort(),
      );

      expect(
        table?.indices.find((index) => index.name === 'IDX_idempotency_key_status_expires_at'),
      ).to.deep.include({ columnNames: ['status', 'expires_at'] });
    };

    try {
      await expectSchema();

      await migration.down(runner);
      expect(await runner.getTable('idempotency_key')).to.equal(undefined);

      await migration.up(runner);
      await expectSchema();
    } finally {
      await runner.release();
    }
  });
});
