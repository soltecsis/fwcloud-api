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

import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Extends `replication_profiles` so profiles can be owned by a FWCloud.
 *
 * Two effective namespaces coexist:
 * - built-in / global profiles: `fwcloud_id IS NULL`, shared by every FWCloud;
 * - custom profiles: `fwcloud_id` set, visible only inside that FWCloud.
 *
 * The original `UNIQUE (code, version)` is replaced by a namespace-aware unique
 * index. Because MySQL/MariaDB treat multiple NULLs in a unique index as
 * distinct, `fwcloud_id` cannot be indexed directly (two different built-ins
 * could then share the same code+version). Instead a generated column
 * `fwcloud_ns = COALESCE(fwcloud_id, 0)` collapses every built-in into the
 * single namespace `0`, and the unique index covers `(fwcloud_ns, code,
 * version)`. This keeps built-ins globally unique while letting two different
 * FWClouds reuse the same custom code+version.
 *
 * Engine notes (validated on MySQL 5.7 / 8.0 and MariaDB 10.1):
 * - the generated column keyword differs per engine (`STORED` on MySQL,
 *   `PERSISTENT` on MariaDB, which also rejects indexing a VIRTUAL column), so
 *   it is created with raw SQL branched on the server version;
 * - the `fwcloud_id` foreign key uses `ON DELETE RESTRICT`: InnoDB refuses
 *   `CASCADE`/`SET NULL` on a column feeding an indexed generated column.
 *   FWCloud deletion removes owned profiles explicitly in `FwCloud.remove()`.
 */
export class AddFwcloudScopeToReplicationProfiles1781712000001 implements MigrationInterface {
  private readonly tableName = 'replication_profiles';
  private readonly foreignKeyName = 'FK_replication_profiles_fwcloud_id';
  private readonly generatedColumn = 'fwcloud_ns';
  private readonly namespaceUniqueIndex = 'UQ_replication_profiles_ns_code_version';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns(this.tableName, [
      new TableColumn({ name: 'fwcloud_id', type: 'int', isNullable: true, default: null }),
      new TableColumn({ name: 'category', type: 'varchar', isNullable: true, default: null }),
      new TableColumn({ name: 'created_by', type: 'int', isNullable: true, default: null }),
      new TableColumn({ name: 'updated_by', type: 'int', isNullable: true, default: null }),
    ]);

    await queryRunner.createForeignKey(
      this.tableName,
      new TableForeignKey({
        name: this.foreignKeyName,
        columnNames: ['fwcloud_id'],
        referencedTableName: 'fwcloud',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    // Resolve the current global unique's name before adding the generated
    // column, so we drop it by the name TypeORM auto-generated in the create
    // migration (a hash we must not hardcode).
    const table = await queryRunner.getTable(this.tableName);
    const globalUniqueName = this.findUniqueName(table, ['code', 'version']);

    const [{ version }] = await queryRunner.query('SELECT VERSION() AS version');
    const generatedKeyword = String(version).includes('MariaDB') ? 'PERSISTENT' : 'STORED';
    await queryRunner.query(
      `ALTER TABLE \`${this.tableName}\` ADD COLUMN \`${this.generatedColumn}\` INT GENERATED ALWAYS AS (COALESCE(\`fwcloud_id\`, 0)) ${generatedKeyword}`,
    );

    if (globalUniqueName) {
      await queryRunner.query(
        `ALTER TABLE \`${this.tableName}\` DROP INDEX \`${globalUniqueName}\``,
      );
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX \`${this.namespaceUniqueIndex}\` ON \`${this.tableName}\` (\`${this.generatedColumn}\`, \`code\`, \`version\`)`,
    );
  }

  /**
   * Reverses the migration. Restoring the global `UNIQUE (code, version)` can
   * legitimately fail if custom profiles created cross-FWCloud code+version
   * collisions while the migration was applied; that is expected, not a bug.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`${this.tableName}\` DROP INDEX \`${this.namespaceUniqueIndex}\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`${this.tableName}\` DROP COLUMN \`${this.generatedColumn}\``,
    );

    const table = await queryRunner.getTable(this.tableName);
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.name === this.foreignKeyName || fk.columnNames.indexOf('fwcloud_id') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey(this.tableName, foreignKey);
    }

    await queryRunner.dropColumns(this.tableName, [
      'fwcloud_id',
      'category',
      'created_by',
      'updated_by',
    ]);

    // Restore the original global unique. MySQL/MariaDB implement table-level
    // uniques as unique indexes, so use createIndex (createUniqueConstraint is
    // rejected by the MySQL driver on an existing table).
    await queryRunner.createIndex(
      this.tableName,
      new TableIndex({ columnNames: ['code', 'version'], isUnique: true }),
    );
  }

  /**
   * Finds the name of the unique constraint/index covering exactly the given
   * columns, looking in both `uniques` and `indices` since engines/versions
   * surface table-level uniques in either collection.
   */
  private findUniqueName(table: Table | undefined, columns: string[]): string | null {
    if (!table) {
      return null;
    }

    const normalize = (names: string[]): string => [...names].sort().join(',');
    const target = normalize(columns);

    const unique = table.uniques.find((item) => normalize(item.columnNames) === target);
    if (unique?.name) {
      return unique.name;
    }

    const index = table.indices.find(
      (item) => item.isUnique && normalize(item.columnNames) === target,
    );

    return index?.name ?? null;
  }
}
