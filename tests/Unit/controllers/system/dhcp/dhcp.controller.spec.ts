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
import { getRepository } from 'typeorm';
import { DhcpController } from '../../../../../src/controllers/system/dhcp/dhcp.controller';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../../src/models/fwcloud/FwCloud';
import { DHCPGroup } from '../../../../../src/models/system/dhcp/dhcp_g/dhcp_g.model';
import { DHCPRule } from '../../../../../src/models/system/dhcp/dhcp_r/dhcp_r.model';
import { testSuite } from '../../../../mocha/global-setup';
import { Request } from 'express';
import StringHelper from '../../../../../src/utils/string.helper';
import sinon from 'sinon';

describe(DhcpController.name, () => {
  let firewall: Firewall;
  let fwCloud: FwCloud;
  let dhcpgroup: DHCPGroup;
  let dhcprule: DHCPRule;

  let controller: DhcpController;
  let app: Application;

  beforeEach(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();

    controller = new DhcpController(app);

    fwCloud = await getRepository(FwCloud).save(
      getRepository(FwCloud).create({
        name: StringHelper.randomize(10),
      }),
    );

    firewall = await getRepository(Firewall).save(
      getRepository(Firewall).create({
        name: StringHelper.randomize(10),
        fwCloudId: fwCloud.id,
      }),
    );

    dhcpgroup = await getRepository(DHCPGroup).save({
      name: StringHelper.randomize(10),
      firewall: firewall,
    });

    dhcprule = await getRepository(DHCPRule).save(
      getRepository(DHCPRule).create({
        id: 1,
        group: await getRepository(DHCPGroup).save(
          getRepository(DHCPGroup).create({
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
    it('should fetch DHCPRule and DHCPGroup when dhcp param is present', async () => {
      const requestMock = {
        params: {
          dhcp: dhcprule.id,
          firewall: firewall.id,
          fwcloud: fwCloud.id,
        },
      } as unknown as Request;

      const dhcpruleStub = sinon
        .stub(getRepository(DHCPRule), 'findOneOrFail')
        .resolves(dhcprule);
      const firewallStub = sinon
        .stub(getRepository(Firewall), 'findOneOrFail')
        .resolves(firewall);
      const fwCloudStub = sinon
        .stub(getRepository(FwCloud), 'findOneOrFail')
        .resolves(fwCloud);

      await controller.make(requestMock);

      expect(dhcpruleStub.calledOnce).to.be.true;
      expect(firewallStub.calledOnce).to.be.true;
      expect(fwCloudStub.calledOnce).to.be.true;

      dhcpruleStub.restore();
      firewallStub.restore();
      fwCloudStub.restore();
    });

    it('should not fetch DHCPRule and DHCPGroup when dhcp param is not present', async () => {
      const requestMock = {
        params: {
          firewall: firewall.id,
          fwcloud: fwCloud.id,
        },
      } as unknown as Request;

      const dhcpruleStub = sinon.stub(getRepository(DHCPRule), 'findOneOrFail');
      const dhcpgroupStub = sinon.stub(
        getRepository(DHCPGroup),
        'findOneOrFail',
      );
      const firewallStub = sinon.stub(getRepository(Firewall), 'findOneOrFail');
      const fwCloudStub = sinon.stub(getRepository(FwCloud), 'findOneOrFail');

      await controller.make(requestMock);

      expect(dhcpruleStub.called).to.be.false;
      expect(dhcpgroupStub.called).to.be.false;
      expect(firewallStub.calledOnce).to.be.true;
      expect(fwCloudStub.calledOnce).to.be.true;

      dhcpruleStub.restore();
      dhcpgroupStub.restore();
      firewallStub.restore();
      fwCloudStub.restore();
    });

    it('should handle errors when entities are not found', async () => {
      const requestMock = {
        params: {
          dhcp: 999, // non-existent dhcp id
          firewall: firewall.id,
          fwcloud: fwCloud.id,
        },
      } as unknown as Request;

      const dhcpruleStub = sinon
        .stub(getRepository(DHCPRule), 'findOneOrFail')
        .throws(new Error('DHCPRule not found'));

      await expect(controller.make(requestMock)).to.be.rejectedWith(
        'DHCPRule not found',
      );

      dhcpruleStub.restore();
    });

    it('should fetch Firewall and FwCloud', async () => {
      const requestMock = {
        params: {
          firewall: firewall.id,
          fwcloud: fwCloud.id,
        },
      } as unknown as Request;

      const firewallStub = sinon
        .stub(getRepository(Firewall), 'findOneOrFail')
        .resolves(firewall);
      const fwCloudStub = sinon
        .stub(getRepository(FwCloud), 'findOneOrFail')
        .resolves(fwCloud);

      await controller.make(requestMock);

      expect(firewallStub.calledOnce).to.be.true;
      expect(fwCloudStub.calledOnce).to.be.true;

      firewallStub.restore();
      fwCloudStub.restore();
    });
  });
});
