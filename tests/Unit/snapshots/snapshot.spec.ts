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
import * as fs from 'fs-extra';
import * as path from 'path';
import { Application } from '../../../src/Application';
import { Snapshot, snapshotDigestContent, SnapshotMetadata } from '../../../src/snapshots/snapshot';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { SnapshotService } from '../../../src/snapshots/snapshot.service';
import { FSHelper } from '../../../src/utils/fs-helper';
import { SnapshotNotCompatibleException } from '../../../src/snapshots/exceptions/snapshot-not-compatible.exception';
import { Firewall } from '../../../src/models/firewall/Firewall';
import StringHelper from '../../../src/utils/string.helper';
import * as crypto from 'crypto';
import sinon from 'sinon';

let app: Application;
let fwCloud: FwCloud;
let service: SnapshotService;

describe(describeName('Snapshot Unit Tests'), () => {
  before(async () => {
    app = testSuite.app;
    service = await app.getService<SnapshotService>(SnapshotService.name);
  });

  beforeEach(async () => {
    fwCloud = await FwCloud.save(
      FwCloud.create({
        name: StringHelper.randomize(10),
      }),
    );

    fwCloud = await FwCloud.findOne({ where: { id: fwCloud.id } });
  });

  describe('create()', () => {
    it('should create the fwcloud snapshot directory if it does not exists', async () => {
      await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      expect(fs.statSync(path.join(service.config.data_dir, fwCloud.id.toString())).isDirectory())
        .to.be.true;
    });

    it('should create a directory which name is the snapshot id', async () => {
      const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      expect(snapshot.id).to.be.deep.equal(parseInt(path.basename(snapshot.path)));
      expect(snapshot.id).to.be.deep.equal(snapshot.date.valueOf());
    });

    it('should create the snapshot directory', async () => {
      const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      expect(fs.statSync(snapshot.path).isDirectory()).to.be.true;
      expect(fs.statSync(path.join(snapshot.path, Snapshot.METADATA_FILENAME)).isFile()).to.be.true;
    });

    it('should create the sanapshot metadata file', async () => {
      const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      expect(
        JSON.parse(
          fs.readFileSync(path.join(snapshot.path, Snapshot.METADATA_FILENAME)).toString(),
        ),
      ).to.be.deep.equal({
        timestamp: snapshot.date.valueOf(),
        name: snapshot.name,
        comment: snapshot.comment,
        migrations: snapshot.migrations,
        version: snapshot.version,
        hash: crypto
          .createHmac('sha256', testSuite.app.config.get('crypt.secret'))
          .update(snapshotDigestContent)
          .digest('hex'),
      });
    });

    it('should create a data directory in the snapshot directory', async () => {
      const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      expect(FSHelper.directoryExistsSync(path.join(snapshot.path, Snapshot.DATA_DIRECTORY))).to.be
        .true;
    });

    it('should copy the pki fwcloud directory if it exists', async () => {
      FSHelper.mkdirSync(fwCloud.getPkiDirectoryPath());

      fs.writeFileSync(path.join(fwCloud.getPkiDirectoryPath(), 'test.txt'), 'test file content');

      const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      expect(fs.statSync(path.join(snapshot.path, Snapshot.PKI_DIRECTORY, 'test.txt')).isFile());
      expect(
        fs.readFileSync(path.join(snapshot.path, Snapshot.PKI_DIRECTORY, 'test.txt')).toString(),
      ).to.be.deep.eq('test file content');
    });

    it('should copy the policy fwcloud directory if exists', async () => {
      FSHelper.mkdirSync(fwCloud.getPolicyDirectoryPath());

      fs.writeFileSync(
        path.join(fwCloud.getPolicyDirectoryPath(), 'test.txt'),
        'test file content',
      );

      const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      expect(fs.statSync(path.join(snapshot.path, Snapshot.POLICY_DIRECTORY, 'test.txt')).isFile());
      expect(
        fs.readFileSync(path.join(snapshot.path, Snapshot.POLICY_DIRECTORY, 'test.txt')).toString(),
      ).to.be.deep.eq('test file content');
    });

    it('should export the fwcloud into the data file', async () => {
      const snaphost: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      expect(fs.statSync(path.join(snaphost.path, Snapshot.DATA_FILENAME)).isFile()).to.be.true;
    });

    it('should use the date as a name if the name is empty', async () => {
      const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud);

      expect(snapshot.name).to.be.deep.equal(snapshot.date.utc().format());
    });
  });

  describe('load()', () => {
    it('should load a snapshot from filesystem', async () => {
      const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      expect(await Snapshot.load(snapshot.path)).to.be.deep.equal(snapshot);
    });

    it('should guess the fwcloud by its directory name', async () => {
      const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      const snaphost = await Snapshot.load(snapshot.path);

      expect(snaphost.fwCloud).to.be.deep.equal(fwCloud);
    });

    it('should set incompatible if migrations metadata attribute is not provided', async () => {
      const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      const metadata: SnapshotMetadata = fs.readJSONSync(
        path.join(snapshot.path, Snapshot.METADATA_FILENAME),
      );
      delete metadata['migrations'];
      fs.writeJSONSync(path.join(snapshot.path, Snapshot.METADATA_FILENAME), metadata);

      const snaphost = await Snapshot.load(snapshot.path);

      expect(snaphost.compatible).to.be.false;
    });
  });

  describe('update()', () => {
    it('should update a snapshot name and comment', async () => {
      const snapshot: Snapshot = await Snapshot.create(
        service.config.data_dir,
        fwCloud,
        'name',
        'comment',
      );

      const data: { name: string; comment: string } = {
        name: 'test',
        comment: 'test',
      };

      await snapshot.update(data);

      expect((await Snapshot.load(snapshot.path)).name).to.be.deep.equal('test');
      expect((await Snapshot.load(snapshot.path)).comment).to.be.deep.equal('test');
    });
  });

  describe('delete()', () => {
    it('should remove the snapshot if it exists', async () => {
      const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      await snapshot.destroy();

      expect(fs.existsSync(snapshot.path)).to.be.false;
      expect(snapshot.exists).to.be.false;
    });
  });

  describe('restore()', () => {
    it('should restore a fwcloud as a new fwcloud', async () => {
      const snaphost: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      await snaphost.restore();

      const importedFwCloud: FwCloud = await FwCloud.findOne({
        where: { id: fwCloud.id + 1 },
      });

      expect(importedFwCloud.name).to.be.deep.equal(fwCloud.name);
    });

    it('should return the restored fwcloud', async () => {
      const snapshot: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      const restoredFwCloud: FwCloud = await snapshot.restore();

      expect(restoredFwCloud.name).to.be.deep.equal(fwCloud.name);
    });

    it('should remove the old fwcloud and all its dependencies', async () => {
      const snaphost: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      await snaphost.restore();

      expect(await FwCloud.findOne({ where: { id: fwCloud.id } })).to.be.null;
    });

    it('should remove the old fwcloud data directories', async () => {
      const snaphost: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');
      FSHelper.mkdirSync(fwCloud.getPolicyDirectoryPath());
      FSHelper.mkdirSync(fwCloud.getPkiDirectoryPath());

      await snaphost.restore();

      expect(FSHelper.directoryExistsSync(fwCloud.getPkiDirectoryPath())).to.be.false;
      expect(FSHelper.directoryExistsSync(fwCloud.getPolicyDirectoryPath())).to.be.false;
    });

    it('should remove the new fwcloud data directories if they exist previously', async () => {
      const snaphost: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');
      FSHelper.mkdirSync(path.join(app.config.get('policy').data_dir, (fwCloud.id + 1).toString()));
      FSHelper.mkdirSync(path.join(app.config.get('pki').data_dir, (fwCloud.id + 1).toString()));

      await snaphost.restore();

      expect(
        FSHelper.directoryExistsSync(
          path.join(app.config.get('policy').data_dir, (fwCloud.id + 1).toString()),
        ),
      ).to.be.false;
      expect(
        FSHelper.directoryExistsSync(
          path.join(app.config.get('pki').data_dir, (fwCloud.id + 1).toString()),
        ),
      ).to.be.false;
    });

    it('should throw an exception if the snapshot is not compatible', async () => {
      const stub = sinon.stub(Snapshot.prototype, 'compatible').get(() => {
        return false;
      });

      let snaphost: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      snaphost = await Snapshot.load(snaphost.path);

      async function t() {
        return snaphost.restore();
      }

      await expect(t()).to.be.rejectedWith(SnapshotNotCompatibleException);
      stub.restore();
    });

    it('should mark as uncompiled all fwcloud firewalls', async () => {
      let firewall: Firewall = await Firewall.save(
        Firewall.create({
          name: 'firewall_test',
          status: 1,
          fwCloudId: fwCloud.id,
        }),
      );

      let firewall2: Firewall = await Firewall.save(
        Firewall.create({
          name: 'firewall_test2',
          status: 1,
          fwCloudId: fwCloud.id,
        }),
      );

      const snaphost: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      await snaphost.restore();

      const newFwCloud: FwCloud = await FwCloud.findOne({
        where: { id: fwCloud.id + 1 },
      });

      firewall = (await Firewall.find({ where: { fwCloudId: newFwCloud.id } }))[0];
      firewall2 = (await Firewall.find({ where: { fwCloudId: newFwCloud.id } }))[1];

      expect(firewall.status).to.be.deep.eq(3);
      expect(firewall.compiled_at).to.be.null;
      expect(firewall.installed_at).to.be.null;

      expect(firewall2.status).to.be.deep.eq(3);
      expect(firewall2.compiled_at).to.be.null;
      expect(firewall2.installed_at).to.be.null;
    });

    it('should remove encrypted data if snapshot hash is not equal', async () => {
      let firewall: Firewall = await Firewall.save(
        Firewall.create({
          name: 'firewall_test',
          status: 1,
          fwCloudId: fwCloud.id,
          install_user: 'test',
          install_pass: 'test',
        }),
      );

      let snaphost: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      const metadata: SnapshotMetadata = JSON.parse(
        fs.readFileSync(path.join(snaphost.path, Snapshot.METADATA_FILENAME)).toString(),
      );
      metadata.hash = 'test';
      fs.writeFileSync(
        path.join(snaphost.path, Snapshot.METADATA_FILENAME),
        JSON.stringify(metadata, null, 2),
      );

      snaphost = await Snapshot.load(snaphost.path);
      await snaphost.restore();

      const newFwCloud: FwCloud = await FwCloud.findOne({
        where: { id: fwCloud.id + 1 },
      });

      firewall = (await Firewall.find({ where: { fwCloudId: newFwCloud.id } }))[0];

      expect(firewall.install_user).to.be.null;
      expect(firewall.install_pass).to.be.null;
    });

    it('should migrate snapshot from the old fwcloud to the new one', async () => {
      const snapshotService: SnapshotService = await app.getService<SnapshotService>(
        SnapshotService.name,
      );

      const snaphost1: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');
      const snaphost2: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      await snaphost2.restore();

      const newFwCloud: FwCloud = await FwCloud.findOne({
        where: { id: fwCloud.id + 1 },
      });

      expect(fs.existsSync(snaphost1.path)).to.be.false;
      expect(fs.existsSync(snaphost2.path)).to.be.false;
      expect(fs.existsSync(path.join(snapshotService.config.data_dir, newFwCloud.id.toString()))).to
        .be.true;
    });

    it('should not copy the policy directory if data directory is not present in the snapshot', async () => {
      const snaphost1: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      await snaphost1.restore();

      const newFwCloud: FwCloud = await FwCloud.findOne({
        where: { id: fwCloud.id + 1 },
      });

      expect(FSHelper.directoryExistsSync(newFwCloud.getPolicyDirectoryPath())).to.be.false;
    });

    it('should not copy the pki directory if data directory is not present in the snapshot', async () => {
      const snaphost1: Snapshot = await Snapshot.create(service.config.data_dir, fwCloud, 'test');

      await snaphost1.restore();

      const newFwCloud: FwCloud = await FwCloud.findOne({
        where: { id: fwCloud.id + 1 },
      });

      expect(FSHelper.directoryExistsSync(newFwCloud.getPkiDirectoryPath())).to.be.false;
    });
  });
});
