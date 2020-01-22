import {MigrationInterface, QueryRunner, Table, TableForeignKey} from "typeorm";

export class createMarkTable1579701500404 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        //mark
        await queryRunner.createTable(new Table({
            name: 'mark',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    length: '11',
                    generationStrategy: 'increment',
                    isPrimary: true
                },
                {
                    name: 'code',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'fwcloud',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '255',
                    isNullable: false
                },
                {
                    name: 'comment',
                    type: 'varchar',
                    length: '255',
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
                { columnNames: ['code', 'fwcloud'] }
            ],
            foreignKeys: [
                {
                    columnNames: ['fwcloud'],
                    referencedTableName: 'fwcloud',
                    referencedColumnNames: ['id']
                }
            ]
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable('mark', true);
    }
}
