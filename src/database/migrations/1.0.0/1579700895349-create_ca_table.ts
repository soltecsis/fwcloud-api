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

import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class createCaTable1579700895349 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    //ca
    await queryRunner.createTable(
      new Table({
        name: 'ca',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'fwcloud',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'cn',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'days',
            type: 'int',
            length: '11',
            unsigned: true,
            isNullable: false,
          },
          {
            name: 'comment',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'status',
            type: 'tinyint',
            length: '1',
            isNullable: false,
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
        ],
        uniques: [{ columnNames: ['id', 'cn'] }],
      }),
      true,
    );

    //ca_prefix
    await queryRunner.createTable(
      new Table({
        name: 'ca_prefix',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'ca',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
        ],
        uniques: [{ columnNames: ['ca', 'name'] }],
        foreignKeys: [
          {
            referencedColumnNames: ['id'],
            referencedTableName: 'ca',
            columnNames: ['ca'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropTable('ca_prefix', true);
    await queryRunner.dropTable('ca', true);
  }
}
