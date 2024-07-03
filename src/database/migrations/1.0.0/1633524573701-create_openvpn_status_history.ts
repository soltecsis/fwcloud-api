import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class createOpenvpnStatusHistory1633524573701
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'openvpn_status_history',
        columns: [
          {
            name: 'id',
            type: 'int',
            unsigned: true,
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'address',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'bytes_received',
            type: 'bigint',
            unsigned: true,
            isNullable: false,
          },
          {
            name: 'bytes_sent',
            type: 'bigint',
            unsigned: true,
            isNullable: false,
          },
          {
            name: 'connected_at_timestamp',
            type: 'int',
            unsigned: true,
            isNullable: false,
          },
          {
            name: 'disconnected_at_timestamp',
            type: 'int',
            unsigned: true,
            isNullable: true,
          },
          {
            name: 'timestamp',
            type: 'int',
            unsigned: true,
            isNullable: false,
          },
          {
            name: 'openvpn_server_id',
            type: 'int',
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['openvpn_server_id'],
            referencedTableName: 'openvpn',
            referencedColumnNames: ['id'],
            onDelete: 'set null',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('openvpn_status_history', true);
  }
}
