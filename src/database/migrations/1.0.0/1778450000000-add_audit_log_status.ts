import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogStatus1778450000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `audit_logs` ADD COLUMN `status` INT NULL AFTER `call`');
    await queryRunner.query(
      'ALTER TABLE `audit_logs` MODIFY COLUMN `ts` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `audit_logs` DROP COLUMN `status`');
    await queryRunner.query(
      'ALTER TABLE `audit_logs` MODIFY COLUMN `ts` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    );
  }
}
