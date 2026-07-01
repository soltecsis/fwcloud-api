import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import defaultReplicationProfile from '../../../../src/models/replication-profile/presets/default-replication-profile.v1.json';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import { ReplicationProfileService } from '../../../../src/models/replication-profile/replication-profile.service';
import { ReplicationProfileValidationException } from '../../../../src/models/replication-profile/replication-profile-validation.service';
import StringHelper from '../../../../src/utils/string.helper';
import { makeCustomReplicationProfilePayload } from '../../../utils/replication-profile-fixtures';
import { Like, Repository } from 'typeorm';

describe(describeName('Replication Profile Service Unit Tests'), () => {
  let app: Application;
  let repository: Repository<ReplicationProfile>;
  let service: ReplicationProfileService;
  let codePrefix: string;

  const makeProfile = (overrides: Partial<ReplicationProfile> = {}): ReplicationProfile => {
    return repository.create({
      code: `${codePrefix}profile`,
      version: 1,
      name: 'Test replication profile',
      description: null,
      scope: 'generic',
      targetKind: 'firewall',
      model: {
        replicate: {},
        options: {},
      },
      isBuiltin: false,
      isActive: true,
      isDeprecated: false,
      ...overrides,
    });
  };

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

  describe('findActive()', () => {
    it('should return active non-deprecated profiles ordered by code and descending version', async () => {
      await repository.save([
        makeProfile({ code: `${codePrefix}b`, version: 1 }),
        makeProfile({ code: `${codePrefix}a`, version: 1 }),
        makeProfile({ code: `${codePrefix}a`, version: 2 }),
        makeProfile({ code: `${codePrefix}inactive`, isActive: false }),
        makeProfile({ code: `${codePrefix}deprecated`, isDeprecated: true }),
      ]);

      const profiles = (await service.findActive()).filter((profile) =>
        profile.code.startsWith(codePrefix),
      );

      expect(profiles.map((profile) => `${profile.code}:${profile.version}`)).to.be.deep.eq([
        `${codePrefix}a:2`,
        `${codePrefix}a:1`,
        `${codePrefix}b:1`,
      ]);
    });

    it('should filter active profiles by target kind and compatibility metadata', async () => {
      await repository.save([
        makeProfile({ code: `${codePrefix}firewall`, targetKind: 'firewall' }),
        makeProfile({ code: `${codePrefix}cluster`, targetKind: 'cluster' }),
        makeProfile({
          code: `${codePrefix}compatible-cluster`,
          targetKind: 'firewall',
          model: {
            compatibility: {
              target_kinds: ['firewall', 'cluster'],
            },
            replicate: {},
            options: {},
          },
        }),
      ]);

      const profiles = (await service.findActive('cluster')).filter((profile) =>
        profile.code.startsWith(codePrefix),
      );

      expect(profiles.map((profile) => profile.code)).to.be.deep.eq([
        `${codePrefix}cluster`,
        `${codePrefix}compatible-cluster`,
      ]);
    });

    it('should return global profiles and profiles owned by the requested FWCloud', async () => {
      const fwCloudA = await makeFwCloud();
      const fwCloudB = await makeFwCloud();

      await repository.save([
        makeProfile({ code: `${codePrefix}global`, isBuiltin: true, fwCloudId: null }),
        makeProfile({ code: `${codePrefix}owned`, fwCloudId: fwCloudA.id }),
        makeProfile({ code: `${codePrefix}foreign`, fwCloudId: fwCloudB.id }),
      ]);

      const profiles = (await service.findActive(undefined, fwCloudA.id)).filter((profile) =>
        profile.code.startsWith(codePrefix),
      );

      expect(profiles.map((profile) => profile.code)).to.be.deep.eq([
        `${codePrefix}global`,
        `${codePrefix}owned`,
      ]);
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

      const profile = await service.findByCodeAndVersion(`${codePrefix}lookup`, 3);

      expect(profile.id).to.be.deep.eq(active.id);
      expect(await service.findByCodeAndVersion(`${codePrefix}lookup`, 4)).to.be.null;
      expect(await service.findByCodeAndVersion(`${codePrefix}deprecated`, 1)).to.be.null;
      expect(await service.findByCodeAndVersion(`${codePrefix}missing`, 1)).to.be.null;
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
      expect(profile.model).to.be.deep.eq(defaultReplicationProfile.model);
      expect(profile.isBuiltin).to.be.true;
      expect(profile.isActive).to.be.true;
      expect(profile.isDeprecated).to.be.false;
    });

    it('should resolve FWCloud-owned profiles before global profiles in scoped lookups', async () => {
      const fwCloudA = await makeFwCloud();
      const fwCloudB = await makeFwCloud();
      const code = `${codePrefix}shared`;

      const global = await repository.save(
        makeProfile({ code, version: 1, name: 'Global profile', isBuiltin: true, fwCloudId: null }),
      );
      const inA = await repository.save(
        makeProfile({ code, version: 1, name: 'FWCloud A profile', fwCloudId: fwCloudA.id }),
      );
      const inB = await repository.save(
        makeProfile({ code, version: 1, name: 'FWCloud B profile', fwCloudId: fwCloudB.id }),
      );

      expect((await service.findByCodeAndVersion(code, 1, fwCloudA.id)).id).to.be.eq(inA.id);
      expect((await service.findByCodeAndVersion(code, 1, fwCloudB.id)).id).to.be.eq(inB.id);
      expect((await service.findByCodeAndVersion(code, 1, 999999)).id).to.be.eq(global.id);
    });
  });

  describe('createCustomProfile()', () => {
    it('should generate slug code and version defaults while forcing FWCloud-owned custom flags', async () => {
      const fwCloud = await makeFwCloud();
      const payload = makeCreatePayload();
      const saved = await service.createCustomProfile(payload as any, {
        fwCloudId: fwCloud.id,
        userId: 7,
      });
      const reloaded = await repository.findOneOrFail({ where: { id: saved.id } });

      expect(saved.code).to.be.eq(service.slugFromName(payload.name as string));
      expect(reloaded.version).to.be.eq(1);
      expect(reloaded.isBuiltin).to.be.false;
      expect(reloaded.isActive).to.be.true;
      expect(reloaded.isDeprecated).to.be.false;
      expect(reloaded.fwCloudId).to.be.eq(fwCloud.id);
      expect(reloaded.created_by).to.be.eq(7);
      expect(reloaded.updated_by).to.be.eq(7);
    });

    it('should preserve explicit code and version when provided', async () => {
      const fwCloud = await makeFwCloud();
      const payload = makeCreatePayload({
        code: `${codePrefix}explicit`,
        version: 3,
      });

      const saved = await service.createCustomProfile(payload as any, {
        fwCloudId: fwCloud.id,
      });

      expect(saved.code).to.be.eq(`${codePrefix}explicit`);
      expect(saved.version).to.be.eq(3);
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
        service.createCustomProfile(payload as any, { fwCloudId: fwCloud.id }),
      ).to.be.rejectedWith(ReplicationProfileValidationException);
    });

    it('should reject duplicate code and version inside the same FWCloud', async () => {
      const fwCloud = await makeFwCloud();
      const payload = makeCreatePayload({
        code: `${codePrefix}duplicate`,
        version: 1,
      });

      await service.createCustomProfile(payload as any, { fwCloudId: fwCloud.id });

      await expect(
        service.createCustomProfile(payload as any, { fwCloudId: fwCloud.id }),
      ).to.be.rejectedWith(/already exists in this FWCloud/);
    });
  });
});
