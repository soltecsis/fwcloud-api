import {MigrationInterface, QueryRunner, Table, TableForeignKey} from "typeorm";
import { findForeignKeyInTable } from "../../utils/typeorm/TableUtils";

export class createFwcloudTable1579701392749 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {

        //fwcloud
        await queryRunner.createTable(new Table({
            name: 'fwcloud',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    length: '11',
                    isGenerated: true,
                    generationStrategy: 'increment',
                    isPrimary: true
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '255',
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
                    name: 'locked_at',
                    type: 'datetime',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'locked_by',
                    type: 'int',
                    length: '11',
                    isNullable: true,
                    default: null,
                },
                {
                    name: 'locked',
                    type: 'tinyint',
                    length: '1',
                    isNullable: false,
                    default: 0
                },
                {
                    name: 'image',
                    type: 'varchar',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'comment',
                    type: 'varchar',
                    isNullable: true,
                    default: null
                }
            ]
        }), true);

        await queryRunner.createForeignKey('ca', new TableForeignKey({
            referencedTableName: 'fwcloud',
            referencedColumnNames: ['id'],
            columnNames: ['fwcloud']
        }));

        await queryRunner.createForeignKey('cluster', new TableForeignKey({
            referencedTableName: 'fwcloud',
            referencedColumnNames: ['id'],
            columnNames: ['fwcloud']
        }));

        await queryRunner.createForeignKey('firewall', new TableForeignKey({
            referencedTableName: 'fwcloud',
            referencedColumnNames: ['id'],
            columnNames: ['fwcloud']
        }));

        await queryRunner.createForeignKey('fwc_tree', new TableForeignKey({
            referencedTableName: 'fwcloud',
            referencedColumnNames: ['id'],
            columnNames: ['fwcloud']
        }))
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        let table: Table;

        table = await queryRunner.getTable('fwc_tree');
        await queryRunner.dropForeignKey(table, findForeignKeyInTable(table, 'fwcloud'));

        table = await queryRunner.getTable('firewall');
        await queryRunner.dropForeignKey(table, findForeignKeyInTable(table, 'fwcloud'));

        table = await queryRunner.getTable('cluster');
        await queryRunner.dropForeignKey(table, findForeignKeyInTable(table, 'fwcloud'));

        table = await queryRunner.getTable('ca');
        await queryRunner.dropForeignKey(table, findForeignKeyInTable(table, 'fwcloud'));
        
        await queryRunner.dropTable('fwcloud', true);
    }

}
