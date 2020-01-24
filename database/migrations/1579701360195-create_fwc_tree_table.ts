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

export class createFwcTreeTable1579701360195 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {

        //fwc_tree
        await queryRunner.createTable(new Table({
            name: 'fwc_tree',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isGenerated: true,
                    generationStrategy: 'increment',
                    isPrimary: true
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: "45",
                    isNullable: false
                },
                {
                    name: 'id_parent',
                    type: 'int',
                    isNullable: true,
                    default: null,
                },
                {
                    name: 'node_order',
                    type: 'tinyint',
                    length: '2',
                    isNullable: false,
                    default: 0
                },
                {
                    name: 'node_type',
                    type: 'char',
                    length: '3',
                    isNullable: true,
                    default: null,
                },
                {
                    name: 'id_obj',
                    type: 'int',
                    length: '11',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'obj_type',
                    type: 'int',
                    length: '11',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'fwcloud',
                    type: 'int',
                    length: '11',
                    isNullable: true,
                    default: null
                },
            ],
            uniques: [
                { columnNames: ['id_obj', 'obj_type', 'id_parent', 'nodE_type'] }
            ],
            foreignKeys: [
                {
                    columnNames: ['id_parent'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'fwc_tree'
                }
            ]
        }), true);

        //fwc_tree_node_types
        await queryRunner.createTable(new Table({
            name: 'fwc_tree_node_types',
            columns: [
                {
                    name: 'node_type',
                    type: 'char',
                    length: '3',
                    isPrimary: true
                },
                {
                    name: 'obj_type',
                    type: 'int',
                    length: '11',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '45',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'api_call_base',
                    type: 'varchar',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'order_mode',
                    type: 'tinyint',
                    length: '1',
                    isNullable: false,
                    default: 1,
                    comment: 'Node order: 1-NODE_ORDER, 2 - NAME',
                }
            ]
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable('fwc_tree_node_types', true);
        await queryRunner.dropTable('fwc_tree', true);
    }

}
