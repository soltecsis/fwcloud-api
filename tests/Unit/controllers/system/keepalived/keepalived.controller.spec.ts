/*!
    Copyright 2023 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { expect } from 'chai';
import { Application } from '../../../../../src/Application';
import { KeepalivedController } from '../../../../../src/controllers/system/keepalived/keepalived.controller';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../../src/models/fwcloud/FwCloud';
import { KeepalivedGroup } from '../../../../../src/models/system/keepalived/keepalived_g/keepalived_g.model';
import { KeepalivedRule } from '../../../../../src/models/system/keepalived/keepalived_r/keepalived_r.model';
import { testSuite } from '../../../../mocha/global-setup';
import { Request } from 'express';
import StringHelper from '../../../../../src/utils/string.helper';
import sinon from 'sinon';
import { EntityManager } from 'typeorm';
import db from '../../../../../src/database/database-manager';

describe(KeepalivedController.name, () => {
  let firewall: Firewall;
  let fwCloud: FwCloud;
  //let keepalivedgroup: KeepalivedGroup;
  let Keepalivedrule: KeepalivedRule;

  let controller: KeepalivedController;
  let app: Application;
  let manager: EntityManager;

  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    controller = new KeepalivedController(app);

    fwCloud = await manager.getRepository(FwCloud).save(
      manager.getRepository(FwCloud).create({
        name: StringHelper.randomize(10),
      }),
    );

    firewall = await manager.getRepository(Firewall).save(
      manager.getRepository(Firewall).create({
        name: StringHelper.randomize(10),
        fwCloudId: fwCloud.id,
      }),
    );

    //keepalivedgroup =
    await manager.getRepository(KeepalivedGroup).save({
      name: StringHelper.randomize(10),
      firewall: firewall,
    });

    Keepalivedrule = await manager.getRepository(KeepalivedRule).save(
      manager.getRepository(KeepalivedRule).create({
        id: 1,
        group: await manager.getRepository(KeepalivedGroup).save(
          manager.getRepository(KeepalivedGroup).create({
            name: 'group',
            firewall: firewall,
          }),
        ),
        firewall: firewall,
        rule_order: 1,
        interface: null,
      }),
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('make', () => {
    it('should fetch KeepalivedRule and KeepalivedGroup when Keepalived param is present', async () => {
      const requestMock = {
        params: {
          keepalived: Keepalivedrule.id,
          firewall: firewall.id,
          fwcloud: fwCloud.id,
        },
      } as unknown as Request;

      const KeepalivedruleStub = sinon
        .stub(manager.getRepository(KeepalivedRule), 'findOneOrFail')
        .resolves(Keepalivedrule);
      const firewallStub = sinon
        .stub(manager.getRepository(Firewall), 'findOneOrFail')
        .resolves(firewall);
      const fwCloudStub = sinon
        .stub(manager.getRepository(FwCloud), 'findOneOrFail')
        .resolves(fwCloud);

      await controller.make(requestMock);

      expect(KeepalivedruleStub.calledOnce).to.be.true;
      expect(firewallStub.calledOnce).to.be.true;
      expect(fwCloudStub.calledOnce).to.be.true;

      KeepalivedruleStub.restore();
      firewallStub.restore();
      fwCloudStub.restore();
    });

    it('should not fetch KeepalivedRule and KeepalivedGroup when Keepalived param is not present', async () => {
      const requestMock = {
        params: {
          firewall: firewall.id,
          fwcloud: fwCloud.id,
        },
      } as unknown as Request;

      const KeepalivedruleStub = sinon.stub(manager.getRepository(KeepalivedRule), 'findOneOrFail');
      const KeepalivedgroupStub = sinon.stub(
        manager.getRepository(KeepalivedGroup),
        'findOneOrFail',
      );
      const firewallStub = sinon.stub(manager.getRepository(Firewall), 'findOneOrFail');
      const fwCloudStub = sinon.stub(manager.getRepository(FwCloud), 'findOneOrFail');

      await controller.make(requestMock);

      expect(KeepalivedruleStub.called).to.be.false;
      expect(KeepalivedgroupStub.called).to.be.false;
      expect(firewallStub.calledOnce).to.be.true;
      expect(fwCloudStub.calledOnce).to.be.true;

      KeepalivedruleStub.restore();
      KeepalivedgroupStub.restore();
      firewallStub.restore();
      fwCloudStub.restore();
    });

    it('should handle errors when entities are not found', async () => {
      const requestMock = {
        params: {
          keepalived: 999, // non-existent Keepalived id
          firewall: firewall.id,
          fwcloud: fwCloud.id,
        },
      } as unknown as Request;

      const KeepalivedruleStub = sinon
        .stub(manager.getRepository(KeepalivedRule), 'findOneOrFail')
        .throws(new Error('KeepalivedRule not found'));

      await expect(controller.make(requestMock)).to.be.rejectedWith('KeepalivedRule not found');

      KeepalivedruleStub.restore();
    });

    it('should fetch Firewall and FwCloud', async () => {
      const requestMock = {
        params: {
          firewall: firewall.id,
          fwcloud: fwCloud.id,
        },
      } as unknown as Request;

      const firewallStub = sinon
        .stub(manager.getRepository(Firewall), 'findOneOrFail')
        .resolves(firewall);
      const fwCloudStub = sinon
        .stub(manager.getRepository(FwCloud), 'findOneOrFail')
        .resolves(fwCloud);

      await controller.make(requestMock);

      expect(firewallStub.calledOnce).to.be.true;
      expect(fwCloudStub.calledOnce).to.be.true;

      firewallStub.restore();
      fwCloudStub.restore();
    });
  });
});
