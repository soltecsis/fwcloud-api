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
import { findForeignKeyInTable } from "../../utils/typeorm/TableUtils";

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
                    isGenerated: true,
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
                    isNullable: true,
                    default: null
                },
                {
                    name: 'locked_by',
                    type: 'int',
                    length: '11',
                    isNullable: true,
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
                    isNullable: true,
                    default: null
                },
                {
                    name: 'comment',
                    type: 'varchar',
                    isNullable: true,
                    default: null
                }
            ]
        }), true);

        await queryRunner.createForeignKey('ca', new TableForeignKey({
            referencedTableName: 'fwcloud',
            referencedColumnNames: ['id'],
            columnNames: ['fwcloud']
        }));

        await queryRunner.createForeignKey('cluster', new TableForeignKey({
            referencedTableName: 'fwcloud',
            referencedColumnNames: ['id'],
            columnNames: ['fwcloud']
        }));

        await queryRunner.createForeignKey('firewall', new TableForeignKey({
            referencedTableName: 'fwcloud',
            referencedColumnNames: ['id'],
            columnNames: ['fwcloud']
        }));

        await queryRunner.createForeignKey('fwc_tree', new TableForeignKey({
            referencedTableName: 'fwcloud',
            referencedColumnNames: ['id'],
            columnNames: ['fwcloud']
        }))
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        let table: Table;

        table = await queryRunner.getTable('fwc_tree');
        await queryRunner.dropForeignKey(table, findForeignKeyInTable(table, 'fwcloud'));

        table = await queryRunner.getTable('firewall');
        await queryRunner.dropForeignKey(table, findForeignKeyInTable(table, 'fwcloud'));

        table = await queryRunner.getTable('cluster');
        await queryRunner.dropForeignKey(table, findForeignKeyInTable(table, 'fwcloud'));

        table = await queryRunner.getTable('ca');
        await queryRunner.dropForeignKey(table, findForeignKeyInTable(table, 'fwcloud'));
        
        await queryRunner.dropTable('fwcloud', true);
    }

}
