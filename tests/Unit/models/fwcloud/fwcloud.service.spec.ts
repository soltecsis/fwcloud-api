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

import { AbstractApplication } from '../../../../src/fonaments/abstract-application';
import { describeName, testSuite, expect } from '../../../mocha/global-setup';
import { FwCloudService } from '../../../../src/models/fwcloud/fwcloud.service';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { getRepository } from 'typeorm';
import StringHelper from '../../../../src/utils/string.helper';
import { createUser } from '../../../utils/utils';
import { FwcTree } from '../../../../src/models/tree/fwc-tree.model';

let app: AbstractApplication;
let service: FwCloudService;

describe(describeName('FwCloudService Unit tests'), async () => {
  beforeEach(async () => {
    app = testSuite.app;
    service = await app.getService<FwCloudService>(FwCloudService.name);
  });

  describe('Bootstrap', () => {
    it('service is instantiated in during bootstrap process', async () => {
      expect(
        await app.getService<FwCloudService>(FwCloudService.name),
      ).to.be.instanceof(FwCloudService);
    });
  });

  describe('store()', () => {
    it('should create a fwcloud', async () => {
      const fwCloud: FwCloud = await service.store({
        name: StringHelper.randomize(10),
      });

      expect(await getRepository(FwCloud).findOne(fwCloud.id)).not.to.be.null;
    });

    it('should grant access to all admin users', async () => {
      const admin = await createUser({ role: 1 });
      const regular = await createUser({ role: 0 });

      let fwCloud: FwCloud = await service.store({
        name: StringHelper.randomize(10),
      });

      fwCloud = await getRepository(FwCloud).findOne(fwCloud.id, {
        relations: ['users'],
      });

      expect(
        fwCloud.users.filter((user) => user.id === regular.id),
      ).to.have.length(0);
      expect(
        fwCloud.users.filter((user) => user.id === admin.id),
      ).to.have.length(1);
    });

    it('should create the fwcloud tree node', async () => {
      const fwCloud: FwCloud = await service.store({
        name: StringHelper.randomize(10),
      });

      expect(
        await getRepository(FwcTree).find({
          where: {
            fwCloudId: fwCloud.id,
          },
        }),
      ).not.to.have.length(0);
    });
  });

  describe('update()', () => {
    let fwCloud: FwCloud;

    beforeEach(async () => {
      fwCloud = await getRepository(FwCloud)
        .create({
          name: StringHelper.randomize(10),
        })
        .save();
    });

    it('should update a fwcloud', async () => {
      const newName: string = StringHelper.randomize(10);
      const newComment: string = StringHelper.randomize(10);

      await service.update(fwCloud, {
        name: newName,
        comment: newComment,
      });

      fwCloud = await FwCloud.findOne(fwCloud.id);

      expect(fwCloud.name).to.be.eq(newName);
      expect(fwCloud.comment).to.be.eq(newComment);
    });

    it('should return the updated fwcloud', async () => {
      const newName: string = StringHelper.randomize(10);
      const newComment: string = StringHelper.randomize(10);

      fwCloud = await service.update(fwCloud, {
        name: newName,
        comment: newComment,
      });

      expect(fwCloud.name).to.be.eq(newName);
      expect(fwCloud.comment).to.be.eq(newComment);
    });
  });
});
