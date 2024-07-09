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

import { describeName, expect } from '../../../mocha/global-setup';
import { PolicyRule, SpecialPolicyRules } from '../../../../src/models/policy/PolicyRule';
import db from '../../../../src/database/database-manager';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';
import { RulePositionsMap } from '../../../../src/models/policy/PolicyPosition';
import { populateRule } from './utils';
import {
  AvailablePolicyCompilers,
  PolicyCompiler,
} from '../../../../src/compiler/policy/PolicyCompiler';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';

describe(describeName('Policy Compiler Unit Tests - Fail2Ban special rule'), () => {
  let fwcProduct: FwCloudProduct;
  let dbCon: any;
  let IPv: string;
  let compiler: AvailablePolicyCompilers;
  let chain: string;
  //let manager: EntityManager;

  const cmd = 'systemctl restart fail2ban';
  const comment = 'Fail2Ban compatibility rule';

  const ruleData = {
    firewall: 0,
    type: 0,
    rule_order: 1,
    action: 1,
    active: 1,
    special: SpecialPolicyRules.FAIL2BAN,
    options: 1,
    run_before: cmd,
    run_after: null,
    fw_apply_to: null,
    comment: comment,
  };

  async function runTest(): Promise<void> {
    let rule: number;
    let result: any;
    let error: any;

    try {
      rule = await PolicyRule.insertPolicy_r(ruleData);
      if (ruleData.type === PolicyTypesMap.get(`${IPv}:DNAT`))
        await populateRule(rule, RulePositionsMap.get(`${IPv}:DNAT:Translated Destination`), 50010); // 50010 = Standard VRRP IP

      const rulesData: any = await PolicyRule.getPolicyData(
        'compiler',
        dbCon,
        fwcProduct.fwcloud.id,
        ruleData.firewall,
        ruleData.type,
        [rule],
        null,
      );
      result = await PolicyCompiler.compile(compiler, rulesData);
    } catch (err) {
      error = err;
    }

    const cs = `###########################\n# Hook script rule code:\n${cmd}\n###########################\n`;

    if (ruleData.type != PolicyTypesMap.get('IPv4:INPUT')) {
      expect(error).to.eql({
        fwcErr: 999999,
        msg: 'Invalid chain for Fail2Ban special rule',
      });
    } else {
      expect(result).to.eql([
        {
          id: rule,
          active: ruleData.active,
          comment: comment,
          cs: `${ruleData.fw_apply_to ? `if [ "$HOSTNAME" = "${fwcProduct.firewall.name}" ]; then\n` : ''}${cs}${ruleData.fw_apply_to ? 'fi\n' : ''}`,
        },
      ]);
    }
  }

  before(async () => {
    dbCon = db.getQuery();
    //manager =
    db.getSource().manager;
    fwcProduct = await new FwCloudFactory().make();
    ruleData.firewall = fwcProduct.firewall.id;
  });

  describe('IPv4', () => {
    before(() => {
      IPv = 'IPv4';
    });

    describe('CrowdSec special rule compilation (IPTables, INPUT chain)', () => {
      before(() => {
        compiler = 'IPTables';
        chain = 'INPUT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
        ruleData.fw_apply_to = null;
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (NFTables, INPUT chain)', () => {
      before(() => {
        compiler = 'NFTables';
        chain = 'INPUT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
        ruleData.fw_apply_to = null;
      });

      it('should compile as expected', async () => {
        await runTest();
      });

      it('should compile with firewall apply to', async () => {
        ruleData.fw_apply_to = fwcProduct.firewall.id;
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (IPTables, OUTPUT chain)', () => {
      before(() => {
        compiler = 'IPTables';
        chain = 'OUTPUT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (NFTables, OUTPUT chain)', () => {
      before(() => {
        compiler = 'NFTables';
        chain = 'OUTPUT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (IPTables, FORWARD chain)', () => {
      before(() => {
        compiler = 'IPTables';
        chain = 'FORWARD';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
        ruleData.fw_apply_to = null;
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (NFTables, FORWARD chain)', () => {
      before(() => {
        compiler = 'NFTables';
        chain = 'FORWARD';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
        ruleData.fw_apply_to = null;
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (IPTables, SNAT chain)', () => {
      before(() => {
        compiler = 'IPTables';
        chain = 'SNAT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (NFTables, SNAT chain)', () => {
      before(() => {
        compiler = 'NFTables';
        chain = 'SNAT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (IPTables, DNAT chain)', () => {
      before(() => {
        compiler = 'IPTables';
        chain = 'DNAT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (NFTables, DNAT chain)', () => {
      before(() => {
        compiler = 'NFTables';
        chain = 'DNAT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });
  });

  describe('IPv6', () => {
    before(() => {
      IPv = 'IPv6';
    });

    describe('CrowdSec special rule compilation (IPTables, INPUT chain)', () => {
      before(() => {
        compiler = 'IPTables';
        chain = 'INPUT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
        ruleData.fw_apply_to = null;
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (NFTables, INPUT chain)', () => {
      before(() => {
        compiler = 'NFTables';
        chain = 'INPUT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
        ruleData.fw_apply_to = null;
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (IPTables, OUTPUT chain)', () => {
      before(() => {
        compiler = 'IPTables';
        chain = 'OUTPUT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (NFTables, OUTPUT chain)', () => {
      before(() => {
        compiler = 'NFTables';
        chain = 'OUTPUT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (IPTables, FORWARD chain)', () => {
      before(() => {
        compiler = 'IPTables';
        chain = 'FORWARD';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
        ruleData.fw_apply_to = null;
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (NFTables, FORWARD chain)', () => {
      before(() => {
        compiler = 'NFTables';
        chain = 'FORWARD';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
        ruleData.fw_apply_to = null;
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (IPTables, SNAT chain)', () => {
      before(() => {
        compiler = 'IPTables';
        chain = 'SNAT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (NFTables, SNAT chain)', () => {
      before(() => {
        compiler = 'NFTables';
        chain = 'SNAT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (IPTables, DNAT chain)', () => {
      before(() => {
        compiler = 'IPTables';
        chain = 'DNAT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });

    describe('CrowdSec special rule compilation (NFTables, DNAT chain)', () => {
      before(() => {
        compiler = 'NFTables';
        chain = 'DNAT';
        ruleData.type = PolicyTypesMap.get(`${IPv}:${chain}`);
      });

      it('should throw invalid chain exception', async () => {
        await runTest();
      });
    });
  });
});
