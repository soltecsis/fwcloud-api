/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { AbstractApplication } from "../../../../src/fonaments/abstract-application";
import { PolicyRule } from "../../../../src/models/policy/PolicyRule";
import { PolicyGroup } from "../../../../src/models/policy/PolicyGroup";
import PolicyGroupRepository from "../../../../src/repositories/PolicyGroupRepository";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { getCustomRepository } from "typeorm";

let app: AbstractApplication;

describe(describeName('PolicyGroupRepository tests'), () => {

    beforeEach(async () => {
        app = testSuite.app;
    });

    describe(describeName('PolicyGroupRepository deleteIfEmpty'), () => {

        describe('deleteIfEmpty()', () => {
            it('should delete a policyGroup if it is empty', async () => {
                let policyGroup: PolicyGroup = await PolicyGroup.save(PolicyGroup.create({
                    name: 'group',
                    firewall: await Firewall.save(Firewall.create({
                        name: 'firewall'
                    }))
                }));

                await getCustomRepository(PolicyGroupRepository).deleteIfEmpty(policyGroup);

                expect(await PolicyGroup.findOne(policyGroup.id)).to.be.undefined;
            });

            it('should not delete a policyGroup if it is not empty', async () => {
                let policyGroup: PolicyGroup = await PolicyGroup.save(PolicyGroup.create({
                    name: 'group',
                    firewall: await Firewall.save(Firewall.create({
                        name: 'firewall'
                    })),
                    policyRules: [
                        await PolicyRule.save(PolicyRule.create({
                            rule_order: 0,
                            action: 0
                        }))
                    ]
                }));

                await getCustomRepository(PolicyGroupRepository).deleteIfEmpty(policyGroup);

                expect(await PolicyGroup.findOne(policyGroup.id)).to.be.instanceOf(PolicyGroup);
            });

        });
    });
});