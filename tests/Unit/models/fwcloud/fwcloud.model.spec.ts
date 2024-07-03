/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { describeName, testSuite, expect } from '../../../mocha/global-setup';
import { AbstractApplication } from '../../../../src/fonaments/abstract-application';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { FSHelper } from '../../../../src/utils/fs-helper';
import * as fs from 'fs';
import * as path from 'path';
import sinon from 'sinon';
import StringHelper from '../../../../src/utils/string.helper';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';

let app: AbstractApplication;

describe(describeName('FwCloud Unit Tests'), () => {
  let fwc: FwCloudProduct;

  before(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();
    fwc = await new FwCloudFactory().make();
  });

  describe('removeDataDirectories()', () => {
    it('should remove fwcloud pki directory if it exists', async () => {
      const fwCloud: FwCloud = await FwCloud.save(
        FwCloud.create({ name: 'test' }),
      );

      FSHelper.mkdirSync(fwCloud.getPkiDirectoryPath());
      fs.writeFileSync(
        path.join(fwCloud.getPkiDirectoryPath(), 'test'),
        'test',
      );

      fwCloud.removeDataDirectories();

      expect(FSHelper.directoryExistsSync(fwCloud.getPkiDirectoryPath())).to.be
        .false;
    });

    it('should remove fwcloud policy directory if it exists', async () => {
      const fwCloud: FwCloud = await FwCloud.save(
        FwCloud.create({ name: 'test' }),
      );

      FSHelper.mkdirSync(fwCloud.getPolicyDirectoryPath());
      fs.writeFileSync(
        path.join(fwCloud.getPolicyDirectoryPath(), 'test'),
        'test',
      );

      fwCloud.removeDataDirectories();

      expect(FSHelper.directoryExistsSync(fwCloud.getPolicyDirectoryPath())).to
        .be.false;
    });

    it('should not remove data directories if they do not exist', async () => {
      const fwCloud: FwCloud = await FwCloud.save(
        FwCloud.create({ name: 'test' }),
      );

      fwCloud.removeDataDirectories();

      expect(FSHelper.directoryExistsSync(fwCloud.getPolicyDirectoryPath())).to
        .be.false;
      expect(FSHelper.directoryExistsSync(fwCloud.getPkiDirectoryPath())).to.be
        .false;
    });

    it('should be called before remove', async () => {
      const fwCloud: FwCloud = await FwCloud.save(
        FwCloud.create({ name: 'test' }),
      );

      const spy = sinon.spy(FwCloud.prototype, 'removeDataDirectories');

      await fwCloud.remove();

      expect(spy.calledOnce).to.be.true;
    });
  });
  //TODO: review this test
  describe.skip('remove database data', () => {
    it('should remove all database data', async () => {
      let fwCloud = await FwCloud.findOne({ where: { id: fwc.fwcloud.id } });

      expect(fwc.fwcloud.id).to.be.equal(fwCloud.id);

      await fwCloud.remove();

      fwCloud = await FwCloud.findOne({ where: { id: fwc.fwcloud.id } });
      expect(fwCloud).to.be.null;
    });
  });

  describe('create event', () => {
    it('should create the fwcloud data directories', async () => {
      const fwCloud: FwCloud = await FwCloud.save(
        FwCloud.create({
          name: StringHelper.randomize(10),
        }),
      );

      expect(fs.existsSync(fwCloud.getPolicyDirectoryPath())).to.be.true;
      expect(fs.existsSync(fwCloud.getPkiDirectoryPath())).to.be.true;
    });
  });
});
