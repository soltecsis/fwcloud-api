import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { PROFILE_APPLICATION_AUDIT_CALL } from '../../../../src/models/replication-profile/profile-application.service';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import { User } from '../../../../src/models/user/User';
import StringHelper from '../../../../src/utils/string.helper';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../../utils/utils';
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
      ...overrides,
    });
  };

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

  describe('GET /fwclouds/:fwcloud/assistant/profiles', () => {
    it('should return active profile summaries with detail data for the wizard', async () => {
      const profile = await repository.save(makeProfile({ code: `${codePrefix}firewall` }));

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
          });
          expect(result.model).to.deep.equal(profile.model);
          expect(result).not.to.have.property('isActive');
          expect(result).not.to.have.property('isDeprecated');
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
              targetKinds: ['cluster'],
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

    it('should reject unknown target kinds', async () => {
      await request(app.express)
        .get(`/fwclouds/${fwCloud.id}/assistant/profiles`)
        .query({ targetKind: 'gateway' })
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(422);
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
