import {MigrationInterface, QueryRunner, Table, TableForeignKey} from "typeorm";

export class createPolicyTable1579701543732 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        //policy_c
        await queryRunner.createTable(new Table({
            name: 'policy_c',
            columns: [
                {
                    name: 'rule',
                    type: 'int',
                    length: '11',
                    isPrimary: true
                },
                {
                    name: 'rule_compiled',
                    type: 'text'
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
                    name: 'status_compiled',
                    type: 'tinyint',
                    length: '1',
                    isNullable: false,
                    default: 0
                }
            ]
        }));

        //policy_g
        await queryRunner.createTable(new Table({
            name: 'policy_g',
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
                    type: 'longtext'
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
                },
                {
                    name: 'groupstyle',
                    type: 'varchar',
                    length: '50',
                    default: null
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['firewall'],
                    referencedTableName: 'firewall',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['idgroup'],
                    referencedTableName: 'policy_g',
                    referencedColumnNames: ['id']
                }
            ]
        }));

        //policy_position
        await queryRunner.createTable(new Table({
            name: 'policy_position',
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
                    name: 'policy_type',
                    type: 'tinyint',
                    isNullable: false,
                    comment: 'R : Routing   P: Policy   N:Nat'
                },
                {
                    name: 'position_order',
                    type: 'tinyint',
                    length: '2',
                    default: null
                },
                {
                    name: 'content',
                    type: 'varchar',
                    length: '1',
                    default: null,
                },
                {
                    name: 'single_object',
                    type: 'tinyint',
                    length: '1',
                    isNullable: false,
                    default: 0
                },
            ],
            indices: [
                { columnNames: ['policy_type', 'position_order'] }
            ]
        }));

        //policy_r
        await queryRunner.createTable(new Table({
            name: 'policy_r',
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
                    isNullable: false
                },
                {
                    name: 'direction',
                    type: 'int',
                    length: '11',
                    default: null
                },
                {
                    name: 'action',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'time_start',
                    type: 'datetime',
                    default: null
                },
                {
                    name: 'time_end',
                    type: 'datetime',
                    default: null
                },
                {
                    name: 'comment',
                    type: 'longtext'
                },
                {
                    name: 'options',
                    type: 'smallint',
                    length: '2',
                    isNullable: false,
                    default: 0
                },
                {
                    name: 'active',
                    type: 'tinyint',
                    length: '1',
                    isNullable: false,
                    default: 1
                },
                {
                    name: 'type',
                    type: 'tinyint',
                    default: null,
                    comment: 'rule type: I, O, F, N'
                },
                {
                    name: 'style',
                    type: 'varchar',
                    length: '50',
                    default: null
                },
                {
                    name: 'fw_apply_to',
                    type: 'int',
                    length: '11',
                    default: null
                },
                {
                    name: 'negate',
                    type: 'varchar',
                    length: '255',
                    default: null
                },
                {
                    name: 'mark',
                    type: 'int',
                    length: '11',
                    default: null
                },
                {
                    name: 'special',
                    type: 'int',
                    length: '11',
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
            indices: [
                { columnNames: ['idgroup'] },
                { columnNames: ['firewall'] },
                { columnNames: ['type'] },
                { columnNames: ['mark'] },
            ],
            foreignKeys: [
                {
                    columnNames: ['firewall'],
                    referencedTableName: 'firewall',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['mark'],
                    referencedTableName: 'mark',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['idgroup'],
                    referencedTableName: 'policy_g',
                    referencedColumnNames: ['id']
                }
            ]
        }));

        await queryRunner.createForeignKey('policy_c', new TableForeignKey({
            name: 'fk_policy_c-policy_r',
            columnNames: ['rule'],
            referencedTableName: 'policy_r',
            referencedColumnNames: ['id']
        }));

        //policy_r__interface
        await queryRunner.createTable(new Table({
            name: 'policy_r__interface',
            columns: [
                {
                    name: 'rule',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                },
                {
                    name: 'interface',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                },
                {
                    name: 'position',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                },
                {
                    name: 'position_order',
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
                { columnNames: ['interface']},
                { columnNames: ['position']},
            ],
            foreignKeys: [
                {
                    columnNames: ['interface'],
                    referencedTableName: 'interface',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['position'],
                    referencedTableName: 'policy_position',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['rule'],
                    referencedTableName: 'policy_r',
                    referencedColumnNames: ['id']
                }
            ]
        }));

        //policy_r__ipobj
        await queryRunner.createTable(new Table({
            name: 'policy_r__ipobj',
            columns: [
                {
                    name: 'id_pi',
                    type: 'int',
                    length: '11',
                    generationStrategy: 'increment',
                    isPrimary: true
                },
                {
                    name: 'rule',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'ipobj',
                    type: 'int',
                    length: '11',
                    default: 0,
                    comment: 'id IPOBJ',
                },
                {
                    name: 'ipobj_g',
                    type: 'int',
                    length: '11',
                    default: 0,
                    comment: 'ID IPOBJ GROUP'
                },
                {
                    name: 'interface',
                    type: 'int',
                    length: '11',
                    default: 0,
                    comment: 'ID Interface in this position'
                },
                {
                    name: 'position',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'position_order',
                    type: 'int',
                    length: '11',
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
            uniques: [
                { columnNames: ['rule', 'ipobj', 'ipobj_g', 'interface', 'position'] },
            ],
            indices: [
                { columnNames: ['rule'] },
                { columnNames: ['position'] }
            ]
        }));

        //policy_r__openvpn
        await queryRunner.createTable(new Table({
            name: 'policy_r__openvpn',
            columns: [
                {
                    name: 'rule',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                },
                {
                    name: 'openvpn',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                },
                {
                    name: 'position',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                },
                {
                    name: 'position_order',
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
                { columnNames: ['openvpn'] },
                { columnNames: ['position'] }
            ]
        }));

        //policy_r__openvpn_prefix
        await queryRunner.createTable(new Table({
            name: 'policy_r__openvpn_prefix',
            columns: [
                {
                    name: 'rule',
                    type: 'int',
                    length: '11',
                    isPrimary: true,
                },
                {
                    name: 'prefix',
                    type: 'int',
                    length: '11',
                    isPrimary: true
                },
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
                { columnNames: ['position'] },
                { columnNames: ['rule'] },
                { columnNames: ['prefix'] },
            ]
        }));

        //policy_type
        await queryRunner.createTable(new Table({
            name: 'policy_type',
            columns: [
                {
                    name: 'id',
                    type: 'tinyint',
                    length: '1',
                    isPrimary: true
                },
                {
                    name: 'type',
                    type: 'varchar',
                    length: '2',
                    isNullable: false
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '50',
                    default: null
                },
                {
                    name: 'type_order',
                    type: 'tinyint',
                    length: '2',
                    isNullable: false,
                    default: 1
                },
                {
                    name: 'show_action',
                    type: 'tinyint',
                    length: '1',
                    default: 1
                }
            ],
            uniques: [
                { columnNames: ['type'] }
            ]
        }));

        await queryRunner.createForeignKey('policy_position', new TableForeignKey({
            name: 'fk_policy_position-policy_type',
            columnNames: ['policy_type'],
            referencedTableName: 'policy_type',
            referencedColumnNames: ['id']
        }));

        await queryRunner.createForeignKey('policy_r', new TableForeignKey({
            name: 'fk_policy_r-policy_type',
            columnNames: ['type'],
            referencedTableName: 'policy_type',
            referencedColumnNames: ['id']
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropForeignKey('policy_r', 'fk_policy_r-policy_type');
        await queryRunner.dropForeignKey('policy_position', 'fk_policy_position-policy_type');
        await queryRunner.dropTable('policy_type', true);

        await queryRunner.dropTable('policy_r__openvpn_prefix', true);
        await queryRunner.dropTable('policy_r__openvpn', true);
        await queryRunner.dropTable('policy_r__ipobj', true);
        await queryRunner.dropTable('policy_r__interface', true);

        await queryRunner.dropForeignKey('policy_c', 'fk_policy_c-policy_r');
        await queryRunner.dropTable('policy_r', true);

        await queryRunner.dropTable('policy_position', true);

        await queryRunner.dropTable('policy_g', true);
        await queryRunner.dropTable('policy_c', true);
    }

}
