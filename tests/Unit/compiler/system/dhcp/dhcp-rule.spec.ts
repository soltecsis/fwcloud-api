/*
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { DHCPCompiled, DHCPCompiler } from '../../../../../src/compiler/system/dhcp/DHCPCompiler';
import {
  DHCPRuleService,
  DHCPRulesData,
} from '../../../../../src/models/system/dhcp/dhcp_r/dhcp_r.service';
import { DHCPRuleItemForCompiler } from '../../../../../src/models/system/dhcp/shared';
import { testSuite } from '../../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import { EntityManager } from 'typeorm';
import { DHCPRule } from '../../../../../src/models/system/dhcp/dhcp_r/dhcp_r.model';
import { IPObj } from '../../../../../src/models/ipobj/IPObj';
import sinon from 'sinon';
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import db from '../../../../../src/database/database-manager';

describe(DHCPCompiler.name, (): void => {
  let fwc: FwCloudProduct;

  let dhcpRuleService: DHCPRuleService;
  const compiler: DHCPCompiler = new DHCPCompiler();
  let rules: DHCPRulesData<DHCPRuleItemForCompiler>[];
  let manager: EntityManager;

  beforeEach(async (): Promise<void> => {
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    fwc = await new FwCloudFactory().make();

    dhcpRuleService = await testSuite.app.getService<DHCPRuleService>(DHCPRuleService.name);

    const testData: DHCPRule[] = [];

    for (let i = 0; i < 10; i++) {
      const rule: DHCPRule = await manager.getRepository(DHCPRule).save(
        manager.getRepository(DHCPRule).create({
          id: 1,
          rule_order: 1,
          interface: null,
          rule_type: 1,
          firewall: fwc.firewall,
          max_lease: 5,
          network: await manager.getRepository(IPObj).save(
            manager.getRepository(IPObj).create({
              name: 'test',
              address: '0.0.0.0',
              ipObjTypeId: 0,
              netmask: '/24',
            }),
          ),
          range: await manager.getRepository(IPObj).save(
            manager.getRepository(IPObj).create({
              name: 'test',
              address: '0.0.0.0',
              ipObjTypeId: 0,
              range_start: '1',
              range_end: '2',
            }),
          ),
          router: await manager.getRepository(IPObj).save(
            manager.getRepository(IPObj).create({
              name: 'test',
              address: '0.0.0.0',
              ipObjTypeId: 0,
              netmask: '/24',
            }),
          ),
        }),
      );

      testData.push(rule);
    }

    rules = await dhcpRuleService.getDHCPRulesData<DHCPRuleItemForCompiler>(
      'compiler',
      fwc.fwcloud.id,
      fwc.firewall.id,
      [1, 2, 3],
    );
  });

  describe('compile', () => {
    it('should return an empty array when no data is provided', () => {
      expect(compiler.compile([])).to.be.an('array').that.is.empty;
    });

    it('should return an array with compiled data for an active rule', async (): Promise<void> => {
      expect(compiler.compile(rules)).to.be.an('array').that.is.not.empty;
    });

    it('should return an array with compiled data for an inactive rule', async (): Promise<void> => {
      rules.forEach((element) => {
        element.active = false;
      });

      const result: DHCPCompiled[] = compiler.compile(rules);
      expect(result).to.be.an('array').that.is.not.empty;

      result.forEach((element) => {
        expect(element.active).to.be.false;
        expect(element.cs).to.not.be.empty;
      });
    });

    it('should emit a progress event for each rule', async () => {
      const eventEmitter: EventEmitter = new EventEmitter();

      const progressHandler: sinon.SinonStub<any[], any> = sinon.stub();
      eventEmitter.on('progress', progressHandler);

      compiler.compile(rules, eventEmitter);

      rules.forEach((rule: DHCPRulesData<DHCPRuleItemForCompiler>, index: number): void => {
        expect(
          progressHandler.calledWith(
            sinon.match({
              message: `Compiling DHCP rule ${index} (ID: ${rule.id})${!rule.active ? ' [DISABLED]' : ''}`,
            }),
          ),
        ).to.be.true;
      });
    });
  });
});
