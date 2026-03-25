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

import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

const OPENVPN_CLI_TYPE = 311;
const OPENVPN_ONLY_CLI_TYPE = 313;
const WIREGUARD_ONLY_CLIENT_TYPE = 323;
const IPSEC_ONLY_CLIENT_TYPE = 333;
const IPSEC_ONLY_CLIENT_NODE_TYPE = 'ISCNS';

const onlyClientTypes = [
  { id: OPENVPN_ONLY_CLI_TYPE, type: 'OPENVPN ONLY CLI' },
  { id: WIREGUARD_ONLY_CLIENT_TYPE, type: 'WIREGUARD ONLY CLIENT' },
  { id: IPSEC_ONLY_CLIENT_TYPE, type: 'IPSEC ONLY CLIENT' },
];

const onlyClientTreeNodeTypes = [
  {
    node_type: IPSEC_ONLY_CLIENT_NODE_TYPE,
    obj_type: IPSEC_ONLY_CLIENT_TYPE,
    name: 'IPSec Config NO SERVER CLIENT',
  },
];

export class AlterIpsecTable1770364672900 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.dropIpsecCrtForeignKey(queryRunner);
    await queryRunner.query(`ALTER TABLE ipsec MODIFY COLUMN crt INT NULL`);
    await this.createIpsecCrtForeignKey(queryRunner);
    await queryRunner.query(`ALTER TABLE ipsec ADD COLUMN type TINYINT NULL AFTER status`);
    await queryRunner.query(`ALTER TABLE ipsec ADD COLUMN name VARCHAR(255) NULL AFTER type`);
    await queryRunner.query(
      `ALTER TABLE fwc_tree MODIFY COLUMN node_type VARCHAR(5) NULL DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE fwc_tree_node_types MODIFY COLUMN node_type VARCHAR(5) NOT NULL`,
    );

    for (const onlyClientType of onlyClientTypes) {
      await queryRunner.query(
        `INSERT IGNORE INTO ipobj_type (id, type, protocol_number) VALUES(?, ?, NULL)`,
        [onlyClientType.id, onlyClientType.type],
      );
    }

    for (const onlyClientTreeNodeType of onlyClientTreeNodeTypes) {
      await queryRunner.query(
        `INSERT IGNORE INTO fwc_tree_node_types (node_type, obj_type, name, api_call_base, order_mode) VALUES (?, ?, ?, NULL, 2)`,
        [
          onlyClientTreeNodeType.node_type,
          onlyClientTreeNodeType.obj_type,
          onlyClientTreeNodeType.name,
        ],
      );
    }

    const clientPositions = await queryRunner.query(
      `SELECT position FROM ipobj_type__policy_position WHERE type=${OPENVPN_CLI_TYPE}`,
    );

    for (const clientPosition of clientPositions) {
      for (const onlyClientType of onlyClientTypes) {
        await queryRunner.query(`INSERT IGNORE INTO ipobj_type__policy_position VALUES(?,?)`, [
          onlyClientType.id,
          clientPosition.position,
        ]);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ipsec DROP COLUMN name`);
    await queryRunner.query(`ALTER TABLE ipsec DROP COLUMN type`);
    await this.dropIpsecCrtForeignKey(queryRunner);
    await queryRunner.query(`ALTER TABLE ipsec MODIFY COLUMN crt INT NOT NULL`);
    await this.createIpsecCrtForeignKey(queryRunner);

    for (const onlyClientType of onlyClientTypes) {
      await queryRunner.query(`DELETE FROM ipobj_type__policy_position WHERE type=?`, [
        onlyClientType.id,
      ]);
    }

    for (const onlyClientTreeNodeType of onlyClientTreeNodeTypes) {
      await queryRunner.query(`DELETE FROM fwc_tree_node_types WHERE node_type=?`, [
        onlyClientTreeNodeType.node_type,
      ]);
    }

    for (const onlyClientType of onlyClientTypes) {
      await queryRunner.query(`DELETE FROM ipobj_type WHERE id=?`, [onlyClientType.id]);
    }
    await queryRunner.query(
      `ALTER TABLE fwc_tree MODIFY COLUMN node_type CHAR(3) NULL DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE fwc_tree_node_types MODIFY COLUMN node_type CHAR(3) NOT NULL`,
    );
  }

  private async dropIpsecCrtForeignKey(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('ipsec');
    if (!table) {
      return;
    }

    const crtForeignKey = table.foreignKeys.find(
      (foreignKey) => foreignKey.columnNames.indexOf('crt') !== -1,
    );
    if (crtForeignKey) {
      await queryRunner.dropForeignKey('ipsec', crtForeignKey);
    }
  }

  private async createIpsecCrtForeignKey(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createForeignKey(
      'ipsec',
      new TableForeignKey({
        columnNames: ['crt'],
        referencedTableName: 'crt',
        referencedColumnNames: ['id'],
      }),
    );
  }
}
