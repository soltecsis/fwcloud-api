import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { PROFILE_APPLICATION_AUDIT_CALL } from '../../../../src/models/replication-profile/profile-application.service';
import { PROFILE_DEACTIVATION_AUDIT_CALL } from '../../../../src/models/replication-profile/replication-profile.service';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import { User } from '../../../../src/models/user/User';
import StringHelper from '../../../../src/utils/string.helper';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../../utils/utils';
import { makeCustomReplicationProfilePayload } from '../../../utils/replication-profile-fixtures';
import request = require('supertest');
import { Like, Repository } from 'typeorm';

describe(describeName('Replication Profile E2E Tests'), () => {
  let app: Application;
  let adminUser: User;
  let adminUserSessionId: string;
  let fwCloud: FwCloud;
  let repository: Repository<ReplicationProfile>;
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
      fwCloudId: fwCloud?.id ?? null,
      ...overrides,
    });
  };

  const makeCreatePayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> =>
    makeCustomReplicationProfilePayload(codePrefix, overrides);

  beforeEach(async () => {
    app = testSuite.app;
    repository = db.getSource().manager.getRepository(ReplicationProfile);
    codePrefix = `rp-e2e-${Date.now()}-${Math.round(Math.random() * 100000)}-`;

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    fwCloud = await db
      .getSource()
      .manager.getRepository(FwCloud)
      .save({ name: StringHelper.randomize(10), locked: false, locked_by: null });
  });

  afterEach(async () => {
    await repository.delete({ code: Like(`${codePrefix}%`) });
  });

  describe('POST /fwclouds/:fwcloud/assistant/profiles', () => {
    it('should create a FWCloud-scoped custom profile with generated code and version defaults', async () => {
      const expectedCode = `${codePrefix}basic-lan-wan-profile`;

      await request(app.express)
        .post(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send(makeCreatePayload())
        .expect(201)
        .then(async (response) => {
          const result = response.body.data;

          expect(result).to.include({
            code: expectedCode,
            version: 1,
            name: `${codePrefix}Basic LAN/WAN profile`,
            description: 'Creates WAN/LAN interfaces and allows LAN to WAN traffic.',
            targetKind: 'firewall',
            scope: 'generic',
            category: 'Custom',
            is_built_in: false,
            is_active: true,
            is_deprecated: false,
            fwcloud_id: fwCloud.id,
          });
          expect(result.id).to.be.a('number');
          expect(result.model.provision.interfaces).to.have.length(2);

          const persisted = await repository.findOneOrFail({ where: { id: result.id } });
          expect(persisted.isBuiltin).to.be.false;
          expect(persisted.isActive).to.be.true;
          expect(persisted.isDeprecated).to.be.false;
          expect(persisted.fwCloudId).to.be.eq(fwCloud.id);
        });

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          const result = response.body.data.find((item) => item.code === expectedCode);

          expect(result).to.include({
            code: expectedCode,
            is_built_in: false,
            fwcloud_id: fwCloud.id,
          });
        });
    });

    it('should preserve explicit code and version from a valid payload', async () => {
      await request(app.express)
        .post(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send(makeCreatePayload({ code: `${codePrefix}explicit`, version: 3 }))
        .expect(201)
        .then((response) => {
          expect(response.body.data).to.include({
            code: `${codePrefix}explicit`,
            version: 3,
            is_built_in: false,
            fwcloud_id: fwCloud.id,
          });
        });
    });

    it('should reject users without access to the FWCloud', async () => {
      const regularUser = await createUser({ role: 0 });
      const regularUserSessionId = generateSession(regularUser);

      await request(app.express)
        .post(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .set('Cookie', [attachSession(regularUserSessionId)])
        .send(makeCreatePayload({ code: `${codePrefix}forbidden` }))
        .expect(403);
    });

    it('should reject invalid profile definitions through the centralized validator', async () => {
      await request(app.express)
        .post(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send(
          makeCreatePayload({
            code: `${codePrefix}invalid-definition`,
            model: {
              compatibility: { target_kinds: ['cluster'] },
              provision: {
                interfaces: [
                  { name: 'WAN', role: 'wan' },
                  { name: 'LAN', role: 'lan' },
                ],
              },
            },
          }),
        )
        .expect(422);
    });
  });

  describe('POST /fwclouds/:fwcloud/assistant/profiles/:code/versions', () => {
    it('should create the next custom profile version without mutating the previous version', async () => {
      const original = await repository.save(
        makeProfile({
          code: `${codePrefix}versioned`,
          version: 1,
          name: 'Original profile',
          fwCloudId: fwCloud.id,
        }),
      );

      await request(app.express)
        .post(`/fwclouds/${fwCloud.id}/assistant/profiles/${original.code}/versions`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send(
          makeCreatePayload({
            name: `${codePrefix}Updated profile`,
            description: 'Updated immutable version.',
          }),
        )
        .expect(201)
        .then(async (response) => {
          const result = response.body.data;

          expect(result).to.include({
            code: original.code,
            version: 2,
            name: `${codePrefix}Updated profile`,
            description: 'Updated immutable version.',
            is_built_in: false,
            is_active: true,
            is_deprecated: false,
            fwcloud_id: fwCloud.id,
          });

          const previous = await repository.findOneOrFail({ where: { id: original.id } });
          expect(previous).to.include({
            version: 1,
            name: 'Original profile',
            isActive: true,
            isDeprecated: false,
          });
        });

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles/${original.code}/1`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          expect(response.body.data).to.include({
            id: original.id,
            code: original.code,
            version: 1,
            name: 'Original profile',
          });
        });
    });

    it('should reject built-in profile versioning', async () => {
      const builtIn = await repository.save(
        makeProfile({
          code: `${codePrefix}builtin`,
          isBuiltin: true,
          fwCloudId: null,
        }),
      );

      await request(app.express)
        .post(`/fwclouds/${fwCloud.id}/assistant/profiles/${builtIn.code}/versions`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send(makeCreatePayload())
        .expect(403)
        .then((response) => {
          expect(response.body.message).to.contain(
            'Built-in profiles cannot be modified through this endpoint.',
          );
        });
    });

    it('should reject manual code and version overrides', async () => {
      const profile = await repository.save(
        makeProfile({ code: `${codePrefix}manual-override`, fwCloudId: fwCloud.id }),
      );

      await request(app.express)
        .post(`/fwclouds/${fwCloud.id}/assistant/profiles/${profile.code}/versions`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send(makeCreatePayload({ code: `${codePrefix}other-code`, version: 99 }))
        .expect(422);
    });

    it('should reject invalid profile definitions and persistent secrets', async () => {
      const invalidProfile = await repository.save(
        makeProfile({ code: `${codePrefix}invalid-version`, fwCloudId: fwCloud.id }),
      );
      const secretProfile = await repository.save(
        makeProfile({ code: `${codePrefix}secret-version`, fwCloudId: fwCloud.id }),
      );

      await request(app.express)
        .post(`/fwclouds/${fwCloud.id}/assistant/profiles/${invalidProfile.code}/versions`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send(
          makeCreatePayload({
            model: {
              compatibility: { target_kinds: ['cluster'] },
            },
          }),
        )
        .expect(422);

      await request(app.express)
        .post(`/fwclouds/${fwCloud.id}/assistant/profiles/${secretProfile.code}/versions`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send(
          makeCreatePayload({
            model: {
              compatibility: { target_kinds: ['firewall'] },
              options: { password: 'must-not-persist' },
            },
          }),
        )
        .expect(422);
    });

    it('should enforce FWCloud access and custom profile isolation', async () => {
      const otherFwCloud = await db
        .getSource()
        .manager.getRepository(FwCloud)
        .save({ name: StringHelper.randomize(10), locked: false, locked_by: null });
      const owned = await repository.save(
        makeProfile({ code: `${codePrefix}owned-version`, fwCloudId: fwCloud.id }),
      );
      const foreign = await repository.save(
        makeProfile({ code: `${codePrefix}foreign-version`, fwCloudId: otherFwCloud.id }),
      );
      const regularUser = await createUser({ role: 0 });
      const regularUserSessionId = generateSession(regularUser);

      await request(app.express)
        .post(`/fwclouds/${fwCloud.id}/assistant/profiles/${owned.code}/versions`)
        .set('Cookie', [attachSession(regularUserSessionId)])
        .send(makeCreatePayload())
        .expect(403);

      await request(app.express)
        .post(`/fwclouds/${fwCloud.id}/assistant/profiles/${foreign.code}/versions`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send(makeCreatePayload())
        .expect(404);
    });
  });

  describe('GET /fwclouds/:fwcloud/assistant/profiles', () => {
    it('should return active profile summaries with detail data for the wizard', async () => {
      const profile = await repository.save(
        makeProfile({
          code: `${codePrefix}firewall`,
          category: 'Custom',
          created_by: adminUser.id,
          updated_by: adminUser.id,
        }),
      );

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          const result = response.body.data.find((item) => item.code === profile.code);

          expect(result).to.include({
            id: profile.id,
            code: profile.code,
            version: profile.version,
            name: profile.name,
            description: profile.description,
            scope: profile.scope,
            targetKind: profile.targetKind,
            category: profile.category,
            isBuiltin: false,
            isCustom: true,
            isActive: true,
            isDeprecated: false,
            fwcloudId: fwCloud.id,
            createdBy: adminUser.id,
            updatedBy: adminUser.id,
            is_built_in: false,
            is_active: true,
            is_deprecated: false,
            fwcloud_id: fwCloud.id,
          });
          expect(result.model).to.deep.equal(profile.model);
          expect(result.createdAt).to.be.a('string');
          expect(result.updatedAt).to.be.a('string');
        });
    });

    it('should filter profiles by target kind and compatibility metadata', async () => {
      await repository.save([
        makeProfile({ code: `${codePrefix}firewall`, targetKind: 'firewall' }),
        makeProfile({ code: `${codePrefix}cluster`, targetKind: 'cluster' }),
        makeProfile({
          code: `${codePrefix}compatible-cluster`,
          targetKind: 'firewall',
          model: {
            compatibility: {
              targetKinds: ['firewall', 'cluster'],
            },
            replicate: {},
            options: {},
          },
        }),
      ]);

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .query({ targetKind: 'cluster' })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          const codes = response.body.data
            .map((profile) => profile.code)
            .filter((code) => code.startsWith(codePrefix));

          expect(codes).to.deep.equal([`${codePrefix}cluster`, `${codePrefix}compatible-cluster`]);
        });
    });

    it('should not include custom profiles owned by another FWCloud', async () => {
      const otherFwCloud = await db
        .getSource()
        .manager.getRepository(FwCloud)
        .save({ name: StringHelper.randomize(10), locked: false, locked_by: null });

      await repository.save([
        makeProfile({ code: `${codePrefix}global`, isBuiltin: true, fwCloudId: null }),
        makeProfile({ code: `${codePrefix}owned`, fwCloudId: fwCloud.id }),
        makeProfile({ code: `${codePrefix}foreign`, fwCloudId: otherFwCloud.id }),
      ]);

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          const codes = response.body.data
            .map((profile) => profile.code)
            .filter((code) => code.startsWith(codePrefix));

          expect(codes).to.deep.equal([`${codePrefix}global`, `${codePrefix}owned`]);
        });
    });

    it('should filter profiles by origin', async () => {
      await repository.save([
        makeProfile({ code: `${codePrefix}builtin`, isBuiltin: true, fwCloudId: null }),
        makeProfile({ code: `${codePrefix}custom`, fwCloudId: fwCloud.id }),
      ]);

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .query({ origin: 'builtin' })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          const codes = response.body.data
            .map((profile) => profile.code)
            .filter((code) => code.startsWith(codePrefix));

          expect(codes).to.deep.equal([`${codePrefix}builtin`]);
        });

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .query({ origin: 'custom' })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          const codes = response.body.data
            .map((profile) => profile.code)
            .filter((code) => code.startsWith(codePrefix));

          expect(codes).to.deep.equal([`${codePrefix}custom`]);
        });

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .query({ origin: 'all' })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          const codes = response.body.data
            .map((profile) => profile.code)
            .filter((code) => code.startsWith(codePrefix));

          expect(codes).to.deep.equal([`${codePrefix}builtin`, `${codePrefix}custom`]);
        });
    });

    it('should hide deprecated profiles by default and include them when requested', async () => {
      await repository.save([
        makeProfile({ code: `${codePrefix}active` }),
        makeProfile({ code: `${codePrefix}deprecated`, isDeprecated: true }),
        makeProfile({ code: `${codePrefix}inactive`, isActive: false }),
      ]);

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          const codes = response.body.data
            .map((profile) => profile.code)
            .filter((code) => code.startsWith(codePrefix));

          expect(codes).to.deep.equal([`${codePrefix}active`]);
        });

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .query({ includeDeprecated: 'true' })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          const codes = response.body.data
            .map((profile) => profile.code)
            .filter((code) => code.startsWith(codePrefix));

          expect(codes).to.deep.equal([`${codePrefix}active`, `${codePrefix}deprecated`]);
        });
    });

    it('should filter profiles by search text', async () => {
      await repository.save([
        makeProfile({ code: `${codePrefix}category-hit`, category: 'LAN' }),
        makeProfile({ code: `${codePrefix}description-hit`, description: 'Copies LAN rules' }),
        makeProfile({ code: `${codePrefix}lan-code`, name: 'Plain profile' }),
        makeProfile({ code: `${codePrefix}name-hit`, name: 'LAN template' }),
        makeProfile({ code: `${codePrefix}outside`, name: 'WAN template' }),
      ]);

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .query({ search: 'lan' })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          const codes = response.body.data
            .map((profile) => profile.code)
            .filter((code) => code.startsWith(codePrefix));

          expect(codes).to.have.members([
            `${codePrefix}category-hit`,
            `${codePrefix}description-hit`,
            `${codePrefix}lan-code`,
            `${codePrefix}name-hit`,
          ]);
        });
    });

    it('should return the latest active custom profile version by default', async () => {
      const code = `${codePrefix}catalog-latest`;
      await repository.save([
        makeProfile({ code, version: 1, fwCloudId: fwCloud.id }),
        makeProfile({
          code,
          version: 2,
          name: 'Preferred catalog version',
          fwCloudId: fwCloud.id,
        }),
      ]);

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          const matches = response.body.data.filter((item) => item.code === code);

          expect(matches).to.have.length(1);
          expect(matches[0]).to.include({
            code,
            version: 2,
            name: 'Preferred catalog version',
          });
        });
    });

    it('should reject invalid catalog filters', async () => {
      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .query({ targetKind: 'gateway' })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(400)
        .then((response) => {
          expect(response.body.errors.targetKind[0]).to.contain('targetKind');
        });

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .query({ origin: 'external' })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(400)
        .then((response) => {
          expect(response.body.errors.origin[0]).to.contain('origin');
        });

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .query({ includeDeprecated: 'maybe' })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(400)
        .then((response) => {
          expect(response.body.errors.includeDeprecated[0]).to.contain('includeDeprecated');
        });
    });
  });

  describe('GET /fwclouds/:fwcloud/assistant/profiles/:code/:version', () => {
    it('should return a selected profile detail', async () => {
      const profile = await repository.save(makeProfile({ code: `${codePrefix}detail` }));

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles/${profile.code}/${profile.version}`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          expect(response.body.data).to.include({
            id: profile.id,
            code: profile.code,
            version: profile.version,
            targetKind: profile.targetKind,
          });
          expect(response.body.data.model).to.deep.equal(profile.model);
        });
    });

    it('should reject users without access to the FWCloud', async () => {
      const profile = await repository.save(makeProfile({ code: `${codePrefix}forbidden` }));
      const regularUser = await createUser({ role: 0 });
      const regularUserSessionId = generateSession(regularUser);

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles/${profile.code}/${profile.version}`)
        .set('Cookie', [attachSession(regularUserSessionId)])
        .expect(401);
    });

    it('should not return custom profiles owned by another FWCloud', async () => {
      const otherFwCloud = await db
        .getSource()
        .manager.getRepository(FwCloud)
        .save({ name: StringHelper.randomize(10), locked: false, locked_by: null });
      const profile = await repository.save(
        makeProfile({ code: `${codePrefix}foreign-detail`, fwCloudId: otherFwCloud.id }),
      );

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles/${profile.code}/${profile.version}`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(404);
    });
  });

  describe('DELETE /fwclouds/:fwcloud/assistant/profiles/:code/:version', () => {
    const deleteUrl = (code: string, version: number) =>
      `/fwclouds/${fwCloud.id}/assistant/profiles/${code}/${version}`;

    it('should soft-delete a custom profile and remove it from the catalog', async () => {
      const profile = await repository.save(
        makeProfile({ code: `${codePrefix}deactivate`, version: 2, fwCloudId: fwCloud.id }),
      );

      await request(app.express)
        .delete(deleteUrl(profile.code, profile.version))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          expect(response.body.data).to.include({
            id: profile.id,
            code: profile.code,
            version: profile.version,
            is_built_in: false,
            is_active: false,
            is_deprecated: true,
            fwcloud_id: fwCloud.id,
          });
        });

      const persisted = await repository.findOneOrFail({ where: { id: profile.id } });
      expect(persisted.isActive).to.be.false;
      expect(persisted.isDeprecated).to.be.true;

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200)
        .then((response) => {
          const codes = response.body.data.map((item) => item.code);
          expect(codes).not.to.include(profile.code);
        });

      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles/${profile.code}/${profile.version}`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(404);
    });

    it('should reject built-in profile deactivation', async () => {
      const builtIn = await repository.save(
        makeProfile({ code: `${codePrefix}builtin-delete`, isBuiltin: true, fwCloudId: null }),
      );

      await request(app.express)
        .delete(deleteUrl(builtIn.code, builtIn.version))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(403)
        .then((response) => {
          expect(response.body.message).to.contain(
            'Built-in profiles cannot be deleted or deactivated.',
          );
        });

      const persisted = await repository.findOneOrFail({ where: { id: builtIn.id } });
      expect(persisted.isActive).to.be.true;
      expect(persisted.isDeprecated).to.be.false;
    });

    it('should not deactivate custom profiles owned by another FWCloud', async () => {
      const otherFwCloud = await db
        .getSource()
        .manager.getRepository(FwCloud)
        .save({ name: StringHelper.randomize(10), locked: false, locked_by: null });
      const foreign = await repository.save(
        makeProfile({ code: `${codePrefix}foreign-delete`, fwCloudId: otherFwCloud.id }),
      );

      await request(app.express)
        .delete(deleteUrl(foreign.code, foreign.version))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(404);

      const persisted = await repository.findOneOrFail({ where: { id: foreign.id } });
      expect(persisted.isActive).to.be.true;
      expect(persisted.isDeprecated).to.be.false;
    });

    it('should reject users without access to the FWCloud', async () => {
      const profile = await repository.save(
        makeProfile({ code: `${codePrefix}forbidden-delete`, fwCloudId: fwCloud.id }),
      );
      const regularUser = await createUser({ role: 0 });
      const regularUserSessionId = generateSession(regularUser);

      await request(app.express)
        .delete(deleteUrl(profile.code, profile.version))
        .set('Cookie', [attachSession(regularUserSessionId)])
        .expect(403);

      const persisted = await repository.findOneOrFail({ where: { id: profile.id } });
      expect(persisted.isActive).to.be.true;
    });

    it('should audit the deactivation with the previous and new state', async () => {
      await db
        .getSource()
        .manager.getRepository(AuditLog)
        .delete({ call: PROFILE_DEACTIVATION_AUDIT_CALL });
      const profile = await repository.save(
        makeProfile({ code: `${codePrefix}audited-delete`, version: 3, fwCloudId: fwCloud.id }),
      );

      await request(app.express)
        .delete(deleteUrl(profile.code, profile.version))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200);

      const entries = await db
        .getSource()
        .manager.getRepository(AuditLog)
        .find({ where: { call: PROFILE_DEACTIVATION_AUDIT_CALL } });

      expect(entries).to.have.length(1);
      expect(entries[0].userId).to.be.eq(adminUser.id);
      expect(entries[0].fwCloudId).to.be.eq(fwCloud.id);

      const data = JSON.parse(entries[0].data);
      expect(data.profileId).to.be.eq(profile.id);
      expect(data.profileCode).to.be.eq(profile.code);
      expect(data.profileVersion).to.be.eq(profile.version);
      expect(data.operation).to.be.eq('deactivate');
      expect(data.previous).to.deep.eq({ isActive: true, isDeprecated: false });
      expect(data.current).to.deep.eq({ isActive: false, isDeprecated: true });

      await db
        .getSource()
        .manager.getRepository(AuditLog)
        .delete({ call: PROFILE_DEACTIVATION_AUDIT_CALL });
    });

    it('should reject applying a profile after it has been deactivated', async () => {
      const profile = await repository.save(
        makeProfile({ code: `${codePrefix}deactivated-apply`, fwCloudId: fwCloud.id }),
      );
      const firewallRepository = db.getSource().manager.getRepository(Firewall);
      const sourceFirewall = await firewallRepository.save({
        name: StringHelper.randomize(10),
        fwCloudId: fwCloud.id,
      });
      const targetFirewall = await firewallRepository.save({
        name: StringHelper.randomize(10),
        fwCloudId: fwCloud.id,
      });

      await request(app.express)
        .delete(deleteUrl(profile.code, profile.version))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200);

      await request(app.express)
        .post(`/fwclouds/${fwCloud.id}/assistant/profiles/${profile.code}/${profile.version}/apply`)
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          sourceProfile: { firewallId: sourceFirewall.id, interfaceRoles: {} },
          target: { kind: 'firewall', id: targetFirewall.id },
          interfaceRoleMapping: {},
          mode: 'dry_run',
        })
        .expect(422);
    });
  });

  describe('POST /fwclouds/:fwcloud/assistant/profiles/:code/:version/apply', () => {
    let sourceFirewall: Firewall;
    let targetFirewall: Firewall;
    let profile: ReplicationProfile;

    const applyBody = () => ({
      sourceProfile: {
        firewallId: sourceFirewall.id,
        interfaceRoles: {},
      },
      target: { kind: 'firewall', id: targetFirewall.id },
      interfaceRoleMapping: {},
      mode: 'dry_run',
    });

    const applyUrl = (code: string = profile.code, version: number = profile.version) =>
      `/fwclouds/${fwCloud.id}/assistant/profiles/${code}/${version}/apply`;

    beforeEach(async () => {
      profile = await repository.save(makeProfile({ code: `${codePrefix}apply` }));

      const firewallRepository = db.getSource().manager.getRepository(Firewall);
      sourceFirewall = await firewallRepository.save({
        name: StringHelper.randomize(10),
        fwCloudId: fwCloud.id,
      });
      targetFirewall = await firewallRepository.save({
        name: StringHelper.randomize(10),
        fwCloudId: fwCloud.id,
      });

      await db
        .getSource()
        .manager.getRepository(AuditLog)
        .delete({ call: PROFILE_APPLICATION_AUDIT_CALL });
    });

    it('should reject guest users', async () => {
      await request(app.express).post(applyUrl()).send(applyBody()).expect(401);
    });

    it('should reject users without access to the FWCloud', async () => {
      const regularUser = await createUser({ role: 0 });
      const regularUserSessionId = generateSession(regularUser);

      await request(app.express)
        .post(applyUrl())
        .set('Cookie', [attachSession(regularUserSessionId)])
        .send(applyBody())
        .expect(401);
    });

    it('should allow users with access to the FWCloud', async () => {
      const regularUser = await createUser({ role: 0 });
      regularUser.fwClouds = [fwCloud];
      await db.getSource().manager.getRepository(User).save(regularUser);
      const regularUserSessionId = generateSession(regularUser);

      await request(app.express)
        .post(applyUrl())
        .set('Cookie', [attachSession(regularUserSessionId)])
        .send(applyBody())
        .expect(200)
        .then((response) => {
          expect(response.body.data.mode).to.be.eq('dry_run');
          expect(response.body.data.applied).to.be.false;
        });
    });

    it('should audit the application attempt', async () => {
      await request(app.express)
        .post(applyUrl())
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send(applyBody())
        .expect(200);

      const entries = await db
        .getSource()
        .manager.getRepository(AuditLog)
        .find({ where: { call: PROFILE_APPLICATION_AUDIT_CALL } });

      expect(entries).to.have.length(1);
      expect(entries[0].userId).to.be.eq(adminUser.id);
      expect(entries[0].fwCloudId).to.be.eq(fwCloud.id);

      const data = JSON.parse(entries[0].data);
      expect(data.profileCode).to.be.eq(profile.code);
      expect(data.status).to.be.eq('success');
    });

    it('should not leak transient wizard credentials into any audit log entry', async () => {
      const secretMarker = `e2e-wizard-secret-${Date.now()}`;

      await request(app.express)
        .post(applyUrl())
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          ...applyBody(),
          credentials: { username: 'root', password: secretMarker },
        })
        .expect(200);

      const leakedRows = await db
        .getSource()
        .query('SELECT COUNT(*) AS n FROM audit_logs WHERE data LIKE ? OR `desc` LIKE ?', [
          `%${secretMarker}%`,
          `%${secretMarker}%`,
        ]);
      expect(Number(leakedRows[0].n)).to.be.eq(0);
    });

    it('should reject invalid bodies', async () => {
      await request(app.express)
        .post(applyUrl())
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({ ...applyBody(), mode: 'invalid-mode' })
        .expect(422);
    });

    it('should return 404 for unknown profiles', async () => {
      await request(app.express)
        .post(applyUrl(`${codePrefix}missing`, 9))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send(applyBody())
        .expect(404);
    });

    it('should reject disabled profiles', async () => {
      const disabledProfile = await repository.save(
        makeProfile({ code: `${codePrefix}disabled`, isActive: false }),
      );

      await request(app.express)
        .post(applyUrl(disabledProfile.code, disabledProfile.version))
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send(applyBody())
        .expect(422);
    });
  });
});
