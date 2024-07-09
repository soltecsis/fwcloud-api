/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { describeName, expect } from '../../mocha/global-setup';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import Model from '../../../src/models/Model';
import { PolicyRuleToOpenVPN } from '../../../src/models/policy/PolicyRuleToOpenVPN';
import { Ca } from '../../../src/models/vpn/pki/Ca';
import { PolicyRule } from '../../../src/models/policy/PolicyRule';

describe(describeName('Model Unit Tests'), () => {
  describe('_getTableName()', () => {
    it('should return the entity table name', () => {
      expect(FwCloud._getTableName()).to.be.deep.eq('fwcloud');
    });

    it('should return null if the entitiy does not have a table assigned', () => {
      class SampleEntity extends Model {
        public getTableName(): string {
          return '';
        }
      }

      expect(SampleEntity._getTableName()).to.be.null;
    });
  });

  describe('getEntityDefinition()', () => {
    it('should return the entity', () => {
      expect(Model.getEntitiyDefinition('fwcloud').constructor.name).to.be.eq(
        FwCloud.constructor.name,
      );
      expect(Model.getEntitiyDefinition('fwcloud', 'FwCloud').constructor.name).to.be.eq(
        FwCloud.constructor.name,
      );
    });

    it('should return null if the entity does not exist', () => {
      expect(Model.getEntitiyDefinition('noexist')).to.be.null;
    });
  });

  describe('getEntitiyColumns()', () => {
    const data = FwCloud.getEntityColumns().map((item) => item.propertyName);
    expect(FwCloud.getEntityColumns().map((item) => item.propertyName)).to.be.deep.eq([
      'id',
      'name',
      'created_at',
      'updated_at',
      'created_by',
      'updated_by',
      'locked_at',
      'locked_by',
      'locked',
      'image',
      'comment',
    ]);
  });

  describe('getPrimaryKeys()', () => {
    it('should return an array of columnsMetadataArgs', () => {
      expect(PolicyRuleToOpenVPN.getPrimaryKeys()).to.have.length(3);
      expect(PolicyRuleToOpenVPN.getPrimaryKeys().map((item) => item.propertyName)).to.be.deep.eq([
        'policyRuleId',
        'openVPNId',
        'policyPositionId',
      ]);
    });
  });

  describe('getPrimaryKey()', () => {
    it('should return a column metadata instance if the propertyName is primary key', () => {
      expect(PolicyRuleToOpenVPN.getPrimaryKey('policyRuleId')).not.to.be.null;
      expect(PolicyRuleToOpenVPN.getPrimaryKey('policyRuleId').options.primary).to.be.true;
    });

    it('should return null if the propertyName is not primary key', () => {
      expect(PolicyRuleToOpenVPN.getPrimaryKey('updated_at')).to.be.null;
    });

    it('should return null if the propertyName is not a column', () => {
      expect(PolicyRuleToOpenVPN.getPrimaryKey('other_column')).to.be.null;
    });
  });

  describe('isPrimaryKey()', () => {
    it('should return true if the propertyName is a primary key', () => {
      expect(PolicyRuleToOpenVPN.isPrimaryKey('policyRuleId')).to.be.true;
      expect(PolicyRuleToOpenVPN.isPrimaryKey('openVPNId')).to.be.true;
      expect(PolicyRuleToOpenVPN.isPrimaryKey('policyPositionId')).to.be.true;
      expect(PolicyRuleToOpenVPN.isPrimaryKey('inventedColumnName')).to.be.false;
      expect(PolicyRuleToOpenVPN.isPrimaryKey('updated_at')).to.be.false;
    });
  });

  describe('isForeignKey()', () => {
    it('should return whether a propertyName is foreignKey', () => {
      expect(Ca.isForeignKey('fwCloudId')).to.be.true;
      expect(Ca.isForeignKey('cn')).to.be.false;
    });

    it('should return true if the property is also a primary key', () => {
      expect(PolicyRuleToOpenVPN.isForeignKey('policyRuleId')).to.be.true;
    });
  });

  describe('getJoinColumns()', () => {
    it('should return the properties which are join columns', () => {
      expect(PolicyRuleToOpenVPN.getJoinColumns().map((item) => item.propertyName)).to.be.deep.eq([
        'policyPosition',
        'openVPN',
        'policyRule',
      ]);
    });
  });

  describe('getJoinTables()', () => {
    it('should return the properties which are join tables', () => {
      expect(FwCloud.getJoinTables().map((item) => item.propertyName)).to.be.deep.eq(['users']);
    });
  });

  describe('isJoinTable()', () => {
    it('should return whether the property is a join table', () => {
      expect(FwCloud.isJoinTable('users')).to.be.true;
      expect(PolicyRuleToOpenVPN.isJoinTable('policyPosition')).to.be.false;
    });
  });

  describe('isJoinColumn()', () => {
    it('should return whether the property is a join column', () => {
      expect(FwCloud.isJoinColumn('users')).to.be.false;
      expect(PolicyRuleToOpenVPN.isJoinColumn('policyPosition')).to.be.true;
    });
  });

  describe('getOriginalColumnName()', () => {
    it('should return the property column name if it is mapped', () => {
      expect(PolicyRuleToOpenVPN.getOriginalColumnName('policyRuleId')).to.be.deep.eq('rule');
    });

    it('should return the same name if the property is not mapped', () => {
      expect(PolicyRuleToOpenVPN.getOriginalColumnName('updated_at')).to.be.deep.eq('updated_at');
    });
  });

  describe('getRelationFromForeignKey()', () => {
    it('should return the foreign key relation', () => {
      expect(
        (<any>PolicyRuleToOpenVPN.getRelationFromPropertyName('policyRuleId').type)(),
      ).to.be.deep.eq(PolicyRule);
    });
  });
});
