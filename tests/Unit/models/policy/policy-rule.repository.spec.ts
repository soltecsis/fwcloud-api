import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { PolicyRuleRepository } from "../../../../src/models/policy/policy-rule.repository";
import { AbstractApplication } from "../../../../src/fonaments/abstract-application";
import { RepositoryService } from "../../../../src/database/repository.service";
import { PolicyRule } from "../../../../src/models/policy/PolicyRule";
import { PolicyGroup } from "../../../../src/models/policy/PolicyGroup";
import { Firewall } from "../../../../src/models/firewall/Firewall";

let policyRuleRepository: PolicyRuleRepository;
let app: AbstractApplication;
let repositoryService: RepositoryService;

describe(describeName('PolicyRuleRepository tests'), () => {

    beforeEach(async () => {
        app = testSuite.app;
        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        policyRuleRepository = repositoryService.for(PolicyRule);
    });

    describe(describeName('PolicyRuleRepository updateActive'), () => {

        it('updateActive should update multiple policyRule active flag', async() => {
            const policyRules: Array<PolicyRule> = [
                await policyRuleRepository.save({
                    rule_order: 1,
                    action: 1,
                    active: 0,
                    special: 0
                }),
                await policyRuleRepository.save({
                    rule_order: 1,
                    action: 1,
                    active: 0,
                    special:0,
                })
            ];

            const result: Array<PolicyRule> = await policyRuleRepository.updateActive(policyRules, 1);

            expect(result[0].active).to.be.deep.eq(1);
            expect(result[1].active).to.be.deep.eq(1);
        });

        it('updateActive should not update a policyRule active flag if is an special rule', async() => {
            const policyRule: PolicyRule = await policyRuleRepository.save({
                rule_order: 1,
                action: 1,
                active: 0,
                special: 1
            });

            const result: Array<PolicyRule> = await policyRuleRepository.updateActive([policyRule], 1);

            expect(result[0].active).to.be.deep.eq(0);
        })
    });

    describe(describeName('PolicyRuleRepository assignGroup'), () => {

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

            await policyRuleRepository.assignToGroup([policyRule], policyGroupNew);

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);

            expect(policyRule.idgroup).to.be.deep.eq(policyGroupNew.id);
        });

        it('changeGroup should not change a group if the rule firewall is not the same as the group firewall', async () => {
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
                
            await policyRuleRepository.assignToGroup([policyRule], policyGroupNew);

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);
            
            expect(policyRule.idgroup).to.be.deep.eq(policyGroupOld.id);
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

            await policyRuleRepository.assignToGroup([policyRule], null);

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);

            expect(policyRule.idgroup).to.be.deep.eq(null);
        })
    });

    describe(describeName('PolicyRuleRepository updateStyle'), () => {
        it('updateStyle should update the style', async () => {
            let policyRule: PolicyRule = await repositoryService.for(PolicyRule).save({
                rule_order: 1,
                action: 1,
                style: 'oldStyle'
            });

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);

            await policyRuleRepository.updateStyle([policyRule], "newStyle");

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);

            expect(policyRule.style).to.be.deep.eq("newStyle");
        });
    })

})