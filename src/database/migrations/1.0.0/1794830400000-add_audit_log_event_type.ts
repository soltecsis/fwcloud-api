import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogEventType1794830400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Historical entries deliberately remain unclassified.
    await queryRunner.query(
      'ALTER TABLE `audit_logs` ADD COLUMN `event_type` VARCHAR(32) NULL, ADD COLUMN `outcome` VARCHAR(16) NULL',
    );
    await queryRunner.query(
      'CREATE INDEX `IDX_audit_logs_event_type_ts` ON `audit_logs` (`event_type`, `ts`, `id`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX `IDX_audit_logs_event_type_ts` ON `audit_logs`');
    await queryRunner.query(
      'ALTER TABLE `audit_logs` DROP COLUMN `outcome`, DROP COLUMN `event_type`',
    );
  }
}
