import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { RepositoryService } from "../../../../src/database/repository.service";
import { AbstractApplication } from "../../../../src/fonaments/abstract-application";
import { PolicyGroup } from "../../../../src/models/policy/PolicyGroup";
import { PolicyRule } from "../../../../src/models/policy/PolicyRule";
import { Firewall } from "../../../../src/models/firewall/Firewall";

let app: AbstractApplication;
let repositoryService: RepositoryService;

describe.only(describeName('PolicyRule tests'), () => {
    beforeEach(async () => {
        app = testSuite.app;

        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
    })

    describe(describeName('PolicyRule changeGroup'), () => {

        it('changeGroup_should_change_the_policy_rule_group', async () => {
            const policyGroupOld: PolicyGroup = await repositoryService.for(PolicyGroup).save({
                name: 'groupOld',
                firewall: (await repositoryService.for(Firewall).save({
                    name: 'firewall'
                })).id
            });
            const policyGroupNew: PolicyGroup = await repositoryService.for(PolicyGroup).save({
                name: 'groupNew',
                firewall: policyGroupOld.firewall
            });

            let policyRule: PolicyRule = await repositoryService.for(PolicyRule).save({
                rule_order: 1,
                idgroup: policyGroupOld.id,
                action: 1,
                firewall: policyGroupOld.firewall
            });

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);

            await policyRule.changeGroup(policyGroupNew);

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);

            expect(policyRule.idgroup).to.be.deep.eq(policyGroupNew.id);
        });

        it('changeGroup should throw an exception if the rule firewall is not the same as the group firewall', async () => {
            const policyGroupOld: PolicyGroup = await repositoryService.for(PolicyGroup).save({
                name: 'groupOld',
                firewall: (await repositoryService.for(Firewall).save({
                    name: 'firewall'
                })).id
            });

            const policyGroupNew: PolicyGroup = await repositoryService.for(PolicyGroup).save({
                name: 'groupNew',
                firewall: (await repositoryService.for(Firewall).save({
                    name: 'firewall'
                })).id
            });

            let policyRule: PolicyRule = await repositoryService.for(PolicyRule).save({
                rule_order: 1,
                idgroup: policyGroupOld.id,
                action: 1
            });

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);

            async function t() {
                return await policyRule.changeGroup(policyGroupNew);
            }
            
            await expect(t()).to.be.rejected;
        });

        it('changeRule should unassign the group if is called with null', async () => {
            const policyGroupOld: PolicyGroup = await repositoryService.for(PolicyGroup).save({
                name: 'groupOld',
                firewall: (await repositoryService.for(Firewall).save({
                    name: 'firewall'
                })).id
            });
            
            let policyRule: PolicyRule = await repositoryService.for(PolicyRule).save({
                rule_order: 1,
                idgroup: policyGroupOld.id,
                action: 1
            });

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);

            await policyRule.changeGroup(null);

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);

            expect(policyRule.idgroup).to.be.deep.eq(null);
        })
    });
});