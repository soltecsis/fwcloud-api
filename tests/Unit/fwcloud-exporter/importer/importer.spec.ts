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

import { describeName, testSuite, expect } from '../../../mocha/global-setup';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { Ca } from '../../../../src/models/vpn/pki/Ca';
import { FSHelper } from '../../../../src/utils/fs-helper';
import * as path from 'path';
import * as fs from 'fs';
import { Snapshot } from '../../../../src/snapshots/snapshot';
import { SnapshotService } from '../../../../src/snapshots/snapshot.service';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import StringHelper from '../../../../src/utils/string.helper';

describe(describeName('Importer tests'), () => {
  let snapshotService: SnapshotService;

  beforeEach(async () => {
    snapshotService = await testSuite.app.getService<SnapshotService>(
      SnapshotService.name,
    );
  });

  describe('import()', () => {
    it('should migrate the pki/CA directories from the snapshot into the DATA directory', async () => {
      const fwCloud: FwCloud = await FwCloud.save(
        FwCloud.create({
          name: StringHelper.randomize(10),
        }),
      );

      const ca: Ca = await Ca.save(
        Ca.create({
          cn: StringHelper.randomize(10),
          days: 1,
          fwCloudId: fwCloud.id,
        }),
      );

      FSHelper.mkdirSync(
        path.join(fwCloud.getPkiDirectoryPath(), ca.id.toString()),
      );
      fs.writeFileSync(
        path.join(fwCloud.getPkiDirectoryPath(), ca.id.toString(), 'test.txt'),
        'test',
      );

      const snapshot: Snapshot = await Snapshot.create(
        snapshotService.config.data_dir,
        fwCloud,
      );

      await snapshot.restore();

      const newFwCloud: FwCloud = await FwCloud.findOne({ name: fwCloud.name });
      const newCA: Ca = await Ca.findOne({ cn: ca.cn });

      expect(
        FSHelper.directoryExistsSync(
          path.join(newFwCloud.getPkiDirectoryPath(), newCA.id.toString()),
        ),
      ).to.be.true;
    });

    it('should migrate the policy/firewall directories from the snapshot into the DATA directory', async () => {
      const fwCloud: FwCloud = await FwCloud.save(
        FwCloud.create({
          name: StringHelper.randomize(10),
        }),
      );

      const firewall: Firewall = await Firewall.save(
        Firewall.create({
          name: StringHelper.randomize(10),
          fwCloudId: fwCloud.id,
        }),
      );

      FSHelper.mkdirSync(
        path.join(fwCloud.getPolicyDirectoryPath(), firewall.id.toString()),
      );
      fs.writeFileSync(
        path.join(
          fwCloud.getPolicyDirectoryPath(),
          firewall.id.toString(),
          'test.txt',
        ),
        'test',
      );

      const snapshot: Snapshot = await Snapshot.create(
        snapshotService.config.data_dir,
        fwCloud,
      );

      await snapshot.restore();

      const newFwCloud: FwCloud = await FwCloud.findOne({ name: fwCloud.name });
      const newFirewall: Firewall = await Firewall.findOne({
        name: firewall.name,
      });

      expect(
        FSHelper.directoryExistsSync(
          path.join(
            newFwCloud.getPolicyDirectoryPath(),
            newFirewall.id.toString(),
          ),
        ),
      ).to.be.true;
    });
  });
});
