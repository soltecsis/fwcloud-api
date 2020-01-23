import {MigrationInterface, QueryRunner, Table, TableForeignKey} from "typeorm";
import { findForeignKeyInTable } from "../../utils/typeorm/TableUtils";

export class createIpobjTable1579701470388 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        //interface__ipobj
        await queryRunner.createTable(new Table({
            name: 'interface__ipobj',
            columns: [
                {
                    name: 'interface',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'ipobj',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'interface_order',
                    type: 'varchar',
                    length: '45',
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
                }

            ],
            indices: [{columnNames: ['interface', 'ipobj']}],
            foreignKeys: [
                {
                    columnNames: ['interface'],
                    referencedTableName: 'interface',
                    referencedColumnNames: ['id']
                }
            ]
        }), true);

        // ipobj
        await queryRunner.createTable(new Table({
            name: 'ipobj',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    length: '11',
                    isPrimary: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'fwcloud',
                    type: 'int',
                    length: '11',
                    default: null
                },
                {
                    name: 'interface',
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
                    name: 'type',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'protocol',
                    type: 'tinyint',
                    length: '1',
                    isNullable: false
                },
                {
                    name: 'address',
                    type: 'varchar',
                    length: '255',
                    default: null
                },
                {
                    name: 'netmask',
                    type: 'varchar',
                    length: '255',
                    default: null
                },
                {
                    name: 'diff_serv',
                    type: 'tinyint',
                    length: '1',
                    unsigned: true,
                    default: null
                },
                {
                    name: 'ip_version',
                    type: 'tinyint',
                    length: '1',
                    unsigned: true,
                    default: null
                },
                {
                    name: 'icmp_type',
                    type: 'smallint',
                    length: '2',
                    default: null
                },
                {
                    name: 'icmp_code',
                    type: 'smallint',
                    length: '2',
                    default: null
                },
                {
                    name: 'tcp_flags_mask',
                    type: 'tinyint',
                    length: '1',
                    unsigned: true,
                    default: null
                },
                {
                    name: 'tcp_flags_settings',
                    type: 'tinyint',
                    length: '1',
                    unsigned: true,
                    default: null
                },
                {
                    name: 'range_start',
                    type: 'varchar',
                    length: '255',
                    default: null,
                },
                {
                    name: 'range_end',
                    type: 'varchar',
                    length: '255',
                    default: null
                },
                {
                    name: 'source_port_start',
                    type: 'int',
                    length: '11',
                    default: null
                },
                {
                    name: 'source_port_end',
                    type: 'int',
                    length: '11',
                    default: null
                },
                {
                    name: 'desintation_port_start',
                    type: 'int',
                    default:null
                },
                {
                    name: 'destination_port_end',
                    type: 'int',
                    default: null
                },
                {
                    name: 'options',
                    type: 'varchar',
                    length: '255',
                    default: null
                },
                {
                    name: 'comment',
                    type: 'longtext',
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
            foreignKeys: [
                {
                    columnNames: ['fwcloud'],
                    referencedTableName: 'fwcloud',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['interface'],
                    referencedTableName: 'interface',
                    referencedColumnNames: ['id']
                }
            ]
        }), true);

        await queryRunner.createForeignKey('interface__ipobj', new TableForeignKey({
            columnNames: ['ipobj'],
            referencedTableName: 'ipobj',
            referencedColumnNames: ['id']
        }));

        //ipobj__ipobjg
        await queryRunner.createTable(new Table({
            name: 'ipobj__ipobjg',
            columns: [
                {
                    name: 'id_gi',
                    type: 'int',
                    length: '11',
                    generationStrategy: 'increment',
                    isPrimary: true
                },
                {
                    name: 'ipobj_g',
                    type: 'int',
                    isNullable: true
                },
                {
                    name: 'ipobj',
                    type: 'int',
                    isNullable:true
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
                { columnNames: ['ipobj_g', 'ipobj'] }
            ],
            foreignKeys: [
                {
                    columnNames: ['ipobj'],
                    referencedTableName: 'ipobj',
                    referencedColumnNames: ['id']
                }
            ]
        }), true);

        //ipobj_g
        await queryRunner.createTable(new Table({
            name: 'ipobj_g',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    length: '11',
                    isNullable: false,
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
                    name: 'fwcloud',
                    type: 'int',
                    length: '11',
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
                },
                {
                    name: 'comment',
                    type: 'longtext'
                }
            ]
        }), true);

        await queryRunner.createForeignKey('ipobj__ipobjg', new TableForeignKey({
            columnNames: ['ipobj_g'],
            referencedTableName: 'ipobj_g',
            referencedColumnNames: ['id']
        }));

        //ipobj_type
        await queryRunner.createTable(new Table({
            name: 'ipobj_type',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    length: '11',
                    isPrimary: true
                },
                {
                    name: 'type',
                    type: 'varchar',
                    length: '45',
                    isNullable: false
                },
                {
                    name: 'protocol_number',
                    type: 'smallint',
                    length: '1',
                    default: null
                }
            ]
        }), true);

        await queryRunner.createForeignKey('ipobj', new TableForeignKey({
            columnNames: ['type'],
            referencedTableName: 'ipobj_type',
            referencedColumnNames: ['id']
        }));

        await queryRunner.createForeignKey('fwc_tree', new TableForeignKey({
            columnNames: ['obj_type'],
            referencedTableName: 'ipobj_type',
            referencedColumnNames: ['id']
        }));

        //ipobj_type__policy_position
        await queryRunner.createTable(new Table({
            name: 'ipobj_type__policy_position',
            columns: [
                {
                    name: 'type',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                },
                {
                    name: 'position',
                    type: 'int',
                    length: '11',
                    isNullable: false
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['type'],
                    referencedTableName: 'ipobj_type',
                    referencedColumnNames: ['id']
                }
            ]
        }), true);

        //ipobj_type__routing_position
        await queryRunner.createTable(new Table({
            name: 'ipobj_type__routing_position',
            columns: [
                {
                    name: 'type',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'position',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                },
                {
                    name: 'allowed',
                    type: 'tinyint',
                    length: '1',
                    isNullable: false
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['type'],
                    referencedTableName: 'ipobj_type',
                    referencedColumnNames: ['id']
                }
            ]
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        let table: Table;

        await queryRunner.dropTable('ipobj_type__routing_position', true);
        await queryRunner.dropTable('ipobj_type__policy_position', true);

        table = await queryRunner.getTable('fwc_tree');
        await queryRunner.dropForeignKey(table, findForeignKeyInTable(table, 'obj_type'));

        table = await queryRunner.getTable('ipobj');
        await queryRunner.dropForeignKey('ipobj', findForeignKeyInTable(table, 'type'));
        
        await queryRunner.dropTable('ipobj_type', true);

        table = await queryRunner.getTable('ipobj__ipobjg');
        await queryRunner.dropForeignKey(table, findForeignKeyInTable(table, 'ipobj_g'));
        await queryRunner.dropTable('ipobj_g', true);

        await queryRunner.dropTable('ipobj__ipobjg', true);

        table = await queryRunner.getTable('interface__ipobj');
        await queryRunner.dropForeignKey('interface__ipobj', findForeignKeyInTable(table, 'ipobj'));
        await queryRunner.dropTable('ipobj', true);

        await queryRunner.dropTable('interface__ipobj', true);


    }

}
