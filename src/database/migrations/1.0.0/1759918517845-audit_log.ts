import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

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
            name: 'user',
            type: 'int',
            length: '11',
            isNullable: false,
          },
          {
            name: 'fwcloud',
            type: 'int',
            length: '11',
            isNullable: false,
          },
          {
            name: 'firewall',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          },
          {
            name: 'cluster',
            type: 'int',
            length: '11',
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
            type: 'json',
            isNullable: false,
          },
          {
            name: 'text',
            type: 'text',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['user'],
            referencedTableName: 'user',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            columnNames: ['fwcloud'],
            referencedTableName: 'fwcloud',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['firewall'],
            referencedTableName: 'firewall',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            columnNames: ['cluster'],
            referencedTableName: 'cluster',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
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
