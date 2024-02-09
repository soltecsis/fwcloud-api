/*
    Copyright 2023 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class DHCPService1699131121605 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'dhcp_g',
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
                    name: 'style',
                    type: 'varchar',
                    length: '50',
                    isNullable: true,
                    default: null
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

        await queryRunner.createTable(new Table({
            name: 'dhcp_r',
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
                    isNullable: true
                },
                {
                    name: 'rule_type',
                    type: 'tinyint',
                    length: '1',
                    isNullable: false,
                    default: 1
                },
                {
                    name: 'rule_order',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                },
                {
                    name: 'active',
                    type: 'tinyint',
                    length: '1',
                    isNullable: false,
                    default: 1
                },
                {
                    name: 'group',
                    type: 'int',
                    length: '11',
                    isNullable: true
                },
                {
                    name: 'style',
                    type: 'varchar',
                    length: '50',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'network',
                    type: 'int',
                    length: '11',
                    isNullable: true
                },
                {
                    name: 'range',
                    type: 'int',
                    length: '11',
                    isNullable: true
                },
                {
                    name: 'router',
                    type: 'int',
                    length: '11',
                    isNullable: true
                },
                {
                    name: 'interface',
                    type: 'int',
                    length: '11',
                    isNullable: true
                },
                {
                    name: 'max_lease',
                    type: 'int',
                    length: '11',
                    unsigned: true,
                    isNullable: true,
                    default: 86400
                },
                {
                    name: 'cfg_text',
                    type: 'text',
                    isNullable: true
                },
                {
                    name: 'comment',
                    type: 'text',
                    isNullable: true
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['group'],
                    referencedTableName: 'dhcp_g',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['network'],
                    referencedTableName: 'ipobj',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['range'],
                    referencedTableName: 'ipobj',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['router'],
                    referencedTableName: 'ipobj',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['interface'],
                    referencedTableName: 'interface',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['firewall'],
                    referencedTableName: 'firewall',
                    referencedColumnNames: ['id']
                }
            ]
        }));

        await queryRunner.createTable(new Table({
            name: 'dhcp_r__ipobj',
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
                },
                {
                    name: 'order',
                    type: 'int',
                    length: '11',
                    isNullable: false,
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['rule'],
                    referencedTableName: 'dhcp_r',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['ipobj'],
                    referencedTableName: 'ipobj',
                    referencedColumnNames: ['id']
                }
            ]
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('dhcp_r__ipobj', true);
        await queryRunner.dropTable('dhcp_r', true);
        await queryRunner.dropTable('dhcp_g', true);
    }
}
