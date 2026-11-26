import { expect } from 'chai';
import { UserRole } from '../../../src/models/user/user-role';
const shared = require('../../../src/middleware/joi_schemas/shared');

describe('User role input schema', () => {
  for (const role of [UserRole.Administrator, UserRole.Manager, UserRole.Viewer]) {
    it(`accepts the explicit role ${role}`, () => {
      expect(shared.role.validate(role, { convert: false }).error).to.equal(undefined);
    });
  }
  for (const role of [0, -1, 4, 1.5, '3', null]) {
    it(`rejects invalid role ${JSON.stringify(role)}`, () => {
      expect(shared.role.validate(role, { convert: false }).error).not.to.equal(undefined);
    });
  }
});
