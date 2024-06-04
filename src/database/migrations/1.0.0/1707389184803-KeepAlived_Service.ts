/*
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class KeepAlivedService1707389184803 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "keepalived_g",
        columns: [
          {
            name: "id",
            type: "int",
            length: "11",
            isGenerated: true,
            generationStrategy: "increment",
            isPrimary: true,
          },
          {
            name: "name",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "firewall",
            type: "int",
            length: "11",
            isNullable: false,
          },
          {
            name: "style",
            type: "varchar",
            length: "50",
            isNullable: true,
            default: null,
          },
        ],
        foreignKeys: [
          {
            columnNames: ["firewall"],
            referencedTableName: "firewall",
            referencedColumnNames: ["id"],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: "keepalived_r",
        columns: [
          {
            name: "id",
            type: "int",
            length: "11",
            isGenerated: true,
            generationStrategy: "increment",
            isPrimary: true,
          },
          {
            name: "firewall",
            type: "int",
            length: "11",
            isNullable: false,
          },
          {
            name: "rule_type",
            type: "tinyint",
            length: "1",
            isNullable: false,
            default: 1,
          },
          {
            name: "rule_order",
            type: "int",
            length: "11",
            isNullable: false,
          },
          {
            name: "active",
            type: "tinyint",
            length: "1",
            isNullable: false,
            default: 1,
          },
          {
            name: "group",
            type: "int",
            length: "11",
            isNullable: true,
          },
          {
            name: "style",
            type: "varchar",
            length: "50",
            isNullable: true,
            default: null,
          },
          {
            name: "interface",
            type: "int",
            length: "11",
            isNullable: true,
          },
          {
            name: "master_node",
            type: "int",
            length: "11",
            isNullable: true,
          },
          {
            name: "cfg_text",
            type: "text",
            isNullable: true,
          },
          {
            name: "comment",
            type: "text",
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ["group"],
            referencedTableName: "keepalived_g",
            referencedColumnNames: ["id"],
          },
          {
            columnNames: ["interface"],
            referencedTableName: "interface",
            referencedColumnNames: ["id"],
          },
          {
            columnNames: ["master_node"],
            referencedTableName: "firewall",
            referencedColumnNames: ["id"],
          },
          {
            columnNames: ["firewall"],
            referencedTableName: "firewall",
            referencedColumnNames: ["id"],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: "keepalived_r__ipobj",
        columns: [
          {
            name: "rule",
            type: "int",
            length: "11",
            isPrimary: true,
          },
          {
            name: "ipobj",
            type: "int",
            length: "11",
            isPrimary: true,
          },
          {
            name: "order",
            type: "int",
            length: "11",
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ["rule"],
            referencedTableName: "keepalived_r",
            referencedColumnNames: ["id"],
          },
          {
            columnNames: ["ipobj"],
            referencedTableName: "ipobj",
            referencedColumnNames: ["id"],
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("keepalived_r__ipobj");
    await queryRunner.dropTable("keepalived_r");
    await queryRunner.dropTable("keepalived_g");
  }
}
