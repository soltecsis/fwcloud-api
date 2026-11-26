import { QueryRunner } from 'typeorm';
import { AddAuditLogClassificationAndBackfillDurations1794830400000 } from '../../../src/database/migrations/1.0.0/1794830400000-add_audit_log_classification_and_backfill_durations';
import db from '../../../src/database/database-manager';
import { expect } from '../../mocha/global-setup';

describe('Audit log metadata migration', () => {
  let runner: QueryRunner;
  let migration: AddAuditLogClassificationAndBackfillDurations1794830400000;

  const insertEntries = async (entries: Array<[string, number | null]>): Promise<void> => {
    await runner.query(
      `INSERT INTO \`audit_logs\` (\`data\`, \`duration_ms\`) VALUES ${entries.map(() => '(?, ?)').join(', ')}`,
      entries.flat(),
    );
  };

  beforeEach(async () => {
    runner = db.getSource().createQueryRunner();
    migration = new AddAuditLogClassificationAndBackfillDurations1794830400000();
    // A temporary table shadows the migrated application table on this connection only.
    await runner.query(
      "CREATE TEMPORARY TABLE `audit_logs` (`id` INT AUTO_INCREMENT PRIMARY KEY, `ts` DATETIME(3) NOT NULL DEFAULT '2024-01-01 00:00:00', `data` LONGTEXT NOT NULL, `duration_ms` INT NULL, `status` INT NULL)",
    );
  });

  afterEach(async () => {
    try {
      await runner.query('DROP TEMPORARY TABLE IF EXISTS `audit_logs`');
    } finally {
      await runner.release();
    }
  });

  it('keeps historical metadata unclassified and reverses schema changes without removing records', async () => {
    await runner.query('INSERT INTO `audit_logs` (`data`, `status`) VALUES (?, 403), (?, 401)', [
      '{"durationMs":1250}',
      '{}',
    ]);

    await migration.up(runner);

    expect(
      await runner.query(
        'SELECT `id`, `status`, `duration_ms`, `event_type`, `outcome`, `confirmation_token_challenge` FROM `audit_logs` ORDER BY `id`',
      ),
    ).to.deep.equal([
      {
        id: 1,
        status: 403,
        duration_ms: 1250,
        event_type: null,
        outcome: null,
        confirmation_token_challenge: null,
      },
      {
        id: 2,
        status: 401,
        duration_ms: null,
        event_type: null,
        outcome: null,
        confirmation_token_challenge: null,
      },
    ]);
    const indexes = await runner.query(
      "SHOW INDEX FROM `audit_logs` WHERE `Key_name` = 'IDX_audit_logs_event_type_ts'",
    );
    expect(indexes.map((index) => index.Column_name)).to.deep.equal(['event_type', 'ts', 'id']);

    await runner.query(
      'INSERT INTO `audit_logs` (`data`, `status`, `event_type`, `confirmation_token_challenge`) VALUES (?, 403, ?, TRUE), (?, 403, ?, FALSE)',
      ['{}', 'modification', '{}', 'modification'],
    );
    expect(
      await runner.query(
        'SELECT `id` FROM `audit_logs` WHERE (`confirmation_token_challenge` IS NULL OR `confirmation_token_challenge` = FALSE) ORDER BY `id`',
      ),
    ).to.deep.equal([{ id: 1 }, { id: 2 }, { id: 4 }]);

    await migration.down(runner);

    expect(
      (await runner.query('SHOW COLUMNS FROM `audit_logs`')).map((column) => column.Field),
    ).to.deep.equal(['id', 'ts', 'data', 'duration_ms', 'status']);
    expect(
      await runner.query(
        "SHOW INDEX FROM `audit_logs` WHERE `Key_name` = 'IDX_audit_logs_event_type_ts'",
      ),
    ).to.deep.equal([]);
    // Recovered durations remain valid after rollback; their origin cannot be distinguished.
    expect(
      await runner.query('SELECT `id`, `status`, `duration_ms` FROM `audit_logs` ORDER BY `id`'),
    ).to.deep.equal([
      { id: 1, status: 403, duration_ms: 1250 },
      { id: 2, status: 401, duration_ms: null },
      { id: 3, status: 403, duration_ms: null },
      { id: 4, status: 403, duration_ms: null },
    ]);
  });

  it('recovers root duration fields while preserving unknown and structured durations through rollback and reapplication', async () => {
    const examples: Array<[string, number | null]> = [
      ['{"durationMs":1250}', 1250],
      ['{"duration_ms":"2500"}', 2500],
      ['{"durationMs":0}', 0],
      ['{"durationMs":23.9}', 23],
      ['{"durationMs":null,"duration_ms":45}', 45],
      ['{"durationMs":55,"duration_ms":99}', 55],
      ['{"durationMs":2147483647}', 2147483647],
      ['{"durationMs":-1}', null],
      ['{"durationMs":2147483648}', null],
      ['{"durationMs":"Infinity"}', null],
      ['{"durationMs":true}', null],
      ['{"durationMs":" "}', null],
      ['{"durationMs":"unknown"}', null],
      ['{"request":{"durationMs":123}}', null],
      ['{"durationMs":123', null],
      ['[ {"durationMs":123} ]', null],
      ['null', null],
      ['{}', null],
    ];
    const entries: Array<[string, number | null]> = [
      ...examples.map(([data]): [string, number | null] => [data, null]),
      ['{"durationMs":999}', 77],
    ];
    await insertEntries(entries);

    await migration.up(runner);

    const persisted = await runner.query(
      'SELECT `data`, `duration_ms` FROM `audit_logs` ORDER BY `id`',
    );
    expect(persisted.map((entry) => entry.duration_ms)).to.deep.equal([
      ...examples.map(([, duration]) => duration),
      77,
    ]);
    expect(persisted.map((entry) => entry.data)).to.deep.equal(entries.map(([data]) => data));

    await migration.down(runner);
    await migration.up(runner);

    expect(
      await runner.query('SELECT `data`, `duration_ms` FROM `audit_logs` ORDER BY `id`'),
    ).to.deep.equal(persisted);
  });

  it('continues past unknown batches and backfills records across multiple batches', async () => {
    await insertEntries([
      ...Array.from({ length: 125 }, (): [string, number | null] => ['{}', null]),
      ...Array.from({ length: 125 }, (_, index): [string, number | null] => [
        JSON.stringify({ durationMs: index }),
        null,
      ]),
    ]);

    await migration.up(runner);

    const persisted = await runner.query('SELECT `duration_ms` FROM `audit_logs` ORDER BY `id`');
    expect(persisted.slice(0, 125).every((entry) => entry.duration_ms === null)).to.equal(true);
    expect(persisted.slice(125).map((entry) => entry.duration_ms)).to.deep.equal(
      Array.from({ length: 125 }, (_, index) => index),
    );
  });
});
