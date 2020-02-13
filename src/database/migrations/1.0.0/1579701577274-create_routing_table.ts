/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import {MigrationInterface, QueryRunner, Table, TableForeignKey} from "typeorm";
import { findForeignKeyInTable } from "../../../utils/typeorm/TableUtils";

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
