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

import { Application } from '../../../../../src/Application';
import { DhcpGroupController } from '../../../../../src/controllers/system/dhcp-group/dhcp-group.controller';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../../src/models/fwcloud/FwCloud';
import { DHCPGroup } from '../../../../../src/models/system/dhcp/dhcp_g/dhcp_g.model';
import StringHelper from '../../../../../src/utils/string.helper';
import { testSuite } from '../../../../mocha/global-setup';
import sinon from 'sinon';
import { Request } from 'express';
import { expect } from 'chai';
import { DHCPGroupService } from '../../../../../src/models/system/dhcp/dhcp_g/dhcp_g.service';
import { EntityManager } from 'typeorm';
import db from '../../../../../src/database/database-manager';

describe(DhcpGroupController.name, () => {
  let firewall: Firewall;
  let fwCloud: FwCloud;
  let dhcpgroup: DHCPGroup;

  let controller: DhcpGroupController;
  let app: Application;
  let manager: EntityManager;

  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    controller = new DhcpGroupController(app);

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

    dhcpgroup = await manager.getRepository(DHCPGroup).save({
      name: StringHelper.randomize(10),
      firewall: firewall,
    });
  });

  afterEach(async () => {
    sinon.restore();
  });

  describe('make', () => {
    it('should fetch DHCPGroup when dhcpGroup param is present', async () => {
      const requestMock = {
        params: {
          dhcpgroup: dhcpgroup.id,
          firewall: firewall.id,
          fwcloud: fwCloud.id,
        },
      } as unknown as Request;

      const dhcpGroupServiceStub = sinon
        .stub(DHCPGroupService.prototype, 'findOneInPath')
        .resolves(dhcpgroup);
      const firewallStub = sinon
        .stub(manager.getRepository(Firewall), 'findOneOrFail')
        .resolves(firewall);
      const fwCloudStub = sinon
        .stub(manager.getRepository(FwCloud), 'findOneOrFail')
        .resolves(fwCloud);

      await controller.make(requestMock);

      expect(dhcpGroupServiceStub.calledOnce).to.be.true;
      expect(firewallStub.calledOnce).to.be.true;
      expect(fwCloudStub.calledOnce).to.be.true;

      dhcpGroupServiceStub.restore();
      firewallStub.restore();
      fwCloudStub.restore();
    });

    it('should fetch Firewall and FwCloud when dhcpGroup param is not present', async () => {
      const requestMock = {
        params: {
          firewall: firewall.id,
          fwcloud: fwCloud.id,
        },
      } as unknown as Request;

      const dhcpGroupServiceStub = sinon.stub(DHCPGroupService.prototype, 'findOneInPath');
      const firewallStub = sinon.stub(manager.getRepository(Firewall), 'findOneOrFail');
      const fwCloudStub = sinon.stub(manager.getRepository(FwCloud), 'findOneOrFail');

      await controller.make(requestMock);

      expect(dhcpGroupServiceStub.calledOnce).to.be.false;
      expect(firewallStub.calledOnce).to.be.true;
      expect(fwCloudStub.calledOnce).to.be.true;

      dhcpGroupServiceStub.restore();
      firewallStub.restore();
      fwCloudStub.restore();
    });

    it('should handle errors when entities are not found', async () => {
      const requestMock = {
        params: {
          dhcpgroup: 9999,
          firewall: firewall.id,
          fwcloud: fwCloud.id,
        },
      } as unknown as Request;

      const dhcpGroupServiceStub = sinon
        .stub(DHCPGroupService.prototype, 'findOneInPath')
        .throws(new Error('DHCP Group not found'));

      await expect(controller.make(requestMock)).to.be.rejectedWith('DHCP Group not found');

      dhcpGroupServiceStub.restore();
    });
  });
});
