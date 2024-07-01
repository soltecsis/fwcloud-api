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

import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class dropPolicyCTable1615219877909 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('policy_c', true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'policy_c',
        columns: [
          {
            name: 'rule',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'rule_compiled',
            type: 'text',
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
          {
            name: 'status_compiled',
            type: 'tinyint',
            length: '1',
            isNullable: false,
            default: 0,
          },
        ],
      }),
    );
  }
}
