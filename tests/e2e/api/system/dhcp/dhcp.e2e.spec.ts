import { Application } from "../../../../../src/Application";
import { Firewall } from "../../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../../src/models/fwcloud/FwCloud";
import { DHCPRule } from "../../../../../src/models/system/dhcp/dhcp_r/dhcp_r.model";
import { User } from "../../../../../src/models/user/User";
import { expect, testSuite } from "../../../../mocha/global-setup";
import { attachSession, createUser, generateSession } from "../../../../utils/utils";
import { DHCPRuleService } from "../../../../../src/models/system/dhcp/dhcp_r/dhcp_r.service";
import { FwCloudFactory, FwCloudProduct } from "../../../../utils/fwcloud-factory";
import { DhcpController } from "../../../../../src/controllers/system/dhcp/dhcp.controller";
import request = require("supertest");
import { _URL } from "../../../../../src/fonaments/http/router/router.service";
import { DHCPGroup } from "../../../../../src/models/system/dhcp/dhcp_g/dhcp_g.model";
import { getCustomRepository, getRepository } from "typeorm";
import { DHCPRuleCopyDto } from "../../../../../src/controllers/system/dhcp/dto/copy.dto";
import { DHCPRepository } from "../../../../../src/models/system/dhcp/dhcp_r/dhcp.repository";
import { Offset } from "../../../../../src/offset";

describe('DHCPRule E2E Tests', () => {
    let app: Application;
    let loggedUser: User;
    let loggedUserSessionId: string;

    let adminUser: User;
    let adminUserSessionId: string;

    let fwcProduct: FwCloudProduct;
    let fwCloud: FwCloud;
    let firewall: Firewall;
    let group: DHCPGroup;

    let DHCPRuleServiceInstance: DHCPRuleService;

    beforeEach(async () => {
        app = testSuite.app;
        await testSuite.resetDatabaseData();

        loggedUser = await createUser({ role: 0 });
        loggedUserSessionId = generateSession(loggedUser);

        adminUser = await createUser({ role: 1 });
        adminUserSessionId = generateSession(adminUser);

        DHCPRuleServiceInstance = await app.getService(DHCPRuleService.name);

        fwcProduct = await new FwCloudFactory().make();

        fwCloud = fwcProduct.fwcloud;

        firewall = fwcProduct.firewall;

        group = await getRepository(DHCPGroup).save(getRepository(DHCPGroup).create({
            name: 'group',
            firewall: firewall,
        }));
    });

    describe(DhcpController.name, () => {
        describe('@index', () => {
            let dhcpRule: DHCPRule;

            beforeEach(async () => {
                dhcpRule = await DHCPRuleServiceInstance.store({
                    active: true,
                    groupId: group.id,
                    firewallId: firewall.id,
                    max_lease: 5,
                    cfg_text: "cfg_text",
                    comment: "comment",
                    rule_order: 1,
                });
            });

            it('guest user should not see a dhcp rules', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.system.dhcp.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401);
            });

            it('regular user which does not belong to the fwcloud should not see a dhcp rules', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.system.dhcp.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401);
            });

            it('regular user which belongs to the fwcloud should see a dhcp rules', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.system.dhcp.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(1);
                    });
            });

            it('admin user should see a dhcp rules', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.system.dhcp.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then((response) => {
                        expect(response.body.data).to.have.length(1);
                    });
            });
        });

        describe('@grid', () => {
            let dhcpRule: DHCPRule;

            beforeEach(async () => {
                dhcpRule = await DHCPRuleServiceInstance.store({
                    active: true,
                    groupId: group.id,
                    firewallId: firewall.id,
                    max_lease: 5,
                    cfg_text: "cfg_text",
                    comment: "comment",
                    rule_order: 1,
                });
            });

            it('guest user should not see a dhcp rules grid', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.system.dhcp.grid', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401);
            });

            it('regular user which does not belong to the fwcloud should not see a dhcp rules grid', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.system.dhcp.grid', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401);
            });

            it('regular user which belongs to the fwcloud should see a dhcp rules grid', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.system.dhcp.grid', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data[0].id).to.deep.equal(dhcpRule.id);
                    });
            });

            it('admin user should see a dhcp rules grid', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.system.dhcp.grid', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then((response) => {
                        expect(response.body.data[0].id).to.deep.equal(dhcpRule.id);
                    });
            });
        });

        describe('@create', () => {
            it('gust user should not create a dhcp rule', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.system.dhcp.store', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .send({
                        active: true,
                        groupId: group.id,
                        firewallId: firewall.id,
                        max_lease: 5,
                        cfg_text: "cfg_text",
                        comment: "comment",
                    })
                    .expect(401);
            });

            it('regular user which does not belong to the fwcloud should not create a dhcp rule', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.system.dhcp.store', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .send({
                        active: true,
                        groupId: group.id,
                        firewallId: firewall.id,
                        max_lease: 5,
                        cfg_text: "cfg_text",
                        comment: "comment",
                    })
                    .expect(401);
            });

            it('regular user which belongs to the fwcloud should create a dhcp rule', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.system.dhcp.store', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .send({
                        active: true,
                        groupId: group.id,
                        firewallId: firewall.id,
                        max_lease: 5,
                        cfg_text: "cfg_text",
                        comment: "comment",
                    })
                    .expect(201)
                    .then(response => {
                        expect(response.body.data).to.have.property('id');
                    });
            });

            it('admin user should create a dhcp rule', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.system.dhcp.store', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .send({
                        active: true,
                        groupId: group.id,
                        firewallId: firewall.id,
                        max_lease: 5,
                        cfg_text: "cfg_text",
                        comment: "comment",
                    })
                    .expect(201)
                    .then((response) => {
                        expect(response.body.data).to.have.property('id');
                    });
            });
        });

        describe('@copy', () => {
            let DHCPRule1: DHCPRule;
            let DHCPRule2: DHCPRule;
            let data: DHCPRuleCopyDto;

            beforeEach(async () => {
                DHCPRule1 = await DHCPRuleServiceInstance.store({
                    active: true,
                    groupId: group.id,
                    firewallId: firewall.id,
                    max_lease: 5,
                    cfg_text: "cfg_text",
                    comment: "comment",
                    rule_order: 1,
                });
                DHCPRule2 = await DHCPRuleServiceInstance.store({
                    active: true,
                    groupId: group.id,
                    firewallId: firewall.id,
                    max_lease: 5,
                    cfg_text: "cfg_text",
                    comment: "comment",
                    rule_order: 2,
                });
                data = {
                    rules_ids: [DHCPRule1.id, DHCPRule2.id],
                    to: (await getCustomRepository(DHCPRepository).getLastDHCPRuleInGroup(group.id)).id,
                    offset: Offset.Below,
                } as DHCPRuleCopyDto;
            });

            it('guest user should not copy a dhcp rule', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.system.dhcp.copy', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .send(data)
                    .expect(401);
            });

            it('regular user which does not belong to the fwcloud should not copy a dhcp rule', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.system.dhcp.copy', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .send(data)
                    .expect(401);
            });

            it('regular user which belongs to the fwcloud should copy a dhcp rule', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.system.dhcp.copy', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .send(data)
                    .expect(201)
                    .then(response => {
                        expect(response.body.data).to.have.length(2);
                    });
            });

            it('admin user should copy a dhcp rule', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.system.dhcp.copy', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .send(data)
                    .expect(201)
                    .then((response) => {
                        expect(response.body.data).to.have.length(2);
                    });
            });
        });

        describe('@update', () => {
            let dhcpRule: DHCPRule;

            beforeEach(async () => {
                dhcpRule = await DHCPRuleServiceInstance.store({
                    active: true,
                    groupId: group.id,
                    firewallId: firewall.id,
                    max_lease: 5,
                    cfg_text: "cfg_text",
                    comment: "comment",
                    rule_order: 1,
                });
            });

            it('guest user should not update a dhcp rule', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.system.dhcp.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        dhcp: dhcpRule.id,
                    }))
                    .send({
                        active: false,
                        groupId: group.id,
                        firewallId: firewall.id,
                        max_lease: 5,
                        cfg_text: "cfg_text",
                        comment: "comment",
                    })
                    .expect(401);
            });

            it('regular user which does not belong to the fwcloud should not update a dhcp rule', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.system.dhcp.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        dhcp: dhcpRule.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .send({
                        active: false,
                        groupId: group.id,
                        firewallId: firewall.id,
                        max_lease: 5,
                        cfg_text: "cfg_text",
                        comment: "comment",
                    })
                    .expect(401);
            });

            it('regular user which belongs to the fwcloud should update a dhcp rule', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.system.dhcp.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        dhcp: dhcpRule.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .send({
                        active: false,
                        groupId: group.id,
                        firewallId: firewall.id,
                        max_lease: 5,
                        cfg_text: "cfg_text",
                        comment: "comment",
                    })
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.property('id');
                    });
            });

            it('admin user should update a dhcp rule', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.system.dhcp.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        dhcp: dhcpRule.id,
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .send({
                        active: false,
                        groupId: group.id,
                        firewallId: firewall.id,
                        max_lease: 5,
                        cfg_text: "cfg_text",
                        comment: "comment",
                    })
                    .expect(200)
                    .then((response) => {
                        expect(response.body.data).to.have.property('id');
                    });
            });
        });

        describe('@remove', () => {
            let dhcpRule: DHCPRule;

            beforeEach(async () => {
                dhcpRule = await DHCPRuleServiceInstance.store({
                    active: true,
                    groupId: group.id,
                    firewallId: firewall.id,
                    max_lease: 5,
                    cfg_text: "cfg_text",
                    comment: "comment",
                    rule_order: 1,
                });
            });

            it('guest user should not remove a dhcp rule', async () => {
                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.system.dhcp.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        dhcp: dhcpRule.id,
                    }))
                    .expect(401);
            });

            it('regular user which does not belong to the fwcloud should not remove a dhcp rule', async () => {
                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.system.dhcp.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        dhcp: dhcpRule.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401);
            });

            it('regular user which belongs to the fwcloud should remove a dhcp rule', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.system.dhcp.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        dhcp: dhcpRule.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.property('id');
                    });
            });

            it('admin user should remove a dhcp rule', async () => {
                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.system.dhcp.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        dhcp: dhcpRule.id,
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then((response) => {
                        expect(response.body.data).to.have.property('id');
                    });
            });
        });

        describe('@show', () => {
            let dhcpRule: DHCPRule;

            beforeEach(async () => {
                dhcpRule = await DHCPRuleServiceInstance.store({
                    active: true,
                    groupId: group.id,
                    firewallId: firewall.id,
                    max_lease: 5,
                    cfg_text: "cfg_text",
                    comment: "comment",
                    rule_order: 1,
                });
            });

            it('guest user should not see a dhcp rule', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.system.dhcp.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        dhcp: dhcpRule.id,
                    }))
                    .expect(401);
            });

            it('regular user which does not belong to the fwcloud should not see a dhcp rule', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.system.dhcp.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        dhcp: dhcpRule.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401);
            });

            it('regular user which belongs to the fwcloud should see a dhcp rule', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.system.dhcp.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        dhcp: dhcpRule.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.property('id');
                    });
            });

            it('admin user should see a dhcp rule', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.system.dhcp.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        dhcp: dhcpRule.id,
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then((response) => {
                        expect(response.body.data).to.have.property('id');
                    });
            });
        });

        describe('@move', () => {
            let dhcpRule1: DHCPRule;
            let dhcpRule2: DHCPRule;
            let dhcpRule3: DHCPRule;
            let dhcpRule4: DHCPRule;
            let data: DHCPRuleCopyDto;

            beforeEach(async () => {
                dhcpRule1 = await DHCPRuleServiceInstance.store({
                    active: true,
                    groupId: group.id,
                    firewallId: firewall.id,
                    max_lease: 1,
                    cfg_text: "cfg_text",
                    comment: "comment",
                    rule_order: 1,
                });
                dhcpRule2 = await DHCPRuleServiceInstance.store({
                    active: true,
                    groupId: group.id,
                    firewallId: firewall.id,
                    max_lease: 2,
                    cfg_text: "cfg_text",
                    comment: "comment",
                    rule_order: 2,
                });
                dhcpRule3 = await DHCPRuleServiceInstance.store({
                    active: true,
                    groupId: group.id,
                    firewallId: firewall.id,
                    max_lease: 3,
                    cfg_text: "cfg_text",
                    comment: "comment",
                    rule_order: 3,
                });
                dhcpRule4 = await DHCPRuleServiceInstance.store({
                    active: true,
                    groupId: group.id,
                    firewallId: firewall.id,
                    max_lease: 4,
                    cfg_text: "cfg_text",
                    comment: "comment",
                    rule_order: 4,
                });
                data = {
                    rules_ids: [dhcpRule1.id, dhcpRule2.id],
                    to: dhcpRule3.id,
                    offset: Offset.Above,
                } as DHCPRuleCopyDto;
            });

            it('guest user should not move a dhcp rule', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.system.dhcp.move', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .send(data)
                    .expect(401);
            });

            it('regular user which does not belong to the fwcloud should not move a dhcp rule', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.system.dhcp.move', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .send(data)
                    .expect(401);
            });

            it('regular user which belongs to the fwcloud should move a dhcp rule', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.system.dhcp.move', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .send(data)
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(2);
                    });

                expect((await getRepository(DHCPRule).findOneOrFail(dhcpRule1.id)).rule_order).to.equal(1);
                expect((await getRepository(DHCPRule).findOneOrFail(dhcpRule2.id)).rule_order).to.equal(2);
                expect((await getRepository(DHCPRule).findOneOrFail(dhcpRule3.id)).rule_order).to.equal(3);
                expect((await getRepository(DHCPRule).findOneOrFail(dhcpRule4.id)).rule_order).to.equal(4);
            });

            it('admin user should move a dhcp rule', async () => {
                await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.system.dhcp.move', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .send(data)
                    .expect(200)
                    .then((response) => {
                        expect(response.body.data).to.have.length(2);
                    });

                expect((await getRepository(DHCPRule).findOneOrFail(dhcpRule1.id)).rule_order).to.equal(1);
                expect((await getRepository(DHCPRule).findOneOrFail(dhcpRule2.id)).rule_order).to.equal(2);
                expect((await getRepository(DHCPRule).findOneOrFail(dhcpRule3.id)).rule_order).to.equal(3);
                expect((await getRepository(DHCPRule).findOneOrFail(dhcpRule4.id)).rule_order).to.equal(4);
            });
        });
    });
});