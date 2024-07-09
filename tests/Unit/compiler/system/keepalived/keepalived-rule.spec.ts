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

import sinon from 'sinon';
import { DeepPartial, EntityManager } from 'typeorm';
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import {
  KeepalivedCompiled,
  KeepalivedCompiler,
} from '../../../../../src/compiler/system/keepalived/KeepalivedCompiler';
import { IPObj } from '../../../../../src/models/ipobj/IPObj';
import { KeepalivedRule } from '../../../../../src/models/system/keepalived/keepalived_r/keepalived_r.model';
import {
  KeepalivedRuleService,
  KeepalivedRulesData,
} from '../../../../../src/models/system/keepalived/keepalived_r/keepalived_r.service';
import { KeepalivedRuleItemForCompiler } from '../../../../../src/models/system/keepalived/shared';
import { expect, testSuite } from '../../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import db from '../../../../../src/database/database-manager';

describe(KeepalivedCompiler.name, () => {
  let fwc: FwCloudProduct;

  let keepalivedRuleService: KeepalivedRuleService;
  const compiler: KeepalivedCompiler = new KeepalivedCompiler();
  let rules: KeepalivedRulesData<KeepalivedRuleItemForCompiler>[];
  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    fwc = await new FwCloudFactory().make();

    keepalivedRuleService = await testSuite.app.getService<KeepalivedRuleService>(
      KeepalivedRuleService.name,
    );

    const testData: KeepalivedRule[] = [];

    for (let i = 0; i < 10; i++) {
      const rule: KeepalivedRule = await manager.getRepository(KeepalivedRule).save(
        manager.getRepository(KeepalivedRule).create({
          id: 1,
          rule_order: 1,
          rule_type: 1,
          firewall: fwc.firewall,
          max_lease: 5,
          interface: null,
          virtualIps: [],
        } as DeepPartial<KeepalivedRule>),
      );

      testData.push(rule);
    }

    rules = await keepalivedRuleService.getKeepalivedRulesData<KeepalivedRuleItemForCompiler>(
      'compiler',
      fwc.fwcloud.id,
      fwc.firewall.id,
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

      const result: KeepalivedCompiled[] = compiler.compile(rules);
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

      rules.forEach(
        (rule: KeepalivedRulesData<KeepalivedRuleItemForCompiler>, index: number): void => {
          expect(
            progressHandler.calledWith(
              sinon.match({
                message: `Compiling Keepalived rule ${index} (ID: ${rule.id})${!rule.active ? ' [DISABLED]' : ''}`,
              }),
            ),
          ).to.be.true;
        },
      );
    });
  });
});
