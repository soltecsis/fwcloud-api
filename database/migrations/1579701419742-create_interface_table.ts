import {MigrationInterface, QueryRunner, Table, TableForeignKey} from "typeorm";

export class createInterfaceTable1579701419742 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        
        //interface
        await queryRunner.createTable(new Table({
            name: 'interface',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    length: '11',
                    isPrimary: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'firewall',
                    type: 'int',
                    length: '11',
                    default: null
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '255',
                    isNullable: false
                },
                {
                    name: 'labelName',
                    type: 'varchar',
                    length: '255',
                    default: null
                },
                {
                    name: 'type',
                    type: 'varchar',
                    length: '255',
                    isNullable: false
                },
                {
                    name: 'interface_type',
                    type: 'tinyint',
                    length: '2',
                    isNullable: false
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
                {
                    name: 'created_by',
                    type: 'int',
                    isNullable: false,
                    default: 0,
                },
                {
                    name: 'updated_by',
                    type: 'int',
                    isNullable: false,
                    default: 0,
                },
                {
                    name: 'comment',
                    type: 'varchar',
                    length: '255',
                    default: null
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['firewall'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'firewall'
                }
            ]
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable('interface', true);
    }

}
