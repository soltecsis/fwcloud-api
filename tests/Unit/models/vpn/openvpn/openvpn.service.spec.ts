/*!
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { FSHelper } from './../../../../../src/utils/fs-helper';
import { describeName, testSuite, expect } from '../../../../mocha/global-setup';
import {
  OpenVPNService,
  OpenVPNUpdateableConfig,
} from '../../../../../src/models/vpn/openvpn/openvpn.service';
import * as fs from 'fs';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import path from 'path';
import {
  CreateOpenVPNStatusHistoryData,
  OpenVPNStatusHistoryService,
} from '../../../../../src/models/vpn/openvpn/status/openvpn-status-history.service';
import { AbstractApplication } from '../../../../../src/fonaments/abstract-application';
import sinon from 'sinon';
import db from '../../../../../src/database/database-manager';
import { OpenVPNStatusHistory } from '../../../../../src/models/vpn/openvpn/status/openvpn-status-history';
import { AuditLog } from '../../../../../src/models/audit/AuditLog';

describe(describeName('OpenVPN Service Unit Tests'), () => {
  let app: AbstractApplication;
  let openVPNService: OpenVPNService;
  let openVPNStatusHistoryService: OpenVPNStatusHistoryService;
  let fwcProduct: FwCloudProduct;
  let data: CreateOpenVPNStatusHistoryData[];
  let newData: CreateOpenVPNStatusHistoryData[];
  let yearDir: string;
  let monthSubDir: string;
  let fileName: string;
  let filePath: string;

  beforeEach(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();
    fwcProduct = await new FwCloudFactory().make();
    openVPNService = await app.getService<OpenVPNService>(OpenVPNService.name);
    openVPNStatusHistoryService = await app.getService<OpenVPNStatusHistoryService>(
      OpenVPNStatusHistoryService.name,
    );

    data = [
      {
        timestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0)),
        name: 'test-status-history1',
        address: '1.1.1.1',
        bytesReceived: 100,
        bytesSent: 200,
        connectedAtTimestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0)),
      },
      {
        timestampInSeconds: parseInt((new Date('2000-01-01').getTime() / 1000).toFixed(0)),
        name: 'test-status-history2',
        address: '1.1.1.1',
        bytesReceived: 100,
        bytesSent: 200,
        connectedAtTimestampInSeconds: parseInt(
          (new Date('2000-01-01').getTime() / 1000).toFixed(0),
        ),
      },
    ];

    await openVPNStatusHistoryService.create(fwcProduct.openvpnServer.id, data);

    await openVPNService.archiveHistory();

    const date = new Date();
    yearDir = date.getFullYear().toString();
    monthSubDir = ('0' + (date.getMonth() + 1)).slice(-2);
    fileName = `openvpn_status_history-${date.getFullYear()}${('0' + (date.getMonth() + 1)).slice(-2)}${('0' + date.getDate()).slice(-2)}.sql`;
    filePath = path.join(
      `${path.join(app.config.get('openvpn.history').data_dir, yearDir, monthSubDir, fileName)}.zip`,
    );
  });

  it('should be provided as an application service', async () => {
    expect(await app.getService<OpenVPNService>(OpenVPNService.name)).to.be.instanceOf(
      OpenVPNService,
    );
  });

  describe('archiveHistory()', () => {
    it('should create a backup directory', async () => {
      const directory = path.join(
        `${path.join(app.config.get('openvpn.history').data_dir, yearDir, monthSubDir)}`,
      );

      expect(FSHelper.directoryExistsSync(directory)).to.be.true;
    });

    it('should be created a zip file with data records file less than archive_days config', async () => {
      expect(fs.existsSync(filePath)).to.be.true;
    });

    it('should remove a unzipped data records file', () => {
      expect(
        fs.existsSync(
          path.join(app.config.get('openvpn.history').data_dir, yearDir, monthSubDir, fileName),
        ),
      ).to.be.false;
    });

    it('should be deleted zipped records', async () => {
      const results = await openVPNStatusHistoryService.history(fwcProduct.openvpnServer.id, {
        name: data[1].name,
      });

      expect(results).to.not.have.property('name');
    });
    it('should be added new records to zip file if exist new registers', async () => {
      const date = new Date();
      const oldDate = date.setMonth(date.getMonth() - 4);

      newData = [
        {
          timestampInSeconds: parseInt((new Date(oldDate).getTime() / 1000).toFixed(0)),
          name: 'test-status-history3',
          address: '1.1.1.1',
          bytesReceived: 100,
          bytesSent: 200,
          connectedAtTimestampInSeconds: parseInt((new Date(oldDate).getTime() / 1000).toFixed(0)),
        },
      ];
      await openVPNStatusHistoryService.create(fwcProduct.openvpnServer.id, newData);

      await openVPNService.archiveHistory();

      const results = await openVPNStatusHistoryService.history(fwcProduct.openvpnServer.id, {
        name: newData[0].name,
      });

      expect(results).to.not.have.property('name');
    });

    it('should return the affected rows reported by the delete database result', async () => {
      const date = new Date();
      const oldDate = date.setMonth(date.getMonth() - 6);
      await openVPNStatusHistoryService.create(fwcProduct.openvpnServer.id, [
        {
          timestampInSeconds: parseInt((new Date(oldDate).getTime() / 1000).toFixed(0)),
          name: 'affected-count-source-test',
          address: '1.1.1.1',
          bytesReceived: 100,
          bytesSent: 200,
          connectedAtTimestampInSeconds: parseInt((new Date(oldDate).getTime() / 1000).toFixed(0)),
        },
      ]);

      const repository = db.getSource().manager.getRepository(OpenVPNStatusHistory);
      const originalDelete = repository.delete.bind(repository);
      const deleteStub = sinon.stub(repository, 'delete').callsFake(async (criteria) => {
        await originalDelete(criteria);
        return {
          affected: 7,
          raw: {
            affectedRows: 7,
          },
        } as any;
      });

      try {
        const archivedRows = await openVPNService.archiveHistory();
        expect(archivedRows).to.equal(7);
      } finally {
        deleteStub.restore();
      }
    });
  });

  describe('startScheduledTasks()', () => {
    let sandbox: sinon.SinonSandbox;

    const setCronAuditConfig = (enabled: boolean): void => {
      app.config.set('auditLogs.internal.enabled', enabled);
      app.config.set('auditLogs.internal.cron.enabled', enabled);
    };

    beforeEach(async () => {
      sandbox = sinon.createSandbox();
      setCronAuditConfig(true);
      await db.getSource().manager.getRepository(AuditLog).createQueryBuilder().delete().execute();
    });

    afterEach(() => {
      setCronAuditConfig(false);
      sandbox.restore();
    });

    const setupCronCallbacks = () => {
      const handlers: Array<() => Promise<void>> = [];

      sandbox
        .stub((openVPNService as any)._cronService, 'addJob')
        .callsFake((_cronTime: string, onTick: () => Promise<void>) => {
          handlers.push(onTick);
          return {
            start: () => {},
          } as any;
        });

      openVPNService.startScheduledTasks();

      return {
        archive: handlers[0],
        retention: handlers[1],
      };
    };

    const findLatestByCall = async (call: string): Promise<AuditLog | null> => {
      return db
        .getSource()
        .manager.getRepository(AuditLog)
        .findOne({
          where: { call },
          order: {
            id: 'DESC',
          },
        });
    };

    it('should persist a successful internal archive event with affectedCount details', async () => {
      sandbox.stub(openVPNService, 'archiveHistory').resolves(4);
      const callbacks = setupCronCallbacks();

      await callbacks.archive();

      const persisted = await findLatestByCall('INTERNAL:cron:archive');
      expect(persisted).to.not.be.null;
      const payload = JSON.parse(persisted.data);

      expect(payload.source).to.equal('cron');
      expect(payload.operation).to.equal('archive');
      expect(payload.entity).to.equal('OpenVPNStatusHistory');
      expect(payload.affectedCount).to.equal(4);
      expect(payload.status).to.equal('success');
      expect(payload.error).to.equal(null);
      expect(payload.details.archivedCount).to.equal(4);
      expect(payload.details.deletedCount).to.equal(4);
      expect(Number.isNaN(new Date(payload.startedAt).getTime())).to.be.false;
      expect(payload).to.not.have.property('finishedAt');
    });

    it('should persist a failed internal archive event when the cron throws an error', async () => {
      sandbox.stub(openVPNService, 'archiveHistory').rejects(new Error('archive cron failed'));
      const callbacks = setupCronCallbacks();

      await callbacks.archive();

      const persisted = await findLatestByCall('INTERNAL:cron:archive');
      expect(persisted).to.not.be.null;
      const payload = JSON.parse(persisted.data);

      expect(payload.operation).to.equal('archive');
      expect(payload.entity).to.equal('OpenVPNStatusHistory');
      expect(payload.affectedCount).to.equal(0);
      expect(payload.status).to.equal('failed');
      expect(payload.error).to.contain('archive cron failed');
      expect(payload.details.archivedCount).to.equal(0);
      expect(payload.details.deletedCount).to.equal(0);
    });

    it('should persist a successful internal retention event with affectedCount details', async () => {
      sandbox.stub(openVPNService, 'removeExpiredFiles').resolves(3);
      const callbacks = setupCronCallbacks();

      await callbacks.retention();

      const persisted = await findLatestByCall('INTERNAL:cron:retention');
      expect(persisted).to.not.be.null;
      const payload = JSON.parse(persisted.data);

      expect(payload.source).to.equal('cron');
      expect(payload.operation).to.equal('retention');
      expect(payload.entity).to.equal('OpenVPNStatusHistory');
      expect(payload.affectedCount).to.equal(3);
      expect(payload.status).to.equal('success');
      expect(payload.error).to.equal(null);
      expect(payload.details.deletedCount).to.equal(3);
      expect(payload.details.removedFilesCount).to.equal(3);
    });

    it('should persist a failed internal retention event when the cron throws an error', async () => {
      sandbox
        .stub(openVPNService, 'removeExpiredFiles')
        .rejects(new Error('retention cron failed'));
      const callbacks = setupCronCallbacks();

      await callbacks.retention();

      const persisted = await findLatestByCall('INTERNAL:cron:retention');
      expect(persisted).to.not.be.null;
      const payload = JSON.parse(persisted.data);

      expect(payload.operation).to.equal('retention');
      expect(payload.entity).to.equal('OpenVPNStatusHistory');
      expect(payload.affectedCount).to.equal(0);
      expect(payload.status).to.equal('failed');
      expect(payload.error).to.contain('retention cron failed');
      expect(payload.details.deletedCount).to.equal(0);
      expect(payload.details.removedFilesCount).to.equal(0);
    });
  });

  describe('removeExpiredFiles()', () => {
    let clock;
    before(async () => {
      const date = new Date();
      const futureDate = date.setFullYear(date.getFullYear() + 4);
      //Mock the clock timer to test because the method removeExpiredFiles() checks the birthTime of the files
      clock = sinon.useFakeTimers({
        now: new Date(futureDate),
        shouldAdvanceTime: true,
        toFake: ['Date'],
      });
    });

    after(async () => {
      clock.restore();
    });

    it('should be deleted files with date of creation greater than retention_days config', async () => {
      const res = await openVPNService.removeExpiredFiles();
      expect(fs.existsSync(filePath)).to.be.false;
      expect(res).to.be.equal(1);
    });
  });

  describe('updateArchiveConfig()', () => {
    it('should be stored custom config in json file', async () => {
      const jsonPath = path.join(app.config.get('openvpn.history').data_dir, 'config.json');
      const custom_config = { history: { archive_days: 20, retention_days: 40 } };
      await openVPNService.updateArchiveConfig(custom_config);

      expect(fs.existsSync(jsonPath)).to.be.true;
    });

    it('should be overwritten base config by a custom config', async () => {
      const custom_config = { history: { archive_days: 20, retention_days: 40 } };
      await openVPNService.updateArchiveConfig(custom_config);
      const config = openVPNService.getCustomizedConfig();

      expect(config).to.be.deep.equal(custom_config);
    });
  });

  describe('getCustomizedConfig()', () => {
    let custom_config: OpenVPNUpdateableConfig;

    beforeEach(async () => {
      custom_config = {
        history: {
          archive_days: 20,
          retention_days: 40,
        },
      };
      await openVPNService.updateArchiveConfig(custom_config);
    });

    it('should be returned custom_config if config.json exists', async () => {
      expect(openVPNService.getCustomizedConfig()).to.be.deep.equals(custom_config);
    });

    it('should be returned base_config if config.json does not exist', async () => {
      fs.unlinkSync(path.join(app.config.get('openvpn.history').data_dir, 'config.json'));

      expect(openVPNService.getCustomizedConfig()).to.be.deep.equals({
        history: {
          archive_days: app.config.get('openvpn.history').archive_days,
          retention_days: app.config.get('openvpn.history').retention_days,
        },
      });
    });
  });
});
