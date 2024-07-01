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

import { AbstractApplication } from '../../../src/fonaments/abstract-application';
import { Backup } from '../../../src/backups/backup';
import {
  BackupService,
  BackupUpdateableConfig,
} from '../../../src/backups/backup.service';
import { testSuite, expect, describeName } from '../../mocha/global-setup';
import * as fs from 'fs';
import * as path from 'path';
import sinon from 'sinon';
import { Zip } from '../../../src/utils/zip';

let app: AbstractApplication;

describe(describeName('BackupService Unit tests'), async () => {
  beforeEach(async () => {
    app = testSuite.app;
  });

  describe('Bootstrap', () => {
    it('service is instantiated in during bootstrap process', async () => {
      //One way to detect backup service has been instantiated (without calling it)
      // is checking whether backup directory has been created
      expect(fs.existsSync(app.config.get('backup').data_dir)).to.be.true;
    });
  });

  describe('BackupService', () => {
    let service: BackupService;

    beforeEach(async () => {
      service = await app.getService<BackupService>(BackupService.name);
    });

    describe('config', () => {
      it('config should be equals to default config if there is not a custom version', async () => {
        service = await BackupService.make(app);
        expect(app.config.get('backup')).to.be.deep.eq(service.config);
      });

      it('config should be overwritten by a custom config if custom config exists', async () => {
        const customConfig: BackupUpdateableConfig = {
          schedule: service.config.schedule,
          max_copies: 99999,
          max_days: 99999,
        };

        fs.writeFileSync(
          path.join(service.config.data_dir, service.config.config_file),
          JSON.stringify(customConfig),
        );

        service = await BackupService.make(app);
        expect(app.config.get('backup')).not.to.be.deep.eq(service.config);
        expect(service.config.max_copies).to.be.deep.eq(99999);
        expect(service.config.max_days).to.be.deep.eq(99999);
      });
    });

    describe('getAll()', () => {
      it('should return all existing backups', async () => {
        const b1: Backup = new Backup();
        const b2: Backup = new Backup();

        await b1.create(service.config.data_dir);
        await b2.create(service.config.data_dir);

        expect(await service.getAll()).to.be.deep.equal([b1, b2]);
      });

      it('should return all backups can be loaded', async () => {
        const b1: Backup = new Backup();
        const b2: Backup = new Backup();

        await b1.create(service.config.data_dir);
        await b2.create(service.config.data_dir);

        fs.unlinkSync(path.join(b1.path, Backup.METADATA_FILENAME));

        expect(await service.getAll()).to.be.deep.equal([b2]);
      });

      it('should return an empty array if any backup is persisted', async () => {
        expect(await service.getAll()).to.have.length(0);
      });
    });

    describe('findOne()', () => {
      it('should return a backup if exists', async () => {
        const b1: Backup = new Backup();
        await b1.create(service.config.data_dir);

        expect(await service.findOne(b1.id)).to.be.deep.equal(b1);
      });

      it('should return null if backup does not exist', async () => {
        expect(await service.findOne(0)).to.be.null;
      });
    });

    describe('create()', () => {
      it('should create a backup', async () => {
        const backup: Backup = await new Backup().create(
          service.config.data_dir,
        );

        expect(backup.exists()).to.be.true;
      });
    });

    describe('delete()', () => {
      it('should remove a backup', async () => {
        let backup: Backup = new Backup();
        await backup.create(service.config.data_dir);

        backup = await service.destroy(backup);

        expect(backup.exists()).to.be.false;
      });
    });

    describe('export()', async () => {
      let backup: Backup;

      beforeEach(async () => {
        backup = await service.create();
      });

      it('should generate a zipped file', async () => {
        const p: string = await service.export(backup);

        expect(fs.existsSync(p)).to.be.true;
      });
    });

    describe('import()', async () => {
      let zippedFilePath: string;
      let backup: Backup;
      beforeEach(async () => {
        backup = await service.create();
        zippedFilePath = await service.export(backup);
      });

      it('should create a new backup', async () => {
        const currentBackups: number = (await service.getAll()).length;

        const newBackup: Backup = await service.import(zippedFilePath);

        expect((await service.getAll()).length).to.be.eq(currentBackups + 1);
      });

      it('should create a new backup with new id', async () => {
        const newBackup: Backup = await service.import(zippedFilePath);

        expect(newBackup.id).not.to.be.eq(backup.id);
      });

      it('should set the imported flag to true', async () => {
        const currentBackups: number = (await service.getAll()).length;

        const newBackup: Backup = await service.import(zippedFilePath);

        expect(newBackup.imported).to.be.true;
      });

      it('should throw an exception if the file is not a valid backup', async () => {
        const tmpDirectoryPath: string = path.join(
          app.config.get('tmp.directory'),
          'test',
        );
        fs.mkdirSync(tmpDirectoryPath);
        fs.writeFileSync(
          path.join(tmpDirectoryPath, 'test.txt'),
          'this is a file',
        );
        await Zip.zip(
          tmpDirectoryPath,
          path.join(app.config.get('tmp.directory'), 'test.zip'),
        );

        const t = () => {
          return service.import(
            path.join(app.config.get('tmp.directory'), 'test.zip'),
          );
        };

        await expect(t()).to.be.rejected;
      });
    });

    describe('applyRetentionPolicy()', () => {
      it('should remove a backup if retention policy by backup counts is enabled', async () => {
        const b1: Backup = new Backup();
        const b2: Backup = new Backup();

        await b1.create(service.config.data_dir);
        await b2.create(service.config.data_dir);

        service['_config'].max_copies = 1;
        service['_config'].max_days = 0;

        const expectedRemoved: number =
          (await service.getAll()).length - service['_config'].max_copies;

        expect(await service.applyRetentionPolicy()).to.have.length(
          expectedRemoved,
        );
      });

      it('should remove a backup if retention policy by expiration date is enabled', async () => {
        const b1: Backup = new Backup();
        const b2: Backup = new Backup();

        service['_config'].max_copies = 0;
        service['_config'].max_days = 1;

        let stubDate = sinon
          .stub(Date, 'now')
          .returns(new Date(Date.UTC(2017, 1, 14)).valueOf());
        await b1.create(service.config.data_dir);
        stubDate.restore();

        stubDate = sinon
          .stub(Date, 'now')
          .returns(new Date(Date.UTC(2017, 1, 15)).valueOf());
        await b2.create(service.config.data_dir);
        stubDate.restore();

        expect(await service.applyRetentionPolicy()).to.have.length(2);
      });
    });

    describe('updateConfig()', () => {
      it('should update the custom config parameters', async () => {
        const config = service.config;

        config.default_max_days = 99999;

        await service.updateConfig(config);

        expect(service.config.default_max_days).to.be.deep.equal(99999);
      });
    });
  });
});
