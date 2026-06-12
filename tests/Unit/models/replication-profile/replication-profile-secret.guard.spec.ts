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

  describe('preset definitions', () => {
    it('should not contain secret-like fields in the shipped presets', () => {
      expect(findSecretLikePaths(defaultReplicationProfile)).to.deep.eq([]);
    });
  });

  describe('profile persistence', () => {
    let repository: Repository<ReplicationProfile>;

    const makeProfile = (model: Record<string, unknown>): ReplicationProfile =>
      repository.create({
        code: `secret-guard-${Date.now()}-${Math.round(Math.random() * 100000)}`,
        version: 1,
        name: 'Secret guard test profile',
        description: null,
        scope: 'generic',
        targetKind: 'firewall',
        model,
        isBuiltin: false,
        isActive: true,
        isDeprecated: false,
      });

    beforeEach(() => {
      repository = db.getSource().manager.getRepository(ReplicationProfile);
    });

    it('should reject inserting a profile whose definition contains secrets', async () => {
      await expect(
        repository.save(makeProfile({ options: { password: 'super-secret' } })),
      ).to.be.rejectedWith(ProfileSecretPersistenceError);

      const persisted = await db
        .getSource()
        .query("SELECT COUNT(*) AS n FROM replication_profiles WHERE model LIKE '%super-secret%'");
      expect(Number(persisted[0].n)).to.be.eq(0);
    });

    it('should reject updating a profile definition with secret-like fields', async () => {
      const profile = await repository.save(makeProfile({ replicate: {}, options: {} }));

      profile.model = { options: { sshKey: '-----BEGIN OPENSSH PRIVATE KEY-----' } };

      await expect(repository.save(profile)).to.be.rejectedWith(ProfileSecretPersistenceError);

      const persisted = await db
        .getSource()
        .query('SELECT model FROM replication_profiles WHERE id = ?', [profile.id]);
      expect(persisted[0].model).not.to.contain('OPENSSH PRIVATE KEY');
    });

    it('should keep accepting clean profile definitions', async () => {
      const profile = await repository.save(
        makeProfile({ replicate: { firewall: { policyRules: true } }, options: {} }),
      );

      expect(profile.id).to.be.a('number');

      await repository.delete(profile.id);
    });
  });
});
