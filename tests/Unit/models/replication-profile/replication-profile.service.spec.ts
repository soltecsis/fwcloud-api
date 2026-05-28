import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import defaultReplicationProfile from '../../../../src/models/replication-profile/presets/default-replication-profile.v1.json';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import { ReplicationProfileService } from '../../../../src/models/replication-profile/replication-profile.service';
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
              target_kinds: ['cluster'],
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
  });
});
