import { QueryRunner, Repository } from 'typeorm';
import { BackfillAuditLogDuration1794916800000 } from '../../../src/database/migrations/1.0.0/1794916800000-backfill_audit_log_duration';
import db from '../../../src/database/database-manager';
import { AuditLog } from '../../../src/models/audit/AuditLog';
import { expect } from '../../mocha/global-setup';

describe('Historical audit duration migration', () => {
  let repository: Repository<AuditLog>;
  let runner: QueryRunner;
  let migration: BackfillAuditLogDuration1794916800000;

  const entry = (data: string, durationMs: number | null = null): Partial<AuditLog> => ({
    call: 'PUT /api/example',
    description: 'historical audit entry',
    startedAt: new Date('2024-01-01T00:00:00Z'),
    data,
    durationMs,
  });

  beforeEach(async () => {
    repository = db.getSource().getRepository(AuditLog);
    await repository.clear();
    runner = db.getSource().createQueryRunner();
    migration = new BackfillAuditLogDuration1794916800000();
  });

  afterEach(async () => {
    await runner.release();
    await repository.clear();
  });

  it('recovers root duration fields while preserving unknown and structured durations', async () => {
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
    const entries = await repository.save([
      ...examples.map(([data]) => repository.create(entry(data))),
      repository.create(entry('{"durationMs":999}', 77)),
    ]);

    await migration.up(runner);

    const persisted = await repository.find({ order: { id: 'ASC' } });
    expect(persisted.map(({ durationMs }) => durationMs)).to.deep.equal([
      ...examples.map(([, duration]) => duration),
      77,
    ]);
    expect(persisted.map(({ data }) => data)).to.deep.equal(entries.map(({ data }) => data));

    await migration.up(runner);
    expect(
      (await repository.find({ order: { id: 'ASC' } })).map(({ durationMs }) => durationMs),
    ).to.deep.equal(persisted.map(({ durationMs }) => durationMs));
  });

  it('continues past unknown batches and backfills records across multiple batches', async () => {
    await repository.insert([
      ...Array.from({ length: 125 }, () => entry('{}')),
      ...Array.from({ length: 125 }, (_, index) => entry(JSON.stringify({ durationMs: index }))),
    ]);

    await migration.up(runner);

    const persisted = await repository.find({ order: { id: 'ASC' } });
    expect(persisted.slice(0, 125).every(({ durationMs }) => durationMs === null)).to.equal(true);
    expect(persisted.slice(125).map(({ durationMs }) => durationMs)).to.deep.equal(
      Array.from({ length: 125 }, (_, index) => index),
    );
  });
});
