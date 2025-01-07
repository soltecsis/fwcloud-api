import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class IPSecTables1736239806777 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    //Create 'ipsec' table
    await queryRunner.createTable(
      new Table({
        name: 'ipsec',
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
          { name: 'config_name', type: 'varchar', length: '255', isNullable: false },
          { name: 'encryption_algo', type: 'varchar', length: '255', isNullable: false },
          { name: 'authentication_algo', type: 'varchar', length: '255', isNullable: false },
          { name: 'key_lifetime', type: 'int', isNullable: true },
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
        ],
        foreignKeys: [
          {
            columnNames: ['firewall'],
            referencedTableName: 'firewall',
            referencedColumnNames: ['id'],
          },
          { columnNames: ['crt'], referencedTableName: 'crt', referencedColumnNames: ['id'] },
        ],
      }),
    );

    //Create 'ipsec_peer' table
    await queryRunner.createTable(
      new Table({
        name: 'ipsec_peer',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'ipsec', type: 'int', isNullable: false },
          { name: 'peer_address', type: 'varchar', length: '255', isNullable: false },
          { name: 'peer_id', type: 'varchar', length: '255', isNullable: false },
          { name: 'shared_secret', type: 'varchar', length: '255', isNullable: true },
          { name: 'status', type: 'tinyint', isNullable: false, default: 0 },
        ],
        foreignKeys: [
          { columnNames: ['ipsec'], referencedTableName: 'ipsec', referencedColumnNames: ['id'] },
        ],
      }),
    );

    // Create 'ipsec_tunnel' table
    await queryRunner.createTable(
      new Table({
        name: 'ipsec_tunnel',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'ipsec', type: 'int', isNullable: false },
          { name: 'local_subnet', type: 'varchar', length: '255', isNullable: false },
          { name: 'remote_subnet', type: 'varchar', length: '255', isNullable: false },
          { name: 'protocol', type: 'varchar', length: '50', isNullable: false },
          { name: 'status', type: 'tinyint', isNullable: false, default: 0 },
        ],
        foreignKeys: [
          {
            columnNames: ['ipsec'],
            referencedTableName: 'ipsec',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    // Create 'ipsec_status_history' table
    await queryRunner.createTable(
      new Table({
        name: 'ipsec_status_history',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'ipsec_id', type: 'int', isNullable: false },
          { name: 'event', type: 'varchar', length: '255', isNullable: false },
          { name: 'timestamp', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          {
            columnNames: ['ipsec_id'],
            referencedTableName: 'ipsec',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.dropTable('ipsec_status_history');
    await queryRunner.dropTable('ipsec_tunnel');
    await queryRunner.dropTable('ipsec_peer');
    await queryRunner.dropTable('ipsec');
  }
}
