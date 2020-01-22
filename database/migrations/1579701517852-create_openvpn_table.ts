import {MigrationInterface, QueryRunner, Table, TableForeignKey} from "typeorm";

export class createOpenvpnTable1579701517852 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
                //openvpn
                await queryRunner.createTable(new Table({
                    name: 'openvpn',
                    columns: [
                        {
                            name: 'id',
                            type: 'int',
                            length: '11',
                            isPrimary: true,
                            generationStrategy: 'increment'
                        },
                        {
                            name: 'openvpn',
                            type: 'int',
                            length: '11',
                            default: null
                        },
                        {
                            name: 'firewall',
                            type: 'int',
                            length: '11',
                            isNullable: false
                        },
                        {
                            name: 'crt',
                            type: 'int',
                            length: '11',
                            isNullable: false
                        },
                        {
                            name: 'install_dir',
                            type: 'varchar',
                            length: '255',
                            default: null
                        },
                        {
                            name: 'install_name',
                            type: 'varchar',
                            length: '255',
                            default: null
                        },
                        {
                            name: 'comment',
                            type: 'varchar',
                            length: '255',
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
                        },
                        {
                            name: 'installed_at',
                            type: 'datetime',
                            default: null
                        }
                    ],
                    uniques: [
                        { columnNames: ['firewall', 'crt'] }
                    ],
                    foreignKeys: [
                        {
                            columnNames: ['crt'],
                            referencedTableName: 'crt',
                            referencedColumnNames: ['id']
                        },
                        {
                            columnNames: ['firewall'],
                            referencedTableName: 'firewall',
                            referencedColumnNames: ['id']
                        },
                        {
                            columnNames: ['openvpn'],
                            referencedTableName: 'openvpn',
                            referencedColumnNames: ['id']
                        }
                    ]
                }), true, true);
        
                //openvpn__ipobj_g
                await queryRunner.createTable(new Table({
                    name: 'openvpn__ipobj_g',
                    columns: [
                        {
                            name: 'openvpn',
                            type: 'int',
                            length: '11',
                            isNullable: false,
                            isPrimary: true
                        },
                        {
                            name: 'ipobj_g',
                            type: 'int',
                            length: '11',
                            isNullable: false,
                            isPrimary: true
                        }
                    ],
                    foreignKeys: [
                        {
                            columnNames: ['ipobj_g'],
                            referencedTableName: 'ipobj_g',
                            referencedColumnNames: ['id']
                        },
                        {
                            columnNames: ['openvpn'],
                            referencedTableName: 'openvpn',
                            referencedColumnNames: ['id']
                        }
                    ]
                }), true);
        
                //openvpn_opt
                await queryRunner.createTable(new Table({
                    name: 'openvpn_opt',
                    columns: [
                        {
                            name: 'openvpn',
                            type: 'int',
                            length: '11',
                            isNullable: false
                        },
                        {
                            name: 'ipobj',
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
                            name: 'arg',
                            type: 'varchar',
                            length: '255',
                            default: null
                        },
                        {
                            name: 'order',
                            type: 'int',
                            length: '11',
                            unsigned: true,
                            isNullable: false
                        },
                        {
                            name: 'scope',
                            type: 'tinyint',
                            length: '1',
                            unsigned: true,
                            isNullable: true
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
                            columnNames: ['ipobj'],
                            referencedTableName: 'ipobj',
                            referencedColumnNames: ['id']
                        },
                        {
                            columnNames: ['openvpn'],
                            referencedTableName: 'openvpn',
                            referencedColumnNames: ['id']
                        }
                    ]
                }), true);
        
                //openvpn_prefix
                await queryRunner.createTable(new Table({
                    name: 'openvpn_prefix',
                    columns: [
                        {
                            name: 'id',
                            type: 'int',
                            length: '11',
                            isPrimary: true,
                            generationStrategy: 'increment'
                        },
                        {
                            name: 'openvpn',
                            type: 'int',
                            length: '11',
                            isNullable: false
                        },
                        {
                            name: 'name',
                            type: 'varchar',
                            length: '255',
                            isNullable: false
                        }
                    ],
                    uniques: [
                        { columnNames: ['openvpn', 'name']}
                    ],
                    foreignKeys: [
                        {
                            columnNames: ['openvpn'],
                            referencedTableName: 'openvpn',
                            referencedColumnNames: ['id']
                        }
                    ]
                }));
        
                //openvpn_prefix__ipobj_g
                await queryRunner.createTable(new Table({
                    name: 'openvpn_prefix__ipobj_g',
                    columns: [
                        {
                            name: 'prefix',
                            type: 'int',
                            length: '11',
                            isNullable: false
                        },
                        {
                            name: 'ipobj_g',
                            type: 'int',
                            length: '11',
                            isNullable: false
                        }
                    ],
                    foreignKeys: [
                        {
                            columnNames: ['ipobj_g'],
                            referencedTableName: 'ipobj_g',
                            referencedColumnNames: ['id']
                        },
                        {
                            columnNames: ['prefix'],
                            referencedTableName: 'openvpn_prefix',
                            referencedColumnNames: ['id']
                        }
                    ]
                }));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable('openvpn_prefix__ipobj_g', true);
        await queryRunner.dropTable('openvpn_prefix', true);
        await queryRunner.dropTable('openvpn_opt', true);
        await queryRunner.dropTable('openvpn__ipobj_g', true);
        await queryRunner.dropTable('openvpn', true);
    }

}
