import { describeName, expect } from '../../mocha/global-setup';
import db from '../../../src/database/database-manager';
import { QueryRunner } from 'typeorm';
import { ReplicationProfileVersionSlots1792022400000 } from '../../../src/database/migrations/1.0.0/1792022400000-replication_profile_version_slots';
import { ReplicationProfile } from '../../../src/models/replication-profile/replication-profile.model';
import {
  buildReplicationProfileTemplatePath,
  loadReplicationProfileModel,
  removeReplicationProfileModel,
  writeReplicationProfileModel,
  type ReplicationProfileTemplateReference,
} from '../../../src/models/replication-profile/replication-profile-template';
import { createUser } from '../../utils/utils';

describe(describeName('Consolidated replication profiles migration'), () => {
  const migration = new ReplicationProfileVersionSlots1792022400000();
  let runner: QueryRunner;
  let code: string;
  let templates: ReplicationProfileTemplateReference[];

  beforeEach(async () => {
    runner = db.getSource().createQueryRunner();
    await runner.connect();
    code = `rp-migration-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    templates = [];
    await migration.down(runner);
  });

  afterEach(async () => {
    try {
      await migration.up(runner);
      await runner.query('DELETE FROM replication_profiles WHERE code = ?', [code]);
      templates.forEach(removeReplicationProfileModel);
    } finally {
      await runner.release();
    }
  });

  const repository = () => runner.manager.getRepository(ReplicationProfile);

  function writeLegacyTemplate(version: number, userId: number | null = null) {
    const profile = {
      code,
      version,
      targetKind: 'firewall',
      path:
        userId === null
          ? `custom/fixtures/${code}.v${version}.json`
          : `custom/users/${userId}/${code}.v${version}.json`,
    };
    writeReplicationProfileModel(profile, { options: { marker: version } });
    templates.push(profile);
    for (const versionSlot of ['latest', 'previous'] as const) {
      templates.push({
        ...profile,
        path: buildReplicationProfileTemplatePath({ code, userId, versionSlot }),
      });
    }
    return profile;
  }

  it('creates the complete schema, ownership constraints, two-slot indexes and default preset', async () => {
    await migration.up(runner);
    const columns = await runner.query('SHOW COLUMNS FROM replication_profiles');
    expect(columns.map((column) => column.Field)).to.include.members([
      'user_id',
      'fwcloud_id',
      'category',
      'created_by',
      'updated_by',
      'user_ns',
      'version_slot',
    ]);
    expect(columns.find((column) => column.Field === 'version_slot')).to.include({
      Type: "enum('latest','previous')",
      Null: 'NO',
      Default: 'latest',
    });
    const indices = await runner.query('SHOW INDEX FROM replication_profiles');
    expect(indices.map((index) => index.Key_name)).to.include.members([
      'UQ_replication_profiles_ns_code_version',
      'UQ_replication_profiles_ns_code_slot',
    ]);
    const foreignKeys = await runner.query(
      "SELECT CONSTRAINT_NAME, DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'replication_profiles'",
    );
    expect(foreignKeys).to.deep.include.members([
      { CONSTRAINT_NAME: 'FK_replication_profiles_user_id', DELETE_RULE: 'RESTRICT' },
      { CONSTRAINT_NAME: 'FK_replication_profiles_fwcloud_id', DELETE_RULE: 'SET NULL' },
    ]);
    const preset = await repository().findOneOrFail({
      where: { code: 'default', isBuiltin: true },
    });
    expect(preset).to.include({ versionSlot: 'latest', userId: null, path: 'default.latest.json' });
    expect(loadReplicationProfileModel(preset)).to.be.an('object');
  });

  it('reverses the entire consolidated migration and can be applied again', async () => {
    await migration.up(runner);
    await migration.down(runner);
    expect(await runner.hasTable('replication_profiles')).to.eq(false);
    await migration.up(runner);
    expect(await repository().count()).to.eq(1);
    expect((await repository().findOneOrFail({ where: { code: 'default' } })).versionSlot).to.eq(
      'latest',
    );
  });

  it('upgrades the original table before user ownership existed and preserves its latest models', async () => {
    await runner.query(`CREATE TABLE replication_profiles (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(255) NOT NULL,
      version INT NOT NULL DEFAULT 1,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      scope VARCHAR(255) NOT NULL DEFAULT 'generic',
      target_kind VARCHAR(255) NOT NULL DEFAULT 'firewall',
      path VARCHAR(512) NOT NULL,
      is_built_in TINYINT NOT NULL DEFAULT 1,
      is_active TINYINT NOT NULL DEFAULT 1,
      is_deprecated TINYINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY legacy_code_version (code, version)
    ) ENGINE=InnoDB`);
    for (const version of [1, 2, 3]) {
      const profile = writeLegacyTemplate(version);
      await runner.query(
        'INSERT INTO replication_profiles (code, version, name, path) VALUES (?, ?, ?, ?)',
        [code, version, 'Legacy.Template', profile.path],
      );
    }
    await migration.up(runner);
    const profiles = await repository().find({ where: { code }, order: { version: 'DESC' } });
    expect(profiles.map((profile) => profile.version)).to.deep.eq([3, 2]);
    expect(profiles.map((profile) => profile.versionSlot)).to.deep.eq(['latest', 'previous']);
    expect(profiles[0]).to.include({ name: 'Legacy_Template', userId: null, isBuiltin: true });
    expect(loadReplicationProfileModel(profiles[0])).to.deep.eq({ options: { marker: 3 } });
    expect(loadReplicationProfileModel(profiles[1])).to.deep.eq({ options: { marker: 2 } });
    const indices = await runner.query('SHOW INDEX FROM replication_profiles');
    expect(indices.some((index) => index.Key_name === 'legacy_code_version')).to.eq(false);
  });

  it('upgrades a user-scoped table and keeps identical codes from different owners separate', async () => {
    await migration.up(runner);
    await runner.query(
      'ALTER TABLE replication_profiles DROP INDEX UQ_replication_profiles_ns_code_slot, DROP COLUMN version_slot',
    );
    const users = [await createUser({ role: 0 }), await createUser({ role: 0 })];
    for (const user of users) {
      const profile = writeLegacyTemplate(1, user.id);
      await runner.query(
        'INSERT INTO replication_profiles (code, version, name, path, user_id, is_built_in) VALUES (?, 1, ?, ?, ?, 0)',
        [code, 'Owned template', profile.path, user.id],
      );
    }
    await migration.up(runner);
    const profiles = await repository().find({ where: { code }, order: { userId: 'ASC' } });
    expect(profiles.map((profile) => profile.userId)).to.deep.eq(users.map((user) => user.id));
    expect(profiles.every((profile) => profile.versionSlot === 'latest')).to.eq(true);
    expect(new Set(profiles.map((profile) => profile.path)).size).to.eq(2);
    profiles.forEach((profile) =>
      expect(loadReplicationProfileModel(profile)).to.deep.eq({ options: { marker: 1 } }),
    );
  });

  it('can be rerun without duplicating the default profile or replacing existing data', async () => {
    await migration.up(runner);
    const before = await repository().find();
    await migration.up(runner);
    expect(await repository().find()).to.deep.eq(before);
  });
});
