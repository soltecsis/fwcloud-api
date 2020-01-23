import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class createCrtTable1579701318936 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        // crt
        await queryRunner.createTable(new Table({
            name: 'crt',
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
                    name: 'cn',
                    type: 'varchar',
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
                    name: 'type',
                    type: 'tinyint',
                    length: '1',
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
                { columnNames: ['ca', 'cn'] }
            ],
            foreignKeys: [
                {
                    columnNames: ['ca'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'ca'
                }
            ]
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable('crt');
    }

}
