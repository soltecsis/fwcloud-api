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

import { getRepository } from "typeorm";
import {
  HAProxyCompiled,
  HAProxyCompiler,
} from "../../../../../src/compiler/system/haproxy/HAProxyCompiler";
import { HAProxyRule } from "../../../../../src/models/system/haproxy/haproxy_r/haproxy_r.model";
import {
  HAProxyRuleService,
  HAProxyRulesData,
} from "../../../../../src/models/system/haproxy/haproxy_r/haproxy_r.service";
import { HAProxyRuleItemForCompiler } from "../../../../../src/models/system/haproxy/shared";
import { testSuite } from "../../../../mocha/global-setup";
import {
  FwCloudFactory,
  FwCloudProduct,
} from "../../../../utils/fwcloud-factory";
import { expect } from "chai";
import { IPObj } from "../../../../../src/models/ipobj/IPObj";
import { EventEmitter } from "events";
import sinon from "sinon";

describe(HAProxyCompiler.name, () => {
  let fwc: FwCloudProduct;

  let haproxyService: HAProxyRuleService;
  const compiler: HAProxyCompiler = new HAProxyCompiler();
  let rules: HAProxyRulesData<HAProxyRuleItemForCompiler>[];

  beforeEach(async () => {
    await testSuite.resetDatabaseData();

    fwc = await new FwCloudFactory().make();

    haproxyService = await testSuite.app.getService<HAProxyRuleService>(
      HAProxyRuleService.name,
    );

    const testData: HAProxyRule[] = [];

    for (let i = 0; i < 10; i++) {
      const rule: HAProxyRule = await getRepository(HAProxyRule).save(
        getRepository(HAProxyRule).create({
          rule_order: i + 1,
          rule_type: 1,
          firewall: fwc.firewall,
          frontendIp: await getRepository(IPObj).save(
            getRepository(IPObj).create({
              address: `192.168.1.${i}`,
              destination_port_start: 80,
              destination_port_end: 80,
              name: "test",
              ipObjTypeId: 0,
            }),
          ),
          frontendPort: await getRepository(IPObj).save(
            getRepository(IPObj).create({
              destination_port_start: 80,
              destination_port_end: 80,
              name: "test",
              ipObjTypeId: 0,
            }),
          ),
        }),
      );

      testData.push(rule);
    }

    rules =
      await haproxyService.getHAProxyRulesData<HAProxyRuleItemForCompiler>(
        "compiler",
        fwc.fwcloud.id,
        fwc.firewall.id,
      );
  });

  describe("compile", () => {
    it("should return an empty array when no data is provided", () => {
      expect(compiler.compile([])).to.be.an("array").that.is.empty;
    });

    it("should return an array with compiled data for an active rule", async (): Promise<void> => {
      expect(compiler.compile(rules)).to.be.an("array").that.is.not.empty;
    });

    it("should return an array with compiled data for an inactive rule", async (): Promise<void> => {
      rules.forEach((element) => {
        element.active = false;
      });

      const result: HAProxyCompiled[] = compiler.compile(rules);
      expect(result).to.be.an("array").that.is.not.empty;

      result.forEach((element) => {
        expect(element.active).to.be.false;
        expect(element.cs).equals("");
      });
    });

    it("should emit a progress event for each rule", async () => {
      const eventEmitter: EventEmitter = new EventEmitter();

      const progressHandler: sinon.SinonStub<any[], any> = sinon.stub();
      eventEmitter.on("progress", progressHandler);

      compiler.compile(rules, eventEmitter);

      rules.forEach(
        (
          rule: HAProxyRulesData<HAProxyRuleItemForCompiler>,
          index: number,
        ): void => {
          expect(
            progressHandler.calledWith(
              sinon.match({
                message: `Compiling HAProxy rule ${index} (ID: ${rule.id})${!rule.active ? " [DISABLED]" : ""}`,
              }),
            ),
          ).to.be.true;
        },
      );
    });
  });
});
