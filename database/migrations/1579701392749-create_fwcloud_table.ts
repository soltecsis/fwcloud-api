import {MigrationInterface, QueryRunner, Table, TableForeignKey} from "typeorm";

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
                    isPrimary: true,
                    generationStrategy: 'increment',
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
                    default: null
                },
                {
                    name: 'locked_by',
                    type: 'int',
                    length: '11',
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
                    length: '255',
                    default: null
                },
                {
                    name: 'comment',
                    type: 'varchar',
                    default: null
                }
            ]
        }), true);

        await queryRunner.createForeignKey('ca', new TableForeignKey({
            name: 'fk_ca-fwcloud',
            referencedTableName: 'fwcloud',
            referencedColumnNames: ['id'],
            columnNames: ['fwcloud']
        }));

        await queryRunner.createForeignKey('cluster', new TableForeignKey({
            name: 'fk_cluster-fwcloud',
            referencedTableName: 'fwcloud',
            referencedColumnNames: ['id'],
            columnNames: ['fwcloud']
        }));

        await queryRunner.createForeignKey('firewall', new TableForeignKey({
            name: 'fk_firewall-fwcloud',
            referencedTableName: 'fwcloud',
            referencedColumnNames: ['id'],
            columnNames: ['fwcloud']
        }));

        await queryRunner.createForeignKey('fwc_tree', new TableForeignKey({
            name: 'fk_fwc_tree-fwcloud',
            referencedTableName: 'fwcloud',
            referencedColumnNames: ['id'],
            columnNames: ['fwcloud']
        }))
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        
        await queryRunner.dropForeignKey('fwc_tree', 'fk_fwc_tree-fwcloud');
        await queryRunner.dropForeignKey('firewall', 'fk_firewall-fwcloud');
        await queryRunner.dropForeignKey('cluster', 'fk_cluster-fwcloud');
        await queryRunner.dropForeignKey('ca', 'fk_ca-fwcloud');
        
        await queryRunner.dropTable('fwcloud', true);
    }

}
