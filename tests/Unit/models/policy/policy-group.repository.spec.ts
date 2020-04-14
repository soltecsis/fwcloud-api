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
import { RepositoryService } from "../../../../src/database/repository.service";
import { PolicyRule } from "../../../../src/models/policy/PolicyRule";
import { PolicyGroup } from "../../../../src/models/policy/PolicyGroup";
import PolicyGroupRepository from "../../../../src/repositories/PolicyGroupRepository";
import { Firewall } from "../../../../src/models/firewall/Firewall";

let policyGroupRepository: PolicyGroupRepository;
let app: AbstractApplication;
let repositoryService: RepositoryService;

describe.only(describeName('PolicyGroupRepository tests'), () => {

    beforeEach(async () => {
        app = testSuite.app;
        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        policyGroupRepository = repositoryService.for(PolicyGroup);
    });

    describe(describeName('PolicyGroupRepository deleteIfEmpty'), () => {

        it('deleteIfEmpty should delete a policyGroup if it is empty', async () => {
            let policyGroup: PolicyGroup = policyGroupRepository.create({
                name: 'group',
                firewall: await repositoryService.for(Firewall).save(repositoryService.for(Firewall).create({
                    name: 'firewall'
                }))
            });

            policyGroup = await policyGroupRepository.save(policyGroup);

            await policyGroupRepository.deleteIfEmpty(policyGroup);

            expect(await policyGroupRepository.findOne(policyGroup.id)).to.be.undefined;
        });

        it('deleteIfEmpty should not delete a policyGroup if it is not empty', async () => {
            let policyGroup: PolicyGroup = policyGroupRepository.create({
                name: 'group',
                firewall: await repositoryService.for(Firewall).save(repositoryService.for(Firewall).create({
                    name: 'firewall'
                })),
                policyRules: [
                    await repositoryService.for(PolicyRule).save(repositoryService.for(PolicyRule).create({
                        rule_order: 0,
                        action: 0
                    }))
                ]
            });

            policyGroup = await policyGroupRepository.save(policyGroup);

            await policyGroupRepository.deleteIfEmpty(policyGroup);

            expect(await policyGroupRepository.findOne(policyGroup.id)).to.be.instanceOf(PolicyGroup);
        });

    });
})