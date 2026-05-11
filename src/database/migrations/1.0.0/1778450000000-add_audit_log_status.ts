import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogStatus1778450000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `audit_logs` ADD COLUMN `status` INT NULL AFTER `call`');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `audit_logs` DROP COLUMN `status`');
  }
}
