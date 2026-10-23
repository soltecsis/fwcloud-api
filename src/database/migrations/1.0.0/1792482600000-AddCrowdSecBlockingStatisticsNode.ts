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
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrowdSecBlockingStatisticsNode1792482600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) SELECT 'S12', NULL, 'Blocking statistics' WHERE NOT EXISTS (SELECT 1 FROM `fwc_tree_node_types` WHERE `node_type` = 'S12')",
    );

    await queryRunner.query(
      'INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`, `node_order`, `id_obj`, `fwcloud`) ' +
        "SELECT `id`, 'Blocking statistics', 'S12', 0, `id_obj`, `fwcloud` " +
        'FROM `fwc_tree` parent ' +
        "WHERE parent.`node_type` = 'S05' " +
        'AND NOT EXISTS ( ' +
        '  SELECT 1 FROM `fwc_tree` child ' +
        '  WHERE child.`id_parent` = parent.`id` ' +
        "  AND child.`node_type` = 'S12' " +
        ')',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DELETE FROM `fwc_tree` WHERE `node_type` = 'S12'");
    await queryRunner.query("DELETE FROM `fwc_tree_node_types` WHERE `node_type` = 'S12'");
  }
}
