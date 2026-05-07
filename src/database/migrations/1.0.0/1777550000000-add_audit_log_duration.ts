import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddAuditLogDuration1777550000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_ts');

    await queryRunner.changeColumn(
      'audit_logs',
      'ts',
      new TableColumn({
        name: 'started_at',
        type: 'datetime',
        precision: 3,
        isNullable: false,
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_started_at',
        columnNames: ['started_at'],
      }),
    );

    await queryRunner.addColumns('audit_logs', [
      new TableColumn({
        name: 'duration_ms',
        type: 'int',
        isNullable: true,
        default: null,
      }),
      new TableColumn({
        name: 'finished_at',
        type: 'datetime',
        precision: 3,
        isNullable: true,
        default: null,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('audit_logs', ['finished_at', 'duration_ms']);
    await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_started_at');

    await queryRunner.changeColumn(
      'audit_logs',
      'started_at',
      new TableColumn({
        name: 'ts',
        type: 'datetime',
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_ts',
        columnNames: ['ts'],
      }),
    );
  }
}
