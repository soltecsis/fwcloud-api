import { describeName, testSuite, playgroundPath, expect } from '../../mocha/global-setup';
import { Application } from '../../../src/Application';
import * as path from 'path';
import * as fs from 'fs';
import { FwCloudExport } from '../../../src/fwcloud-exporter/fwcloud-export';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import StringHelper from '../../../src/utils/string.helper';
import { FSHelper } from '../../../src/utils/fs-helper';
import { Snapshot, SnapshotMetadata } from '../../../src/snapshots/snapshot';
import { SnapshotService } from '../../../src/snapshots/snapshot.service';
import { User } from '../../../src/models/user/User';
import { createUser } from '../../utils/utils';
import { SnapshotNotCompatibleException } from '../../../src/snapshots/exceptions/snapshot-not-compatible.exception';
import Sinon from 'sinon';
import { Firewall } from '../../../src/models/firewall/Firewall';
import { EntityManager } from 'typeorm';
import db from '../../../src/database/database-manager';

describe(describeName('FwCloudExport Unit Tests'), () => {
  let app: Application;
  let fwCloud: FwCloud;
  let directory: string;
  let snapshotService: SnapshotService;
  let user: User;
  let manager: EntityManager;

  before(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    snapshotService = await app.getService<SnapshotService>(SnapshotService.name);

    fwCloud = await manager.getRepository(FwCloud).save(
      manager.getRepository(FwCloud).create({
        name: StringHelper.randomize(10),
      }),
    );

    user = await createUser({});
  });

  beforeEach(() => {
    directory = path.join(playgroundPath, StringHelper.randomize(10));
  });

  describe('create()', () => {
    it('should create the directory where the exportation is going to be created', async () => {
      await FwCloudExport.create(directory, fwCloud, user);

      expect(FSHelper.directoryExistsSync(directory)).to.be.true;
    });

    it('should create the export directory within the directory defined', async () => {
      const fwCloudExport: FwCloudExport = await FwCloudExport.create(directory, fwCloud, user);

      expect(FSHelper.directoryExistsSync(path.join(directory, fwCloudExport.id))).to.be.true;
    });

    it('should create a fwcloud snapshot data in the fwcloud directory within export directory', async () => {
      const fwCloudExport: FwCloudExport = await FwCloudExport.create(directory, fwCloud, user);

      expect(
        FSHelper.directoryExistsSync(
          path.join(fwCloudExport.path, FwCloudExport.FWCLOUD_DATA_DIRECTORY),
        ),
      ).to.be.true;
      expect(
        FSHelper.fileExistsSync(
          path.join(
            fwCloudExport.path,
            FwCloudExport.FWCLOUD_DATA_DIRECTORY,
            Snapshot.DATA_FILENAME,
          ),
        ),
      ).to.be.true;
    });

    it('should copy snapshot data directories if the fwcloud snapshot contains it', async () => {
      FSHelper.mkdirSync(fwCloud.getPkiDirectoryPath());
      FSHelper.mkdirSync(fwCloud.getPolicyDirectoryPath());

      fs.writeFileSync(path.join(fwCloud.getPkiDirectoryPath(), 'test'), '');
      fs.writeFileSync(path.join(fwCloud.getPolicyDirectoryPath(), 'test'), '');

      const fwCloudExport: FwCloudExport = await FwCloudExport.create(directory, fwCloud, user);

      expect(
        FSHelper.directoryExistsSync(
          path.join(
            fwCloudExport.path,
            FwCloudExport.FWCLOUD_DATA_DIRECTORY,
            Snapshot.DATA_DIRECTORY,
          ),
        ),
      ).to.be.true;
    });

    it('should copy fwcloud snapshots within fwcloud export directory', async () => {
      const snapshot1: Snapshot = await Snapshot.create(snapshotService.config.data_dir, fwCloud);
      const snapshot2: Snapshot = await Snapshot.create(snapshotService.config.data_dir, fwCloud);

      const fwCloudExport: FwCloudExport = await FwCloudExport.create(directory, fwCloud, user);

      expect(
        FSHelper.directoryExistsSync(
          path.join(fwCloudExport.path, FwCloudExport.SNAPSHOTS_DIRECTORY, snapshot1.id.toString()),
        ),
      ).to.be.true;
      expect(
        FSHelper.directoryExistsSync(
          path.join(fwCloudExport.path, FwCloudExport.SNAPSHOTS_DIRECTORY, snapshot2.id.toString()),
        ),
      ).to.be.true;
    });
  });

  describe('compress()', () => {
    it('should generate a compress file', async () => {
      const fwCloudExport: FwCloudExport = await FwCloudExport.create(directory, fwCloud, user);
      await fwCloudExport.compress();

      expect(FSHelper.fileExistsSync(fwCloudExport.exportPath)).to.be.true;
      expect(fwCloudExport.exportPath).to.be.deep.eq(fwCloudExport.path + '.fwcloud');
    });
  });

  describe('load()', () => {
    let fwCloudExporter: FwCloudExport;

    beforeEach(async () => {
      fwCloudExporter = await FwCloudExport.create(directory, fwCloud, user);
    });

    it('should load the export directory', async () => {
      fwCloudExporter = await FwCloudExport.load(fwCloudExporter.path);

      expect(fwCloudExporter).to.be.instanceOf(FwCloudExport);
      expect(fwCloudExporter.loaded).to.be.true;
    });
  });

  describe('loadCompressed()', () => {
    let fwCloudExport: FwCloudExport;

    beforeEach(async () => {
      fwCloudExport = await FwCloudExport.create(directory, fwCloud, user);
      await fwCloudExport.compress();
      await FSHelper.remove(fwCloudExport.path);
    });

    it('should unzip the file', async () => {
      await FwCloudExport.loadCompressed(fwCloudExport.exportPath);

      expect(FSHelper.directoryExistsSync(fwCloudExport.path)).to.be.true;
      expect(
        FSHelper.directoryExistsSync(
          path.join(fwCloudExport.path, FwCloudExport.FWCLOUD_DATA_DIRECTORY),
        ),
      ).to.be.true;
    });
  });

  describe('import()', () => {
    let fwCloudExporter: FwCloudExport;
    let snapshot: Snapshot;

    beforeEach(async () => {
      snapshot = await Snapshot.create(snapshotService.config.data_dir, fwCloud);
      fwCloudExporter = await FwCloudExport.create(directory, fwCloud, user);
    });

    it('should import the fwcloud as a new fwcloud', async () => {
      const restoredFwCloud: FwCloud = await fwCloudExporter.import();

      expect(fwCloud).to.be.instanceOf(FwCloud);
      expect(restoredFwCloud.id).to.be.deep.eq(fwCloud.id + 1);
    });

    it('should copy snapshots', async () => {
      const restoredFwCloud: FwCloud = await fwCloudExporter.import();

      expect(FSHelper.directoryExistsSync(restoredFwCloud.getSnapshotDirectoryPath())).to.be.true;
      expect(
        FSHelper.directoryExistsSync(
          path.join(restoredFwCloud.getSnapshotDirectoryPath(), snapshot.id.toString()),
        ),
      ).to.be.true;
    });

    it('should throw an exception if the export is not compatible', async () => {
      fwCloudExporter = await FwCloudExport.create(directory, fwCloud, user);

      const stub = Sinon.stub(Snapshot.prototype, 'compatible').get(() => false);

      const t = () => {
        return fwCloudExporter.import();
      };

      await expect(t()).to.be.rejectedWith(SnapshotNotCompatibleException);
      stub.restore();
    });

    it('should remove encrypted data if export snapshot hash is not equal', async () => {
      let firewall: Firewall = await Firewall.save(
        Firewall.create({
          name: 'firewall_test',
          status: 1,
          fwCloudId: fwCloud.id,
          install_user: 'test',
          install_pass: 'test',
        }),
      );

      fwCloudExporter = await FwCloudExport.create(directory, fwCloud, user);

      const snapshotMetadata: SnapshotMetadata = JSON.parse(
        fs
          .readFileSync(
            path.join(
              fwCloudExporter.path,
              FwCloudExport.FWCLOUD_DATA_DIRECTORY,
              Snapshot.METADATA_FILENAME,
            ),
          )
          .toString(),
      );
      snapshotMetadata.hash = 'test';
      fs.writeFileSync(
        path.join(
          fwCloudExporter.path,
          FwCloudExport.FWCLOUD_DATA_DIRECTORY,
          Snapshot.METADATA_FILENAME,
        ),
        JSON.stringify(snapshotMetadata, null, 2),
      );

      const restoredFwCloud: FwCloud = await fwCloudExporter.import();

      firewall = (await Firewall.find({ where: { fwCloudId: restoredFwCloud.id } }))[0];

      expect(firewall.install_user).to.be.null;
      expect(firewall.install_pass).to.be.null;
    });
  });

  describe('toResponse()', () => {
    it('should return the response object', async () => {
      const fwCloudExport: FwCloudExport = await FwCloudExport.create(directory, fwCloud, user);

      expect(fwCloudExport.toResponse()).to.be.deep.eq({
        id: fwCloudExport.id,
        timestamp: fwCloudExport.timestamp,
        fwcloud_id: fwCloud.id,
        user_id: user.id,
      });
    });
  });
});
