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

import { OpenVPNService } from '../../../src/models/vpn/openvpn/openvpn.service';
import { expect, describeName, testSuite } from '../../mocha/global-setup';
import { User } from '../../../src/models/user/User';
import { Application } from '../../../src/Application';
import { attachSession, createUser, generateSession } from '../../utils/utils';
import request = require('supertest');
import { _URL } from '../../../src/fonaments/http/router/router.service';
import { FwCloudFactory, FwCloudProduct } from '../../utils/fwcloud-factory';
import {
  CreateOpenVPNStatusHistoryData,
  OpenVPNStatusHistoryService,
} from '../../../src/models/vpn/openvpn/status/openvpn-status-history.service';
import { EntityManager } from 'typeorm';
import db from '../../../src/database/database-manager';

let app: Application;
let openVPNService: OpenVPNService;
let openVPNStatusHistoryService: OpenVPNStatusHistoryService;
let loggedUser: User;
let loggedUserSessionId: string;
let adminUser: User;
let adminUserSessionId: string;
let fwcProduct: FwCloudProduct;
let data: CreateOpenVPNStatusHistoryData[];
let manager: EntityManager;

describe(describeName('OpenVPNArchive E2E tests'), () => {
  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    fwcProduct = await new FwCloudFactory().make();

    openVPNService = await app.getService(OpenVPNService.name);
    openVPNStatusHistoryService = await app.getService(OpenVPNStatusHistoryService.name);

    loggedUser = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUser);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);
    const date1 = parseInt((new Date('2022-01-01').getTime() / 1000).toFixed(0));
    const date2 = parseInt((new Date('2000-01-01').getTime() / 1000).toFixed(0));
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
        timestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0)),
        name: 'test-status-history2',
        address: '1.1.1.1',
        bytesReceived: 100,
        bytesSent: 200,
        connectedAtTimestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0)),
      },
      {
        timestampInSeconds: date1,
        name: 'test-status-history3',
        address: '1.1.1.1',
        bytesReceived: 100,
        bytesSent: 200,
        connectedAtTimestampInSeconds: date1,
      },
      {
        timestampInSeconds: date2,
        name: 'test-status-history4',
        address: '1.1.1.1',
        bytesReceived: 100,
        bytesSent: 200,
        connectedAtTimestampInSeconds: date2,
      },
    ];

    await openVPNStatusHistoryService.create(fwcProduct.openvpnServer.id, data);

    await openVPNService.build();
  });

  describe('OpenVPNArchiveController', () => {
    describe('OpenVPNArchiveController@store', async () => {
      it('guest user should not create a history VPN archiver', async () => {
        await request(app.express).post(_URL().getURL('openvpnarchives.store')).expect(401);
      });

      it('regular user should not create a history VPN archiver', async () => {
        await request(app.express)
          .post(_URL().getURL('openvpnarchives.store'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('admin user should create a history VPN archiver', async () => {
        await request(app.express)
          .post(_URL().getURL('openvpnarchives.store'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(201)
          .then((response) => {
            expect(response.body.data).to.be.deep.equal({ rows: 2 });
          });
      });

      it('should throw an exception if process is locked', async () => {
        openVPNService.archiveHistory();

        await request(app.express)
          .post(_URL().getURL('openvpnarchives.store'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(500);
      });
    });
  });

  describe('OpenVPNArchiveConfigController', () => {
    describe('OpenVPNArchiveConfigController@show', async () => {
      it('guest user should not see history openVPN archiver config', async () => {
        await request(app.express).get(_URL().getURL('openvpnarchives.config.show')).expect(401);
      });

      it('regular user should not see history openVPN archiver config', async () => {
        await request(app.express)
          .get(_URL().getURL('openvpnarchives.config.show'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('admin user should see history openVPN archiver config', async () => {
        await request(app.express)
          .get(_URL().getURL('openvpnarchives.config.show'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.be.deep.equal({
              archive_days: openVPNService.getCustomizedConfig().history.archive_days,
              retention_days: openVPNService.getCustomizedConfig().history.retention_days,
            });
          });
      });
    });

    describe('OpenVPNArchiveConfigController@update', async () => {
      it('guest user should not update history VPN archiver config', async () => {
        await request(app.express).put(_URL().getURL('openvpnarchives.config.update')).expect(401);
      });

      it('regular user should not update history VPN archiver config', async () => {
        await request(app.express)
          .put(_URL().getURL('openvpnarchives.config.update'))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('admin user should update history VPN archiver config', async () => {
        await request(app.express)
          .put(_URL().getURL('openvpnarchives.config.update'))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send({
            archive_days: 20,
            retention_days: 40,
          })
          .expect(201)
          .then((response) => {
            expect(response.body.data).to.be.deep.equal({
              archive_days: openVPNService.getCustomizedConfig().history.archive_days,
              retention_days: openVPNService.getCustomizedConfig().history.retention_days,
            });
          });
      });
    });
  });
});
