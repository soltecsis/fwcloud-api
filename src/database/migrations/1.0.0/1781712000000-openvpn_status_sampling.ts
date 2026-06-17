import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class openvpnStatusSampling1781712000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'openvpn_status_sampling',
        columns: [
          {
            name: 'id',
            type: 'int',
            length: '11',
            isGenerated: true,
            generationStrategy: 'increment',
            isPrimary: true,
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
            name: 'enabled',
            type: 'tinyint',
            length: '1',
            isNullable: false,
            default: 0,
          },
          {
            name: 'collector_firewall',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          },
          {
            name: 'last_sync_result',
            type: 'varchar',
            length: '20',
            isNullable: true,
            default: null,
          },
          {
            name: 'last_sync_error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'last_synced_at',
            type: 'datetime',
            isNullable: true,
            default: null,
          },
          {
            name: 'last_poll_result',
            type: 'varchar',
            length: '20',
            isNullable: true,
            default: null,
          },
          {
            name: 'last_poll_error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'last_polled_at',
            type: 'datetime',
            isNullable: true,
            default: null,
          },
          {
            name: 'created_at',
            type: 'datetime',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['firewall'],
            referencedTableName: 'firewall',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['cluster'],
            referencedTableName: 'cluster',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['collector_firewall'],
            referencedTableName: 'firewall',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'openvpn_status_sampling',
      new TableIndex({
        columnNames: ['firewall'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'openvpn_status_sampling',
      new TableIndex({
        columnNames: ['cluster'],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'openvpn_status_sampling_file',
        columns: [
          {
            name: 'id',
            type: 'int',
            length: '11',
            isGenerated: true,
            generationStrategy: 'increment',
            isPrimary: true,
          },
          {
            name: 'sampling',
            type: 'int',
            length: '11',
            isNullable: false,
          },
          {
            name: 'path',
            type: 'varchar',
            length: '4096',
            isNullable: false,
          },
          {
            name: 'path_hash',
            type: 'char',
            length: '64',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'datetime',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['sampling'],
            referencedTableName: 'openvpn_status_sampling',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'openvpn_status_sampling_file',
      new TableIndex({
        columnNames: ['sampling', 'path_hash'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('openvpn_status_sampling_file');
    await queryRunner.dropTable('openvpn_status_sampling');
  }
}
