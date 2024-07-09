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
import { RouterService } from '../../../../../src/fonaments/http/router/router.service';
import { URLHelper } from '../../../../../src/fonaments/http/router/url-helper';

let service: RouterService;
let routing: URLHelper;

describe(describeName('URL tests'), () => {
  beforeEach(async () => {
    service = await RouterService.make(testSuite.app);
    service.registerRoutes();
    routing = new URLHelper(service);
  });

  describe('getRouteByName()', () => {
    it('should return a route by its name', async () => {
      expect(routing.getURL('ping.pong')).to.be.deep.eq('/ping');
    });
  });
});
