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

import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class createFirewallTable1579701347320 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        //firewall
        await queryRunner.createTable(new Table({
            name: 'firewall',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'cluster',
                    type: 'int',
                    isNullable: true,
                    default: null,
                },
                {
                    name: 'fwcloud',
                    type: 'int',
                    isNullable: true,
                    default: null,
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
                    name: 'compiled_at',
                    type: 'datetime',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'installed_at',
                    type: 'datetime',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'by_user',
                    type: 'int',
                    isNullable: false,
                    default: 0
                },
                {
                    name: 'status',
                    type: 'tinyint',
                    length: '1',
                    isNullable: false,
                    default: 0
                },
                {
                    name: 'install_user',
                    type: 'varchar',
                    length: '250',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'install_pass',
                    type: 'varchar',
                    length: '250',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'save_user_pass',
                    type: 'tinyint',
                    length: '1',
                    isNullable: false,
                    default: 1
                },
                {
                    name: 'install_interface',
                    type: 'int',
                    length: '11',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'install_ipobj',
                    type: 'int',
                    length: '11',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'fwmaster',
                    type: 'tinyint',
                    length: '1',
                    isNullable: false,
                    default: 0
                },
                {
                    name: 'install_port',
                    type: 'int',
                    isNullable: false,
                    default: 22
                },
                {
                    name: 'options',
                    type: 'smallint',
                    length: "2",
                    isNullable: false,
                    default: 0
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['cluster'],
                    referencedTableName: 'cluster',
                    referencedColumnNames: ['id']
                }
            ]
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable('firewall', true);
    }

}
