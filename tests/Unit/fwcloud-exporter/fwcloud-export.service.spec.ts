import { describeName, expect, testSuite } from '../../mocha/global-setup';
import { Application } from '../../../src/Application';
import { FwCloudExportService } from '../../../src/fwcloud-exporter/fwcloud-export.service';
import { FSHelper } from '../../../src/utils/fs-helper';
import { FwCloudExport } from '../../../src/fwcloud-exporter/fwcloud-export';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import {
  colorUsage,
  fwcloudColors,
} from '../../../src/models/fwcloud/FwCloud-colors';
import StringHelper from '../../../src/utils/string.helper';
import { User } from '../../../src/models/user/User';
import { createUser, sleep, ramdomInteger } from '../../utils/utils';
import { EntityManager } from 'typeorm';
import db from '../../../src/database/database-manager';

describe(describeName('FwCloudExportService Unit Tests'), () => {
  let app: Application;
  let service: FwCloudExportService;
  let fwCloud: FwCloud;
  let user: User;
  let manager: EntityManager;

  before(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    service = await app.getService<FwCloudExportService>(
      FwCloudExportService.name,
    );
    fwCloud = await manager.getRepository(FwCloud).save(
      manager.getRepository(FwCloud).create({
        name: StringHelper.randomize(10),
      }),
    );

    user = await createUser({});
  });

  it('should be provided as a service', async () => {
    expect(
      await app.getService<FwCloudExportService>(FwCloudExportService.name),
    ).to.be.instanceOf(FwCloudExportService);
  });

  describe('build()', () => {
    it('should create the export directory', async () => {
      FSHelper.rmDirectorySync(app.config.get('exporter').data_dir);

      await FwCloudExportService.make(app);

      expect(FSHelper.directoryExistsSync(app.config.get('exporter').data_dir))
        .to.be.true;
      expect(
        FSHelper.directoryExistsSync(app.config.get('exporter').upload_dir),
      ).to.be.true;
    });
  });

  describe('create()', () => {
    it('should create an export file and metadata file', async () => {
      const fwCloudExport: FwCloudExport = await service.create(fwCloud, user);

      expect(fwCloudExport).to.be.instanceOf(FwCloudExport);
      expect(FSHelper.fileExistsSync(fwCloudExport.exportPath)).to.be.true;
    });

    it('should remove the export directory', async () => {
      const fwCloudExport: FwCloudExport = await service.create(fwCloud, user);

      expect(FSHelper.directoryExistsSync(fwCloudExport.path)).to.be.false;
    });

    it('should remove all generated files after ttl', async () => {
      const fwCloudExport: FwCloudExport = await service.create(
        fwCloud,
        user,
        1,
      );

      await sleep(4);
      expect(FSHelper.fileExistsSync(fwCloudExport.exportPath)).to.be.false;
    });
  });

  describe('import()', () => {
    let fwCloudExport: FwCloudExport;

    beforeEach(async () => {
      fwCloudExport = await service.create(fwCloud, user);
    });

    it('should import the fwcloud', async () => {
      const currentFwClouds: number = (await FwCloud.find()).length;
      await service.import(fwCloudExport.exportPath, user);

      expect((await FwCloud.find()).length).to.be.eq(currentFwClouds + 1);
    });

    it('should assign the fwcloud to the user', async () => {
      user = await User.findOne({
        where: { id: user.id },
        relations: ['fwClouds'],
      });

      const fwcloudAssigned = user.fwClouds.length;

      await service.import(fwCloudExport.exportPath, user);

      user = await User.findOne({
        where: { id: user.id },
        relations: ['fwClouds'],
      });

      expect(user.fwClouds.length).to.be.eq(fwcloudAssigned + 1);
    });
  });

  describe('colors()', () => {
    let fwcColors1: fwcloudColors;
    let fwcColors2: fwcloudColors;
    const cua1: colorUsage[] = [];
    const cua2: colorUsage[] = [];

    beforeEach(async () => {
      let n: number;

      // Generate ramdon content colorsUsage arrays.
      for (n = ramdomInteger(1, 64); n > 0; n--) {
        cua1.push({
          color: '#' + Math.random().toString(16).substr(2, 6),
          count: ramdomInteger(1, 10000),
        });
      }
      for (n = ramdomInteger(1, 64); n > 0; n--) {
        cua2.push({
          color: '#' + Math.random().toString(16).substr(2, 6),
          count: ramdomInteger(1, 10000),
        });
      }

      fwcColors1 = new fwcloudColors(cua1);
      fwcColors2 = new fwcloudColors(cua2);
    });

    describe('combine fwcloudColors objects', () => {
      it('should return empty fwcloudColor object', () => {
        fwcColors1.empty();
        fwcColors2.empty();
        fwcColors1.combine(fwcColors2);
        expect(fwcColors1.isEmpty()).to.be.true;
      });

      it('should return combined fwcloudColor object', () => {
        fwcColors1.combine(fwcColors2);
        expect(fwcColors1.foundAll(cua1)).to.be.true;
        expect(fwcColors1.foundAll(cua2)).to.be.true;
      });

      it('should add count usage for same color', () => {
        fwcColors1.add({ color: '#112233', count: 5 });
        fwcColors2.add({ color: '#112233', count: 10 });
        fwcColors1.combine(fwcColors2);
        expect(fwcColors1.found({ color: '#112233', count: 15 })).to.be.true;
      });

      it('should return sorted combined fwcloudColor object', () => {
        fwcColors1.combine(fwcColors2);
        fwcColors1.sort();
        expect(fwcColors1.isSorted()).to.be.true;
      });
    });
  });
});
