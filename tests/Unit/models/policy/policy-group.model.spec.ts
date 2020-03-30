import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { AbstractApplication } from "../../../../src/fonaments/abstract-application";
import { RepositoryService } from "../../../../src/database/repository.service";
import PolicyGroupRepository from "../../../../src/repositories/PolicyGroupRepository";
import { PolicyGroup } from "../../../../src/models/policy/PolicyGroup";
import { PolicyRule } from "../../../../src/models/policy/PolicyRule";
import { Firewall } from "../../../../src/models/firewall/Firewall";

let app: AbstractApplication;
let repositoryService: RepositoryService;
let policyGroupRepository: PolicyGroupRepository;

describe(describeName('PolicyRule tests'), () => {
    beforeEach(async () => {
        app = testSuite.app;

        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        policyGroupRepository = repositoryService.for(PolicyGroup);
    })

    it('removing a policy group should unassign all policy rules which belongs to the group', async () => {
        let group: PolicyGroup = policyGroupRepository.create({
            name: 'test',
            firewall: (await repositoryService.for(Firewall).save({name: 'test'})).id
        });

        group = await policyGroupRepository.save(group, {reload: true});

        let rule: PolicyRule = await repositoryService.for(PolicyRule).save({
            rule_order: 0,
            action: 1,
            idgroup: group.id
        });

        await policyGroupRepository.remove(group);

        rule = await repositoryService.for(PolicyRule).findOne(rule.id);

        expect(rule.idgroup).to.be.null;

    })
});