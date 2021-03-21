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

import { describeName, expect } from "../../../mocha/global-setup";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { getRepository } from "typeorm";
import StringHelper from "../../../../src/utils/string.helper";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import sinon, { SinonSpy } from "sinon";
import { PolicyRule } from "../../../../src/models/policy/PolicyRule";
import db from "../../../../src/database/database-manager";
import { IPTablesCompiler, ACTION, POLICY_TYPE, POLICY_TYPE_INPUT, POLICY_TYPE_OUTPUT, POLICY_TYPE_FORWARD, POLICY_TYPE_SNAT, POLICY_TYPE_DNAT } from '../../../../src/compiler/iptables/iptables-compiler';

function positionsEmpty(data: any): boolean {
    if (!data || !data.positions) return false;

    for(let i=0; i<data.positions.length; i++) {
        if (data.positions[i].ipobjs.length !== 0) return false;
    }

    return true;
}

describe(describeName('IPTables Compiler Unit Tests - Empty rule'), () => {
    const sandbox = sinon.createSandbox();
    let spy: SinonSpy;

    let fwcloud: number;
    let dbCon: any;

    let ruleData = {
        firewall: 0,
        type: 0,
        rule_order: 1,
        action: 1,
        active: 1,
        special: 0,
        options: 0    
    }

    async function runTest(type: number): Promise<void> {
        ruleData.type = type;
        const rule = await PolicyRule.insertPolicy_r(ruleData);
        let result: any;
        let error: any;

        try {
            result = await IPTablesCompiler.compile(dbCon, fwcloud, ruleData.firewall, type, rule);
        } catch(err) { error = err }
        
        expect(spy.calledOnce).to.be.true;
        expect(positionsEmpty(spy.getCall(0).args[0])).to.be.true;

        if (type === POLICY_TYPE_DNAT) { 
            expect(error).to.eql({
                fwcErr: 999999,
                msg: "For DNAT 'Translated Destination' is mandatory"
            });
        } else {
            let cs: string;
            if (ruleData.action===4 && type!==POLICY_TYPE_SNAT && type!==POLICY_TYPE_DNAT) // Accounting
                cs = `$IPTABLES -N FWCRULE${rule}.ACC\n$IPTABLES -A FWCRULE${rule}.ACC -j RETURN\n$IPTABLES -A ${POLICY_TYPE[type]} -j FWCRULE${rule}.ACC\n`
            else
                cs = `$IPTABLES ${type===POLICY_TYPE_SNAT?'-t nat ':''}-A ${POLICY_TYPE[type]} -j ${type===POLICY_TYPE_SNAT?'MASQUERADE':ACTION[ruleData.action]}\n`;
            
            expect(result).to.eql([{
                id: rule,
                active: ruleData.active,
                comment: null,
                cs: cs
            }]);    
        }
    }
    
        
    beforeEach(async () => {
        spy = sandbox.spy(IPTablesCompiler, "ruleCompile");
    });

    afterEach(() => {
        sandbox.restore();
    });

    before(async () => {
        dbCon = db.getQuery();

        fwcloud = (await getRepository(FwCloud).save(getRepository(FwCloud).create({ name: StringHelper.randomize(10) }))).id;
        ruleData.firewall = (await getRepository(Firewall).save(getRepository(Firewall).create({ name: StringHelper.randomize(10), fwCloudId: fwcloud }))).id;
    });


    describe('Empty rule with ACCEPT action', () => {
        before(async () => {
            ruleData.action = 1; // ACCEPT
        });

        it('in INPUT chain', async () => {
            await runTest(POLICY_TYPE_INPUT);
        });

        it('in OUTPUT chain', async () => {
            await runTest(POLICY_TYPE_OUTPUT);
        });

        it('in FORWARD chain', async () => {
            await runTest(POLICY_TYPE_FORWARD);
        });

        it('in SNAT', async () => {
            await runTest(POLICY_TYPE_SNAT);
        });

        it('in DNAT', async () => {
            await runTest(POLICY_TYPE_DNAT);
        });
    });

    describe('Empty rule with DROP action', () => {
        before(async () => {
            ruleData.action = 2; // DROP
        });

        it('in INPUT chain', async () => {
            await runTest(POLICY_TYPE_INPUT);
        });

        it('in OUTPUT chain', async () => {
            await runTest(POLICY_TYPE_OUTPUT);
        });

        it('in FORWARD chain', async () => {
            await runTest(POLICY_TYPE_FORWARD);
        });

        it('in SNAT', async () => {
            await runTest(POLICY_TYPE_SNAT);
        });

        it('in DNAT', async () => {
            await runTest(POLICY_TYPE_DNAT);
        });
    });

    describe('Empty rule with REJECT action', () => {
        before(async () => {
            ruleData.action = 3; // REJECT
        });

        it('in INPUT chain', async () => {
            await runTest(POLICY_TYPE_INPUT);
        });

        it('in OUTPUT chain', async () => {
            await runTest(POLICY_TYPE_OUTPUT);
        });

        it('in FORWARD chain', async () => {
            await runTest(POLICY_TYPE_FORWARD);
        });

        it('in SNAT', async () => {
            await runTest(POLICY_TYPE_SNAT);
        });

        it('in DNAT', async () => {
            await runTest(POLICY_TYPE_DNAT);
        });
    });

    describe('Empty rule with ACCOUNTING action', () => {
        before(async () => {
            ruleData.action = 4; // ACCOUNTING
        });

        it('in INPUT chain', async () => {
            await runTest(POLICY_TYPE_INPUT);
        });

        it('in OUTPUT chain', async () => {
            await runTest(POLICY_TYPE_OUTPUT);
        });

        it('in FORWARD chain', async () => {
            await runTest(POLICY_TYPE_FORWARD);
        });

        it('in SNAT', async () => {
            await runTest(POLICY_TYPE_SNAT);
        });

        it('in DNAT', async () => {
            await runTest(POLICY_TYPE_DNAT);
        });
    });
});