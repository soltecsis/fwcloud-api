import fs = require('fs');
import * as path from 'path';
import sinon from 'sinon';
import request = require('supertest');
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { Cluster } from '../../../../src/models/firewall/Cluster';
import { Interface } from '../../../../src/models/interface/Interface';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { IPObjGroup } from '../../../../src/models/ipobj/IPObjGroup';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import { ReplicationProfileService } from '../../../../src/models/replication-profile/replication-profile.service';
import {
  buildReplicationProfileTemplatePath,
  getUserReplicationProfileTemplatesDirectory,
  loadReplicationProfileModel,
  removeReplicationProfileModel,
  resolveReplicationProfileTemplatePath,
} from '../../../../src/models/replication-profile/replication-profile-template';
import {
  REPLICATION_PROFILE_FORMAT,
  type ReplicationProfilePortableDocument,
} from '../../../../src/models/replication-profile/replication-profile-portable';
import { User } from '../../../../src/models/user/User';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../../utils/utils';
import { makeReplicationProfileFixture } from '../../../utils/replication-profile-fixtures';

describe(describeName('Replication profile import/export E2E Tests'), () => {
  let app: Application;
  let owner: User;
  let importer: User;
  let ownerCookie: string;
  let importerCookie: string;
  let fwCloud: FwCloud;
  let code: string;
  const sandbox = sinon.createSandbox();
  const repository = () => db.getSource().getRepository(ReplicationProfile);
  const base = () => `/fwclouds/${fwCloud.id}/assistant/profiles`;
  const model = (kind = 'firewall', marker = 'latest') => ({
    compatibility: { target_kinds: [kind] },
    options: { marker, nested: { complete: [1, true, 'value'] } },
    provision: { interfaces: [{ name: 'eth0', role: 'wan' }], rules: [] },
    ...(kind === 'cluster'
      ? { topologyPreset: { nodes: [{ role: 'primary' }, { role: 'secondary' }] } }
      : {}),
  });
  const document = (): ReplicationProfilePortableDocument => ({
    format: REPLICATION_PROFILE_FORMAT,
    formatVersion: 1,
    profile: {
      code,
      name: 'Imported template',
      targetKind: 'firewall',
      scope: 'generic',
      description: 'Portable',
      category: 'Custom',
    },
    versions: { latest: { model: model() }, previous: { model: model('firewall', 'previous') } },
  });
  const imported = () => repository().find({ where: { code, userId: importer.id } });
  const importerFiles = () => {
    const directory = getUserReplicationProfileTemplatesDirectory(importer.id);
    return fs.existsSync(directory)
      ? fs.readdirSync(directory).filter((file) => file.startsWith(code))
      : [];
  };
  const importDocument = (input: unknown = document()) =>
    request(app.express)
      .post(`${base()}/import`)
      .set('Cookie', [importerCookie])
      .send(input as object);

  beforeEach(async () => {
    app = testSuite.app;
    owner = await createUser({ role: 1 });
    importer = await createUser({ role: 1 });
    ownerCookie = attachSession(generateSession(owner));
    importerCookie = attachSession(generateSession(importer));
    code = `portable-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    fwCloud = await db.getSource().getRepository(FwCloud).save({ name: code, locked: false });
  });

  afterEach(async () => {
    sandbox.restore();
    const profiles = await repository().find({ where: [{ code }, { userId: importer.id }] });
    for (const profile of profiles) {
      removeReplicationProfileModel(profile);
      await repository().delete(profile.id);
    }
  });

  for (const kind of ['firewall', 'cluster'] as const) {
    for (const withPrevious of [false, true]) {
      it(`round-trips complete ${kind} models with ${withPrevious ? 'latest and previous' : 'latest only'}`, async () => {
        const latest = await repository().save(
          makeReplicationProfileFixture({
            code,
            userId: owner.id,
            name: 'Portable template',
            targetKind: kind,
            version: withPrevious ? 2 : 1,
            model: model(kind),
          }),
        );
        if (withPrevious)
          await repository().save(
            makeReplicationProfileFixture({
              code,
              userId: owner.id,
              name: 'Previous template name',
              description: 'Previous description',
              category: 'Previous category',
              targetKind: kind,
              version: 1,
              versionSlot: 'previous',
              model: model(kind, 'previous'),
            }),
          );
        const response = await request(app.express)
          .get(`${base()}/${code}/export`)
          .set('Cookie', [ownerCookie])
          .expect(200)
          .expect('Content-Type', /application\/json/)
          .expect(
            'Content-Disposition',
            /attachment; filename=[a-z0-9-]+\.replication-profile\.json/,
          );
        const exported = response.body;
        expect(exported.profile).not.to.have.any.keys(
          'id',
          'path',
          'userId',
          'fwCloudId',
          'isBuiltin',
        );
        expect(exported.versions.latest.model).to.deep.eq(loadReplicationProfileModel(latest));
        expect(Boolean(exported.versions.previous)).to.eq(withPrevious);
        const resources = () =>
          Promise.all(
            [Firewall, Cluster, Interface, PolicyRule, IPObj, IPObjGroup].map((entity) =>
              db
                .getSource()
                .getRepository(entity as any)
                .count(),
            ),
          );
        const counts = await resources();
        const result = await importDocument(exported).expect(201);
        expect(result.body.data).to.include({
          userId: importer.id,
          isBuiltin: false,
          hasPrevious: withPrevious,
        });
        expect(await resources()).to.deep.eq(counts);
        const profiles = await imported();
        expect(profiles).to.have.length(withPrevious ? 2 : 1);
        for (const profile of profiles) {
          expect(profile.path).to.eq(
            `custom/users/${importer.id}/${code}.${profile.versionSlot}.json`,
          );
          expect(loadReplicationProfileModel(profile)).to.deep.eq(
            exported.versions[profile.versionSlot].model,
          );
        }
        const again = await request(app.express)
          .get(`${base()}/${code}/export`)
          .set('Cookie', [importerCookie])
          .expect(200);
        expect(again.body).to.deep.eq(exported);
      });
    }
  }

  it('exports built-ins and imports them as private user-owned custom copies', async () => {
    const response = await request(app.express)
      .get(`${base()}/default/export`)
      .set('Cookie', [ownerCookie])
      .expect(200);
    const builtin = await repository().findOneOrFail({
      where: { code: 'default', isBuiltin: true },
    });
    const result = await importDocument(response.body).expect(201);
    expect(result.body.data).to.include({ code: 'default', isBuiltin: false, userId: importer.id });
    expect(await repository().findOneByOrFail({ id: builtin.id })).to.deep.eq(builtin);
  });

  it('keeps templates accessible across authorized FWClouds and private from other users', async () => {
    await importDocument().expect(201);
    const other = await db
      .getSource()
      .getRepository(FwCloud)
      .save({ name: `${code}-other`, locked: false });
    for (const cloud of [fwCloud, other]) {
      const response = await request(app.express)
        .get(`/fwclouds/${cloud.id}/profiles?origin=custom`)
        .set('Cookie', [importerCookie])
        .expect(200);
      expect(response.body.data.some((profile) => profile.code === code)).to.eq(true);
    }
    await request(app.express)
      .get(`${base()}/${code}/export`)
      .set('Cookie', [ownerCookie])
      .expect(404);
    const outsider = await createUser({ role: 0 });
    const cookie = attachSession(generateSession(outsider));
    await request(app.express).get(`${base()}/${code}/export`).set('Cookie', [cookie]).expect(401);
    await request(app.express)
      .post(`${base()}/import`)
      .set('Cookie', [cookie])
      .send(document())
      .expect(401);
  });

  it('requires authentication for both endpoints', async () => {
    await request(app.express).get(`${base()}/${code}/export`).expect(401);
    await request(app.express).post(`${base()}/import`).send(document()).expect(401);
  });

  it('rejects malformed JSON, unsupported versions, unsafe names and incomplete models before persistence', async () => {
    await request(app.express)
      .post(`${base()}/import`)
      .set('Cookie', [importerCookie])
      .set('Content-Type', 'application/json')
      .send('{ broken')
      .expect(400);
    for (const value of [
      { ...document(), formatVersion: 7 },
      { ...document(), profile: { ...document().profile, name: '../overwrite' } },
      { ...document(), versions: { latest: { model: null } } },
      {
        ...document(),
        versions: {
          ...document().versions,
          previous: { model: { compatibility: { target_kinds: ['router'] } } },
        },
      },
    ])
      await importDocument(value).expect(422);
    expect(await imported()).to.have.length(0);
    expect(importerFiles()).to.deep.eq([]);
  });

  it('enforces a configurable request size before parsing and permits larger files when configured', async () => {
    const original = app.config.get('replication_profiles').import_max_size;
    const input = document();
    input.versions.latest.model.options = { text: 'x'.repeat(2 * 1024 * 1024) };
    try {
      app.config.set('replication_profiles.import_max_size', 1024);
      await importDocument(input).expect(413);
      expect(await imported()).to.have.length(0);
      app.config.set('replication_profiles.import_max_size', 3 * 1024 * 1024);
      await importDocument(input).expect(201);
    } finally {
      app.config.set('replication_profiles.import_max_size', original);
    }
  });

  it('returns conflict metadata for duplicate codes or names, including inactive templates', async () => {
    await importDocument().expect(201);
    const before = await imported();
    const bytes = before.map((profile) =>
      fs.readFileSync(resolveReplicationProfileTemplatePath(profile), 'utf8'),
    );
    for (const profile of [document().profile, { ...document().profile, code: `${code}-new` }]) {
      const response = await importDocument({
        ...document(),
        profile,
        versions: { latest: document().versions.latest },
      }).expect(409);
      expect(response.body.errors.conflicts[0]).to.include({ code, name: 'Imported template' });
    }
    await repository().update({ code, userId: importer.id }, { isActive: false });
    await importDocument().expect(409);
    expect(
      before.map((profile) =>
        fs.readFileSync(resolveReplicationProfileTemplatePath(profile), 'utf8'),
      ),
    ).to.deep.eq(bytes);
  });

  it('preserves reference snapshots, ignores foreign ids and recreates missing objects only during apply', async () => {
    const address = await db.getSource().getRepository(IPObj).save({
      name: 'Different local address',
      ipObjTypeId: 5,
      ip_version: 4,
      address: '198.51.100.7',
      netmask: '/32',
      fwCloudId: fwCloud.id,
    });
    const input = document();
    input.versions.latest.model = {
      compatibility: { target_kinds: ['firewall'] },
      objectReferences: [
        {
          referenceId: 'public-ip',
          objectType: 'address',
          sourceObjectId: address.id,
          sourceName: 'Portable public IP',
          snapshot: {
            type: 5,
            name: 'Portable public IP',
            ip_version: 4,
            address: '203.0.113.5',
            netmask: '/32',
          },
          locations: ['model.provision.rules[0].source[0]'],
        },
      ],
      provision: {
        interfaces: [],
        rules: [
          {
            chain: 'forward',
            action: 'accept',
            source: [{ kind: 'external', referenceId: 'public-ip' }],
          },
        ],
      },
    };
    const count = await db.getSource().getRepository(IPObj).count();
    const response = await importDocument(input).expect(201);
    expect(await db.getSource().getRepository(IPObj).count()).to.eq(count);
    const saved = await repository().findOneByOrFail({ id: response.body.data.id });
    const references = loadReplicationProfileModel(saved).objectReferences as any[];
    expect(references[0]).not.to.have.property('sourceObjectId');
    expect(references[0].snapshot).to.deep.eq(
      (input.versions.latest.model.objectReferences as any[])[0].snapshot,
    );
    const target = await db
      .getSource()
      .getRepository(Firewall)
      .save({ name: 'Target', fwCloudId: fwCloud.id });
    await request(app.express)
      .post(`/fwclouds/${fwCloud.id}/profiles/${code}/latest/apply`)
      .set('Cookie', [importerCookie])
      .send({ target: { kind: 'firewall', id: target.id }, mode: 'merge' })
      .expect(200);
    const recreated = await db
      .getSource()
      .getRepository(IPObj)
      .findOneByOrFail({ name: 'Portable public IP', fwCloudId: fwCloud.id });
    expect(recreated.address).to.eq('203.0.113.5');
    expect(recreated.id).not.to.eq(address.id);
  });

  it('rejects incomplete object snapshots without creating files or records', async () => {
    const input = document();
    input.versions.latest.model.objectReferences = [
      {
        referenceId: 'bad-network',
        objectType: 'network',
        sourceName: 'Network',
        snapshot: { type: 7, name: 'Network' },
      },
    ];
    await importDocument(input).expect(422);
    expect(await imported()).to.have.length(0);
    expect(importerFiles()).to.deep.eq([]);
  });

  it('round-trips address groups, ranges, networks and service groups with their shared snapshots', async () => {
    const address = {
      id: 301,
      type: 5,
      name: 'Address',
      ip_version: 4,
      address: '192.0.2.5',
      netmask: '/32',
    };
    const network = {
      id: 302,
      type: 7,
      name: 'Network',
      ip_version: 4,
      address: '192.0.2.0',
      netmask: '/24',
    };
    const range = {
      id: 303,
      type: 6,
      name: 'Range',
      ip_version: 4,
      range_start: '192.0.2.10',
      range_end: '192.0.2.20',
    };
    const service = {
      id: 304,
      type: 2,
      name: 'HTTPS',
      protocol: 6,
      source_port_start: 0,
      source_port_end: 65535,
      destination_port_start: 443,
      destination_port_end: 443,
      tcp_flags_mask: 0,
      tcp_flags_settings: 0,
    };
    const snapshots = [
      ['address', address],
      ['network', network],
      ['range', range],
      ['tcp', service],
      ['group', { type: 20, name: 'Address group', members: [address, network, range] }],
      ['serviceGroup', { type: 21, name: 'Service group', members: [service] }],
    ] as const;
    const original = model() as Record<string, any>;
    original.objectReferences = snapshots.map(([objectType, snapshot], index) => ({
      referenceId: `object-${index}`,
      objectType,
      sourceObjectId: index + 1,
      sourceName: snapshot.name,
      snapshot,
      locations: [],
    }));
    const source = await repository().save(
      makeReplicationProfileFixture({ code, userId: owner.id, model: original }),
    );
    const exported = await request(app.express)
      .get(`${base()}/${code}/export`)
      .set('Cookie', [ownerCookie])
      .expect(200);
    const result = await importDocument(exported.body).expect(201);
    const saved = await repository().findOneByOrFail({ id: result.body.data.id });
    expect(loadReplicationProfileModel(saved)).to.deep.eq(exported.body.versions.latest.model);
    const references = loadReplicationProfileModel(saved).objectReferences as any[];
    expect(references[4].snapshot.members[0]).to.deep.eq(references[0].snapshot);
    expect(references[5].snapshot.members[0]).to.deep.eq(references[3].snapshot);
    expect(JSON.stringify(references)).not.to.include('sourceObjectId');
    expect(loadReplicationProfileModel(source)).to.deep.eq(original);
  });

  it('refuses to export stored credentials even if a legacy file bypassed normal persistence', async () => {
    const profile = await repository().save(
      makeReplicationProfileFixture({ code, userId: owner.id }),
    );
    for (const content of [
      JSON.stringify({ options: { password: 'private' } }),
      'private malformed JSON',
    ]) {
      fs.writeFileSync(resolveReplicationProfileTemplatePath(profile), content);
      const response = await request(app.express)
        .get(`${base()}/${code}/export`)
        .set('Cookie', [ownerCookie])
        .expect(500);
      expect(response.text).not.to.include('private');
      expect(response.text).not.to.include(profile.path);
      expect(response.headers).not.to.have.property('content-disposition');
    }
  });

  for (const failure of ['commit', 'second record', 'second file']) {
    it(`compensates both versions after a ${failure} failure`, async () => {
      const source = await repository().save(
        makeReplicationProfileFixture({ code, userId: owner.id, model: model() }),
      );
      const original = fs.readFileSync(resolveReplicationProfileTemplatePath(source), 'utf8');
      const service = await app.getService<ReplicationProfileService>(
        ReplicationProfileService.name,
      );
      if (failure === 'second file') {
        const link = fs.linkSync;
        sandbox.stub(fs, 'linkSync').callsFake((source, target) => {
          if (String(target).endsWith('.previous.json'))
            throw Object.assign(new Error('injected failure'), { code: 'EIO' });
          link(source, target);
        });
      } else {
        const createRunner = db.getSource().createQueryRunner.bind(db.getSource());
        sandbox.stub(db.getSource(), 'createQueryRunner').callsFake(() => {
          const runner = createRunner();
          if (failure === 'commit')
            sandbox.stub(runner, 'commitTransaction').rejects(new Error('injected failure'));
          else {
            const repo = runner.manager.getRepository(ReplicationProfile);
            const save = repo.save.bind(repo);
            sandbox.stub(repo, 'save').callsFake(async (profile: any) => {
              if (profile.versionSlot === 'previous') throw new Error('injected failure');
              return save(profile);
            });
          }
          return runner;
        });
      }
      await expect(
        service.importProfile(document(), { userId: importer.id, fwCloudId: fwCloud.id }),
      ).to.be.rejected;
      sandbox.restore();
      expect(await imported()).to.have.length(0);
      expect(importerFiles()).to.deep.eq([]);
      expect(fs.readFileSync(resolveReplicationProfileTemplatePath(source), 'utf8')).to.eq(
        original,
      );
    });
  }

  it('never overwrites an existing file even if it has no database record', async () => {
    const profile = {
      code,
      version: 1,
      targetKind: 'firewall',
      path: buildReplicationProfileTemplatePath({ code, userId: importer.id }),
    };
    const file = resolveReplicationProfileTemplatePath(profile);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'existing content');
    try {
      await importDocument().expect(409);
      expect(await imported()).to.have.length(0);
      expect(fs.readFileSync(file, 'utf8')).to.eq('existing content');
    } finally {
      fs.rmSync(file);
    }
  });
});
