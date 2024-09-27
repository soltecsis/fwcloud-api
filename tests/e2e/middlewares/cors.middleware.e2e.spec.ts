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

import { describeName, testSuite, expect } from '../../mocha/global-setup';
import { Application } from '../../../src/Application';
import request = require('supertest');
import { _URL } from '../../../src/fonaments/http/router/router.service';
import sinon from 'sinon';
import { CORS } from '../../../src/middleware/cors.middleware';

let app: Application;
describe(describeName('CORSMiddleware E2E test'), () => {
  beforeEach(async () => {
    app = testSuite.app;
  });

  it('should return 400 when request is rejected by CORS', async () => {
    const stub = sinon.stub(CORS.prototype, 'isOriginAllowed').returns(false);

    await request(app.express)
      .post(_URL().getURL('versions.show'))
      .expect(400)
      .expect((response) => {
        expect(response.body.message).to.contains('Not allowed by CORS:');
      });

    stub.restore();
  });

  it('should not return 400 when request is allowed by CORS', async () => {
    const stub = sinon.stub(CORS.prototype, 'isOriginAllowed').returns(true);

    await request(app.express).post(_URL().getURL('versions.show')).expect(401);

    stub.restore();
  });
});
