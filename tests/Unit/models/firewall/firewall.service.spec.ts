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
import { Application } from '../../../../src/Application';
import { FirewallService } from '../../../../src/models/firewall/firewall.service';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import StringHelper from '../../../../src/utils/string.helper';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { FSHelper } from '../../../../src/utils/fs-helper';
import * as path from 'path';
import * as fs from 'fs';
import { Installer } from '../../../../src/models/firewall/installer';
import sinon from 'sinon';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import sshTools from '../../../../src/utils/ssh';
import { EntityManager } from 'typeorm';
import db from '../../../../src/database/database-manager';

describe.skip(describeName('Firewall Service Unit Tests'), () => {
  let app: Application;
  let service: FirewallService;
  let firewall: Firewall;
  let manager: EntityManager;

  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    service = await app.getService<FirewallService>(FirewallService.name);

    firewall = await Firewall.save(
      Firewall.create({
        name: StringHelper.randomize(10),
        fwCloudId: (
          await manager
            .getRepository(FwCloud)
            .save(manager.getRepository(FwCloud).create({ name: StringHelper.randomize(10) }))
        ).id,
      }),
    );
  });

  it('should be provided as an application service', async () => {
    expect(await app.getService<FirewallService>(FirewallService.name)).to.be.instanceOf(
      FirewallService,
    );
  });

  describe('compile()', () => {
    it('should throw an exception if the firewall does not belong to a fwcloud', async () => {
      const _f: Firewall = await Firewall.save(
        Firewall.create({ name: StringHelper.randomize(10) }),
      );

      await expect(service.compile(_f)).to.be.rejectedWith(Error);
    });

    it('should create the firewall policy directory', async () => {
      await service.compile(firewall);

      const directoryExists: boolean = FSHelper.directoryExistsSync(
        path.join(
          app.config.get('policy').data_dir,
          firewall.fwCloudId.toString(),
          firewall.id.toString(),
        ),
      );
      expect(directoryExists).to.be.true;
    });

    it('should remove the policy directory if it already exists', async () => {
      const testFilePath: string = path.join(
        app.config.get('policy').data_dir,
        firewall.fwCloudId.toString(),
        firewall.id.toString(),
        'test',
      );
      FSHelper.mkdirSync(path.dirname(testFilePath));
      fs.writeFileSync(testFilePath, '');

      await service.compile(firewall);
      expect(FSHelper.fileExistsSync(testFilePath)).to.be.false;
    });

    it('should create script file', async () => {
      const scriptPath: string = path.join(
        app.config.get('policy').data_dir,
        firewall.fwCloudId.toString(),
        firewall.id.toString(),
        app.config.get('policy').script_name,
      );

      await service.compile(firewall);
      expect(FSHelper.fileExistsSync(scriptPath)).to.be.true;
    });

    it('should append headers into the script file', async () => {
      const scriptPath: string = path.join(
        app.config.get('policy').data_dir,
        firewall.fwCloudId.toString(),
        firewall.id.toString(),
        app.config.get('policy').script_name,
      );

      await service.compile(firewall);

      const scriptData: string = fs.readFileSync(scriptPath).toString();
      const headers: string = fs.readFileSync(app.config.get('policy').header_file).toString();
      expect(scriptData).contain(headers);
    });

    it('should append footer into the script file', async () => {
      const scriptPath: string = path.join(
        app.config.get('policy').data_dir,
        firewall.fwCloudId.toString(),
        firewall.id.toString(),
        app.config.get('policy').script_name,
      );

      await service.compile(firewall);
      const scriptData: string = fs.readFileSync(scriptPath).toString();
      const footers: string = fs.readFileSync(app.config.get('policy').footer_file).toString();
      expect(scriptData).contain(footers);
    });
  });

  describe('install()', () => {
    let sshRunCommandStub: sinon.SinonStub;
    let sshUploadFileStub: sinon.SinonStub;

    before(async () => {
      sshRunCommandStub = sinon.stub(sshTools, 'runCommand').resolves('done');
      sshUploadFileStub = sinon.stub(sshTools, 'uploadFile').resolves('done');
    });

    after(async () => {
      sshRunCommandStub.restore();
      sshUploadFileStub.restore();
    });

    it.skip('should merge custom ssh config', async () => {
      firewall.install_pass = 'test';
      firewall.install_port = 9999;
      firewall.install_user = 'user';

      const ipObj: IPObj = await manager.getRepository(IPObj).save(
        manager.getRepository(IPObj).create({
          name: 'test',
          address: '0.0.0.0',
          ipObjTypeId: 0,
          interfaceId: null,
        }),
      );

      firewall.install_ipobj = ipObj.id;
      await firewall.save();

      const spy = sinon.spy(Installer.prototype, 'install');

      await service.install(firewall, {
        username: 'user_2',
        password: 'test_2',
      });

      expect(
        spy.calledWith({
          host: '0.0.0.0',
          port: 9999,
          username: 'user_2',
          password: 'test_2',
        }),
      ).to.be.true;
    });
  });
});
