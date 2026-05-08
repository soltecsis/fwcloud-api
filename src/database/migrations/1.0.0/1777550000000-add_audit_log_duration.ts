import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAuditLogDuration1777550000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'audit_logs',
      new TableColumn({
        name: 'duration_ms',
        type: 'int',
        isNullable: true,
        default: null,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('audit_logs', 'duration_ms');
  }
}
