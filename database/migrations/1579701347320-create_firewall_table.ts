import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class createFirewallTable1579701347320 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        //firewall
        await queryRunner.createTable(new Table({
            name: 'firewall',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'cluster',
                    type: 'int',
                    default: null,
                },
                {
                    name: 'fwcloud',
                    type: 'int',
                    default: null
                },
                {
                    name: 'name',
                    type: 'varchar',
                    isNullable: false
                },
                {
                    name: 'comment',
                    type: 'longtext',
                    charset: 'utf8'
                },
                {
                    name: 'compiled_at',
                    type: 'datetime',
                    default: null
                },
                {
                    name: 'installed_at',
                    type: 'datetime',
                    default: null
                },
                {
                    name: 'by_user',
                    type: 'int',
                    isNullable: false,
                    default: 0
                },
                {
                    name: 'status',
                    type: 'tinyint',
                    isNullable: false,
                    default: 0
                },
                {
                    name: 'install_user',
                    type: 'varchar',
                    default: null
                },
                {
                    name: 'install_pass',
                    type: 'varchar',
                    default: null
                },
                {
                    name: 'save_user_pass',
                    type: 'tinyint',
                    isNullable: false,
                    default: false
                },
                {
                    name: 'install_interface',
                    type: 'int',
                    default: null
                },
                {
                    name: 'install_ipobj',
                    type: 'int',
                    default: null
                },
                {
                    name: 'fwmaster',
                    type: 'tinyint',
                    default: null
                },
                {
                    name: 'install_port',
                    type: 'int',
                    isNullable: false,
                    default: 22
                },
                {
                    name: 'options',
                    type: 'smallint',
                    length: "2",
                    isNullable: false,
                    default: 0
                },
                {
                    name: 'created_at',
                    type: 'datetime',
                    isNullable: false,
                    default: "CURRENT_TIMESTAMP"
                },
                {
                    name: 'updated_at',
                    type: 'datetime',
                    isNullable: false,
                    default: 'CURRENT_TIMESTAMP',
                    onUpdate: 'CURRENT_TIMESTAMP',
                },
            ]
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable('firewall', true);
    }

}
