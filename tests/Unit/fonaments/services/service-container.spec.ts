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

import { ServiceContainer } from '../../../../src/fonaments/services/service-container';
import { Application } from '../../../../src/Application';
import { Service } from '../../../../src/fonaments/services/service';
import { AbstractApplication } from '../../../../src/fonaments/abstract-application';
import { testSuite, expect, describeName } from '../../../mocha/global-setup';
import StringHelper from '../../../../src/utils/string.helper';

let app: Application;
before(async () => {
  app = testSuite.app;
});

class TestService extends Service {
  public tag: string;
}

describe(describeName('Service container tests'), () => {
  describe('bind()', () => {
    it('should include a service reference into the services array', async () => {
      const sc = new ServiceContainer(app);

      sc.bind(TestService.name, null);

      expect(sc.services).to.be.deep.equal([
        {
          singleton: false,
          name: 'TestService',
          target: null,
          instance: null,
        },
      ]);
    });
  });

  describe('singleton()', () => {
    it('should include a service reference with an instance', async () => {
      const sc = new ServiceContainer(app);
      sc.singleton<TestService>(TestService.name, async (app: AbstractApplication) => {
        return await TestService.make(app);
      });

      expect(await sc.get<TestService>('TestService')).to.be.deep.equal(
        await TestService.make(app),
      );
    });
  });

  describe('get()', () => {
    it('should return an instance of the service if the service has been registered using bind', async () => {
      const sc = new ServiceContainer(app);
      sc.bind(TestService.name, async (app: AbstractApplication) => await TestService.make(app));

      expect(await sc.get(TestService.name)).to.be.deep.equal(await TestService.make(app));
    });

    it('should return the instance of the service if the service has been registered using singleton', async () => {
      const sc = new ServiceContainer(app);

      sc.singleton(TestService.name, async (app: AbstractApplication) => {
        const c: TestService = await TestService.make(app);
        c.tag = StringHelper.randomize(10);
        return c;
      });

      expect((await sc.get<TestService>(TestService.name)).tag).to.be.deep.equal(
        (await sc.get<TestService>(TestService.name)).tag,
      );
    });

    it('should return a new instance of the service if the service is not singleton', async () => {
      const sc = new ServiceContainer(app);

      sc.bind(TestService.name, async (app: AbstractApplication) => {
        const c: TestService = await TestService.make(app);
        c.tag = StringHelper.randomize(10);
        return c;
      });

      expect((await sc.get<TestService>(TestService.name)).tag).not.be.deep.equal(
        (await sc.get<TestService>(TestService.name)).tag,
      );
    });
  });
});
