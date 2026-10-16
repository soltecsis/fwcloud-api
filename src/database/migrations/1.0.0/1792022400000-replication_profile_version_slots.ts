import * as fs from 'fs';
import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import defaultReplicationProfile from '../../../models/replication-profile/presets/default-replication-profile.v1.json';
import {
  buildReplicationProfileTemplatePath,
  removeReplicationProfileModel,
  resolveReplicationProfileTemplatePath,
  ReplicationProfileTemplateChanges,
  type ReplicationProfileTemplateReference,
  type ReplicationProfileVersionSlot,
} from '../../../models/replication-profile/replication-profile-template';
import {
  assertReplicationProfileName,
  REPLICATION_PROFILE_NAME_PATTERN,
} from '../../../models/replication-profile/replication-profile-name';
import {
  acquireReplicationProfileLock,
  releaseReplicationProfileLock,
  undoReplicationProfileChanges,
} from '../../../models/replication-profile/replication-profile-transaction';
import { addToList } from '../../../models/replication-profile/replication-sql.helpers';

interface LegacyTemplate {
  id: number;
  code: string;
  version: number;
  version_slot: ReplicationProfileVersionSlot | null;
  name: string;
  target_kind: string;
  path: string;
  user_id: number | null;
  is_built_in: boolean;
}

/**
 * Consolidates profile creation, user ownership and latest/previous versioning.
 * Keep the newest migration identity so databases which ran the earlier
 * creation/ownership migrations can still run this upgrade. The schema checks
 * also make an interrupted MySQL DDL phase safe to retry.
 * Run through the migration CLI with the API stopped.
 */
export class ReplicationProfileVersionSlots1792022400000 implements MigrationInterface {
  // DDL commits implicitly on MySQL; keep DDL outside the data/files transaction.
  public transaction = false;
  private readonly index = 'UQ_replication_profiles_ns_code_slot';

  public async up(runner: QueryRunner): Promise<void> {
    await this.ensureProfilesTable(runner);
    await this.ensureUserOwnership(runner);
    await this.ensureDefaultProfile(runner);
    await this.migrateVersionSlots(runner);
  }

  private async migrateVersionSlots(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasColumn('replication_profiles', 'version_slot'))) {
      await runner.query(
        "ALTER TABLE replication_profiles ADD COLUMN version_slot ENUM('latest', 'previous') NULL",
      );
    }
    const indices = await runner.query('SHOW INDEX FROM replication_profiles');
    if (!indices.some((index) => index.Key_name === this.index)) {
      await runner.query(
        `CREATE UNIQUE INDEX ${this.index} ON replication_profiles (user_ns, code, version_slot)`,
      );
    }

    const rows: LegacyTemplate[] = await runner.query(
      'SELECT * FROM replication_profiles ORDER BY user_ns, code, version DESC, id DESC',
    );
    const groups = new Map<string, LegacyTemplate[]>();
    for (const row of rows) {
      addToList(groups, `${row.user_id ?? 0}:${row.code.toLowerCase()}`, row);
    }

    const lockedOwners: number[] = [];
    const files = new ReplicationProfileTemplateChanges();
    const obsolete: ReplicationProfileTemplateReference[] = [];
    try {
      // The per-owner locks of replicationProfileTransaction(), so the API waits.
      const owners = [...new Set(rows.map((row) => row.user_id ?? 0))].sort((a, b) => a - b);
      for (const owner of owners) {
        if (!(await acquireReplicationProfileLock(runner, owner)))
          throw new Error('A replication template is in use. Retry migration.');
        lockedOwners.push(owner);
      }
      await runner.startTransaction();
      try {
        for (const versions of groups.values()) {
          // Already migrated groups make a retry safe after interruption between DML and DDL.
          if (versions.every((version) => version.version_slot)) continue;
          const retained = versions.slice(0, 2);
          const destinations = new Set<string>();
          for (const [index, row] of retained.entries()) {
            const slot: ReplicationProfileVersionSlot = index === 0 ? 'latest' : 'previous';
            let source = this.reference(row);
            const target = {
              ...source,
              versionSlot: slot,
              path: buildReplicationProfileTemplatePath({
                code: versions[0].code,
                userId: row.user_id,
                versionSlot: slot,
              }),
            };
            const targetFile = resolveReplicationProfileTemplatePath(target);
            // The shipped default template was renamed in the repository as well.
            if (
              row.is_built_in &&
              row.code === 'default' &&
              row.version === 1 &&
              row.path === 'default.v1.json' &&
              !fs.existsSync(resolveReplicationProfileTemplatePath(source))
            ) {
              source = { ...target };
            }
            const sourceFile = resolveReplicationProfileTemplatePath(source);
            // Never overwrite an unrelated file, even if a previous failed migration left it.
            if (
              fs.existsSync(targetFile) &&
              targetFile !== sourceFile &&
              !fs.readFileSync(targetFile).equals(fs.readFileSync(sourceFile))
            ) {
              throw new Error(`Template migration collision at ${target.path}.`);
            }
            files.copy(source, target);
            destinations.add(target.path);
            const name = this.safeLegacyName(row.name);
            await runner.query(
              'UPDATE replication_profiles SET version_slot = ?, path = ?, name = ?, code = ? WHERE id = ?',
              [slot, target.path, name, versions[0].code, row.id],
            );
          }
          for (const row of versions.slice(2)) {
            await runner.query('DELETE FROM replication_profiles WHERE id = ?', [row.id]);
          }
          obsolete.push(
            ...versions
              .filter((row) => !destinations.has(row.path))
              .map((row) => this.reference(row)),
          );
        }
        await runner.commitTransaction();
      } catch (error) {
        await undoReplicationProfileChanges(runner, files);
        throw error;
      }
      // Delete only after commit and only when no row references the legacy file.
      for (const old of obsolete) {
        const [{ count }] = await runner.query(
          'SELECT COUNT(*) AS count FROM replication_profiles WHERE path = ?',
          [old.path],
        );
        if (Number(count) === 0) removeReplicationProfileModel(old);
      }
    } finally {
      for (const owner of lockedOwners.reverse()) {
        await releaseReplicationProfileLock(runner, owner);
      }
    }
    await runner.query(
      "ALTER TABLE replication_profiles MODIFY version_slot ENUM('latest', 'previous') NOT NULL DEFAULT 'latest'",
    );
  }

  public async down(runner: QueryRunner): Promise<void> {
    // The consolidated migration owns the entire table. JSON files are kept,
    // just as in the original creation migration, so database rollback does
    // not delete the user's template files.
    await runner.query('DROP TABLE IF EXISTS replication_profiles');
  }

  private async ensureProfilesTable(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('replication_profiles')) return;
    await runner.createTable(
      new Table({
        name: 'replication_profiles',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'code', type: 'varchar' },
          // Numeric revisions remain internal, for existing object bindings.
          { name: 'version', type: 'int', default: 1 },
          { name: 'name', type: 'varchar' },
          { name: 'description', type: 'text', isNullable: true, default: null },
          { name: 'scope', type: 'varchar', default: "'generic'" },
          { name: 'target_kind', type: 'varchar', default: "'firewall'" },
          { name: 'path', type: 'varchar', length: '512' },
          { name: 'is_built_in', type: 'boolean', default: 1 },
          { name: 'is_active', type: 'boolean', default: 1 },
          { name: 'is_deprecated', type: 'boolean', default: 0 },
          { name: 'user_id', type: 'int', isNullable: true, default: null },
          { name: 'fwcloud_id', type: 'int', isNullable: true, default: null },
          { name: 'category', type: 'varchar', isNullable: true, default: null },
          { name: 'created_by', type: 'int', isNullable: true, default: null },
          { name: 'updated_by', type: 'int', isNullable: true, default: null },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );
  }

  private async ensureUserOwnership(runner: QueryRunner): Promise<void> {
    const columns = {
      user_id: 'INT NULL DEFAULT NULL',
      fwcloud_id: 'INT NULL DEFAULT NULL',
      category: 'VARCHAR(255) NULL DEFAULT NULL',
      created_by: 'INT NULL DEFAULT NULL',
      updated_by: 'INT NULL DEFAULT NULL',
    };
    // Raw DDL avoids TypeORM's generated-column metadata table dependency.
    for (const [name, definition] of Object.entries(columns)) {
      if (!(await runner.hasColumn('replication_profiles', name))) {
        await runner.query(`ALTER TABLE replication_profiles ADD COLUMN \`${name}\` ${definition}`);
      }
    }

    const foreignKeys: Array<{ CONSTRAINT_NAME: string }> = await runner.query(
      "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replication_profiles' AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
    );
    const relationships = [
      {
        name: 'FK_replication_profiles_user_id',
        column: 'user_id',
        table: 'user',
        onDelete: 'RESTRICT',
      },
      {
        name: 'FK_replication_profiles_fwcloud_id',
        column: 'fwcloud_id',
        table: 'fwcloud',
        onDelete: 'SET NULL',
      },
    ];
    for (const relation of relationships) {
      if (!foreignKeys.some((foreignKey) => foreignKey.CONSTRAINT_NAME === relation.name)) {
        await runner.query(
          `ALTER TABLE replication_profiles ADD CONSTRAINT \`${relation.name}\` FOREIGN KEY (\`${relation.column}\`) REFERENCES \`${relation.table}\` (id) ON DELETE ${relation.onDelete}`,
        );
      }
    }

    if (!(await runner.hasColumn('replication_profiles', 'user_ns'))) {
      const [{ version }] = await runner.query('SELECT VERSION() AS version');
      // MariaDB requires a persistent generated column for this unique index.
      const generatedKeyword = String(version).includes('MariaDB') ? 'PERSISTENT' : 'STORED';
      await runner.query(
        `ALTER TABLE replication_profiles ADD COLUMN user_ns INT GENERATED ALWAYS AS (COALESCE(user_id, 0)) ${generatedKeyword}`,
      );
    }

    const indices = await runner.query('SHOW INDEX FROM replication_profiles');
    const uniqueColumns = new Map<string, string[]>();
    for (const index of indices) {
      if (Number(index.Non_unique) === 0)
        addToList(uniqueColumns, index.Key_name, index.Column_name);
    }
    // An old installation may still enforce global uniqueness of code/version.
    for (const [name, indexedColumns] of uniqueColumns) {
      if ([...indexedColumns].sort().join(',') === 'code,version') {
        await runner.query(
          `ALTER TABLE replication_profiles DROP INDEX \`${name.replace(/`/g, '``')}\``,
        );
      }
    }
    if (!uniqueColumns.has('UQ_replication_profiles_ns_code_version')) {
      await runner.query(
        'CREATE UNIQUE INDEX UQ_replication_profiles_ns_code_version ON replication_profiles (user_ns, code, version)',
      );
    }
  }

  private async ensureDefaultProfile(runner: QueryRunner): Promise<void> {
    // Preserve an existing built-in preset, including all of its revisions.
    await runner.query(
      `INSERT INTO replication_profiles
        (code, version, name, description, scope, target_kind, path, is_built_in, is_active, is_deprecated)
       SELECT ?, ?, ?, ?, ?, ?, ?, 1, 1, 0
       WHERE NOT EXISTS (
         SELECT 1 FROM replication_profiles WHERE code = ? AND is_built_in = 1 AND user_id IS NULL
       )`,
      [
        defaultReplicationProfile.code,
        defaultReplicationProfile.version,
        defaultReplicationProfile.name,
        defaultReplicationProfile.description,
        defaultReplicationProfile.scope,
        defaultReplicationProfile.target_kind,
        defaultReplicationProfile.path,
        defaultReplicationProfile.code,
      ],
    );
  }

  private reference(row: LegacyTemplate): ReplicationProfileTemplateReference {
    return { code: row.code, version: row.version, path: row.path, targetKind: row.target_kind };
  }

  private safeLegacyName(name: string): string {
    const sanitized =
      Array.from(name)
        .map((character) => (REPLICATION_PROFILE_NAME_PATTERN.test(character) ? character : '_'))
        .join('')
        .trim() || 'Template';
    assertReplicationProfileName(sanitized);
    return sanitized;
  }
}
