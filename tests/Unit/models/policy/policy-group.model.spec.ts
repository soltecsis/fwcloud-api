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
import PolicyGroupRepository from "../../../../src/repositories/PolicyGroupRepository";
import { PolicyGroup } from "../../../../src/models/policy/PolicyGroup";
import { PolicyRule } from "../../../../src/models/policy/PolicyRule";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import sinon from "sinon";

let app: AbstractApplication;
let repositoryService: RepositoryService;
let policyGroupRepository: PolicyGroupRepository;

describe(describeName('PolicyRule tests'), () => {
    before(async () => {
        app = testSuite.app;

        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        policyGroupRepository = repositoryService.for(PolicyGroup);
    })

    describe('unassignPolicyRulesBeforeRemove()', () => {

        it('should unassign all policy rules which belongs to the group', async () => {
            let group: PolicyGroup = policyGroupRepository.create({
                name: 'test',
                firewall: (await repositoryService.for(Firewall).save({ name: 'test' }))
            });

            group = await policyGroupRepository.save(group, { reload: true });

            let rule: PolicyRule = await repositoryService.for(PolicyRule).save({
                rule_order: 0,
                action: 1,
                policyGroup: group
            });

            await group.unassignPolicyRulesBeforeRemove();

            rule = await repositoryService.for(PolicyRule).findOne(rule.id);

            expect(rule.policyGroupId).to.be.null;
        });

        it('should be called before be removed', async () => {
            const spy = sinon.spy(PolicyGroup.prototype, "unassignPolicyRulesBeforeRemove");

            let group: PolicyGroup = policyGroupRepository.create({
                name: 'test',
                firewall: (await repositoryService.for(Firewall).save({ name: 'test' }))
            });

            group = await policyGroupRepository.save(group, { reload: true });

            await repositoryService.for(PolicyGroup).remove(group);

            expect(spy.calledOnce).to.be.true;

        });
    });
});