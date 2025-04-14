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

const OPENVPN_CLI_TYPE = 311;
const OPENVPN_PREFIX_TYPE = 401;
const IPSEC_CLI_TYPE = 331;
const IPSEC_PREFIX_TYPE = 403;

export class IPSec1740582098062 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      //ipsec
      new Table({
        name: 'ipsec',
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
            name: 'ipsec',
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
            columnNames: ['ipsec'],
            referencedTableName: 'ipsec',
            referencedColumnNames: ['id'],
          },
        ],
      }),
      true,
      true,
    );

    //ipsec__ipobj_g
    await queryRunner.createTable(
      new Table({
        name: 'ipsec__ipobj_g',
        columns: [
          {
            name: 'ipsec',
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
            columnNames: ['ipsec'],
            referencedTableName: 'ipsec',
            referencedColumnNames: ['id'],
          },
        ],
      }),
      true,
    );

    //ipsec_opt
    await queryRunner.createTable(
      new Table({
        name: 'ipsec_opt',
        columns: [
          {
            name: 'id',
            type: 'int',
            isGenerated: true,
            generationStrategy: 'increment',
            isPrimary: true,
          },
          {
            name: 'ipsec',
            type: 'int',
            length: '11',
            isNullable: false,
          },
          {
            name: 'ipsec_cli',
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
            columnNames: ['ipsec', 'ipsec_cli'],
          },
        ],
        foreignKeys: [
          {
            columnNames: ['ipobj'],
            referencedTableName: 'ipobj',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['ipsec'],
            referencedTableName: 'ipsec',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['ipsec_cli'],
            referencedTableName: 'ipsec',
            referencedColumnNames: ['id'],
          },
        ],
      }),
      true,
    );

    //ipsec_prefix
    await queryRunner.createTable(
      new Table({
        name: 'ipsec_prefix',
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
            name: 'ipsec',
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
        uniques: [{ columnNames: ['ipsec', 'name'] }],
        foreignKeys: [
          {
            columnNames: ['ipsec'],
            referencedTableName: 'ipsec',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    //ipsec_prefix__ipobj_g
    await queryRunner.createTable(
      new Table({
        name: 'ipsec_prefix__ipobj_g',
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
            referencedTableName: 'ipsec_prefix',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'policy_r__ipsec',
        columns: [
          {
            name: 'rule',
            type: 'int',
            length: '11',
            isNullable: false,
            isPrimary: true,
          },
          {
            name: 'ipsec',
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
            columnNames: ['ipsec'],
            referencedTableName: 'ipsec',
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
        name: 'policy_r__ipsec_prefix',
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
            referencedTableName: 'ipsec_prefix',
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
        name: 'route__ipsec',
        columns: [
          {
            name: 'route',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'ipsec',
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
            columnNames: ['ipsec'],
            referencedTableName: 'ipsec',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'route__ipsec_prefix',
        columns: [
          {
            name: 'route',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'ipsec_prefix',
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
            columnNames: ['ipsec_prefix'],
            referencedTableName: 'ipsec_prefix',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'routing_r__ipsec',
        columns: [
          {
            name: 'rule',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'ipsec',
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
            columnNames: ['ipsec'],
            referencedTableName: 'ipsec',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'routing_r__ipsec_prefix',
        columns: [
          {
            name: 'rule',
            type: 'int',
            length: '11',
            isPrimary: true,
          },
          {
            name: 'ipsec_prefix',
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
            columnNames: ['ipsec_prefix'],
            referencedTableName: 'ipsec_prefix',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );

    const clientPositions = await queryRunner.query(
      `SELECT position FROM ipobj_type__policy_position WHERE type=${OPENVPN_CLI_TYPE}`,
    );
    const prefixPositions = await queryRunner.query(
      `SELECT position FROM ipobj_type__policy_position WHERE type=${OPENVPN_PREFIX_TYPE}`,
    );
    for (let index = 0; index < clientPositions.length; index++) {
      await queryRunner.query(`INSERT IGNORE INTO ipobj_type__policy_position VALUES(?,?)`, [
        IPSEC_CLI_TYPE,
        clientPositions[index].position,
      ]);
    }
    for (let index = 0; index < prefixPositions.length; index++) {
      await queryRunner.query(`INSERT IGNORE INTO ipobj_type__policy_position VALUES(?,?)`, [
        IPSEC_PREFIX_TYPE,
        prefixPositions[index].position,
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    const clientPositions = await queryRunner.query(
      `SELECT position FROM ipobj_type__policy_position WHERE type=${OPENVPN_CLI_TYPE}`,
    );
    const prefixPositions = await queryRunner.query(
      `SELECT position FROM ipobj_type__policy_position WHERE type=${OPENVPN_PREFIX_TYPE}`,
    );
    for (let index = 0; index < clientPositions.length; index++) {
      await queryRunner.query(
        `DELETE FROM ipobj_type__policy_position WHERE type=? AND position=?`,
        [IPSEC_CLI_TYPE, clientPositions[index].position],
      );
    }
    for (let index = 0; index < prefixPositions.length; index++) {
      await queryRunner.query(
        `DELETE FROM ipobj_type__policy_position WHERE type=? AND position=?`,
        [IPSEC_PREFIX_TYPE, prefixPositions[index].position],
      );
    }

    // Remove the IPSec clients nodes
    await queryRunner.query('DELETE FROM fwc_tree WHERE node_type="ISC"');
    // Remove the IPSec prefixes nodes
    await queryRunner.query('DELETE FROM fwc_tree WHERE node_type="PRI"');
    // Remove the IPSec server nodes
    await queryRunner.query('DELETE FROM fwc_tree WHERE node_type="ISS"');

    await queryRunner.dropTable('routing_r__ipsec_prefix', true);
    await queryRunner.dropTable('routing_r__ipsec', true);
    await queryRunner.dropTable('route__ipsec_prefix', true);
    await queryRunner.dropTable('route__ipsec', true);
    await queryRunner.dropTable('policy_r__ipsec_prefix', true);
    await queryRunner.dropTable('policy_r__ipsec', true);
    await queryRunner.dropTable('ipsec_prefix__ipobj_g', true);
    await queryRunner.dropTable('ipsec_prefix', true);
    await queryRunner.dropTable('ipsec_opt', true);
    await queryRunner.dropTable('ipsec__ipobj_g', true);
    await queryRunner.dropTable('ipsec', true);
  }
}
