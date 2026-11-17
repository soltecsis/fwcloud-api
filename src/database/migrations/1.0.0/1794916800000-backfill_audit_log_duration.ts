import { MigrationInterface, QueryRunner } from 'typeorm';

const BATCH_SIZE = 100;
const MAX_DURATION_MS = 2147483647;

type HistoricalAuditLog = { id: number; data: string };

export class BackfillAuditLogDuration1794916800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ maxId }] = await queryRunner.query(
      'SELECT COALESCE(MAX(`id`), 0) AS `maxId` FROM `audit_logs`',
    );
    let lastId = 0;

    // Parse historical payloads once, rather than reading LONGTEXT on every list request.
    // A fixed upper bound also prevents concurrent inserts from extending the migration.
    while (lastId < Number(maxId)) {
      const rows: HistoricalAuditLog[] = await queryRunner.query(
        'SELECT `id`, `data` FROM `audit_logs` WHERE `duration_ms` IS NULL AND `id` > ? AND `id` <= ? ORDER BY `id` ASC LIMIT ?',
        [lastId, maxId, BATCH_SIZE],
      );
      if (rows.length === 0) break;
      lastId = rows[rows.length - 1].id;

      const updates = rows.flatMap((row) => {
        const duration = this.extractDuration(row.data);
        return duration === null ? [] : [{ id: row.id, duration }];
      });
      if (updates.length === 0) continue;

      await queryRunner.query(
        `UPDATE \`audit_logs\` SET \`duration_ms\` = CASE \`id\` ${updates.map(() => 'WHEN ? THEN ?').join(' ')} END WHERE \`duration_ms\` IS NULL AND \`id\` IN (${updates.map(() => '?').join(', ')})`,
        [...updates.flatMap(({ id, duration }) => [id, duration]), ...updates.map(({ id }) => id)],
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Recovered durations cannot be distinguished from values written by the application.
  }

  private extractDuration(data: string): number | null {
    try {
      const payload: unknown = JSON.parse(data);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

      const record = payload as Record<string, unknown>;
      const value = record.durationMs ?? record.duration_ms;
      if (typeof value !== 'number' && !(typeof value === 'string' && value.trim().length > 0)) {
        return null;
      }

      const duration = Number(value);
      return Number.isFinite(duration) && duration >= 0 && duration <= MAX_DURATION_MS
        ? Math.trunc(duration)
        : null;
    } catch {
      // Malformed or truncated payloads do not establish a known completion time.
      return null;
    }
  }
}
