import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import defaultReplicationProfile from '../../../../src/models/replication-profile/presets/default-replication-profile.v1.json';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import {
  PROFILE_CLONE_AUDIT_CALL,
  PROFILE_CREATE_AUDIT_CALL,
  PROFILE_REMOVE_AUDIT_CALL,
  PROFILE_VERSION_AUDIT_CALL,
  ReplicationProfileService,
  type ReplicationProfileCatalogFilters,
} from '../../../../src/models/replication-profile/replication-profile.service';
import { ReplicationProfileValidationException } from '../../../../src/models/replication-profile/replication-profile-validation.service';
import {
  getUserReplicationProfileTemplatesDirectory,
  loadReplicationProfileModel,
  removeReplicationProfileModel,
  ReplicationProfileTemplateException,
  resolveReplicationProfileTemplatePath,
} from '../../../../src/models/replication-profile/replication-profile-template';
import StringHelper from '../../../../src/utils/string.helper';
import { createUser } from '../../../utils/utils';
import {
  ReplicationProfileFixture,
  makeCustomReplicationProfilePayload,
  makeReplicationProfileFixture,
  readVersionedReplicationProfileTemplate,
  templateExists,
  writeRawReplicationProfileTemplate,
} from '../../../utils/replication-profile-fixtures';
import * as fs from 'fs';
import * as path from 'path';
import { Like, Repository } from 'typeorm';

describe(describeName('Replication Profile Service Unit Tests'), () => {
  let app: Application;
  let repository: Repository<ReplicationProfile>;
  let service: ReplicationProfileService;
  let codePrefix: string;
  let userId: number;
  let otherUserId: number;

  const makeProfile = (overrides: Partial<ReplicationProfileFixture> = {}): ReplicationProfile =>
    makeReplicationProfileFixture({
      code: `${codePrefix}profile`,
      userId: overrides.isBuiltin ? null : userId,
      ...overrides,
    });

  const makeCreatePayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> =>
    makeCustomReplicationProfilePayload(codePrefix, overrides);

  const makeFwCloud = (): Promise<FwCloud> =>
    db
      .getSource()
      .manager.getRepository(FwCloud)
      .save({ name: StringHelper.randomize(10), locked: false, locked_by: null });

  beforeEach(async () => {
    app = testSuite.app;
    repository = db.getSource().manager.getRepository(ReplicationProfile);
    service = await app.getService<ReplicationProfileService>(ReplicationProfileService.name);
    codePrefix = `rp-test-${Date.now()}-${Math.round(Math.random() * 100000)}-`;
    userId = (await createUser({ role: 0 })).id;
    otherUserId = (await createUser({ role: 0 })).id;

    await repository.delete({ code: Like(`${codePrefix}%`) });
  });

  afterEach(async () => {
    await repository.delete({ code: Like(`${codePrefix}%`) });
  });

  it('should be provided as an application service', async () => {
    expect(service).to.be.instanceOf(ReplicationProfileService);
  });

  describe('profile definition validation', () => {
    it('should expose reusable validation for profile create/version/clone flows', () => {
      const validPayload = {
        targetKind: 'firewall',
        model: {
          compatibility: { target_kinds: ['firewall'] },
          provision: {
            interfaces: [
              { name: 'eth0', role: 'wan' },
              { name: 'eth1', role: 'lan' },
            ],
            rules: [
              {
                action: 'accept',
                sourceRole: 'lan',
                destinationRole: 'wan',
                service: { protocol: 'tcp', port: 443 },
              },
            ],
          },
        },
      };
      const invalidPayload = {
        ...validPayload,
        targetKind: 'gateway',
      };

      expect(service.validateDefinition(validPayload)).to.be.empty;
      expect(() => service.assertDefinitionIsValid(invalidPayload)).to.throw(
        ReplicationProfileValidationException,
      );
    });
  });

  describe('findCatalog()', () => {
    const findCatalogProfiles = async (
      filters: Partial<ReplicationProfileCatalogFilters> = {},
    ): Promise<ReplicationProfile[]> =>
      (await service.findCatalog({ userId, ...filters }))
        .map(({ profile }) => profile)
        .filter((profile) => profile.code.startsWith(codePrefix));

    const findCatalogCodes = async (
      filters: Partial<ReplicationProfileCatalogFilters> = {},
    ): Promise<string[]> => (await findCatalogProfiles(filters)).map((profile) => profile.code);

    it('should return built-in profiles and the custom profiles of the user from any FWCloud', async () => {
      const fwCloudA = await makeFwCloud();
      const fwCloudB = await makeFwCloud();

      await repository.save([
        makeProfile({ code: `${codePrefix}builtin`, isBuiltin: true, fwCloudId: null }),
        makeProfile({ code: `${codePrefix}owned-a`, fwCloudId: fwCloudA.id }),
        makeProfile({ code: `${codePrefix}owned-b`, fwCloudId: fwCloudB.id }),
        makeProfile({ code: `${codePrefix}foreign`, fwCloudId: fwCloudA.id, userId: otherUserId }),
      ]);

      expect(await findCatalogCodes()).to.deep.eq([
        `${codePrefix}builtin`,
        `${codePrefix}owned-a`,
        `${codePrefix}owned-b`,
      ]);
      expect(await findCatalogCodes({ userId: otherUserId })).to.deep.eq([
        `${codePrefix}builtin`,
        `${codePrefix}foreign`,
      ]);
    });

    it('should return only built-in profiles when there is no valid user', async () => {
      await repository.save([
        makeProfile({ code: `${codePrefix}builtin`, isBuiltin: true, fwCloudId: null }),
        makeProfile({ code: `${codePrefix}custom` }),
      ]);

      for (const userId of [
        undefined,
        null,
        0,
        -1,
        1.5,
        NaN,
        Infinity,
        Number.MAX_SAFE_INTEGER + 1,
      ]) {
        expect(await findCatalogCodes({ userId })).to.deep.eq([`${codePrefix}builtin`]);
        expect(await findCatalogCodes({ userId, origin: 'custom' })).to.be.empty;
      }
    });

    it('should filter catalog profiles by origin', async () => {
      const fwCloud = await makeFwCloud();

      await repository.save([
        makeProfile({ code: `${codePrefix}builtin`, isBuiltin: true, fwCloudId: null }),
        makeProfile({ code: `${codePrefix}custom`, fwCloudId: fwCloud.id }),
      ]);

      expect(await findCatalogCodes({ origin: 'builtin' })).to.deep.eq([`${codePrefix}builtin`]);
      expect(await findCatalogCodes({ origin: 'custom' })).to.deep.eq([`${codePrefix}custom`]);
      expect(await findCatalogCodes({ origin: 'all' })).to.deep.eq([
        `${codePrefix}builtin`,
        `${codePrefix}custom`,
      ]);
    });

    it('should hide deprecated catalog profiles unless explicitly requested', async () => {
      const fwCloud = await makeFwCloud();

      await repository.save([
        makeProfile({ code: `${codePrefix}active`, fwCloudId: fwCloud.id }),
        makeProfile({
          code: `${codePrefix}deprecated`,
          fwCloudId: fwCloud.id,
          isDeprecated: true,
        }),
        makeProfile({ code: `${codePrefix}inactive`, fwCloudId: fwCloud.id, isActive: false }),
      ]);

      expect(await findCatalogCodes()).to.deep.eq([`${codePrefix}active`]);
      expect(await findCatalogCodes({ includeDeprecated: true })).to.deep.eq([
        `${codePrefix}active`,
        `${codePrefix}deprecated`,
      ]);
    });

    it('should list a profile whose template cannot be read with its error, next to the valid ones', async () => {
      const fwCloud = await makeFwCloud();
      const [, broken] = await repository.save([
        makeProfile({ code: `${codePrefix}valid`, fwCloudId: fwCloud.id }),
        makeProfile({ code: `${codePrefix}broken`, fwCloudId: fwCloud.id }),
      ]);
      writeRawReplicationProfileTemplate(broken, '{ broken');

      const entries = (await service.findCatalog({ userId })).filter(({ profile }) =>
        profile.code.startsWith(codePrefix),
      );
      const [brokenEntry, validEntry] = entries;

      expect(entries.map(({ profile }) => profile.code)).to.deep.eq([
        `${codePrefix}broken`,
        `${codePrefix}valid`,
      ]);
      expect(validEntry.template).to.deep.eq({
        model: { replicate: {}, options: {} },
        error: null,
      });
      expect(brokenEntry.template.model).to.be.null;
      expect(brokenEntry.template.error).to.be.instanceOf(ReplicationProfileTemplateException);
      expect(brokenEntry.template.error.reason).to.be.eq('invalid_json');
    });

    it('should match a profile whose template cannot be read by its own target kind', async () => {
      const fwCloud = await makeFwCloud();
      const broken = await repository.save(
        makeProfile({
          code: `${codePrefix}broken-cluster`,
          fwCloudId: fwCloud.id,
          targetKind: 'cluster',
          model: {
            compatibility: { target_kinds: ['cluster', 'firewall'] },
            replicate: {},
            options: {},
          },
        }),
      );
      removeReplicationProfileModel(broken);

      expect(await findCatalogCodes({ targetKind: 'cluster' })).to.deep.eq([
        `${codePrefix}broken-cluster`,
      ]);
      expect(await findCatalogCodes({ targetKind: 'firewall' })).to.be.empty;
    });

    it('should filter catalog profiles by target kind and search fields', async () => {
      const fwCloud = await makeFwCloud();

      await repository.save([
        makeProfile({
          code: `${codePrefix}cluster-lan`,
          fwCloudId: fwCloud.id,
          targetKind: 'cluster',
        }),
        makeProfile({
          code: `${codePrefix}description-hit`,
          fwCloudId: fwCloud.id,
          targetKind: 'cluster',
          description: 'LAN cluster profile',
        }),
        makeProfile({
          code: `${codePrefix}firewall-lan`,
          fwCloudId: fwCloud.id,
          targetKind: 'firewall',
        }),
      ]);

      expect(await findCatalogCodes({ targetKind: 'cluster', search: 'lan' })).to.have.members([
        `${codePrefix}cluster-lan`,
        `${codePrefix}description-hit`,
      ]);
    });

    it('should keep built-in and custom catalog entries distinct when they share a code', async () => {
      const fwCloud = await makeFwCloud();
      const code = `${codePrefix}shared-code`;

      await repository.save([
        makeProfile({ code, version: 1, isBuiltin: true, fwCloudId: null, name: 'Built-in v1' }),
        makeProfile({ code, version: 2, isBuiltin: true, fwCloudId: null, name: 'Built-in v2' }),
        makeProfile({ code, version: 1, fwCloudId: fwCloud.id, name: 'Custom v1' }),
        makeProfile({ code, version: 2, fwCloudId: fwCloud.id, name: 'Custom v2' }),
      ]);

      const profiles = await findCatalogProfiles();

      expect(
        profiles.map((profile) => `${profile.isBuiltin ? 'builtin' : 'custom'}:${profile.version}`),
      ).to.deep.eq(['builtin:2', 'custom:2']);
    });
  });

  describe('findByCodeAndVersion()', () => {
    it('should return only active non-deprecated profiles for the requested code and version', async () => {
      const active = await repository.save(
        makeProfile({ code: `${codePrefix}lookup`, version: 3 }),
      );

      await repository.save([
        makeProfile({ code: `${codePrefix}lookup`, version: 4, isActive: false }),
        makeProfile({ code: `${codePrefix}deprecated`, isDeprecated: true }),
      ]);

      const profile = await service.findByCodeAndVersion(`${codePrefix}lookup`, 3, userId);

      expect(profile.id).to.be.deep.eq(active.id);
      expect(await service.findByCodeAndVersion(`${codePrefix}lookup`, 4, userId)).to.be.null;
      expect(await service.findByCodeAndVersion(`${codePrefix}deprecated`, 1, userId)).to.be.null;
      expect(await service.findByCodeAndVersion(`${codePrefix}missing`, 1, userId)).to.be.null;
    });

    it('should return the built-in default profile inserted by the migration', async () => {
      const profile = await service.findByCodeAndVersion(
        defaultReplicationProfile.code,
        defaultReplicationProfile.version,
      );

      expect(profile).not.to.be.null;
      expect(profile.code).to.be.deep.eq(defaultReplicationProfile.code);
      expect(profile.version).to.be.deep.eq(defaultReplicationProfile.version);
      expect(profile.name).to.be.deep.eq(defaultReplicationProfile.name);
      expect(profile.description).to.be.deep.eq(defaultReplicationProfile.description);
      expect(profile.scope).to.be.deep.eq(defaultReplicationProfile.scope);
      expect(profile.targetKind).to.be.deep.eq(defaultReplicationProfile.target_kind);
      expect(profile.path).to.be.eq('default.v1.json');
      expect(loadReplicationProfileModel(profile)).to.be.deep.eq(
        readVersionedReplicationProfileTemplate(defaultReplicationProfile.path),
      );
      expect(profile.isBuiltin).to.be.true;
      expect(profile.isActive).to.be.true;
      expect(profile.isDeprecated).to.be.false;
    });

    it('should resolve the custom profiles of the user before global profiles, whatever their FWCloud', async () => {
      const fwCloudA = await makeFwCloud();
      const fwCloudB = await makeFwCloud();
      const code = `${codePrefix}shared`;

      const global = await repository.save(
        makeProfile({ code, version: 1, name: 'Global profile', isBuiltin: true, fwCloudId: null }),
      );
      const owned = await repository.save(
        makeProfile({ code, version: 1, name: 'Owned profile', fwCloudId: fwCloudA.id }),
      );
      const foreign = await repository.save(
        makeProfile({
          code,
          version: 1,
          name: 'Foreign profile',
          fwCloudId: fwCloudB.id,
          userId: otherUserId,
        }),
      );

      expect((await service.findByCodeAndVersion(code, 1, userId)).id).to.be.eq(owned.id);
      expect((await service.findByCodeAndVersion(code, 1, otherUserId)).id).to.be.eq(foreign.id);
      expect((await service.findByCodeAndVersion(code, 1, 999999)).id).to.be.eq(global.id);
      expect((await service.findByCodeAndVersion(code, 1)).id).to.be.eq(global.id);
    });

    it('should fall back to built-ins only when the lookup excludes the matching custom profile', async () => {
      for (const state of [{ isActive: false }, { isDeprecated: true }]) {
        const code = `${codePrefix}${state.isActive === false ? 'inactive' : 'deprecated'}`;
        const builtin = await repository.save(makeProfile({ code, isBuiltin: true }));
        const custom = await repository.save(makeProfile({ code, ...state }));

        expect((await service.findByCodeAndVersion(code, 1, userId)).id).to.be.eq(builtin.id);
        expect((await service.findAnyByCodeAndVersion(code, 1, userId)).id).to.be.eq(custom.id);

        for (const invalidUserId of [undefined, null, 0, -1, NaN]) {
          expect((await service.findByCodeAndVersion(code, 1, invalidUserId)).id).to.be.eq(
            builtin.id,
          );
          expect((await service.findAnyByCodeAndVersion(code, 1, invalidUserId)).id).to.be.eq(
            builtin.id,
          );
        }
      }
    });

    it('should not resolve the custom profiles of another user', async () => {
      const profile = await repository.save(makeProfile({ code: `${codePrefix}private` }));

      expect(await service.findByCodeAndVersion(profile.code, 1, otherUserId)).to.be.null;
      expect(await service.findByCodeAndVersion(profile.code, 1)).to.be.null;
      expect(await service.findAnyByCodeAndVersion(profile.code, 1, otherUserId)).to.be.null;
      expect(await service.findAnyByCodeAndVersion(profile.code, 1)).to.be.null;
      expect((await service.findAnyByCodeAndVersion(profile.code, 1, userId)).id).to.be.eq(
        profile.id,
      );
    });
  });

  describe('createCustomProfile()', () => {
    it('should not create a custom profile without a user to own it', async () => {
      const fwCloud = await makeFwCloud();
      const code = `${codePrefix}no-owner`;

      await expect(
        service.createCustomProfile(makeCreatePayload({ code }) as any, { fwCloudId: fwCloud.id }),
      ).to.be.rejectedWith('A user is required to manage custom replication profiles.');

      expect(await repository.findOne({ where: { code } })).to.be.null;
    });

    it('should generate slug code and version defaults while forcing user-owned custom flags', async () => {
      const fwCloud = await makeFwCloud();
      const payload = makeCreatePayload();
      const saved = await service.createCustomProfile(payload as any, {
        fwCloudId: fwCloud.id,
        userId,
      });
      const reloaded = await repository.findOneOrFail({ where: { id: saved.id } });

      expect(saved.code).to.be.eq(service.slugFromName(payload.name as string));
      expect(reloaded.version).to.be.eq(1);
      expect(reloaded.isBuiltin).to.be.false;
      expect(reloaded.isActive).to.be.true;
      expect(reloaded.isDeprecated).to.be.false;
      expect(reloaded.fwCloudId).to.be.eq(fwCloud.id);
      expect(reloaded.userId).to.be.eq(userId);
      expect(reloaded.created_by).to.be.eq(userId);
      expect(reloaded.updated_by).to.be.eq(userId);
    });

    it('should store the model in the user template named after its code and version', async () => {
      const fwCloud = await makeFwCloud();
      const payload = makeCreatePayload({ code: `${codePrefix}templated`, version: 2 });

      const saved = await service.createCustomProfile(payload as any, {
        fwCloudId: fwCloud.id,
        userId,
      });
      const reloaded = await repository.findOneOrFail({ where: { id: saved.id } });

      expect(reloaded.path).to.be.eq(`custom/users/${userId}/${codePrefix}templated.v2.json`);
      expect(resolveReplicationProfileTemplatePath(reloaded)).to.be.eq(
        path.join(
          getUserReplicationProfileTemplatesDirectory(userId),
          `${codePrefix}templated.v2.json`,
        ),
      );
      expect(loadReplicationProfileModel(reloaded)).to.deep.eq(payload.model);
    });

    it('should not keep the profile when its template cannot be written', async () => {
      const fwCloud = await makeFwCloud();
      const code = `${codePrefix}unwritable`;
      const userTemplatesDirectory = getUserReplicationProfileTemplatesDirectory(userId);
      // A file where the user template directory should be makes the write fail.
      fs.rmSync(userTemplatesDirectory, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(userTemplatesDirectory), { recursive: true });
      fs.writeFileSync(userTemplatesDirectory, '');

      try {
        await expect(
          service.createCustomProfile(makeCreatePayload({ code }) as any, {
            fwCloudId: fwCloud.id,
            userId,
          }),
        ).to.be.rejectedWith(ReplicationProfileTemplateException, /could not be written/);
      } finally {
        fs.rmSync(userTemplatesDirectory, { force: true });
      }

      expect(await repository.findOne({ where: { code, fwCloudId: fwCloud.id } })).to.be.null;
    });

    it('should preserve explicit code and version when provided', async () => {
      const fwCloud = await makeFwCloud();
      const payload = makeCreatePayload({
        code: `${codePrefix}explicit`,
        version: 3,
      });

      const saved = await service.createCustomProfile(payload as any, {
        fwCloudId: fwCloud.id,
        userId,
      });

      expect(saved.code).to.be.eq(`${codePrefix}explicit`);
      expect(saved.version).to.be.eq(3);
    });

    it('should create structure profiles without requiring a targetKind in the payload', async () => {
      const fwCloud = await makeFwCloud();
      const payload = makeCreatePayload({
        code: `${codePrefix}no-target-kind`,
        model: {
          compatibility: { target_kinds: ['firewall', 'cluster'] },
          policyStructure: {
            interfaces: [],
            rules: [],
          },
          provision: {
            interfaces: [],
            rules: [],
          },
        },
      });
      delete payload.targetKind;

      const saved = await service.createCustomProfile(payload as any, {
        fwCloudId: fwCloud.id,
        userId,
      });

      expect(saved.targetKind).to.be.eq('firewall');
      expect(
        (loadReplicationProfileModel(saved).compatibility as Record<string, unknown>).target_kinds,
      ).to.deep.eq(['firewall', 'cluster']);
    });

    it('should produce stable URL-safe slugs from names', () => {
      expect(service.slugFromName('Basic LAN/WAN profile')).to.be.eq('basic-lan-wan-profile');
      expect(service.slugFromName('  Ámbito DMZ + WAN  ')).to.be.eq('ambito-dmz-wan');
    });

    it('should reject invalid definitions through the centralized validation service', async () => {
      const fwCloud = await makeFwCloud();
      const payload = makeCreatePayload({
        name: `${codePrefix}invalid`,
        targetKind: 'firewall',
        model: {
          compatibility: { target_kinds: ['cluster'] },
        },
      });

      await expect(
        service.createCustomProfile(payload as any, { fwCloudId: fwCloud.id, userId }),
      ).to.be.rejectedWith(ReplicationProfileValidationException);
    });

    it('should reject duplicate code and version for the same user, also from another FWCloud', async () => {
      const fwCloudA = await makeFwCloud();
      const fwCloudB = await makeFwCloud();
      const payload = makeCreatePayload({
        code: `${codePrefix}duplicate`,
        version: 1,
      });

      await service.createCustomProfile(payload as any, { fwCloudId: fwCloudA.id, userId });

      for (const fwCloud of [fwCloudA, fwCloudB]) {
        await expect(
          service.createCustomProfile(payload as any, { fwCloudId: fwCloud.id, userId }),
        ).to.be.rejectedWith(/already exists for this user/);
      }
    });

    it('should let two users have the same code and version in the same FWCloud', async () => {
      const fwCloud = await makeFwCloud();
      const payload = makeCreatePayload({ code: `${codePrefix}same-code`, version: 1 });
      const otherModel = { replicate: {}, options: {} };

      const owned = await service.createCustomProfile(payload as any, {
        fwCloudId: fwCloud.id,
        userId,
      });
      const foreign = await service.createCustomProfile({ ...payload, model: otherModel } as any, {
        fwCloudId: fwCloud.id,
        userId: otherUserId,
      });

      expect(foreign.id).not.to.be.eq(owned.id);
      expect(foreign.userId).to.be.eq(otherUserId);
      expect(foreign.path).not.to.be.eq(owned.path);
      expect(loadReplicationProfileModel(owned)).to.deep.eq(payload.model);
      expect(loadReplicationProfileModel(foreign)).to.deep.eq(otherModel);
    });

    it('should clean up inactive duplicate rows before creating the same code and version', async () => {
      const fwCloud = await makeFwCloud();
      const code = `${codePrefix}recreate-after-remove`;
      const stale = await repository.save(
        makeProfile({
          code,
          version: 1,
          fwCloudId: fwCloud.id,
          isActive: false,
          isDeprecated: true,
        }),
      );
      const payload = makeCreatePayload({ code, version: 1 });

      const saved = await service.createCustomProfile(payload as any, {
        fwCloudId: fwCloud.id,
        userId,
      });

      expect(saved.id).not.to.be.eq(stale.id);
      expect(saved.code).to.be.eq(code);
      const deletedStaleProfile = await repository.findOne({ where: { id: stale.id } });
      expect(deletedStaleProfile).to.be.null;
      expect(loadReplicationProfileModel(saved)).to.deep.eq(payload.model);
    });

    it('should audit successful profile creation with secret-safe metadata only', async () => {
      const fwCloud = await makeFwCloud();
      const auditRepository = db.getSource().manager.getRepository(AuditLog);
      await auditRepository.delete({ call: PROFILE_CREATE_AUDIT_CALL });

      const marker = `${codePrefix}model-marker`;
      const payload = makeCreatePayload({ code: `${codePrefix}audited-create` }) as any;
      payload.model.provision.rules[0].comment = marker;

      const saved = await service.createCustomProfile(payload, {
        fwCloudId: fwCloud.id,
        userId,
        actor: { userId, userName: 'creator' },
      });

      const entries = await auditRepository.find({
        where: { call: PROFILE_CREATE_AUDIT_CALL },
      });
      expect(entries).to.have.length(1);
      expect(entries[0].userId).to.be.eq(userId);
      expect(entries[0].fwCloudId).to.be.eq(fwCloud.id);
      expect(entries[0].description).to.contain(
        `Custom replication profile ${saved.code} v1 created`,
      );
      expect(entries[0].data).not.to.contain(marker);

      const data = JSON.parse(entries[0].data);
      expect(data).to.include({
        operation: 'create',
        result: 'success',
        profileId: saved.id,
        profileCode: saved.code,
        profileVersion: 1,
        fwCloudId: fwCloud.id,
        targetKind: 'firewall',
        scope: 'generic',
        category: 'Custom',
      });
      expect(data).not.to.have.property('model');

      await auditRepository.delete({ call: PROFILE_CREATE_AUDIT_CALL });
    });

    it('should audit failed profile creation without leaking secret values', async () => {
      const fwCloud = await makeFwCloud();
      const auditRepository = db.getSource().manager.getRepository(AuditLog);
      await auditRepository.delete({ call: PROFILE_CREATE_AUDIT_CALL });

      const secretMarker = `${codePrefix}must-not-leak`;
      const payload = makeCreatePayload({
        code: `${codePrefix}secret-create`,
        model: {
          compatibility: { target_kinds: ['firewall'] },
          options: { password: secretMarker },
        },
      });

      await expect(
        service.createCustomProfile(payload as any, {
          fwCloudId: fwCloud.id,
          userId,
          actor: { userId, userName: 'creator' },
        }),
      ).to.be.rejectedWith('Replication profile definition is invalid.');

      const entries = await auditRepository.find({
        where: { call: PROFILE_CREATE_AUDIT_CALL },
      });
      expect(entries).to.have.length(1);
      expect(entries[0].status).to.be.eq(422);
      expect(entries[0].data).not.to.contain(secretMarker);
      expect(entries[0].description).not.to.contain(secretMarker);

      const data = JSON.parse(entries[0].data);
      expect(data).to.include({
        operation: 'create',
        result: 'failure',
        profileCode: `${codePrefix}secret-create`,
        fwCloudId: fwCloud.id,
      });
      expect(data).not.to.have.property('model');

      await auditRepository.delete({ call: PROFILE_CREATE_AUDIT_CALL });
    });
  });

  describe('cloneCustomProfile()', () => {
    it('should clone a built-in profile into a user-owned custom profile without mutating the source', async () => {
      const fwCloud = await makeFwCloud();
      const builtIn = await repository.save(
        makeProfile({ code: `${codePrefix}builtin-clone`, isBuiltin: true, fwCloudId: null }),
      );

      const saved = await service.cloneCustomProfile(
        builtIn.code,
        builtIn.version,
        { code: `${codePrefix}builtin-clone-copy`, name: 'Built-in copy' },
        { fwCloudId: fwCloud.id, userId },
      );
      const reloadedSource = await repository.findOneOrFail({ where: { id: builtIn.id } });

      expect(saved).to.include({
        code: `${codePrefix}builtin-clone-copy`,
        version: 1,
        name: 'Built-in copy',
        isBuiltin: false,
        isActive: true,
        isDeprecated: false,
        fwCloudId: fwCloud.id,
        created_by: userId,
        updated_by: userId,
      });
      expect(saved.path).to.be.eq(`custom/users/${userId}/${codePrefix}builtin-clone-copy.v1.json`);
      expect(loadReplicationProfileModel(saved)).to.deep.eq(loadReplicationProfileModel(builtIn));
      expect(reloadedSource.isBuiltin).to.be.true;
      expect(reloadedSource.fwCloudId).to.be.null;
      expect(reloadedSource.path).to.be.eq(builtIn.path);
    });

    it('should not clone custom profiles owned by another user', async () => {
      const fwCloudA = await makeFwCloud();
      const fwCloudB = await makeFwCloud();
      const foreign = await repository.save(
        makeProfile({
          code: `${codePrefix}foreign-clone`,
          fwCloudId: fwCloudB.id,
          userId: otherUserId,
        }),
      );

      await expect(
        service.cloneCustomProfile(
          foreign.code,
          foreign.version,
          { code: `${codePrefix}foreign-clone-copy` },
          { fwCloudId: fwCloudA.id, userId },
        ),
      ).to.be.rejectedWith('Replication profile not found');
    });

    it('should clone a custom profile from another FWCloud of its owner', async () => {
      const fwCloud = await makeFwCloud();
      const otherFwCloud = await makeFwCloud();
      const source = await repository.save(
        makeProfile({ code: `${codePrefix}reused-clone`, fwCloudId: otherFwCloud.id }),
      );

      const saved = await service.cloneCustomProfile(
        source.code,
        source.version,
        { code: `${codePrefix}reused-clone-copy` },
        { fwCloudId: fwCloud.id, userId },
      );

      expect(saved.userId).to.be.eq(userId);
      expect(saved.fwCloudId).to.be.eq(fwCloud.id);
      expect(loadReplicationProfileModel(saved)).to.deep.eq(loadReplicationProfileModel(source));
    });

    it('should audit clone operations with source and target metadata', async () => {
      const fwCloud = await makeFwCloud();
      const auditRepository = db.getSource().manager.getRepository(AuditLog);
      await auditRepository.delete({ call: PROFILE_CLONE_AUDIT_CALL });

      const source = await repository.save(
        makeProfile({ code: `${codePrefix}audited-clone`, fwCloudId: fwCloud.id }),
      );

      const saved = await service.cloneCustomProfile(
        source.code,
        source.version,
        { code: `${codePrefix}audited-clone-copy` },
        {
          fwCloudId: fwCloud.id,
          userId,
          actor: { userId, userName: 'cloner' },
        },
      );

      const entries = await auditRepository.find({
        where: { call: PROFILE_CLONE_AUDIT_CALL },
      });
      expect(entries).to.have.length(1);
      expect(entries[0].userId).to.be.eq(userId);

      const data = JSON.parse(entries[0].data);
      expect(data).to.include({
        operation: 'clone',
        result: 'success',
        profileId: saved.id,
        profileCode: saved.code,
        profileVersion: saved.version,
        sourceProfileId: source.id,
        sourceProfileCode: source.code,
        sourceProfileVersion: source.version,
      });
      expect(data).not.to.have.property('model');

      await auditRepository.delete({ call: PROFILE_CLONE_AUDIT_CALL });
    });
  });

  describe('createCustomProfileVersion()', () => {
    it('should create the next immutable custom profile version, also from another FWCloud', async () => {
      const fwCloud = await makeFwCloud();
      const otherFwCloud = await makeFwCloud();
      const original = await repository.save(
        makeProfile({
          code: `${codePrefix}versioned`,
          version: 1,
          fwCloudId: otherFwCloud.id,
          created_by: 3,
          updated_by: 3,
        }),
      );
      const payload = makeCreatePayload({
        name: `${codePrefix}Versioned profile update`,
        description: 'Updated profile definition.',
        scope: 'generic',
        targetKind: 'firewall',
      });

      const saved = await service.createCustomProfileVersion(original.code, payload as any, {
        fwCloudId: fwCloud.id,
        userId,
      });
      const reloadedOriginal = await repository.findOneOrFail({ where: { id: original.id } });

      expect(saved).to.include({
        code: original.code,
        version: 2,
        name: `${codePrefix}Versioned profile update`,
        isBuiltin: false,
        isActive: true,
        isDeprecated: false,
        fwCloudId: fwCloud.id,
        created_by: userId,
        updated_by: userId,
      });
      expect(reloadedOriginal.version).to.be.eq(1);
      expect(reloadedOriginal.isActive).to.be.true;
      expect(reloadedOriginal.isDeprecated).to.be.false;
      expect(saved.path).not.to.be.eq(reloadedOriginal.path);
      expect(loadReplicationProfileModel(saved)).to.deep.eq(payload.model);
      expect(loadReplicationProfileModel(reloadedOriginal)).to.deep.eq({
        replicate: {},
        options: {},
      });
    });

    it('should increment from the highest existing custom version', async () => {
      const fwCloud = await makeFwCloud();
      const code = `${codePrefix}highest`;
      await repository.save([
        makeProfile({ code, version: 1, fwCloudId: fwCloud.id }),
        makeProfile({ code, version: 4, fwCloudId: fwCloud.id }),
      ]);

      const saved = await service.createCustomProfileVersion(code, makeCreatePayload() as any, {
        fwCloudId: fwCloud.id,
        userId,
      });

      expect(saved.version).to.be.eq(5);
    });

    it('should reject built-in profiles', async () => {
      const fwCloud = await makeFwCloud();
      const code = `${codePrefix}builtin`;
      await repository.save(makeProfile({ code, isBuiltin: true, fwCloudId: null }));

      await expect(
        service.createCustomProfileVersion(code, makeCreatePayload() as any, {
          fwCloudId: fwCloud.id,
          userId,
        }),
      ).to.be.rejectedWith('Built-in profiles cannot be modified through this endpoint.');
    });

    it('should not version custom profiles owned by another user', async () => {
      const fwCloudA = await makeFwCloud();
      const fwCloudB = await makeFwCloud();
      const code = `${codePrefix}foreign`;
      await repository.save(makeProfile({ code, fwCloudId: fwCloudB.id, userId: otherUserId }));

      await expect(
        service.createCustomProfileVersion(code, makeCreatePayload() as any, {
          fwCloudId: fwCloudA.id,
          userId,
        }),
      ).to.be.rejectedWith('Replication profile not found');
    });

    it('should reject invalid definitions before saving the new version', async () => {
      const fwCloud = await makeFwCloud();
      const code = `${codePrefix}invalid-version`;
      await repository.save(makeProfile({ code, fwCloudId: fwCloud.id }));

      await expect(
        service.createCustomProfileVersion(
          code,
          makeCreatePayload({
            targetKind: 'firewall',
            model: {
              compatibility: { target_kinds: ['cluster'] },
            },
          }) as any,
          { fwCloudId: fwCloud.id, userId },
        ),
      ).to.be.rejectedWith(ReplicationProfileValidationException);
    });

    it('should reject inactive or deprecated profiles', async () => {
      const fwCloud = await makeFwCloud();
      const code = `${codePrefix}inactive-version`;
      await repository.save(
        makeProfile({ code, fwCloudId: fwCloud.id, isActive: false, isDeprecated: true }),
      );

      await expect(
        service.createCustomProfileVersion(code, makeCreatePayload() as any, {
          fwCloudId: fwCloud.id,
          userId,
        }),
      ).to.be.rejectedWith('Inactive or deprecated profiles cannot be modified');
    });

    it('should audit new profile versions with previous-version metadata', async () => {
      const fwCloud = await makeFwCloud();
      const auditRepository = db.getSource().manager.getRepository(AuditLog);
      await auditRepository.delete({ call: PROFILE_VERSION_AUDIT_CALL });
      const original = await repository.save(
        makeProfile({ code: `${codePrefix}audited-version`, fwCloudId: fwCloud.id, userId }),
      );

      const saved = await service.createCustomProfileVersion(
        original.code,
        makeCreatePayload({ name: `${codePrefix}Audited update` }) as any,
        {
          fwCloudId: fwCloud.id,
          userId,
          actor: { userId, userName: 'versioner' },
        },
      );

      const entries = await auditRepository.find({
        where: { call: PROFILE_VERSION_AUDIT_CALL },
      });
      expect(entries).to.have.length(1);
      expect(entries[0].userId).to.be.eq(userId);

      const data = JSON.parse(entries[0].data);
      expect(data).to.include({
        operation: 'update',
        result: 'success',
        profileId: saved.id,
        profileCode: original.code,
        profileVersion: 2,
        previousProfileId: original.id,
        previousProfileVersion: 1,
      });
      expect(data).not.to.have.property('model');

      await auditRepository.delete({ call: PROFILE_VERSION_AUDIT_CALL });
    });
  });

  describe('removeCustomProfile()', () => {
    it('should delete a custom profile row and template, also from another FWCloud', async () => {
      const fwCloud = await makeFwCloud();
      const otherFwCloud = await makeFwCloud();
      const profile = await repository.save(
        makeProfile({
          code: `${codePrefix}remove`,
          version: 2,
          fwCloudId: otherFwCloud.id,
          updated_by: 3,
        }),
      );

      const result = await service.removeCustomProfile(profile.code, profile.version, {
        fwCloudId: fwCloud.id,
        userId,
        actor: { userId },
      });

      expect(result.profile).to.include({
        id: profile.id,
        code: profile.code,
        version: profile.version,
        updated_by: 3,
      });
      expect(result.template).to.deep.eq({ model: { replicate: {}, options: {} }, error: null });

      const reloaded = await repository.findOne({ where: { id: profile.id } });
      expect(reloaded).to.be.null;
      expect(templateExists(profile)).to.be.false;
    });

    it('should remove a custom profile whose template can no longer be read', async () => {
      const fwCloud = await makeFwCloud();
      const profile = await repository.save(
        makeProfile({ code: `${codePrefix}broken-remove`, fwCloudId: fwCloud.id }),
      );
      writeRawReplicationProfileTemplate(profile, '{ broken');

      const result = await service.removeCustomProfile(profile.code, profile.version, {
        fwCloudId: fwCloud.id,
        userId,
      });

      expect(result.profile.code).to.be.eq(profile.code);
      expect(result.template.model).to.be.null;
      expect(result.template.error.reason).to.be.eq('invalid_json');
      expect(await repository.findOne({ where: { id: profile.id } })).to.be.null;
      expect(templateExists(profile)).to.be.false;
    });

    it('should reject built-in profiles', async () => {
      const fwCloud = await makeFwCloud();
      const code = `${codePrefix}builtin-remove`;
      const builtIn = await repository.save(
        makeProfile({ code, isBuiltin: true, fwCloudId: null }),
      );

      await expect(
        service.removeCustomProfile(code, builtIn.version, { fwCloudId: fwCloud.id, userId }),
      ).to.be.rejectedWith('Built-in profiles cannot be deleted.');

      const reloaded = await repository.findOneOrFail({ where: { id: builtIn.id } });
      expect(reloaded.isActive).to.be.true;
      expect(reloaded.isDeprecated).to.be.false;
    });

    it('should not remove custom profiles owned by another user', async () => {
      const fwCloudA = await makeFwCloud();
      const fwCloudB = await makeFwCloud();
      const code = `${codePrefix}foreign-remove`;
      const foreign = await repository.save(
        makeProfile({ code, fwCloudId: fwCloudB.id, userId: otherUserId }),
      );

      await expect(
        service.removeCustomProfile(code, foreign.version, { fwCloudId: fwCloudA.id, userId }),
      ).to.be.rejectedWith('Replication profile not found');

      const reloaded = await repository.findOneOrFail({ where: { id: foreign.id } });
      expect(reloaded.isActive).to.be.true;
      expect(reloaded.isDeprecated).to.be.false;
    });

    it('should reject unknown profiles', async () => {
      const fwCloud = await makeFwCloud();

      await expect(
        service.removeCustomProfile(`${codePrefix}missing`, 1, { fwCloudId: fwCloud.id, userId }),
      ).to.be.rejectedWith('Replication profile not found');
    });

    it('should audit failed remove attempts with safe metadata', async () => {
      const fwCloud = await makeFwCloud();
      const auditRepository = db.getSource().manager.getRepository(AuditLog);
      await auditRepository.delete({ call: PROFILE_REMOVE_AUDIT_CALL });
      const builtIn = await repository.save(
        makeProfile({
          code: `${codePrefix}audited-builtin-delete`,
          isBuiltin: true,
          fwCloudId: null,
        }),
      );

      await expect(
        service.removeCustomProfile(builtIn.code, builtIn.version, {
          fwCloudId: fwCloud.id,
          userId,
          actor: { userId, userName: 'deleter' },
        }),
      ).to.be.rejectedWith('Built-in profiles cannot be deleted.');

      const entries = await auditRepository.find({
        where: { call: PROFILE_REMOVE_AUDIT_CALL },
      });
      expect(entries).to.have.length(1);
      expect(entries[0].status).to.be.eq(403);
      expect(entries[0].userId).to.be.eq(userId);

      const data = JSON.parse(entries[0].data);
      expect(data).to.include({
        operation: 'remove',
        result: 'failure',
        profileCode: builtIn.code,
        profileVersion: builtIn.version,
        fwCloudId: fwCloud.id,
      });
      expect(data).not.to.have.property('model');

      await auditRepository.delete({ call: PROFILE_REMOVE_AUDIT_CALL });
    });

    it('should audit the removal in the FWCloud it was requested from', async () => {
      const fwCloud = await makeFwCloud();
      const otherFwCloud = await makeFwCloud();
      const auditRepository = db.getSource().manager.getRepository(AuditLog);
      await auditRepository.delete({ call: PROFILE_REMOVE_AUDIT_CALL });

      const profile = await repository.save(
        makeProfile({ code: `${codePrefix}audited`, version: 4, fwCloudId: otherFwCloud.id }),
      );

      await service.removeCustomProfile(profile.code, profile.version, {
        fwCloudId: fwCloud.id,
        userId,
        actor: { userId, userName: 'auditor' },
      });

      const entries = await auditRepository.find({
        where: { call: PROFILE_REMOVE_AUDIT_CALL },
      });
      expect(entries).to.have.length(1);
      expect(entries[0].userId).to.be.eq(userId);
      expect(entries[0].fwCloudId).to.be.eq(fwCloud.id);

      const data = JSON.parse(entries[0].data);
      expect(data.profileId).to.be.eq(profile.id);
      expect(data.profileCode).to.be.eq(profile.code);
      expect(data.profileVersion).to.be.eq(profile.version);
      expect(data.fwCloudId).to.be.eq(fwCloud.id);
      expect(data.operation).to.be.eq('remove');
      expect(data.removed).to.be.true;
      expect(data).not.to.have.property('previous');
      expect(data).not.to.have.property('current');

      await auditRepository.delete({ call: PROFILE_REMOVE_AUDIT_CALL });
    });
  });
});
