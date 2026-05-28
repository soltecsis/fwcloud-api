import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
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
  });
});
