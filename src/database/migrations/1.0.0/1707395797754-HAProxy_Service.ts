/*
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class HAProxyService1707395797754 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'haproxy_g',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment'
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
                    default: null,
                },
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
            name: 'haproxy_r',
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
                    name: 'firewall',
                    type: 'int',
                    length: '11',
                    isNullable: false
                },
                {
                    name: 'frontend_ip',
                    type: 'int',
                    length: '11',
                    isNullable: true
                },
                {
                    name: 'frontend_port',
                    type: 'int',
                    length: '11',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'backend_ip',
                    type: 'int',
                    length: '11',
                    isNullable: true
                },
                {
                    name: 'backend_port',
                    type: 'int',
                    length: '11',
                    isNullable: true,
                    default: null
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
                    columnNames: ['firewall'],
                    referencedTableName: 'firewall',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['frontend_ip'],
                    referencedTableName: 'ipobj',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['frontend_port'],
                    referencedTableName: 'ipobj',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['backend_ip'],
                    referencedTableName: 'ipobj',
                    referencedColumnNames: ['id']
                },
                {
                    columnNames: ['backend_port'],
                    referencedTableName: 'ipobj',
                    referencedColumnNames: ['id']
                }
            ]
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('haproxy_r');
        await queryRunner.dropTable('haproxy_g');
    }

}
