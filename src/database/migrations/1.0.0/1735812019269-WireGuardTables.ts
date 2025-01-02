import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class WireGuardTables1735812019269 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create 'wireguard' table
    await queryRunner.createTable(
      new Table({
        name: 'wireguard',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'firewall', type: 'int', isNullable: false },
          { name: 'crt', type: 'int', isNullable: false },
          { name: 'install_dir', type: 'varchar', length: '255', isNullable: true },
          { name: 'install_name', type: 'varchar', length: '255', isNullable: true },
          { name: 'comment', type: 'varchar', length: '255', isNullable: true },
          { name: 'status', type: 'tinyint', isNullable: false, default: 0 },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updated_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          { name: 'created_by', type: 'int', isNullable: true },
          { name: 'updated_by', type: 'int', isNullable: true },
          { name: 'installed_at', type: 'datetime', isNullable: true },
        ],
        foreignKeys: [
          {
            columnNames: ['firewall'],
            referencedTableName: 'firewall',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['crt'],
            referencedTableName: 'crt',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // Create 'wireguard_prefix' table
    await queryRunner.createTable(
      new Table({
        name: 'wireguard_prefix',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'wireguard', type: 'int', isNullable: false },
          { name: 'name', type: 'varchar', length: '255', isNullable: false },
        ],
        foreignKeys: [
          {
            columnNames: ['wireguard'],
            referencedTableName: 'wireguard',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // Create 'wireguard_status_history' table
    await queryRunner.createTable(
      new Table({
        name: 'wireguard_status_history',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'wireguard_server_id', type: 'int', isNullable: false },
          { name: 'name', type: 'varchar', length: '255', isNullable: true },
          { name: 'address', type: 'varchar', length: '255', isNullable: true },
          { name: 'bytes_received', type: 'bigint', unsigned: true, isNullable: false, default: 0 },
          { name: 'bytes_sent', type: 'bigint', unsigned: true, isNullable: false, default: 0 },
          { name: 'connected_at_timestamp', type: 'int', unsigned: true, isNullable: true },
          { name: 'disconnected_at_timestamp', type: 'int', unsigned: true, isNullable: true },
          { name: 'timestamp', type: 'int', unsigned: true, isNullable: false },
        ],
        foreignKeys: [
          {
            columnNames: ['wireguard_server_id'],
            referencedTableName: 'wireguard',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.dropTable('wireguard_status_history');
    await queryRunner.dropTable('wireguard_prefix');
    await queryRunner.dropTable('wireguard');
  }
}
