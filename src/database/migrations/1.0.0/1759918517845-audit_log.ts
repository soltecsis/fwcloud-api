import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AuditLog1759918517845 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'int',
            length: '11',
            isPrimary: true,
            isNullable: false,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'ts',
            type: 'datetime',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'user_id',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          },
          {
            name: 'user_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
            default: null,
          },
          {
            name: 'session_id',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          },
          {
            name: 'source_ip',
            type: 'varchar',
            length: '45',
            isNullable: true,
            default: null,
          },
          {
            name: 'fwcloud_id',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          },
          {
            name: 'fwcloud_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
            default: null,
          },
          {
            name: 'firewall_id',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          },
          {
            name: 'firewall_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
            default: null,
          },
          {
            name: 'cluster_id',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          },
          {
            name: 'cluster_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
            default: null,
          },
          {
            name: 'call',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'data',
            type: 'longtext',
            isNullable: false,
          },
          {
            name: 'desc',
            type: 'text',
            isNullable: false,
          },
        ],
        indices: [
          {
            name: 'IDX_audit_logs_ts',
            columnNames: ['ts'],
          },
          {
            name: 'IDX_audit_logs_user_id',
            columnNames: ['user_id'],
          },
          {
            name: 'IDX_audit_logs_user_name',
            columnNames: ['user_name'],
          },
          {
            name: 'IDX_audit_logs_session_id',
            columnNames: ['session_id'],
          },
          {
            name: 'IDX_audit_logs_source_ip',
            columnNames: ['source_ip'],
          },
          {
            name: 'IDX_audit_logs_fwcloud_id',
            columnNames: ['fwcloud_id'],
          },
          {
            name: 'IDX_audit_logs_fwcloud_name',
            columnNames: ['fwcloud_name'],
          },
          {
            name: 'IDX_audit_logs_firewall_id',
            columnNames: ['firewall_id'],
          },
          {
            name: 'IDX_audit_logs_firewall_name',
            columnNames: ['firewall_name'],
          },
          {
            name: 'IDX_audit_logs_cluster_id',
            columnNames: ['cluster_id'],
          },
          {
            name: 'IDX_audit_logs_cluster_name',
            columnNames: ['cluster_name'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('audit_logs', true);
  }
}
