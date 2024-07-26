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

import { RequestInputs } from '../../../../src/fonaments/http/request-inputs';
import { expect, describeName } from '../../../mocha/global-setup';

describe(describeName('Request tests'), () => {
  describe('all()', () => {
    it('All inputs from req.body should be listed in the inputs', () => {
      const req: any = {
        body: {
          testInput: 'testInput',
          testInput2: 'testInput2',
        },
      };

      const request = new RequestInputs(req);
      expect(request.all()).to.be.deep.equal({
        testInput: 'testInput',
        testInput2: 'testInput2',
      });
    });
  });

  describe('has()', () => {
    it('should return false if an input does not exist', () => {
      const req: any = {
        body: {},
        query: {},
      };

      const request = new RequestInputs(req);

      expect(request.has('testInput2')).to.be.false;
    });

    it('should return true if an input does exist', () => {
      const req: any = {
        body: {
          testInput: 'testInput',
        },
        query: {},
      };

      const request = new RequestInputs(req);

      expect(request.has('testInput')).to.be.true;
    });

    it('should return true if the query parameter exists', () => {
      const req: any = {
        query: {
          testInput2: 'testInput2',
        },
        body: {
          testInput: 'testInput',
        },
      };

      const request = new RequestInputs(req);

      expect(request.has('testInput2')).to.be.true;
    });
  });

  describe('get()', () => {
    it('should return the value if the input exists', () => {
      const req: any = {
        body: {
          testInput: 'testInput',
        },
        query: {},
      };

      const request = new RequestInputs(req);

      expect(request.get('testInput')).to.be.deep.equal('testInput');
    });

    it('should return undefined if the input does not exists', () => {
      const req: any = {
        body: {},
        query: {},
      };

      const request = new RequestInputs(req);

      expect(request.get('testInput2')).to.be.undefined;
    });

    it('should return a default value if the input does not exists and a default value is provided', () => {
      const req: any = {
        body: {},
        query: {},
      };

      const request = new RequestInputs(req);

      expect(request.get('testInput2', 'defaultValue')).to.be.deep.equal('defaultValue');
    });
  });
});
