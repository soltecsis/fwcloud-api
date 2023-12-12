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
import { getRepository } from "typeorm";

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

        adminUser = await createUser({role: 1});
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

    describe(DhcpController.name,( ) => {
        describe('@index', () => {
            let dhcpRule: DHCPRule;

            beforeEach(async () => {
                dhcpRule = await DHCPRuleServiceInstance.store({
                    active: true,
                    groupId: group.id,
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

        describe.only('@create', () => {
            it('gust user should not create a dhcp rule', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.system.dhcp.store', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .send({
                        active: true,
                        groupId: group.id,
                        max_lease: 5,
                        cfg_text: "cfg_text",
                        comment: "comment",
                        rule_order: 1,
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
                        max_lease: 5,
                        cfg_text: "cfg_text",
                        comment: "comment",
                        rule_order: 1,
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
                        max_lease: 5,
                        cfg_text: "cfg_text",
                        comment: "comment",
                        rule_order: 1,
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
                    max_lease: 5,
                    cfg_text: "cfg_text",
                    comment: "comment",
                    rule_order: 1,
                })
                .expect(201)
                .then((response) => {
                    expect(response.body.data).to.have.property('id');
                });
            });
        });
    });
});