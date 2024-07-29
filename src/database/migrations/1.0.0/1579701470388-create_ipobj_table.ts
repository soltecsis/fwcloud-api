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

import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';
import { findForeignKeyInTable } from '../../../utils/typeorm/TableUtils';

export class createIpobjTable1579701470388 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    //interface__ipobj
    await queryRunner.createTable(
      new Table({
        name: 'interface__ipobj',
        columns: [
          {
            name: 'interface',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'ipobj',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'interface_order',
            type: 'varchar',
            length: '45',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'datetime',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
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
        ],
        foreignKeys: [
          {
            columnNames: ['interface'],
            referencedTableName: 'interface',
            referencedColumnNames: ['id'],
          },
        ],
      }),
      true,
    );

    // ipobj
    await queryRunner.createTable(
      new Table({
        name: 'ipobj',
        columns: [
          {
            name: 'id',
            type: 'int',
            length: '11',
            isGenerated: true,
            generationStrategy: 'increment',
            isPrimary: true,
          },
          {
            name: 'fwcloud',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          },
          {
            name: 'interface',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'int',
            length: '11',
            isNullable: false,
          },
          {
            name: 'protocol',
            type: 'tinyint',
            length: '1',
            unsigned: true,
            isNullable: true,
            default: null,
          },
          {
            name: 'address',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'netmask',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'diff_serv',
            type: 'tinyint',
            length: '1',
            unsigned: true,
            isNullable: true,
            default: null,
          },
          {
            name: 'ip_version',
            type: 'tinyint',
            length: '1',
            unsigned: true,
            isNullable: true,
            default: null,
          },
          {
            name: 'icmp_type',
            type: 'smallint',
            length: '2',
            isNullable: true,
            default: null,
          },
          {
            name: 'icmp_code',
            type: 'smallint',
            length: '2',
            isNullable: true,
            default: null,
          },
          {
            name: 'tcp_flags_mask',
            type: 'tinyint',
            length: '1',
            unsigned: true,
            isNullable: true,
            default: null,
          },
          {
            name: 'tcp_flags_settings',
            type: 'tinyint',
            length: '1',
            unsigned: true,
            isNullable: true,
            default: null,
          },
          {
            name: 'range_start',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'range_end',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'source_port_start',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          },
          {
            name: 'source_port_end',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          },
          {
            name: 'destination_port_start',
            type: 'int',
            isNullable: true,
            default: null,
          },
          {
            name: 'destination_port_end',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          },
          {
            name: 'options',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'comment',
            type: 'longtext',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
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
        ],
        foreignKeys: [
          {
            columnNames: ['fwcloud'],
            referencedTableName: 'fwcloud',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['interface'],
            referencedTableName: 'interface',
            referencedColumnNames: ['id'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'interface__ipobj',
      new TableForeignKey({
        columnNames: ['ipobj'],
        referencedTableName: 'ipobj',
        referencedColumnNames: ['id'],
      }),
    );

    //ipobj__ipobjg
    await queryRunner.createTable(
      new Table({
        name: 'ipobj__ipobjg',
        columns: [
          {
            name: 'id_gi',
            type: 'int',
            length: '11',
            isGenerated: true,
            generationStrategy: 'increment',
            isPrimary: true,
          },
          {
            name: 'ipobj_g',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'ipobj',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'datetime',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
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
        ],
        uniques: [{ columnNames: ['ipobj_g', 'ipobj'] }],
        foreignKeys: [
          {
            columnNames: ['ipobj'],
            referencedTableName: 'ipobj',
            referencedColumnNames: ['id'],
          },
        ],
      }),
      true,
    );

    //ipobj_g
    await queryRunner.createTable(
      new Table({
        name: 'ipobj_g',
        columns: [
          {
            name: 'id',
            type: 'int',
            length: '11',
            isGenerated: true,
            generationStrategy: 'increment',
            isPrimary: true,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'tinyint',
            length: '2',
            isNullable: false,
          },
          {
            name: 'fwcloud',
            type: 'int',
            isNullable: true,
            default: 0,
          },
          {
            name: 'created_at',
            type: 'datetime',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
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
            type: 'longtext',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'ipobj__ipobjg',
      new TableForeignKey({
        columnNames: ['ipobj_g'],
        referencedTableName: 'ipobj_g',
        referencedColumnNames: ['id'],
      }),
    );

    //ipobj_type
    await queryRunner.createTable(
      new Table({
        name: 'ipobj_type',
        columns: [
          {
            name: 'id',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '45',
            isNullable: false,
          },
          {
            name: 'protocol_number',
            type: 'smallint',
            length: '1',
            isNullable: true,
            default: null,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'ipobj',
      new TableForeignKey({
        columnNames: ['type'],
        referencedTableName: 'ipobj_type',
        referencedColumnNames: ['id'],
      }),
    );

    await queryRunner.createForeignKey(
      'fwc_tree',
      new TableForeignKey({
        columnNames: ['obj_type'],
        referencedTableName: 'ipobj_type',
        referencedColumnNames: ['id'],
      }),
    );

    //ipobj_type__policy_position
    await queryRunner.createTable(
      new Table({
        name: 'ipobj_type__policy_position',
        columns: [
          {
            name: 'type',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'position',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['type'],
            referencedTableName: 'ipobj_type',
            referencedColumnNames: ['id'],
          },
        ],
      }),
      true,
    );

    //ipobj_type__routing_position
    await queryRunner.createTable(
      new Table({
        name: 'ipobj_type__routing_position',
        columns: [
          {
            name: 'type',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'position',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'allowed',
            type: 'tinyint',
            length: '1',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['type'],
            referencedTableName: 'ipobj_type',
            referencedColumnNames: ['id'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
