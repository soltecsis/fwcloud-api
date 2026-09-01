/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrowdSecSystemNode1785235073000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) SELECT 'S05', NULL, 'CrowdSec' WHERE NOT EXISTS (SELECT 1 FROM `fwc_tree_node_types` WHERE `node_type` = 'S05')",
    );

    const systemNodes = await queryRunner.query(
      'SELECT `id`, `id_obj`, `fwcloud`\n' +
        'FROM `fwc_tree` t\n' +
        "WHERE `node_type` = 'SYS'\n" +
        'AND NOT EXISTS (\n' +
        '  SELECT 1\n' +
        '  FROM `fwc_tree` c\n' +
        '  WHERE c.`id_parent` = t.`id`\n' +
        "  AND c.`node_type` = 'S05'\n" +
        ')',
    );

    for (const node of systemNodes) {
      await queryRunner.query(
        "INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`, `node_order`, `id_obj`, `fwcloud`) VALUES (?, 'CrowdSec', 'S05', 0, ?, ?)",
        [node.id, node.id_obj, node.fwcloud],
      );
    }

    const crowdSecChildren = [
      ['S06', 'Status'],
      ['S07', 'Collections'],
      ['S08', 'Decisions'],
      ['S09', 'Alerts'],
      ['S10', 'Bouncers'],
    ];

    for (const [nodeType, name] of crowdSecChildren) {
      await queryRunner.query(
        'INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) ' +
          'SELECT ?, NULL, ? ' +
          'WHERE NOT EXISTS (SELECT 1 FROM `fwc_tree_node_types` WHERE `node_type` = ?)',
        [nodeType, name, nodeType],
      );

      await queryRunner.query(
        'INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`, `node_order`, `id_obj`, `fwcloud`) ' +
          'SELECT `id`, ?, ?, 0, `id_obj`, `fwcloud` ' +
          'FROM `fwc_tree` parent ' +
          "WHERE parent.`node_type` = 'S05' " +
          'AND NOT EXISTS ( ' +
          '  SELECT 1 FROM `fwc_tree` child ' +
          '  WHERE child.`id_parent` = parent.`id` ' +
          '  AND child.`node_type` = ? ' +
          ')',
        [name, nodeType, nodeType],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `fwc_tree` WHERE `node_type` IN ('S06', 'S07', 'S08', 'S09', 'S10')",
    );
    await queryRunner.query("DELETE FROM `fwc_tree` WHERE `node_type` = 'S05'");
    await queryRunner.query(
      "DELETE FROM `fwc_tree_node_types` WHERE `node_type` IN ('S06', 'S07', 'S08', 'S09', 'S10')",
    );
    await queryRunner.query("DELETE FROM `fwc_tree_node_types` WHERE `node_type` = 'S05'");
  }
}
