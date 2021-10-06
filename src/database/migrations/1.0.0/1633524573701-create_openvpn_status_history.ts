import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class createOpenvpnStatusHistory1633524573701 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'openvpn_status_history',
            columns: [
                {
                    name: 'id',
                    type: 'bigint',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "increment",
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: "255",
                    isNullable: false,
                },
                {
                    name: 'address',
                    type: 'varchar',
                    length: "255",
                    isNullable: false,
                },
                {
                    name: 'bytes_received',
                    type: 'int',
                    isNullable: false,
                },
                {
                    name: 'bytes_sent',
                    type: 'int',
                    isNullable: false,
                },
                {
                    name: 'connected_at',
                    type: 'datetime',
                    isNullable: false
                },
                {
                    name: 'timestamp',
                    type: 'int',
                    isNullable: false
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
                    onDelete: 'set null'
                }
            ]
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('openvpn_status_history', true);
    }

}
