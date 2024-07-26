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

import { describeName, testSuite, playgroundPath, expect } from '../../mocha/global-setup';
import { Application } from '../../../src/Application';
import * as fs from 'fs';
import * as path from 'path';
import { FSHelper } from '../../../src/utils/fs-helper';
import { DatabaseService } from '../../../src/database/database.service';

describe(describeName('Application Unit Test'), () => {
  let app: Application;

  beforeEach(() => {
    app = testSuite.app;
  });

  describe('getVersion()', () => {
    it('tag should be the version provided in the package.json', async () => {
      fs.writeFileSync(
        path.join(playgroundPath, 'package.json'),
        JSON.stringify({ version: '100.0.0' }),
      );
      const _app: Application = await Application.run(playgroundPath);

      expect(_app.version.tag).to.be.deep.eq('100.0.0');
    });

    it('schema version should be the migration version directory', async () => {
      const directory: string = path.join(playgroundPath, 'migrations');
      FSHelper.mkdirSync(path.join(directory, '100.100.100'));
      const databaseService: DatabaseService = await app.getService<DatabaseService>(
        DatabaseService.name,
      );
      databaseService['_config'].migration_directory = directory;

      expect(await databaseService.getSchemaVersion()).to.be.deep.eq('100.100.100');
    });

    it('schema version should be the last version migration directory', async () => {
      const directory: string = path.join(playgroundPath, 'migrations');

      FSHelper.mkdirSync(path.join(directory, '1.0.0'));
      FSHelper.mkdirSync(path.join(directory, '1.0.1'));

      const databaseService: DatabaseService = await app.getService<DatabaseService>(
        DatabaseService.name,
      );
      databaseService['_config'].migration_directory = directory;

      expect(await databaseService.getSchemaVersion()).to.be.deep.eq('1.0.1');
    });
  });
});
