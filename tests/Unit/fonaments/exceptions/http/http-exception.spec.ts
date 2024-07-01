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

import { AbstractApplication } from '../../../../../src/fonaments/abstract-application';
import { HttpException } from '../../../../../src/fonaments/exceptions/http/http-exception';
import {
  expect,
  testSuite,
  describeName,
} from '../../../../mocha/global-setup';
import sinon from 'sinon';

let app: AbstractApplication;

describe(describeName('HttpException Unit tests'), () => {
  beforeEach(async () => {
    app = testSuite.app;
  });

  describe('toResponse()', () => {
    it('should return the stack if the app is not in prod mode', () => {
      const error = new HttpException();

      expect(error.toResponse()).to.haveOwnProperty('stack');
    });

    it('should not return the stack if the app is in prod mode', () => {
      const error = new HttpException();

      const stub: sinon.SinonStub = sinon
        .stub(app.config, 'get')
        .returns('prod');

      expect(error.toResponse()).not.to.haveOwnProperty('stack');

      stub.restore();
    });
  });
});
