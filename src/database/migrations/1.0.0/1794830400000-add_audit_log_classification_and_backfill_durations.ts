import { MigrationInterface, QueryRunner } from 'typeorm';

const BATCH_SIZE = 100;
const MAX_DURATION_MS = 2147483647;

type HistoricalAuditLog = { id: number; data: string };

export class AddAuditLogClassificationAndBackfillDurations1794830400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Historical event types and confirmation challenges cannot be inferred reliably.
    await queryRunner.query(
      'ALTER TABLE `audit_logs` ADD COLUMN `event_type` VARCHAR(32) NULL, ADD COLUMN `outcome` VARCHAR(16) NULL, ADD COLUMN `confirmation_token_challenge` TINYINT(1) NULL',
    );
    await queryRunner.query(
      'CREATE INDEX `IDX_audit_logs_event_type_ts` ON `audit_logs` (`event_type`, `ts`, `id`)',
    );

    await this.backfillDurations(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX `IDX_audit_logs_event_type_ts` ON `audit_logs`');
    await queryRunner.query(
      'ALTER TABLE `audit_logs` DROP COLUMN `confirmation_token_challenge`, DROP COLUMN `outcome`, DROP COLUMN `event_type`',
    );
    // Recovered durations cannot be distinguished from values written by the application.
  }

  private async backfillDurations(queryRunner: QueryRunner): Promise<void> {
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
