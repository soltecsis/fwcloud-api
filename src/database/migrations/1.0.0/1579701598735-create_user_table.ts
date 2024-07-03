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

export class createUserTable1579701598735 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    //user
    await queryRunner.createTable(
      new Table({
        name: 'user',
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
            name: 'customer',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'email',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'username',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'password',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'enabled',
            type: 'tinyint',
            length: '1',
            isNullable: false,
            default: 1,
          },
          {
            name: 'role',
            type: 'tinyint',
            length: '1',
            isNullable: false,
            default: 1,
          },
          {
            name: 'allowed_from',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'last_login',
            type: 'datetime',
            isNullable: true,
            default: null,
          },
          {
            name: 'confirmation_token',
            type: 'varchar',
            isNullable: true,
            default: null,
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
        uniques: [{ columnNames: ['customer', 'username'] }],
        foreignKeys: [
          {
            columnNames: ['customer'],
            referencedTableName: 'customer',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    //user__fwcloud
    await queryRunner.createTable(
      new Table({
        name: 'user__fwcloud',
        columns: [
          {
            name: 'user',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'fwcloud',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['fwcloud'],
            referencedTableName: 'fwcloud',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['user'],
            referencedTableName: 'user',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropTable('user__fwcloud', true);
    await queryRunner.dropTable('user', true);
  }
}
