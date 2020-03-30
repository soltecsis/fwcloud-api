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

        it ('updateActive should update the policyRule active flag', async () => {
            let policyRule: PolicyRule = policyRuleRepository.create({
                rule_order: 1,
                action: 1,
                active: 0,
                special: 0
            });

            policyRule = await policyRuleRepository.save(policyRule);

            const result: PolicyRule = await policyRuleRepository.updateActive(policyRule, 1);

            policyRule = await policyRuleRepository.findOne(policyRule.id);

            expect(result.active).to.be.deep.eq(1);
            expect(policyRule.active).to.be.deep.eq(1);
        });

        it('updateActive should update multiple policyRule active flag', async () => {
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
                    special: 0,
                })
            ];

            const result: Array<PolicyRule> = await policyRuleRepository.updateActive(policyRules, 1);

            expect(result[0].active).to.be.deep.eq(1);
            expect(result[1].active).to.be.deep.eq(1);
        });

        it('updateActive should not update a policyRule active flag if is an special rule', async () => {
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

        it('changeGroup should change the policy rule group', async () => {
            const policyGroupOld: PolicyGroup = await repositoryService.for(PolicyGroup).save({
                name: 'groupOld',
                firewall: (await repositoryService.for(Firewall).save({
                    name: 'firewall'
                }))
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

            const result = await policyRuleRepository.assignToGroup(policyRule, policyGroupNew);

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);

            expect(result).to.be.instanceOf(PolicyRule);
            expect(policyRule.policyGroupId).to.be.deep.eq(policyGroupNew.id);
        });

        it('changeGroup should change multiple policy rule group', async () => {
            const policyGroupOld: PolicyGroup = await repositoryService.for(PolicyGroup).save({
                name: 'groupOld',
                firewall: (await repositoryService.for(Firewall).save({
                    name: 'firewall'
                }))
            });
            const policyGroupNew: PolicyGroup = await repositoryService.for(PolicyGroup).save({
                name: 'groupNew',
                firewall: policyGroupOld.firewall
            });

            let policyRule: PolicyRule = await repositoryService.for(PolicyRule).create({
                rule_order: 1,
                idgroup: policyGroupOld.id,
                action: 1,
                firewall: policyGroupOld.firewall
            });
            let policyRule2: PolicyRule = await repositoryService.for(PolicyRule).create({
                rule_order: 1,
                idgroup: policyGroupOld.id,
                action: 1,
                firewall: policyGroupOld.firewall
            });

            policyRule = await repositoryService.for(PolicyRule).save(policyRule, {reload: true});
            policyRule2 = await repositoryService.for(PolicyRule).save(policyRule2, {reload: true});

            const result = await policyRuleRepository.assignToGroup([policyRule, policyRule2], policyGroupNew);

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);
            policyRule2 = await repositoryService.for(PolicyRule).findOne(policyRule2.id);

            expect(result).to.have.length(2);
            expect(policyRule.policyGroupId).to.be.deep.eq(policyGroupNew.id);
            expect(policyRule2.policyGroupId).to.be.deep.eq(policyGroupNew.id);
        });

        it('changeGroup should not change a group if the rule firewall is not the same as the group firewall', async () => {
            const policyGroupOld: PolicyGroup = await repositoryService.for(PolicyGroup).save({
                name: 'groupOld',
                firewall: (await repositoryService.for(Firewall).save({
                    name: 'firewall'
                }))
            });

            const policyGroupNew: PolicyGroup = await repositoryService.for(PolicyGroup).save({
                name: 'groupNew',
                firewall: (await repositoryService.for(Firewall).save({
                    name: 'firewall'
                }))
            });

            let policyRule: PolicyRule = await repositoryService.for(PolicyRule).create({
                rule_order: 1,
                policyGroup: policyGroupOld,
                action: 1,
                firewall: policyGroupOld.firewall
            });

            policyRule = await repositoryService.for(PolicyRule).save(policyRule, { reload: true });

            await policyRuleRepository.assignToGroup([policyRule], policyGroupNew);

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);

            expect(policyRule.policyGroupId).to.be.deep.eq(policyGroupOld.id);
        });

        it('changeRule should unassign the group if is called with null', async () => {
            const policyGroupOld: PolicyGroup = await repositoryService.for(PolicyGroup).save({
                name: 'groupOld',
                firewall: (await repositoryService.for(Firewall).save({
                    name: 'firewall'
                }))
            });

            let policyRule: PolicyRule = await repositoryService.for(PolicyRule).save({
                rule_order: 1,
                idgroup: policyGroupOld.id,
                action: 1
            });

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);

            await policyRuleRepository.assignToGroup([policyRule], null);

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);

            expect(policyRule.policyGroupId).to.be.deep.eq(null);
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

            const result = await policyRuleRepository.updateStyle(policyRule, "newStyle");

            policyRule = await repositoryService.for(PolicyRule).findOne(policyRule.id);

            expect(result).to.be.instanceOf(PolicyRule);
            expect(policyRule.style).to.be.deep.eq("newStyle");
        });

        it('updateStyle should update multiple policyRule styles', async () => {
            let policyRules: Array<PolicyRule> = [
                await repositoryService.for(PolicyRule).save(repositoryService.for(PolicyRule).create({
                    rule_order: 1,
                    action: 1,
                    style: 'oldStyle'
                }), { reload: true }),
                await repositoryService.for(PolicyRule).save(repositoryService.for(PolicyRule).create({
                    rule_order: 1,
                    action: 1,
                    style: 'oldStyle'
                }), { reload: true }),
            ];

            const result = await policyRuleRepository.updateStyle(policyRules, "newStyle");

            expect(result).to.have.length(2);
            expect(result[0].style).to.be.deep.eq('newStyle');
            expect(result[1].style).to.be.deep.eq('newStyle'); 
        })
    })

})