import {MigrationInterface, QueryRunner, Table, TableForeignKey} from "typeorm";
import { findForeignKeyInTable } from "../../utils/typeorm/TableUtils";

export class createRoutingTable1579701577274 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        //routing_g
        await queryRunner.createTable(new Table({
            name: 'routing_g',
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
                    name: 'comment',
                    type: 'longtext',
                },
                {
                    name: 'idgroup',
                    type: 'int',
                    length: '11',
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
            indices: [
                { columnNames: ['firewall'] }
            ]
        }));

        //routing_position
        await queryRunner.createTable(new Table({
            name: 'routing_position',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    length: '11',
                    isPrimary: true
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '45',
                    isNullable: false
                },
                {
                    name: 'position_order',
                    type: 'tinyint',
                    length: '2',
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
            ]
        }));

        await queryRunner.createForeignKey('ipobj_type__routing_position', new TableForeignKey({
            columnNames: ['position'],
            referencedTableName: 'routing_position',
            referencedColumnNames: ['id']
        }));

        //routing_r
        await queryRunner.createTable(new Table({
            name: 'routing_r',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    length: '11',
                    isPrimary: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'idgroup',
                    type: 'int',
                    length: '11',
                    default: null
                },
                {
                    name: 'firewall',
                    type: 'int',
                    length: '11',
                    default: null
                },
                {
                    name: 'rule_order',
                    type: 'int',
                    length: '11',
                    isNullable: true,
                    default: 0
                },
                {
                    name: 'metric',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'options',
                    type: 'varchar',
                    length: '255',
                    default: null
                },
                {
                    name: 'comment',
                    type: 'longtext'
                },
                {
                    name: 'active',
                    type: 'tinyint',
                    isNullable: false,
                    default: 1
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
            indices: [
                { columnNames: ['idgroup'] },
                { columnNames: ['firewall'] }
            ]
        }));

        //routing_r__interface
        await queryRunner.createTable(new Table({
            name: 'routing_r__interface',
            columns: [
                {
                    name: 'rule',
                    type: 'int',
                    length: '11',
                    isPrimary: true
                },
                {
                    name: 'interface',
                    type: 'int',
                    length: '11',
                    isPrimary: true
                },
                {
                    name: 'interface_order',
                    type: 'varchar',
                    length: '45',
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
            indices: [
                { columnNames: ['interface'] }
            ]
        }));

        //routing_r__ipobj
        await queryRunner.createTable(new Table({
            name: 'routing_r__ipobj',
            columns: [
                {
                    name: 'rule',
                    type: 'int',
                    length: '11',
                    isPrimary: true
                },
                {
                    name: 'ipobj',
                    type: 'int',
                    length: '11',
                    isPrimary: true
                }
                ,
                {
                    name: 'ipobj_g',
                    type: 'int',
                    length: '11',
                    isPrimary: true
                }
                ,
                {
                    name: 'position',
                    type: 'int',
                    length: '11',
                    isPrimary: true
                },
                {
                    name: 'position_order',
                    type: 'int',
                    length: '11',
                    isPrimary: true
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
            indices: [
                { columnNames: ['ipobj_g'] },
                { columnNames: ['ipobj'] }
            ]
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        let table: Table;

        await queryRunner.dropTable('routing_r__ipobj', true);
        await queryRunner.dropTable('routing_r__interface', true);
        await queryRunner.dropTable('routing_r', true);
        
        table = await queryRunner.getTable('ipobj_type__routing_position');
        await queryRunner.dropForeignKey(table, findForeignKeyInTable(table, 'position'));
        await queryRunner.dropTable('routing_position', true);
        
        await queryRunner.dropTable('routing_g', true);
    }

}
