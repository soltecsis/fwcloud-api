/*
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import {MigrationInterface, QueryRunner, Table } from "typeorm";

export class routingFeature1619453385390 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        // New tree node types.
        await queryRunner.query(`INSERT INTO fwc_tree_node_types VALUES('ROU',NULL,'Routing',NULL,1)`);
        await queryRunner.query(`INSERT INTO fwc_tree_node_types VALUES('RTS',NULL,'Routing tables',NULL,1)`);
        await queryRunner.query(`INSERT INTO fwc_tree_node_types VALUES('RT',NULL,'Routing table',NULL,1)`);

        // Drop old database routing tables.
        await queryRunner.dropTable('ipobj_type__routing_position', true);
        await queryRunner.dropTable('routing_r__ipobj', true);
        await queryRunner.dropTable('routing_r__interface', true);
        await queryRunner.dropTable('routing_r', true);      
        await queryRunner.dropTable('routing_position', true);
        await queryRunner.dropTable('routing_g', true);

        // Create new database routing tables.
        //routing_table
        await queryRunner.createTable(new Table({
            name: 'routing_table',
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
                    name: 'firewall',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'number',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                },
                {
                    name: 'name',
                    type: 'varchar',
                    isNullable: false
                },
                {
                    name: 'comment',
                    type: 'text',
                    isNullable: true
                }
            ],
            indices: [{ columnNames: ['firewall', 'number'], isUnique: true }],
            foreignKeys: [
                {
                    columnNames: ['firewall'],
                    referencedTableName: 'firewall',
                    referencedColumnNames: ['id']
                }
            ]
        }));

        //route_g
        await queryRunner.createTable(new Table({
            name: 'route_g',
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
                    isNullable: false
                },
                {
                    name: 'firewall',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'comment',
                    type: 'text',
                    isNullable: true
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['firewall'],
                    referencedTableName: 'firewall',
                    referencedColumnNames: ['id']
                }
            ]
        }));

        //route
        await queryRunner.createTable(new Table({
            name: 'route',
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
                    name: 'group',
                    type: 'int',
                    length: '11',
                    isNullable: true
                },
                {
                    name: 'routing_table',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'gateway',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'interface',
                    type: 'int',
                    length: '11',
                    isNullable: true
                },
                {
                    name: 'active',
                    type: 'tinyint',
                    length: '1',
                    isNullable: false,
                    default: 1
                },
                {
                    name: 'comment',
                    type: 'text',
                    isNullable: true
                },
                {
                    name: 'route_order',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                },
                {
                    name: 'style',
                    type: 'varchar',
                    length: '50',
                    isNullable: true,
                    default: null
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['group'],
                    referencedTableName: 'route_g',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['routing_table'],
                    referencedTableName: 'routing_table',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['gateway'],
                    referencedTableName: 'ipobj',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['interface'],
                    referencedTableName: 'interface',
                    referencedColumnNames: ['id']
                }
            ]
        }));

        //routing_g
        await queryRunner.createTable(new Table({
            name: 'routing_g',
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
                    isNullable: false
                },
                {
                    name: 'firewall',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'comment',
                    type: 'text',
                    isNullable: true
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['firewall'],
                    referencedTableName: 'firewall',
                    referencedColumnNames: ['id']
                }
            ]
        }));

        //routing_r
        await queryRunner.createTable(new Table({
            name: 'routing_r',
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
                    name: 'group',
                    type: 'int',
                    length: '11',
                    isNullable: true
                },
                {
                    name: 'routing_table',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'active',
                    type: 'tinyint',
                    length: '1',
                    isNullable: false,
                    default: 1
                },
                {
                    name: 'comment',
                    type: 'text',
                    isNullable: true
                },
                {
                    name: 'rule_order',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                },
                {
                    name: 'style',
                    type: 'varchar',
                    length: '50',
                    isNullable: true,
                    default: null
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['group'],
                    referencedTableName: 'routing_g',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['routing_table'],
                    referencedTableName: 'routing_table',
                    referencedColumnNames: ['id']
                },
            ]
        }));


        //routing_r__mark
        await queryRunner.createTable(new Table({
            name: 'routing_r__mark',
            columns: [
                {
                    name: 'rule',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                },
                {
                    name: 'mark',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['rule'],
                    referencedTableName: 'routing_r',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['mark'],
                    referencedTableName: 'mark',
                    referencedColumnNames: ['id']
                }
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
                    isNullable: false,
                    isPrimary: true
                },
                {
                    name: 'ipobj',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['rule'],
                    referencedTableName: 'routing_r',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['ipobj'],
                    referencedTableName: 'ipobj',
                    referencedColumnNames: ['id']
                }
            ]
        }));

        //routing_r__ipobj_g
        await queryRunner.createTable(new Table({
            name: 'routing_r__ipobj_g',
            columns: [
                {
                    name: 'rule',
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
                    columnNames: ['rule'],
                    referencedTableName: 'routing_r',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['ipobj_g'],
                    referencedTableName: 'ipobj_g',
                    referencedColumnNames: ['id']
                }
            ]
        }));

        //routing_r__openvpn
        await queryRunner.createTable(new Table({
            name: 'routing_r__openvpn',
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
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['rule'],
                    referencedTableName: 'routing_r',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['openvpn'],
                    referencedTableName: 'openvpn',
                    referencedColumnNames: ['id']
                }
            ]
        }));

        //routing_r__openvpn_prefix
        await queryRunner.createTable(new Table({
            name: 'routing_r__openvpn_prefix',
            columns: [
                {
                    name: 'rule',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                },
                {
                    name: 'openvpn_prefix',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['rule'],
                    referencedTableName: 'routing_r',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['openvpn_prefix'],
                    referencedTableName: 'openvpn_prefix',
                    referencedColumnNames: ['id']
                }
            ]
        }));


        //route__ipobj
        await queryRunner.createTable(new Table({
            name: 'route__ipobj',
            columns: [
                {
                    name: 'route',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                },
                {
                    name: 'ipobj',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['route'],
                    referencedTableName: 'route',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['ipobj'],
                    referencedTableName: 'ipobj',
                    referencedColumnNames: ['id']
                }
            ]
        }));

        //route__ipobj_g
        await queryRunner.createTable(new Table({
            name: 'route__ipobj_g',
            columns: [
                {
                    name: 'route',
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
                    columnNames: ['route'],
                    referencedTableName: 'route',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['ipobj_g'],
                    referencedTableName: 'ipobj_g',
                    referencedColumnNames: ['id']
                }
            ]
        }));

        //route__openvpn
        await queryRunner.createTable(new Table({
            name: 'route__openvpn',
            columns: [
                {
                    name: 'route',
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
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['route'],
                    referencedTableName: 'route',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['openvpn'],
                    referencedTableName: 'openvpn',
                    referencedColumnNames: ['id']
                }
            ]
        }));

        //route__openvpn_prefix
        await queryRunner.createTable(new Table({
            name: 'route__openvpn_prefix',
            columns: [
                {
                    name: 'route',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                },
                {
                    name: 'openvpn_prefix',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                    isPrimary: true
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['route'],
                    referencedTableName: 'route',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['openvpn_prefix'],
                    referencedTableName: 'openvpn_prefix',
                    referencedColumnNames: ['id']
                }
            ]
        }));
    }


    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DELETE FROM fwc_tree_node_types WHERE node_type='ROU'`);
        await queryRunner.query(`DELETE FROM fwc_tree_node_types WHERE node_type='RTS'`);
        await queryRunner.query(`DELETE FROM fwc_tree_node_types WHERE node_type='RT'`);
        
        await queryRunner.dropTable('routing_r__mark', true);
        await queryRunner.dropTable('routing_r__ipobj', true);
        await queryRunner.dropTable('routing_r__ipobj_g', true);
        await queryRunner.dropTable('routing_r__openvpn', true);
        await queryRunner.dropTable('routing_r__openvpn_prefix', true);

        await queryRunner.dropTable('route__ipobj', true);
        await queryRunner.dropTable('route__ipobj_g', true);
        await queryRunner.dropTable('route__openvpn', true);
        await queryRunner.dropTable('route__openvpn_prefix', true);

        await queryRunner.dropTable('route', true);
        await queryRunner.dropTable('routing_r', true);
        await queryRunner.dropTable('routing_table', true);
        await queryRunner.dropTable('route_g', true);
        await queryRunner.dropTable('routing_g', true);

        //routing_g
        await queryRunner.createTable(new Table({
            name: 'routing_g',
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
                    name: 'firewall',
                    type: 'int',
                    length: '11',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'name',
                    type: 'varchar',
                    isNullable: false
                },
                {
                    name: 'comment',
                    type: 'longtext',
                    isNullable: true
                },
                {
                    name: 'idgroup',
                    type: 'int',
                    length: '11',
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
            foreignKeys: [
                {
                    columnNames: ['firewall'],
                    referencedTableName: 'firewall',
                    referencedColumnNames: ['id']
                }
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
            ]
        }));

        //routing_r
        await queryRunner.createTable(new Table({
            name: 'routing_r',
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
                    name: 'idgroup',
                    type: 'int',
                    length: '11',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'firewall',
                    type: 'int',
                    length: '11',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'rule_order',
                    type: 'int',
                    length: '11',
                    isNullable: false,
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
                    isNullable: true,
                    default: null
                },
                {
                    name: 'comment',
                    type: 'longtext',
                    isNullable: true,
                },
                {
                    name: 'active',
                    type: 'tinyint',
                    length: '1',
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
            foreignKeys: [
                {
                    columnNames: ['firewall'],
                    referencedTableName: 'firewall',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['idgroup'],
                    referencedTableName: 'routing_g',
                    referencedColumnNames: ['id']
                }
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
            foreignKeys: [
                {
                    columnNames: ['interface'],
                    referencedTableName: 'interface',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['rule'],
                    referencedTableName: 'routing_r',
                    referencedColumnNames: ['id']
                }
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
                    length: '11'
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
                    columnNames: ['ipobj'],
                    referencedTableName: 'ipobj',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['ipobj_g'],
                    referencedTableName: 'ipobj_g',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['rule'],
                    referencedTableName: 'routing_r',
                    referencedColumnNames: ['id']
                },
            ]
        }));

        //ipobj_type__routing_position
        await queryRunner.createTable(new Table({
            name: 'ipobj_type__routing_position',
            columns: [
                {
                    name: 'type',
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
                },
                {
                    columnNames: ['position'],
                    referencedTableName: 'routing_position',
                    referencedColumnNames: ['id']
                }
            ]
        }), true);
    }
}
