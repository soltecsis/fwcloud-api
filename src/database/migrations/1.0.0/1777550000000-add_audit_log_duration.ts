import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAuditLogDuration1777550000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'audit_logs',
      'started_at',
      new TableColumn({
        name: 'started_at',
        type: 'datetime',
        precision: 3,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'audit_logs',
      new TableColumn({
        name: 'duration_ms',
        type: 'int',
        isNullable: true,
        default: null,
      }),
    );

    await queryRunner.addColumn(
      'audit_logs',
      new TableColumn({
        name: 'finished_at',
        type: 'datetime',
        precision: 3,
        isNullable: true,
        default: null,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('audit_logs', 'finished_at');
    await queryRunner.dropColumn('audit_logs', 'duration_ms');

    await queryRunner.changeColumn(
      'audit_logs',
      'started_at',
      new TableColumn({
        name: 'started_at',
        type: 'datetime',
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      }),
    );
  }
}
