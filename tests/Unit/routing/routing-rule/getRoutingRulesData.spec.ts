/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { before } from 'mocha';
import { RoutingRuleToIPObjGroup } from '../../../../src/models/routing/routing-rule/routing-rule-to-ipobj-group.model';
import { RoutingRuleToIPObj } from '../../../../src/models/routing/routing-rule/routing-rule-to-ipobj.model';
import { RoutingRuleToMark } from '../../../../src/models/routing/routing-rule/routing-rule-to-mark.model';
import { RoutingRuleToOpenVPNPrefix } from '../../../../src/models/routing/routing-rule/routing-rule-to-openvpn-prefix.model';
import { RoutingRuleToOpenVPN } from '../../../../src/models/routing/routing-rule/routing-rule-to-openvpn.model';
import {
  RoutingRulesData,
  RoutingRuleService,
} from '../../../../src/models/routing/routing-rule/routing-rule.service';
import { ItemForGrid, RoutingRuleItemForCompiler } from '../../../../src/models/routing/shared';
import { expect, testSuite } from '../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { EntityManager } from 'typeorm';
import db from '../../../../src/database/database-manager';

describe('Routing rules data fetch for compiler or grid', () => {
  let routingRuleService: RoutingRuleService;
  let fwc: FwCloudProduct;

  let routingRules:
    | RoutingRulesData<RoutingRuleItemForCompiler>[]
    | RoutingRulesData<ItemForGrid>[];
  let items: RoutingRuleItemForCompiler[] | ItemForGrid[];
  let manager: EntityManager;

  before(async () => {
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();
    fwc = await new FwCloudFactory().make();
    routingRuleService = await testSuite.app.getService<RoutingRuleService>(
      RoutingRuleService.name,
    );
  });

  describe('For compiler', () => {
    let item: RoutingRuleItemForCompiler;

    before(async () => {
      routingRules = await routingRuleService.getRoutingRulesData<RoutingRuleItemForCompiler>(
        'compiler',
        fwc.fwcloud.id,
        fwc.firewall.id,
      );
    });

    describe('Out of group', () => {
      beforeEach(() => {
        items = routingRules[0].items;
        item = {
          entityId: fwc.routingRules.get('routing-rule-1').id,
          type: 0,
          address: null,
          netmask: null,
          range_start: null,
          range_end: null,
          mark_code: null,
        };
      });

      it('should include address data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('address').address;
        expect(items).to.deep.include(item);
      });

      it('should include address range data', () => {
        item.type = 6;
        item.range_start = fwc.ipobjs.get('addressRange').range_start;
        item.range_end = fwc.ipobjs.get('addressRange').range_end;
        expect(items).to.deep.include(item);
      });

      it('should include lan data', () => {
        item.type = 7;
        item.address = fwc.ipobjs.get('network').address;
        item.netmask = fwc.ipobjs.get('network').netmask;
        expect(items).to.deep.include(item);
      });

      it('should include host data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('host-eth2-addr1').address;
        expect(items).to.deep.include(item);
        item.address = fwc.ipobjs.get('host-eth3-addr1').address;
        expect(items).to.deep.include(item);
        item.address = fwc.ipobjs.get('host-eth3-addr2').address;
        expect(items).to.deep.include(item);
      });

      it('should include OpenVPN data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('openvpn-cli3-addr').address;
        expect(items).to.deep.include(item);
      });

      it('should include OpenVPN Prefix data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('openvpn-cli1-addr').address;
        expect(items).to.deep.include(item);
        item.address = fwc.ipobjs.get('openvpn-cli2-addr').address;
        expect(items).to.deep.include(item);
      });

      it('should include mark data', () => {
        item.type = 30;
        item.mark_code = fwc.mark.code;
        expect(items).to.deep.include(item);
      });
    });

    describe('Into group', () => {
      beforeEach(() => {
        items = routingRules[1].items; // This route has the group of objects.
        item = {
          entityId: fwc.routingRules.get('routing-rule-2').id,
          type: 0,
          address: null,
          netmask: null,
          range_start: null,
          range_end: null,
          mark_code: null,
        };
      });

      it('should include address data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('address').address;
        expect(items).to.deep.include(item);
      });

      it('should include address range data', () => {
        item.type = 6;
        item.range_start = fwc.ipobjs.get('addressRange').range_start;
        item.range_end = fwc.ipobjs.get('addressRange').range_end;
        expect(items).to.deep.include(item);
      });

      it('should include lan data', () => {
        item.type = 7;
        item.address = fwc.ipobjs.get('network').address;
        item.netmask = fwc.ipobjs.get('network').netmask;
        expect(items).to.deep.include(item);
      });

      it('should include host data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('host-eth2-addr1').address;
        expect(items).to.deep.include(item);
        item.address = fwc.ipobjs.get('host-eth3-addr1').address;
        expect(items).to.deep.include(item);
        item.address = fwc.ipobjs.get('host-eth3-addr2').address;
        expect(items).to.deep.include(item);
      });

      it('should include OpenVPN data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('openvpn-cli3-addr').address;
        expect(items).to.deep.include(item);
      });

      it('should include OpenVPN Prefix data', () => {
        item.type = 5;
        item.address = fwc.ipobjs.get('openvpn-cli1-addr').address;
        expect(items).to.deep.include(item);
        item.address = fwc.ipobjs.get('openvpn-cli2-addr').address;
        expect(items).to.deep.include(item);
      });
    });
  });

  describe('For grid', () => {
    let item: ItemForGrid & Partial<{ _order: number }>;

    before(async () => {
      routingRules = await routingRuleService.getRoutingRulesData<ItemForGrid>(
        'grid',
        fwc.fwcloud.id,
        fwc.firewall.id,
      );
    });

    describe('Out of group', () => {
      beforeEach(() => {
        items = routingRules[0].items;
        item = {
          entityId: fwc.routingRules.get('routing-rule-1').id,
          id: 0,
          name: null,
          type: 0,
          firewall_id: null,
          firewall_name: null,
          cluster_id: null,
          cluster_name: null,
        };
      });

      it('should include address data', async () => {
        item.id = fwc.ipobjs.get('address').id;
        item.type = 5;
        item.name = fwc.ipobjs.get('address').name;
        item.host_id = null;
        item.host_name = null;
        item._order = (
          await manager.getRepository(RoutingRuleToIPObj).findOneOrFail({
            where: {
              routingRuleId: fwc.routingRules.get('routing-rule-1').id,
              ipObjId: item.id,
            },
          })
        ).order;
        expect(items).to.deep.include(item);
      });

      it('should include address range data', async () => {
        item.id = fwc.ipobjs.get('addressRange').id;
        item.type = 6;
        item.name = fwc.ipobjs.get('addressRange').name;
        item.host_id = null;
        item.host_name = null;
        item._order = (
          await manager.getRepository(RoutingRuleToIPObj).findOneOrFail({
            where: {
              routingRuleId: fwc.routingRules.get('routing-rule-1').id,
              ipObjId: item.id,
            },
          })
        ).order;
        expect(items).to.deep.include(item);
      });

      it('should include lan data', async () => {
        item.id = fwc.ipobjs.get('network').id;
        item.type = 7;
        item.name = fwc.ipobjs.get('network').name;
        item.host_id = null;
        item.host_name = null;
        item._order = (
          await manager.getRepository(RoutingRuleToIPObj).findOneOrFail({
            where: {
              routingRuleId: fwc.routingRules.get('routing-rule-1').id,
              ipObjId: item.id,
            },
          })
        ).order;
        expect(items).to.deep.include(item);
      });

      it('should include host data', async () => {
        item.id = fwc.ipobjs.get('host').id;
        item.type = 8;
        item.name = fwc.ipobjs.get('host').name;
        item.host_id = null;
        item.host_name = null;
        item._order = (
          await manager.getRepository(RoutingRuleToIPObj).findOneOrFail({
            where: {
              routingRuleId: fwc.routingRules.get('routing-rule-1').id,
              ipObjId: item.id,
            },
          })
        ).order;
        expect(items).to.deep.include(item);
      });

      it('should include OpenVPN data', async () => {
        item.id = fwc.openvpnClients.get('OpenVPN-Cli-3').id;
        item.type = 311;
        item.name = fwc.crts.get('OpenVPN-Cli-3').cn;
        item.firewall_id = fwc.firewall.id;
        item.firewall_name = fwc.firewall.name;
        item._order = (
          await manager.getRepository(RoutingRuleToOpenVPN).findOneOrFail({
            where: {
              routingRuleId: fwc.routingRules.get('routing-rule-1').id,
              openVPNId: item.id,
            },
          })
        ).order;
        expect(items).to.deep.include(item);
      });

      it('should include OpenVPN Prefix data', async () => {
        item.id = fwc.openvpnPrefix.id;
        item.type = 401;
        item.name = fwc.openvpnPrefix.name;
        item.firewall_id = fwc.firewall.id;
        item.firewall_name = fwc.firewall.name;
        item._order = (
          await manager.getRepository(RoutingRuleToOpenVPNPrefix).findOneOrFail({
            where: {
              routingRuleId: fwc.routingRules.get('routing-rule-1').id,
              openVPNPrefixId: item.id,
            },
          })
        ).order;
        expect(items).to.deep.include(item);
      });

      it('should include mark data', async () => {
        item.id = fwc.mark.id;
        item.type = 30;
        item.name = fwc.mark.name;
        item.firewall_id = fwc.firewall.id;
        item.firewall_name = fwc.firewall.name;
        item._order = (
          await manager.getRepository(RoutingRuleToMark).findOneOrFail({
            where: {
              routingRuleId: fwc.routingRules.get('routing-rule-1').id,
              markId: item.id,
            },
          })
        ).order;
        expect(items).to.deep.include(item);
      });
    });

    describe('Into group', () => {
      beforeEach(() => {
        items = routingRules[1].items; // This route has the group of objects.
        item = {
          entityId: fwc.routingRules.get('routing-rule-2').id,
          id: 0,
          name: null,
          type: 0,
          firewall_id: fwc.firewall.id,
          firewall_name: fwc.firewall.name,
          cluster_id: null,
          cluster_name: null,
        };
      });

      it('should include group', async () => {
        item.id = fwc.ipobjGroup.id;
        item.type = 20;
        item.name = fwc.ipobjGroup.name;
        item._order = (
          await manager.getRepository(RoutingRuleToIPObjGroup).findOneOrFail({
            where: {
              routingRuleId: fwc.routingRules.get('routing-rule-2').id,
              ipObjGroupId: item.id,
            },
          })
        ).order;
        expect(items).to.deep.include(item);
      });
    });
  });

  describe('Get data for only some routing rules', () => {
    it('should get data for routing rules 1 and 3', async () => {
      const ids = [
        fwc.routingRules.get('routing-rule-1').id,
        fwc.routingRules.get('routing-rule-3').id,
      ];
      routingRules = await routingRuleService.getRoutingRulesData<RoutingRuleItemForCompiler>(
        'compiler',
        fwc.fwcloud.id,
        fwc.firewall.id,
        ids,
      );

      expect(routingRules.length).to.equal(2);
      expect(routingRules[0].id).to.equal(ids[0]);
      expect(routingRules[1].id).to.equal(ids[1]);
    });

    it('should get data for routing rule 2', async () => {
      const ids = [fwc.routingRules.get('routing-rule-2').id];
      routingRules = await routingRuleService.getRoutingRulesData<RoutingRuleItemForCompiler>(
        'compiler',
        fwc.fwcloud.id,
        fwc.firewall.id,
        ids,
      );

      expect(routingRules.length).to.equal(1);
      expect(routingRules[0].id).to.equal(ids[0]);
    });
  });
});
