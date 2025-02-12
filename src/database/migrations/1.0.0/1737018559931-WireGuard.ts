/*
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

export class WireGuard1737018559931 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      //wireguard
      new Table({
        name: 'wireguard',
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
            name: 'wireguard',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          },
          {
            name: 'firewall',
            type: 'int',
            length: '11',
            isNullable: false,
          },
          {
            name: 'crt',
            type: 'int',
            length: '11',
            isNullable: false,
          },
          {
            name: 'public_key',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'private_key',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'install_dir',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'install_name',
            type: 'varchar',
            isNullable: true,
            default: null,
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
          {
            name: 'installed_at',
            type: 'datetime',
            isNullable: true,
            default: null,
          },
        ],
        uniques: [{ columnNames: ['firewall', 'crt'] }],
        foreignKeys: [
          {
            columnNames: ['crt'],
            referencedTableName: 'crt',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['firewall'],
            referencedTableName: 'firewall',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['wireguard'],
            referencedTableName: 'wireguard',
            referencedColumnNames: ['id'],
          },
        ],
      }),
      true,
      true,
    );

    //wireguard__ipobj_g
    await queryRunner.createTable(
      new Table({
        name: 'wireguard__ipobj_g',
        columns: [
          {
            name: 'wireguard',
            type: 'int',
            length: '11',
            isNullable: false,
            isPrimary: true,
          },
          {
            name: 'ipobj_g',
            type: 'int',
            length: '11',
            isNullable: false,
            isPrimary: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['ipobj_g'],
            referencedTableName: 'ipobj_g',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['wireguard'],
            referencedTableName: 'wireguard',
            referencedColumnNames: ['id'],
          },
        ],
      }),
      true,
    );

    //wireguard_opt
    await queryRunner.createTable(
      new Table({
        name: 'wireguard_opt',
        columns: [
          {
            name: 'id',
            type: 'int',
            isGenerated: true,
            generationStrategy: 'increment',
            isPrimary: true,
          },
          {
            name: 'wireguard',
            type: 'int',
            length: '11',
            isNullable: false,
          },
          {
            name: 'wireguard_cli',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          },
          {
            name: 'ipobj',
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
            name: 'arg',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'order',
            type: 'int',
            length: '11',
            unsigned: true,
            isNullable: false,
          },
          {
            name: 'scope',
            type: 'tinyint',
            length: '1',
            unsigned: true,
            isNullable: false,
          },
          {
            name: 'comment',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
        ],
        uniques: [
          {
            columnNames: ['wireguard', 'wireguard_cli'],
          },
        ],
        foreignKeys: [
          {
            columnNames: ['ipobj'],
            referencedTableName: 'ipobj',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['wireguard'],
            referencedTableName: 'wireguard',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['wireguard_cli'],
            referencedTableName: 'wireguard',
            referencedColumnNames: ['id'],
          },
        ],
      }),
      true,
    );

    //wireguard_prefix
    await queryRunner.createTable(
      new Table({
        name: 'wireguard_prefix',
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
            name: 'wireguard',
            type: 'int',
            length: '11',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
        ],
        uniques: [{ columnNames: ['wireguard', 'name'] }],
        foreignKeys: [
          {
            columnNames: ['wireguard'],
            referencedTableName: 'wireguard',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    //wireguard_prefix__ipobj_g
    await queryRunner.createTable(
      new Table({
        name: 'wireguard_prefix__ipobj_g',
        columns: [
          {
            name: 'prefix',
            type: 'int',
            length: '11',
            isNullable: false,
          },
          {
            name: 'ipobj_g',
            type: 'int',
            length: '11',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['ipobj_g'],
            referencedTableName: 'ipobj_g',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['prefix'],
            referencedTableName: 'wireguard_prefix',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'policy_r__wireguard',
        columns: [
          {
            name: 'rule',
            type: 'int',
            length: '11',
            isNullable: false,
            isPrimary: true,
          },
          {
            name: 'wireguard',
            type: 'int',
            length: '11',
            isNullable: false,
            isPrimary: true,
          },
          {
            name: 'position',
            type: 'int',
            length: '11',
            isNullable: false,
            isPrimary: true,
          },
          {
            name: 'position_order',
            type: 'int',
            length: '11',
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
        foreignKeys: [
          {
            columnNames: ['wireguard'],
            referencedTableName: 'wireguard',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['rule'],
            referencedTableName: 'policy_r',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['position'],
            referencedTableName: 'policy_position',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'policy_r__wireguard_prefix',
        columns: [
          {
            name: 'rule',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'prefix',
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
            name: 'position_order',
            type: 'int',
            length: '11',
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
        foreignKeys: [
          {
            columnNames: ['prefix'],
            referencedTableName: 'wireguard_prefix',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['rule'],
            referencedTableName: 'policy_r',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['position'],
            referencedTableName: 'policy_position',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'route__wireguard',
        columns: [
          {
            name: 'route',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'wireguard',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'order',
            type: 'int',
            length: '11',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['route'],
            referencedTableName: 'route',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['wireguard'],
            referencedTableName: 'wireguard',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'route__wireguard_prefix',
        columns: [
          {
            name: 'route',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'wireguard_prefix',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'order',
            type: 'int',
            length: '11',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['route'],
            referencedTableName: 'route',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['wireguard_prefix'],
            referencedTableName: 'wireguard_prefix',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'routing_r__wireguard',
        columns: [
          {
            name: 'rule',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'wireguard',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'order',
            type: 'int',
            length: '11',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['rule'],
            referencedTableName: 'routing_r',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['wireguard'],
            referencedTableName: 'wireguard',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'routing_r__wireguard_prefix',
        columns: [
          {
            name: 'rule',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'wireguard_prefix',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'order',
            type: 'int',
            length: '11',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['rule'],
            referencedTableName: 'routing_r',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['wireguard_prefix'],
            referencedTableName: 'wireguard_prefix',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropTable('routing_r__wireguard_prefix', true);
    await queryRunner.dropTable('routing_r__wireguard', true);
    await queryRunner.dropTable('route__wireguard_prefix', true);
    await queryRunner.dropTable('route__wireguard', true);
    await queryRunner.dropTable('policy_r__wireguard_prefix', true);
    await queryRunner.dropTable('policy_r__wireguard', true);
    await queryRunner.dropTable('wireguard_prefix__ipobj_g', true);
    await queryRunner.dropTable('wireguard_prefix', true);
    await queryRunner.dropTable('wireguard_opt', true);
    await queryRunner.dropTable('wireguard__ipobj_g', true);
    await queryRunner.dropTable('wireguard', true);
  }
}
