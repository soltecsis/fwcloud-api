import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import db from '../../../../src/database/database-manager';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import {
  ReplicationProfileService,
  PROFILE_ROLLBACK_AUDIT_CALL,
} from '../../../../src/models/replication-profile/replication-profile.service';
import {
  buildReplicationProfileTemplatePath,
  getUserReplicationProfileTemplatesDirectory,
  loadReplicationProfileModel,
  resolveReplicationProfileTemplatePath,
  writeReplicationProfileModel,
} from '../../../../src/models/replication-profile/replication-profile-template';
import { ReplicationProfileVersionSlots1792022400000 } from '../../../../src/database/migrations/1.0.0/1792022400000-replication_profile_version_slots';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { createUser } from '../../../utils/utils';
import { makeCustomReplicationProfilePayload } from '../../../utils/replication-profile-fixtures';
import { In, Like } from 'typeorm';
import sinon from 'sinon';
import * as path from 'path';
import { tmpdir } from 'os';
import fs = require('fs');

describe(describeName('Replication profile latest/previous versions'), () => {
  let service: ReplicationProfileService;
  let userId: number;
  let otherUserId: number;
  let fwCloudId: number;
  let code: string;
  const sandbox = sinon.createSandbox();
  const repository = () => db.getSource().getRepository(ReplicationProfile);
  const options = () => ({ userId, fwCloudId });
  const payload = (marker: string, name = 'Office template') =>
    ({
      ...makeCustomReplicationProfilePayload('', { code, name }),
      model: {
        compatibility: { target_kinds: ['firewall', 'cluster'] },
        options: { marker, nested: { full: ['configuration'] } },
      },
    }) as any;
  // Without a code, as the UI sends it: the API derives the code from the name.
  const byName = (name: string, marker = 'A') => ({ ...payload(marker, name), code: undefined });
  const create = (marker = 'A') => service.createCustomProfile(payload(marker), options());
  const update = (marker: string, name?: string) =>
    service.createCustomProfileVersion(code, payload(marker, name), options());
  const versions = () => repository().find({ where: { code, userId }, order: { version: 'DESC' } });
  const read = async (slot: 'latest' | 'previous') =>
    loadReplicationProfileModel(
      await repository().findOneOrFail({ where: { code, userId, versionSlot: slot } }),
    );
  const files = () =>
    fs
      .readdirSync(getUserReplicationProfileTemplatesDirectory(userId))
      .filter((file) => file.startsWith(code));

  beforeEach(async () => {
    service = await testSuite.app.getService<ReplicationProfileService>(
      ReplicationProfileService.name,
    );
    userId = (await createUser({ role: 0 })).id;
    otherUserId = (await createUser({ role: 0 })).id;
    // Other suites reset SQL sequences while their old fixture files can remain.
    for (const owner of [userId, otherUserId])
      fs.rmSync(getUserReplicationProfileTemplatesDirectory(owner), {
        recursive: true,
        force: true,
      });
    fwCloudId = (
      await db.getSource().getRepository(FwCloud).save({ name: 'Version slots', locked: false })
    ).id;
    code = `slots-${Date.now()}-${Math.round(Math.random() * 100000)}`;
  });

  afterEach(async () => {
    sandbox.restore();
    await repository().delete({ code: Like(`${code}%`) });
    await repository().delete({ userId: In([userId, otherUserId]) });
    for (const owner of [userId, otherUserId])
      fs.rmSync(getUserReplicationProfileTemplatesDirectory(owner), {
        recursive: true,
        force: true,
      });
    await db
      .getSource()
      .query(
        "ALTER TABLE replication_profiles MODIFY version_slot ENUM('latest', 'previous') NOT NULL DEFAULT 'latest'",
      );
  });

  it('creates only latest, with a stable filename and the complete model', async () => {
    const profile = await create();
    expect(profile.versionSlot).to.eq('latest');
    expect(await versions()).to.have.length(1);
    expect(files()).to.deep.eq([`${code}.latest.json`]);
    expect(await read('latest')).to.deep.eq(payload('A').model);
    expect(await service.hasPreviousVersion(profile)).to.eq(false);
  });

  it('preserves the former latest on the first update, including its metadata', async () => {
    const original = await create();
    const saved = await update('B', 'Updated template');
    expect(saved.id).to.eq(original.id);
    const retained = await versions();
    expect(retained.map((profile) => profile.versionSlot)).to.deep.eq(['latest', 'previous']);
    expect(retained[1].name).to.eq('Office template');
    expect(await read('latest')).to.deep.eq(payload('B').model);
    expect(await read('previous')).to.deep.eq(payload('A').model);
    expect(await service.hasPreviousVersion(saved)).to.eq(true);
  });

  it('repeated updates replace previous and retain exactly two rows and two files', async () => {
    await create();
    for (const marker of ['B', 'C', 'D', 'E']) {
      await update(marker);
      expect(await versions()).to.have.length(2);
      expect(files().sort()).to.deep.eq([`${code}.latest.json`, `${code}.previous.json`]);
    }
    expect(await read('latest')).to.deep.eq(payload('E').model);
    expect(await read('previous')).to.deep.eq(payload('D').model);
  });

  it('swaps versions on rollback, keeps the current name and records the audit without applying it', async () => {
    const original = await create();
    await update('B', 'Updated template');
    const firewallRows = await db.getSource().query('SELECT * FROM firewall');
    const restored = await service.rollbackCustomProfile(code, options());
    expect(restored.id).to.eq(original.id);
    expect(restored.name).to.eq('Updated template');
    expect(await read('latest')).to.deep.eq(payload('A').model);
    expect(await read('previous')).to.deep.eq(payload('B').model);
    expect((await versions())[1].name).to.eq('Updated template');
    expect(files()).to.have.length(2);
    expect(await db.getSource().query('SELECT * FROM firewall')).to.deep.eq(firewallRows);
    const log = await db
      .getSource()
      .getRepository(AuditLog)
      .findOne({ where: { call: PROFILE_ROLLBACK_AUDIT_CALL, fwCloudId: fwCloudId } });
    expect(log).not.to.eq(null);
    await service.rollbackCustomProfile(code, options());
    expect(await read('latest')).to.deep.eq(payload('B').model);
    expect(await versions()).to.have.length(2);
  });

  it('keeps the current name when removing latest promotes previous', async () => {
    await create();
    await update('B', 'Updated template');
    await service.removeCustomProfile(code, 'latest', options());
    expect(await versions()).to.have.length(1);
    expect((await versions())[0]).to.include({ versionSlot: 'latest', name: 'Updated template' });
    expect(await read('latest')).to.deep.eq(payload('A').model);
  });

  it('gives a free code to a new template named as another one was before a rename', async () => {
    const renamed = await service.createCustomProfile(byName('Template'), options());
    await service.createCustomProfileVersion(renamed.code, byName('Template2', 'B'), options());
    const created = await service.createCustomProfile(byName('Template', 'C'), options());
    expect([renamed.code, created.code]).to.deep.eq(['template', 'template-2']);
    expect(created.name).to.eq('Template');
    expect(loadReplicationProfileModel(created)).to.deep.eq(payload('C').model);
    expect((await service.findByCodeAndVersion('template', 'latest', userId)).name).to.eq(
      'Template2',
    );
  });

  it('rejects a name another current template of the same owner uses', async () => {
    const first = await service.createCustomProfile(byName('Template'), options());
    await expect(service.createCustomProfile(byName(' TEMPLATE '), options())).to.be.rejectedWith(
      'A template with this name already exists.',
    );
    const other = await service.createCustomProfile(byName('Other'), options());
    await expect(
      service.createCustomProfileVersion(other.code, byName('template', 'B'), options()),
    ).to.be.rejectedWith('A template with this name already exists.');
    expect((await service.findByCodeAndVersion(other.code, 'latest', userId)).name).to.eq('Other');
    // Keeping its own name is not a conflict, and other owners have their own names.
    await service.createCustomProfileVersion(first.code, byName('Template', 'C'), options());
    await service.createCustomProfile(byName('Template'), { userId: otherUserId, fwCloudId });
  });

  it('names and codes repeated copies after the first free ones', async () => {
    await create();
    const copies = [
      await service.cloneCustomProfile(code, 'latest', {}, options()),
      await service.cloneCustomProfile(code, 'latest', {}, options()),
    ];
    expect(copies.map((copy) => [copy.code, copy.name])).to.deep.eq([
      [`${code}-copy`, 'Office template copy'],
      [`${code}-copy-2`, 'Office template copy 2'],
    ]);
  });

  it('rejects rollback without previous and preserves latest', async () => {
    await create();
    await expect(service.rollbackCustomProfile(code, options())).to.be.rejectedWith(
      'No previous template version exists.',
    );
    expect(await read('latest')).to.deep.eq(payload('A').model);
    expect(files()).to.deep.eq([`${code}.latest.json`]);
  });

  it('enforces ownership and built-in restrictions for rollback', async () => {
    await create();
    await update('B');
    await expect(
      service.rollbackCustomProfile(code, { userId: otherUserId, fwCloudId }),
    ).to.be.rejectedWith('Replication profile not found');
    await expect(service.rollbackCustomProfile('default', options())).to.be.rejectedWith(
      'Built-in profiles cannot be modified',
    );
    expect(await read('latest')).to.deep.eq(payload('B').model);
  });

  it('rejects invalid previous JSON before rollback changes any row or file', async () => {
    await create();
    await update('B');
    const retained = await versions();
    const previousFile = resolveReplicationProfileTemplatePath(retained[1]);
    fs.writeFileSync(previousFile, '{invalid');
    await expect(service.rollbackCustomProfile(code, options())).to.be.rejectedWith(
      'is not valid JSON',
    );
    expect(await versions()).to.deep.eq(retained);
    expect(await read('latest')).to.deep.eq(payload('B').model);
    expect(fs.readFileSync(previousFile, 'utf8')).to.eq('{invalid');
  });

  it("keeps templates available across the owner's FWClouds and separates other users' files", async () => {
    await create();
    await service.createCustomProfile(payload('OTHER'), { userId: otherUserId, fwCloudId });
    const otherCloud = await db
      .getSource()
      .getRepository(FwCloud)
      .save({ name: 'Other cloud', locked: false });
    await service.createCustomProfileVersion(code, payload('B'), {
      userId,
      fwCloudId: otherCloud.id,
    });
    const owned = await service.findByCodeAndVersion(code, 'latest', userId);
    const other = await service.findByCodeAndVersion(code, 'latest', otherUserId);
    expect(owned.path).not.to.eq(other.path);
    expect(owned.fwCloudId).to.eq(fwCloudId);
    expect(loadReplicationProfileModel(other)).to.deep.eq(payload('OTHER').model);
    expect(
      (await service.findCatalog({ userId })).some(({ profile }) => profile.id === owned.id),
    ).to.eq(true);
  });

  for (const name of [
    'My.Template',
    '../template',
    'Template/name',
    'Template\\name',
    'bad:name',
    'bad*name',
    'bad?name',
    'bad|name',
    'bad<name',
    'bad>name',
    'bad"name',
    'bad\0name',
  ]) {
    it(`rejects unsafe name ${JSON.stringify(name)} before creating or modifying files`, async () => {
      await expect(service.createCustomProfile(payload('A', name), options())).to.be.rejectedWith(
        'Template names cannot contain dots',
      );
      expect(await versions()).to.have.length(0);
      expect(fs.existsSync(getUserReplicationProfileTemplatesDirectory(userId))).to.eq(false);
      await create();
      await expect(update('B', name)).to.be.rejectedWith('Template names cannot contain dots');
      expect(await read('latest')).to.deep.eq(payload('A').model);
      expect(files()).to.have.length(1);
    });
  }

  for (const name of ['MyTemplate', 'My_Template', 'My-Template', 'My Template']) {
    it(`accepts the safe name ${name}`, async () => {
      const profile = await service.createCustomProfile(payload('A', name), options());
      expect(profile.name).to.eq(name);
    });
  }

  it('rejects invalid definitions before rotating files', async () => {
    await create();
    await update('B');
    await expect(
      service.createCustomProfileVersion(code, { ...payload('C'), model: null }, options()),
    ).to.be.rejected;
    expect(await read('latest')).to.deep.eq(payload('B').model);
    expect(await read('previous')).to.deep.eq(payload('A').model);
  });

  it('restores both slots and metadata when atomic replacement of latest fails', async () => {
    await create();
    await update('B');
    const before = await versions();
    const rename = fs.renameSync;
    let failed = false;
    sandbox.stub(fs, 'renameSync').callsFake((source, destination) => {
      if (!failed && String(destination).endsWith(`${code}.latest.json`)) {
        failed = true;
        throw Object.assign(new Error('injected write failure'), { code: 'EIO' });
      }
      return rename(source, destination);
    });
    await expect(update('C')).to.be.rejectedWith('could not be written');
    expect(await versions()).to.deep.eq(before);
    expect(await read('latest')).to.deep.eq(payload('B').model);
    expect(await read('previous')).to.deep.eq(payload('A').model);
    expect(files()).to.have.length(2);
  });

  it('restores files when SQL commit fails, including first creation', async () => {
    const createRunner = db.getSource().createQueryRunner.bind(db.getSource());
    sandbox.stub(db.getSource(), 'createQueryRunner').callsFake(() => {
      const runner = createRunner();
      sandbox.stub(runner, 'commitTransaction').rejects(new Error('injected commit failure'));
      return runner;
    });
    await expect(create()).to.be.rejectedWith('injected commit failure');
    expect(await versions()).to.have.length(0);
    expect(files()).to.have.length(0);
  });

  it('restores existing latest and previous when commit fails after rotation', async () => {
    await create();
    await update('B');
    const before = await versions();
    const createRunner = db.getSource().createQueryRunner.bind(db.getSource());
    sandbox.stub(db.getSource(), 'createQueryRunner').callsFake(() => {
      const runner = createRunner();
      sandbox.stub(runner, 'commitTransaction').rejects(new Error('injected commit failure'));
      return runner;
    });
    await expect(update('C')).to.be.rejectedWith('injected commit failure');
    expect(await versions()).to.deep.eq(before);
    expect(await read('latest')).to.deep.eq(payload('B').model);
    expect(await read('previous')).to.deep.eq(payload('A').model);
  });

  it('serializes simultaneous saves and preserves both final successful writes', async () => {
    await create();
    const saved = await Promise.all(
      ['B', 'C', 'D', 'E'].map((marker, index) =>
        service.createCustomProfileVersion(
          index % 2 ? code : code.toUpperCase(),
          payload(marker),
          options(),
        ),
      ),
    );
    expect(new Set(saved.map((profile) => profile.version)).size).to.eq(4);
    const markers = [await read('latest'), await read('previous')].map(
      (model) => (model.options as any).marker,
    );
    const ordered = saved
      .map((profile, index) => ({ revision: profile.version, marker: ['B', 'C', 'D', 'E'][index] }))
      .sort((left, right) => right.revision - left.revision);
    expect(markers).to.deep.eq(ordered.slice(0, 2).map(({ marker }) => marker));
    expect(await versions()).to.have.length(2);
    expect(files()).to.have.length(2);
  });

  it('allows only one simultaneous creation of the same identity', async () => {
    const results = await Promise.allSettled([create('A'), create('B')]);
    expect(results.filter((result) => result.status === 'fulfilled')).to.have.length(1);
    expect(await versions()).to.have.length(1);
    expect(files()).to.have.length(1);
  });

  it('rejects a symbolic link out of the data directory before creating external directories', async () => {
    const outside = fs.mkdtempSync(path.join(tmpdir(), 'replication-outside-'));
    const directory = getUserReplicationProfileTemplatesDirectory(userId);
    fs.mkdirSync(path.dirname(directory), { recursive: true });
    fs.symlinkSync(outside, directory, 'dir');
    try {
      await expect(create()).to.be.rejectedWith('resolves outside its templates directory');
      expect(fs.readdirSync(outside)).to.deep.eq([]);
      expect(await versions()).to.have.length(0);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it('cannot store a third slot even when bypassing the service', async () => {
    await create();
    await update('B');
    const latest = (await versions())[0];
    await expect(repository().save(repository().create({ ...latest, id: undefined, version: 100 })))
      .to.be.rejected;
    expect(await versions()).to.have.length(2);
    expect(files()).to.have.length(2);
  });

  it('keeps long valid names and codes within the filesystem filename limit', async () => {
    code = 'a'.repeat(255);
    const profile = await service.createCustomProfile(payload('A', 'N'.repeat(255)), options());
    expect(path.basename(profile.path).length).to.be.lessThan(256);
    expect(loadReplicationProfileModel(profile)).to.deep.eq(payload('A').model);
  });

  it('generates safe paths and rejects traversal in code, owner and slot', () => {
    expect(buildReplicationProfileTemplatePath({ code, userId, versionSlot: 'previous' })).to.eq(
      `custom/users/${userId}/${code}.previous.json`,
    );
    for (const unsafe of ['../template', '/tmp/template', 'foo\\bar', 'foo/bar']) {
      expect(() => buildReplicationProfileTemplatePath({ code: unsafe, userId })).to.throw(
        'Invalid replication profile template identity',
      );
    }
    expect(() => buildReplicationProfileTemplatePath({ code, userId: -1 })).to.throw();
    expect(() =>
      buildReplicationProfileTemplatePath({ code, userId, versionSlot: 'v3' as any }),
    ).to.throw();
    const legacy = buildReplicationProfileTemplatePath({ code: 'my.template', userId });
    expect(path.basename(legacy)).to.match(/^legacy-[a-f0-9]{64}\.latest\.json$/);
    expect(legacy).not.to.eq(
      buildReplicationProfileTemplatePath({ code: path.basename(legacy, '.latest.json'), userId }),
    );
  });

  async function legacyVersions(owner: number, suffix = '') {
    await db
      .getSource()
      .query(
        "ALTER TABLE replication_profiles MODIFY version_slot ENUM('latest', 'previous') NULL",
      );
    const contents: string[] = [];
    for (let version = 1; version <= 4; version++) {
      const profile = {
        code: `${code}${suffix}`,
        version,
        targetKind: 'firewall',
        path: `custom/users/${owner}/${code}${suffix}.v${version}.json`,
      };
      const content = ` { "compatibility": {"target_kinds":["firewall"]}, "options": {"marker":${version}}, "extension": {"all": [1,2,3]} }\n`;
      const file = resolveReplicationProfileTemplatePath(profile);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
      await db
        .getSource()
        .query(
          'INSERT INTO replication_profiles (code, version, name, scope, target_kind, path, is_built_in, is_active, is_deprecated, user_id, version_slot) VALUES (?, ?, ?, ?, ?, ?, 0, 1, 0, ?, NULL)',
          [profile.code, version, 'Legacy.Template', 'generic', 'firewall', profile.path, owner],
        );
      contents.push(content);
    }
    return contents;
  }

  it('migrates the two most recent legacy versions byte for byte, including dotted names and codes', async () => {
    const contents = await legacyVersions(userId, '.office');
    await legacyVersions(otherUserId, '.office');
    const runner = db.getSource().createQueryRunner();
    try {
      await new ReplicationProfileVersionSlots1792022400000().up(runner);
    } finally {
      await runner.release();
    }
    for (const owner of [userId, otherUserId]) {
      const retained = await repository().find({
        where: { code: `${code}.office`, userId: owner },
        order: { version: 'DESC' },
      });
      expect(retained.map((profile) => profile.version)).to.deep.eq([4, 3]);
      expect(retained.map((profile) => profile.versionSlot)).to.deep.eq(['latest', 'previous']);
      expect(retained[0].name).to.eq('Legacy_Template');
      for (const [index, profile] of retained.entries()) {
        expect(fs.readFileSync(resolveReplicationProfileTemplatePath(profile), 'utf8')).to.eq(
          contents[3 - index],
        );
        expect(loadReplicationProfileModel(profile).extension).to.deep.eq({ all: [1, 2, 3] });
      }
      expect(fs.readdirSync(getUserReplicationProfileTemplatesDirectory(owner))).to.have.length(2);
    }
  });

  it('migrates a single legacy version without inventing previous', async () => {
    await legacyVersions(userId);
    await repository().delete({ code, userId, version: 1 });
    await repository().delete({ code, userId, version: 2 });
    await repository().delete({ code, userId, version: 3 });
    for (const version of [1, 2, 3])
      fs.rmSync(
        path.join(getUserReplicationProfileTemplatesDirectory(userId), `${code}.v${version}.json`),
      );
    const runner = db.getSource().createQueryRunner();
    try {
      await new ReplicationProfileVersionSlots1792022400000().up(runner);
    } finally {
      await runner.release();
    }
    expect(await versions()).to.have.length(1);
    expect((await versions())[0].versionSlot).to.eq('latest');
    expect(files()).to.deep.eq([`${code}.latest.json`]);
  });

  it('migrates the built-in default after its shipped filename has been renamed', async () => {
    const original = await repository().findOneOrFail({
      where: { code: 'default', isBuiltin: true },
    });
    const model = loadReplicationProfileModel(original);
    await db
      .getSource()
      .query(
        "ALTER TABLE replication_profiles MODIFY version_slot ENUM('latest', 'previous') NULL",
      );
    await db
      .getSource()
      .query(
        "UPDATE replication_profiles SET path = 'default.v1.json', version_slot = NULL WHERE id = ?",
        [original.id],
      );
    const runner = db.getSource().createQueryRunner();
    try {
      await new ReplicationProfileVersionSlots1792022400000().up(runner);
    } finally {
      await runner.release();
    }
    const migrated = await repository().findOneOrFail({ where: { id: original.id } });
    expect(migrated.path).to.eq('default.latest.json');
    expect(migrated.versionSlot).to.eq('latest');
    expect(loadReplicationProfileModel(migrated)).to.deep.eq(model);
  });

  it('refuses migration collisions without changing legacy rows or JSON contents', async () => {
    await legacyVersions(userId);
    const target = {
      code,
      version: 4,
      targetKind: 'firewall',
      path: buildReplicationProfileTemplatePath({ code, userId }),
    };
    writeReplicationProfileModel(target, payload('unrelated').model);
    const before = await versions();
    const runner = db.getSource().createQueryRunner();
    try {
      await expect(new ReplicationProfileVersionSlots1792022400000().up(runner)).to.be.rejectedWith(
        'Template migration collision',
      );
    } finally {
      await runner.release();
    }
    expect(await versions()).to.deep.eq(before);
    expect(loadReplicationProfileModel(target)).to.deep.eq(payload('unrelated').model);
  });
});
