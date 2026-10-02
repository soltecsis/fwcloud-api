import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import db from '../../../../src/database/database-manager';
import defaultReplicationProfile from '../../../../src/models/replication-profile/presets/default-replication-profile.v1.json';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import { getUserReplicationProfileTemplatesDirectory } from '../../../../src/models/replication-profile/replication-profile-template';
import { Tfa } from '../../../../src/models/user/Tfa';
import { User } from '../../../../src/models/user/User';
import StringHelper from '../../../../src/utils/string.helper';
import {
  makeReplicationProfileFixture,
  templateExists,
} from '../../../utils/replication-profile-fixtures';
import { createUser } from '../../../utils/utils';
import * as fs from 'fs';
import { QueryFailedError, Repository } from 'typeorm';

describe(describeName('User Unit Tests'), () => {
  const CUSTOMER_ID = 1;

  let userRepository: Repository<User>;
  let profileRepository: Repository<ReplicationProfile>;
  let fwCloud: FwCloud;
  let user: User;
  let otherUser: User;

  const makeProfile = (owner: User): Promise<ReplicationProfile> =>
    profileRepository.save(
      makeReplicationProfileFixture({
        code: `user-delete-${StringHelper.randomize(10).toLowerCase()}`,
        userId: owner.id,
        fwCloudId: fwCloud.id,
      }),
    );

  const deleteUser = (target: User, customerId: number = CUSTOMER_ID): Promise<void> =>
    User._delete({ body: { user: target.id, customer: customerId } });

  const countFwCloudAccesses = async (target: User): Promise<number> => {
    const rows = await db
      .getSource()
      .query('SELECT COUNT(*) AS n FROM user__fwcloud WHERE user = ?', [target.id]);

    return Number(rows[0].n);
  };

  before(async () => {
    await testSuite.resetDatabaseData();
  });

  beforeEach(async () => {
    userRepository = db.getSource().manager.getRepository(User);
    profileRepository = db.getSource().manager.getRepository(ReplicationProfile);

    fwCloud = await db
      .getSource()
      .manager.getRepository(FwCloud)
      .save({ name: StringHelper.randomize(10), locked: false, locked_by: null });

    user = await createUser({ role: 0 });
    otherUser = await createUser({ role: 0 });
    user.fwClouds = [fwCloud];
    otherUser.fwClouds = [fwCloud];
    await userRepository.save([user, otherUser]);
  });

  describe('_delete()', () => {
    it('should remove the user and their access to FWClouds', async () => {
      await deleteUser(user);

      expect(await userRepository.findOne({ where: { id: user.id } })).to.be.null;
      expect(await countFwCloudAccesses(user)).to.be.eq(0);
      expect(await userRepository.findOne({ where: { id: otherUser.id } })).not.to.be.null;
      expect(await countFwCloudAccesses(otherUser)).to.be.eq(1);
    });

    it('should remove the custom replication profiles of the user with their templates', async () => {
      const owned = [await makeProfile(user), await makeProfile(user)];
      const templatesDirectory = getUserReplicationProfileTemplatesDirectory(user.id);

      expect(owned.every((profile) => templateExists(profile))).to.be.true;

      await deleteUser(user);

      expect(await userRepository.findOne({ where: { id: user.id } })).to.be.null;
      expect(await profileRepository.count({ where: { userId: user.id } })).to.be.eq(0);
      expect(owned.some((profile) => templateExists(profile))).to.be.false;
      expect(fs.existsSync(templatesDirectory)).to.be.false;
    });

    it('should keep the built-in profiles and the custom profiles of other users', async () => {
      await makeProfile(user);
      const foreign = await makeProfile(otherUser);

      await deleteUser(user);

      expect(await profileRepository.findOne({ where: { id: foreign.id } })).not.to.be.null;
      expect(templateExists(foreign)).to.be.true;
      expect(
        await profileRepository.findOne({
          where: {
            code: defaultReplicationProfile.code,
            version: defaultReplicationProfile.version,
            isBuiltin: true,
          },
        }),
      ).not.to.be.null;
    });

    it('should not remove anything of a user that belongs to another customer', async () => {
      const owned = await makeProfile(user);

      await deleteUser(user, CUSTOMER_ID + 1);

      expect(await userRepository.findOne({ where: { id: user.id } })).not.to.be.null;
      expect(await countFwCloudAccesses(user)).to.be.eq(1);
      expect(await profileRepository.findOne({ where: { id: owned.id } })).not.to.be.null;
      expect(templateExists(owned)).to.be.true;
    });

    it('should keep the profiles and FWClouds of a user that cannot be removed', async () => {
      const owned = await makeProfile(user);
      // Two-factor authentication data restricts the removal of its user.
      await db.getSource().manager.getRepository(Tfa).save({
        userId: user.id,
        secret: 'secret',
        tempSecret: '',
        dataURL: '',
        tfaURL: '',
      });

      await expect(deleteUser(user)).to.be.rejectedWith(QueryFailedError);

      expect(await userRepository.findOne({ where: { id: user.id } })).not.to.be.null;
      expect(await countFwCloudAccesses(user)).to.be.eq(1);
      expect(await profileRepository.findOne({ where: { id: owned.id } })).not.to.be.null;
      expect(templateExists(owned)).to.be.true;
    });
  });
});
