/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import StringHelper from '../../../src/utils/string.helper';
import { expect, describeName } from '../../mocha/global-setup';

describe(describeName('StringHelper Unit Tests'), () => {
  describe('toCamelCase()', () => {
    it('toCamelCase should return empty string if only an empty string is provided', () => {
      expect(StringHelper.toCamelCase('')).to.be.deep.equal('');
    });

    it('toCamelCase should return the same word if only one word is provided', () => {
      expect(StringHelper.toCamelCase('test')).to.be.deep.equal('test');
    });

    it('toCamelCase should return camelcased word', () => {
      expect(StringHelper.toCamelCase('test', 'test')).to.be.deep.equal(
        'testTest',
      );
    });

    it('capitalize should return capitalized word', () => {
      expect(StringHelper.capitalize('test')).to.be.deep.equal('Test');
    });
  });

  describe('randomize()', () => {
    it('should generate a random string', () => {
      const result: string = StringHelper.randomize();

      expect(result).to.be.string;
      expect(result).to.have.length(50);
      expect(StringHelper.randomize()).not.to.be.deep.eq(result);
    });
  });
});
