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
            name: 'session_id',
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
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('audit_logs', true);
  }
}
