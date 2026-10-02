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

import { describeName, expect, testSuite } from '../../mocha/global-setup';
import { Application } from '../../../src/Application';
import request = require('supertest');
import { _URL } from '../../../src/fonaments/http/router/router.service';

let app: Application;

describe(describeName('MaintenanceMiddleware E2E test'), () => {
  let originalMaintenanceMode: boolean;

  beforeEach(async () => {
    app = testSuite.app;
    originalMaintenanceMode = app.config.get('maintenance_mode');
  });

  afterEach(() => {
    app.config.set('maintenance_mode', originalMaintenanceMode);
  });

  it('should return 503 if the application is in maintenance mode', async () => {
    app.config.set('maintenance_mode', true);

    await request(app.express).post(_URL().getURL('versions.show')).expect(503);
  });

  it('does not leave subsequent login requests in maintenance mode', async () => {
    expect(app.config.get('maintenance_mode')).to.eq(false);
    // Invalid login input must reach validation rather than maintenance rejection.
    await request(app.express).post('/user/login').send({}).expect(400);
  });
});
