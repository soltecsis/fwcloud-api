/*!
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { describeName, testSuite, expect } from '../../../../mocha/global-setup';
import { Controller } from '../../../../../src/fonaments/http/controller';
import { RouterService } from '../../../../../src/fonaments/http/router/router.service';
import { Route } from '../../../../../src/fonaments/http/router/route';

class TestController extends Controller {
  public async test(request: Request) {}
}

let service: RouterService;
let routeGet: Route;

describe(describeName('RouterService Unit tests'), () => {
  beforeEach(async () => {
    service = await RouterService.make(testSuite.app);
    service.registerRoutes();

    routeGet = new Route();
    routeGet
      .setControllerHandler({ controller: TestController, method: 'test' })
      .setHttpMethod('PUT')
      .setName('ping.pong')
      .setPathParams('/ping');
  });

  describe('getRouteByName()', () => {
    it('should return a route by its name', async () => {
      expect(service.findRouteByName('ping.pong').name).to.be.deep.equal('ping.pong');
    });
  });
});
