import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class createCaTable1579700895349 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        //ca
        await queryRunner.createTable(new Table({
            name: 'ca',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "increment",
                },
                {
                    name: 'fwcloud',
                    type: 'int',
                    isNullable: false,
                },
                {
                    name: 'cn',
                    type: 'varchar',
                    length: "255",
                    isNullable: false
                },
                {
                    name: 'days',
                    type: 'int',
                    length: '11',
                    unsigned: true,
                    isNullable: false
                }, 
                {
                    name: 'comment',
                    type: 'varchar',
                    isNullable: true,
                    default: null
                }, 
                {
                    name: 'status',
                    type: 'tinyint',
                    length: '1',
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
                }
            ],
            uniques: [
                { columnNames: ['id', 'cn'] }
            ]
        }), true);

        //ca_prefix
        await queryRunner.createTable(new Table({
            name: 'ca_prefix',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "increment",
                }, 
                {
                    name: 'ca',
                    type: 'int',
                    isNullable: false
                }, 
                {
                    name: 'name',
                    type: 'varchar',
                    isNullable: false
                }
            ],
            uniques: [
                { columnNames: ['ca', 'name'] }
            ],
            foreignKeys: [
                {
                    referencedColumnNames: ['id'],
                    referencedTableName: 'ca',
                    columnNames: ['ca']
                }
            ]
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable('ca_prefix', true);
        await queryRunner.dropTable('ca', true);
    }

}
