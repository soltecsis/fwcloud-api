import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import db from '../../../../src/database/database-manager';
import defaultReplicationProfile from '../../../../src/models/replication-profile/presets/default-replication-profile.v1.json';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import {
  ProfileSecretPersistenceError,
  assertProfileDefinitionHasNoSecrets,
  findSecretLikePaths,
  isSecretLikeKey,
} from '../../../../src/models/replication-profile/replication-profile-secret.guard';
import {
  getReplicationProfileTemplatesDirectory,
  loadReplicationProfileModel,
  ReplicationProfileTemplateException,
  resolveReplicationProfileTemplatePath,
  writeReplicationProfileModel,
} from '../../../../src/models/replication-profile/replication-profile-template';
import { expectThrownAs } from '../../../utils/assertions';
import {
  makeReplicationProfileFixture,
  readVersionedReplicationProfileTemplate,
  replicationProfileFixtureTemplate,
  templateExists,
  writeRawReplicationProfileTemplate,
} from '../../../utils/replication-profile-fixtures';
import * as fs from 'fs';
import { Repository } from 'typeorm';

describe(describeName('Replication Profile Secret Guard Unit Tests'), () => {
  before(async () => {
    testSuite.app;
    await testSuite.resetDatabaseData();
  });

  describe('isSecretLikeKey()', () => {
    it('should detect the forbidden persisted field names', () => {
      for (const key of ['password', 'token', 'apiKey', 'privateKey', 'sshKey', 'secret']) {
        expect(isSecretLikeKey(key), key).to.be.true;
      }
    });

    it('should detect case and separator variants', () => {
      for (const key of ['PASSWORD', 'api_key', 'Access_Key', 'clientSecret', 'ssh_key', 'OTP']) {
        expect(isSecretLikeKey(key), key).to.be.true;
      }
    });

    it('should not flag regular profile definition keys', () => {
      for (const key of ['name', 'interfaces', 'policyRules', 'overwriteExisting', 'targetKind']) {
        expect(isSecretLikeKey(key), key).to.be.false;
      }
    });
  });

  describe('findSecretLikePaths()', () => {
    it('should find secret-like keys nested in objects and arrays', () => {
      const paths = findSecretLikePaths({
        replicate: { firewall: { interfaces: true } },
        options: { credentials: { user: 'x' } },
        hosts: [{ name: 'fw1', sshKey: '---' }],
      });

      expect(paths).to.have.members(['options.credentials', 'hosts[0].sshKey']);
    });

    it('should return an empty list for plain values and clean definitions', () => {
      expect(findSecretLikePaths(null)).to.deep.eq([]);
      expect(findSecretLikePaths('password')).to.deep.eq([]);
      expect(findSecretLikePaths({ replicate: {}, options: {} })).to.deep.eq([]);
    });
  });

  describe('assertProfileDefinitionHasNoSecrets()', () => {
    it('should throw a readable error listing the offending fields', () => {
      expect(() =>
        assertProfileDefinitionHasNoSecrets({ options: { password: 'x', apiKey: 'y' } }),
      ).to.throw(
        ProfileSecretPersistenceError,
        /must not contain credentials or secrets.*options\.password.*options\.apiKey/,
      );
    });
  });

  describe('shipped definitions', () => {
    it('should not contain secret-like fields in the shipped presets and templates', () => {
      const templates = fs
        .readdirSync(getReplicationProfileTemplatesDirectory())
        .filter((fileName) => fileName.endsWith('.json'));

      expect(templates).to.include(defaultReplicationProfile.path);
      expect(findSecretLikePaths(defaultReplicationProfile)).to.deep.eq([]);
      for (const fileName of templates) {
        expect(
          findSecretLikePaths(readVersionedReplicationProfileTemplate(fileName)),
          fileName,
        ).to.deep.eq([]);
      }
    });
  });

  describe('profile templates', () => {
    let repository: Repository<ReplicationProfile>;
    let code: string;

    const makeProfile = (model: Record<string, unknown>): ReplicationProfile =>
      makeReplicationProfileFixture({ code, name: 'Secret guard test profile', model });

    beforeEach(() => {
      repository = db.getSource().manager.getRepository(ReplicationProfile);
      code = `secret-guard-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    });

    it('should reject writing a template whose definition contains secrets', () => {
      expect(() => makeProfile({ options: { password: 'super-secret' } })).to.throw(
        ProfileSecretPersistenceError,
      );
      expect(templateExists(replicationProfileFixtureTemplate({ code }))).to.be.false;
    });

    it('should reject overwriting a template with secret-like fields', async () => {
      const profile = await repository.save(makeProfile({ replicate: {}, options: {} }));

      expect(() =>
        writeReplicationProfileModel(profile, {
          options: { sshKey: '-----BEGIN OPENSSH PRIVATE KEY-----' },
        }),
      ).to.throw(ProfileSecretPersistenceError);

      const template = fs.readFileSync(resolveReplicationProfileTemplatePath(profile), 'utf8');
      expect(template).not.to.contain('OPENSSH PRIVATE KEY');
      expect(loadReplicationProfileModel(profile)).to.deep.eq({ replicate: {}, options: {} });

      await repository.delete(profile.id);
    });

    it('should keep accepting clean profile definitions', async () => {
      const profile = await repository.save(
        makeProfile({ replicate: { firewall: { policyRules: true } }, options: {} }),
      );

      expect(profile.id).to.be.a('number');
      expect(loadReplicationProfileModel(profile)).to.deep.eq({
        replicate: { firewall: { policyRules: true } },
        options: {},
      });

      await repository.delete(profile.id);
    });

    it('should reject loading a template edited to contain secrets', async () => {
      const profile = await repository.save(makeProfile({ replicate: {}, options: {} }));
      writeRawReplicationProfileTemplate(
        profile,
        JSON.stringify({ replicate: {}, options: { apiKey: 'leaked' } }),
      );

      const error = expectThrownAs(
        () => loadReplicationProfileModel(profile),
        ReplicationProfileTemplateException,
      );
      expect(error.reason).to.be.eq('invalid_model');

      await repository.delete(profile.id);
    });
  });
});
