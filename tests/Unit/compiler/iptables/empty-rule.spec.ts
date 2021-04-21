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
import { IPTablesCompiler, RuleActionsMap, ACTION, POLICY_TYPE } from '../../../../src/compiler/iptables/iptables-compiler';
import { positionsEmpty } from "./utils"
import { PolicyTypesMap } from "../../../../src/models/policy/PolicyType";

describe(describeName('IPTables Compiler Unit Tests - Empty rule'), () => {
    const sandbox = sinon.createSandbox();
    let spy: SinonSpy;

    let fwcloud: number;
    let dbCon: any;

    let IPv: string;

    let ruleData = {
        firewall: 0,
        type: 0,
        rule_order: 1,
        action: 1,
        active: 1,
        special: 0,
        options: 0    
    }

    async function runTest(policyType: number): Promise<void> {
        ruleData.type = policyType;
        const rule = await PolicyRule.insertPolicy_r(ruleData);
        const cmd = IPv === 'IPv4' ? '$IPTABLES' : '$IP6TABLES';
        let result: any;
        let error: any;

        try {
            result = await IPTablesCompiler.compile(dbCon, fwcloud, ruleData.firewall, policyType, rule);
        } catch(err) { error = err }
        
        expect(spy.calledOnce).to.be.true;
        expect(positionsEmpty(spy.getCall(0).args[0])).to.be.true;

        if (policyType === PolicyTypesMap.get(`${IPv}:DNAT`)) { 
            expect(error).to.eql({
                fwcErr: 999999,
                msg: "For DNAT 'Translated Destination' is mandatory"
            });
        } else {
            let cs: string;
            let action = (policyType===PolicyTypesMap.get(`${IPv}:SNAT`)) ? 'MASQUERADE' : ACTION[ruleData.action];
            if (action==='ACCOUNTING') action = 'RETURN';
            const st = (ruleData.action===RuleActionsMap.get('ACCEPT') && ruleData.options&0x0001 && policyType!==PolicyTypesMap.get(`${IPv}:SNAT`) && policyType!==PolicyTypesMap.get(`${IPv}:DNAT`)) ? '-m conntrack --ctstate NEW ' : '' ;
            
            // Accounting ,logging and marking is not allowed with SNAT and DNAT chains.
            const log = (ruleData.options&0x0004 && policyType!==PolicyTypesMap.get(`${IPv}:SNAT`) && policyType!==PolicyTypesMap.get(`${IPv}:DNAT`)) ? `${cmd} -N FWCRULE${rule}.LOG\n${cmd} -A FWCRULE${rule}.LOG -m limit --limit 60/minute -j LOG --log-level info --log-prefix \"RULE ID ${rule} [${action}] \"\n${cmd} -A FWCRULE${rule}.LOG -j ${action}\n`: '';
            if (log) action = `FWCRULE${rule}.LOG`;

            if (ruleData.action===4 && policyType!==PolicyTypesMap.get(`${IPv}:SNAT`) && policyType!==PolicyTypesMap.get(`${IPv}:DNAT`)) // Accounting
                cs = `${log}${cmd} -N FWCRULE${rule}.ACC\n${cmd} -A FWCRULE${rule}.ACC -j ${action}\n${cmd} -A ${POLICY_TYPE[policyType]} ${st}-j FWCRULE${rule}.ACC\n`
            else
                cs = `${log}${cmd} ${policyType===PolicyTypesMap.get(`${IPv}:SNAT`)?'-t nat ':''}-A ${POLICY_TYPE[policyType]} ${st}-j ${action}\n`;
            
            expect(result).to.eql([{
                id: rule,
                active: ruleData.active,
                comment: null,
                cs: cs
            }]);    
        }
    }
    
    before(async () => {
        dbCon = db.getQuery();

        fwcloud = (await getRepository(FwCloud).save(getRepository(FwCloud).create({ name: StringHelper.randomize(10) }))).id;
        ruleData.firewall = (await getRepository(Firewall).save(getRepository(Firewall).create({ name: StringHelper.randomize(10), fwCloudId: fwcloud }))).id;
    });
        
    beforeEach(() => {
        spy = sandbox.spy(IPTablesCompiler, "ruleCompile");
    });

    afterEach(() => {
        sandbox.restore();
    });


    describe('Empty rule in IPv4', () => {
        beforeEach(() => { IPv = 'IPv4' });

        describe('Empty rule with ACCEPT action', () => {
            before(async () => { ruleData.action = RuleActionsMap.get('ACCEPT') });

            describe('statefull', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x01 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x05 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });

            describe('stateless', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x02 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x06 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });
        });

        describe('Empty rule with DROP action', () => {
            before(async () => { ruleData.action = RuleActionsMap.get('DROP') });

            describe('statefull', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x01 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x05 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });

            describe('stateless', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x02 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x06 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });
        });

        describe('Empty rule with REJECT action', () => {
            before(async () => { ruleData.action = RuleActionsMap.get('REJECT') });

            describe('statefull', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x01 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x05 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });

            describe('stateless', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x02 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x06 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });
        });

        describe('Empty rule with ACCOUNTING action', () => {
            before(async () => { ruleData.action = RuleActionsMap.get('ACCOUNTING') });

            describe('statefull', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x01 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x05 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });

            describe('stateless', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x02 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x06 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });
        });
    });


    describe('Empty rule in IPv6', () => {
        beforeEach(() => { IPv = 'IPv6' });

        describe('Empty rule with ACCEPT action', () => {
            before(async () => { ruleData.action = RuleActionsMap.get('ACCEPT') });

            describe('statefull', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x01 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x05 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });

            describe('stateless', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x02 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x06 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });
        });

        describe('Empty rule with DROP action', () => {
            before(async () => { ruleData.action = RuleActionsMap.get('DROP') });

            describe('statefull', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x01 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x05 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });

            describe('stateless', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x02 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x06 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });
        });

        describe('Empty rule with REJECT action', () => {
            before(async () => { ruleData.action = RuleActionsMap.get('REJECT') });

            describe('statefull', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x01 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x05 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });

            describe('stateless', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x02 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x06 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });
        });

        describe('Empty rule with ACCOUNTING action', () => {
            before(async () => { ruleData.action = RuleActionsMap.get('ACCOUNTING') });

            describe('statefull', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x01 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x05 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });

            describe('stateless', () => {
                describe('without log', () => {
                    before(async () => { ruleData.options = 0x02 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });

                describe('with log', () => {
                    before(async () => { ruleData.options = 0x06 });
                    it('in INPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:INPUT`)) });
                    it('in OUTPUT chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:OUTPUT`)) });   
                    it('in FORWARD chain', async () => { await runTest(PolicyTypesMap.get(`${IPv}:FORWARD`)) });
                    it('in SNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:SNAT`)) });
                    it('in DNAT', async () => { await runTest(PolicyTypesMap.get(`${IPv}:DNAT`)) });
                });
            });
        });
    });
});