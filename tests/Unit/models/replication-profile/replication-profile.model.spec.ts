import { describeName, expect } from '../../../mocha/global-setup';
import Model from '../../../../src/models/Model';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';

describe(describeName('Replication Profile Model Unit Tests'), () => {
  describe('_getTableName()', () => {
    it('should return the migrated table name', () => {
      expect(ReplicationProfile._getTableName()).to.be.deep.eq('replication_profiles');
      expect(new ReplicationProfile().getTableName()).to.be.deep.eq('replication_profiles');
    });
  });

  describe('getEntitiyDefinition()', () => {
    it('should expose the entity definition by table name', () => {
      expect(Model.getEntitiyDefinition('replication_profiles')).to.be.deep.eq(ReplicationProfile);
    });
  });

  describe('getOriginalColumnName()', () => {
    it('should map camelCase properties to their database columns', () => {
      expect(ReplicationProfile.getOriginalColumnName('isBuiltin')).to.be.deep.eq('is_built_in');
      expect(ReplicationProfile.getOriginalColumnName('isActive')).to.be.deep.eq('is_active');
      expect(ReplicationProfile.getOriginalColumnName('isDeprecated')).to.be.deep.eq(
        'is_deprecated',
      );
    });
  });
});
