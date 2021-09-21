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

import { getCustomRepository, getRepository } from "typeorm";
import { Application } from "../../../../../src/Application";
import { Firewall } from "../../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../../src/models/fwcloud/FwCloud";
import { User } from "../../../../../src/models/user/User";
import StringHelper from "../../../../../src/utils/string.helper";
import { describeName, expect, testSuite } from "../../../../mocha/global-setup";
import { attachSession, createUser, generateSession } from "../../../../utils/utils";
import request = require("supertest");
import { _URL } from "../../../../../src/fonaments/http/router/router.service";
import { RoutingTable } from "../../../../../src/models/routing/routing-table/routing-table.model";
import { RoutingRule } from "../../../../../src/models/routing/routing-rule/routing-rule.model";
import { RoutingRuleService } from "../../../../../src/models/routing/routing-rule/routing-rule.service";
import { RoutingRuleController } from "../../../../../src/controllers/routing/routing-rule/routing-rule.controller";
import { IPObj } from "../../../../../src/models/ipobj/IPObj";
import { IPObjGroup } from "../../../../../src/models/ipobj/IPObjGroup";
import { OpenVPN } from "../../../../../src/models/vpn/openvpn/OpenVPN";
import { Crt } from "../../../../../src/models/vpn/pki/Crt";
import { Ca } from "../../../../../src/models/vpn/pki/Ca";
import { RoutingRuleControllerMoveDto } from "../../../../../src/controllers/routing/routing-rule/dtos/move.dto";
import { RoutingRuleControllerBulkUpdateDto } from "../../../../../src/controllers/routing/routing-rule/dtos/bulk-update.dto";
import { RoutingRuleControllerCopyDto } from "../../../../../src/controllers/routing/routing-rule/dtos/copy.dto";
import { RoutingRuleRepository } from "../../../../../src/models/routing/routing-rule/routing-rule.repository";
import { Offset } from "../../../../../src/offset";
import { Mark } from "../../../../../src/models/ipobj/Mark";
import { RoutingRuleMoveFromDto } from "../../../../../src/controllers/routing/routing-rule/dtos/move-from.dto";

describe(describeName('Routing Rule E2E Tests'), () => {
    let app: Application;
    let loggedUser: User;
    let loggedUserSessionId: string;
    
    let adminUser: User;
    let adminUserSessionId: string;

    let fwCloud: FwCloud;
    let firewall: Firewall;
    let table: RoutingTable;
    let routingRuleService: RoutingRuleService;

    beforeEach(async () => {
        app = testSuite.app;
        await testSuite.resetDatabaseData();

        loggedUser = await createUser({role: 0});
        loggedUserSessionId = generateSession(loggedUser);

        adminUser = await createUser({role: 1});
        adminUserSessionId = generateSession(adminUser);

        routingRuleService = await app.getService(RoutingRuleService.name);

        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
            name: StringHelper.randomize(10)
        }));

        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwCloud.id
        }));

        table = await getRepository(RoutingTable).save({
            firewallId: firewall.id,
            number: 1,
            name: 'name',
        });
    });

    describe(RoutingRuleController.name, () => {
        describe('@index', () => {
            let rule: RoutingRule;
            
            beforeEach(async () => {
                rule = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: (await getRepository(Mark).save({
                            code: 1,
                            name: 'test',
                            fwCloudId: fwCloud.id
                        })).id,
                        order: 0
                    }]
                });
            });

            it('guest user should not see a rules', async () => {
				return await request(app.express)
					.get(_URL().getURL('fwclouds.firewalls.routing.rules.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not see rules', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.rules.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should see rules', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.rules.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(1);
                    });
            });

            it('admin user should see rules', async () => {
                return await request(app.express)
                .get(_URL().getURL('fwclouds.firewalls.routing.rules.index', {
                    fwcloud: fwCloud.id,
                    firewall: firewall.id,
                }))
                .set('Cookie', [attachSession(adminUserSessionId)])
                .expect(200)
                .then(response => {
                    expect(response.body.data).to.have.length(1);
                });
            });


        });

        describe('@grid', () => {
            let rule: RoutingRule;
            
            beforeEach(async () => {
                rule = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: (await getRepository(Mark).save({
                            code: 1,
                            name: 'test',
                            fwCloudId: fwCloud.id
                        })).id,
                        order: 0
                    }]
                });
            });   

            it('guest user should not see a rules grid', async () => {
				return await request(app.express)
					.get(_URL().getURL('fwclouds.firewalls.routing.rules.grid', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not see a rules grid', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.rules.grid', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should see a rules grid', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.rules.grid', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .then(response => {
                        expect(response.body.data[0].id).to.deep.eq(rule.id);
                        expect(response.body.data[0].routingTableId).to.deep.eq(rule.routingTableId);
                    });
            });

            it('admin user should see a rules grid', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.rules.grid', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        rule: rule.id
                    }))         
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data[0].id).to.deep.eq(rule.id);
                        expect(response.body.data[0].routingTableId).to.deep.eq(rule.routingTableId);
                    });
            });
        });

        describe('@move', () => {
            let ruleOrder1: RoutingRule;
            let ruleOrder2: RoutingRule;
            let ruleOrder3: RoutingRule;
            let ruleOrder4: RoutingRule;
            let data: RoutingRuleControllerMoveDto;

            beforeEach(async () => {
                const mark: Mark = await getRepository(Mark).save({
                    code: 1,
                    name: 'test',
                    fwCloudId: fwCloud.id
                });

                ruleOrder1 = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: mark.id,
                        order: 0
                    }]
                });
                
                ruleOrder2 = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: mark.id,
                        order: 0
                    }]
                });

                ruleOrder3 = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: mark.id,
                        order: 0
                    }]
                });
                
                ruleOrder4 = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: mark.id,
                        order: 0
                    }]
                });

                data = {
                    rules: [ruleOrder1.id, ruleOrder2.id],
                    to: ruleOrder3.id,
                    offset: Offset.Above
                }
            });

            it('guest user should not move rules', async () => {
				return await request(app.express)
					.put(_URL().getURL('fwclouds.firewalls.routing.rules.move', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not move rules', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.rules.move', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .send(data)
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should move rules', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.rules.move', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .send(data)
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(2);
                    });

                expect((await getRepository(RoutingRule).findOne(ruleOrder1.id)).rule_order).to.eq(1);
                expect((await getRepository(RoutingRule).findOne(ruleOrder2.id)).rule_order).to.eq(2);
                expect((await getRepository(RoutingRule).findOne(ruleOrder3.id)).rule_order).to.eq(3);
                expect((await getRepository(RoutingRule).findOne(ruleOrder4.id)).rule_order).to.eq(4);
            });

            it('admin user should move rules', async () => {
                await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.rules.move', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .send(data)
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(2);
                    });
                
                expect((await getRepository(RoutingRule).findOne(ruleOrder1.id)).rule_order).to.eq(1);
                expect((await getRepository(RoutingRule).findOne(ruleOrder2.id)).rule_order).to.eq(2);
                expect((await getRepository(RoutingRule).findOne(ruleOrder3.id)).rule_order).to.eq(3);
                expect((await getRepository(RoutingRule).findOne(ruleOrder4.id)).rule_order).to.eq(4);
            });


        });

        describe('@moveFrom', () => {
            let rule1: RoutingRule;
            let rule2: RoutingRule;
            let data: RoutingRuleMoveFromDto;

            beforeEach(async () => {
                const mark: Mark = await getRepository(Mark).save({
                    code: 1,
                    name: 'test',
                    fwCloudId: fwCloud.id
                });

                const mark2: Mark = await getRepository(Mark).save({
                    code: 2,
                    name: 'test',
                    fwCloudId: fwCloud.id
                });

                rule1 = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: mark.id,
                        order: 0
                    }]
                });
                
                rule2 = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: mark2.id,
                        order: 0
                    }]
                });

                data = {
                    fromId: rule1.id,
                    toId: rule2.id,
                    markId: mark.id
                }
            });

            it('guest user should not move from items between rules', async () => {
				return await request(app.express)
					.put(_URL().getURL('fwclouds.firewalls.routing.rules.moveFrom', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not move from items between rules', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.rules.moveFrom', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .send(data)
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should move from items between rules', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.rules.moveFrom', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .send(data)
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(2);
                    });
            });

            it('admin user should move from items between rules', async () => {
                await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.rules.moveFrom', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .send(data)
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(2);
                    });
            });


        });

        describe('@show', () => {
            let rule: RoutingRule;
            
            beforeEach(async () => {
                rule = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: (await getRepository(Mark).save({
                            code: 1,
                            name: 'test',
                            fwCloudId: fwCloud.id
                        })).id,
                        order: 0
                    }]
                });
            });   

            it('guest user should not see a rules', async () => {
				return await request(app.express)
					.get(_URL().getURL('fwclouds.firewalls.routing.rules.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not see a rules', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.rules.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should see a rules', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.rules.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data.id).to.deep.eq(rule.id);
                        expect(response.body.data.routingTableId).to.deep.eq(rule.routingTableId);
                    });
            });

            it('admin user should see a rules', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.rules.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))         
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data.id).to.deep.eq(rule.id);
                        expect(response.body.data.routingTableId).to.deep.eq(rule.routingTableId);
                    });
            });
        });

        describe('@compile', () => {
            let rule: RoutingRule;
            
            beforeEach(async () => {
                rule = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: (await getRepository(Mark).save({
                            code: 1,
                            name: 'test',
                            fwCloudId: fwCloud.id
                        })).id,
                        order: 0
                    }]
                });
            });   

            it('guest user should not compile a rule', async () => {
				return await request(app.express)
					.get(_URL().getURL('fwclouds.firewalls.routing.rules.compile', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not compile a rule', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.rules.compile', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should compile a rule', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.rules.compile', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).instanceOf(Array);
                    });
            });

            it('admin user should compile a rule', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.rules.compile', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))         
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).instanceOf(Array);
                    });
            });
        });

        describe('@create', () => {
            it('guest user should not create a rules', async () => {
				return await request(app.express)
					.post(_URL().getURL('fwclouds.firewalls.routing.rules.store', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
					.send({
                        routingTableId: table.id,
                        markIds: [{
                            id: (await getRepository(Mark).save({
                                code: 1,
                                name: 'test',
                                fwCloudId: fwCloud.id
                            })).id,
                            order: 0
                        }]
                    })
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not create a rules', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.routing.rules.store', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .send({
                        routingTableId: table.id,
                        markIds: [{
                            id: (await getRepository(Mark).save({
                                code: 1,
                                name: 'test',
                                fwCloudId: fwCloud.id
                            })).id,
                            order: 0
                        }]
                    })
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should create a rules', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.routing.rules.store', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .send({
                        routingTableId: table.id,
                        markIds: [{
                            id: (await getRepository(Mark).save({
                                code: 1,
                                name: 'test',
                                fwCloudId: fwCloud.id
                            })).id,
                            order: 0
                        }]
                    })
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(201)
                    .then(response => {
                        expect(response.body.data.routingTableId).to.eq(table.id);
                    });
            });

            it('admin user should create a rules', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.routing.rules.store', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .send({
                        routingTableId: table.id,
                        markIds: [{
                            id: (await getRepository(Mark).save({
                                code: 1,
                                name: 'test',
                                fwCloudId: fwCloud.id
                            })).id,
                            order: 0
                        }]
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(201)
                    .then(response => {
                        expect(response.body.data.routingTableId).to.eq(table.id);
                    });
            });


        });

        describe('@copy', () => {
            let ruleOrder1: RoutingRule;
            let ruleOrder2: RoutingRule;
            let data: RoutingRuleControllerCopyDto;

            beforeEach(async () => {
                const mark: Mark = await getRepository(Mark).save({
                    code: 1,
                    name: 'test',
                    fwCloudId: fwCloud.id
                });
                
                ruleOrder1 = await routingRuleService.create({
                    routingTableId: table.id,
                    comment: 'comment1',
                    markIds: [{
                        id: mark.id,
                        order: 0
                    }]
                });
                
                ruleOrder2 = await routingRuleService.create({
                    routingTableId: table.id,
                    comment: 'comment2',
                    markIds: [{
                        id: mark.id,
                        order: 0
                    }]
                });

                data = {
                    rules: [ruleOrder1.id, ruleOrder2.id],
                    to: (await getCustomRepository(RoutingRuleRepository).getLastRoutingRuleInFirewall(table.firewallId)).id,
                    offset: Offset.Below
                }
            });

            it('guest user should not copy rules', async () => {
				return await request(app.express)
					.post(_URL().getURL('fwclouds.firewalls.routing.rules.copy', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .send(data)
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not copy rules', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.routing.rules.copy', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .send(data)
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should copy rules', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.routing.rules.copy', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .send(data)
                    .expect(201)
                    .then(response => {
                        expect(response.body.data).to.have.length(2);
                    });

                expect((await getRepository(RoutingRule).count({where: {comment: 'comment1'}}))).to.eq(2);
                expect((await getRepository(RoutingRule).count({where: {comment: 'comment2'}}))).to.eq(2);
            });

            it('admin user should copy rules', async () => {
                await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.routing.rules.copy', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .send(data)
                    .expect(201)
                    .then(response => {
                        expect(response.body.data).to.have.length(2);
                    });
                
                expect((await getRepository(RoutingRule).count({where: {comment: 'comment1'}}))).to.eq(2);
                expect((await getRepository(RoutingRule).count({where: {comment: 'comment2'}}))).to.eq(2);
            });
        });


        describe('@update', () => {
            let rule: RoutingRule;
            
            beforeEach(async () => {
                rule = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: (await getRepository(Mark).save({
                            code: 1,
                            name: 'test',
                            fwCloudId: fwCloud.id
                        })).id,
                        order: 0
                    }]
                });
            });

            it('guest user should not update a rules', async () => {
				return await request(app.express)
					.put(_URL().getURL('fwclouds.firewalls.routing.rules.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
					.send({
                        comment: 'route'
                    })
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not create a rules', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.rules.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
                    .send({
                        routingTableId: table.id,
                        comment: 'route'
                    })
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should update a rules', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.rules.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
                    .send({
                        routingTableId: table.id,
                        comment: 'route'
                    })
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data.comment).to.eq('route');
                    });
            });

            it('admin user should create a rules', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.rules.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
                    .send({
                        routingTableId: table.id,
                        comment: 'other_route'
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data.comment).to.eq('other_route');
                    });
            });

            it('should thrown a validation exception if ipobj type is not valid', async () => {
                const ipobj = await getRepository(IPObj).save(getRepository(IPObj).create({
                    name: 'test',
                    address: '0.0.0.0',
                    ipObjTypeId: 0,
                    interfaceId: null
                }));

                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.rules.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
                    .send({
                        routingTableId: table.id,
                        comment: 'other_route',
                        ipObjIds: [ipobj.id]
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(422);
            });

            it('should thrown a validation exception if ipobj group type is not valid', async () => {
                const group = await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({
                    name: 'test',
                    type: 0
                }));

                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.rules.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
                    .send({
                        routingTableId: table.id,
                        comment: 'other_route',
                        ipObjGroupIds: [group.id]
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(422);
            });

            it('should thrown a validation exception if openvpn certificate type is not valid', async () => {
                const openvpn = await getRepository(OpenVPN).save(getRepository(OpenVPN).create({
                    firewallId: firewall.id,
                    crt: await getRepository(Crt).save(getRepository(Crt).create({
                        cn: StringHelper.randomize(10),
                        days: 100,
                        type: 0,
                        ca: await getRepository(Ca).save(getRepository(Ca).create({
                            fwCloud: fwCloud,
                            cn: StringHelper.randomize(10),
                            days: 100,
                        }))
                    })),
                    parent: await getRepository(OpenVPN).save(getRepository(OpenVPN).create({
                        firewallId: firewall.id,
                        crt: await getRepository(Crt).save(getRepository(Crt).create({
                            cn: StringHelper.randomize(10),
                            days: 100,
                            type: 0,
                            ca: await getRepository(Ca).save(getRepository(Ca).create({
                                fwCloud: fwCloud,
                                cn: StringHelper.randomize(10),
                                days: 100,
                            }))
                        }))
                    }))
                }));

                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.rules.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
                    .send({
                        routingTableId: table.id,
                        comment: 'other_route',
                        openVPNIds: [openvpn.id]
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(422);
            });


        });

        describe('@bulkUpdate', () => {
            let ruleOrder1: RoutingRule;
            let ruleOrder2: RoutingRule;
            let data: RoutingRuleControllerBulkUpdateDto = {
                style: 'style!'
            }
            
            beforeEach(async () => {
                const mark: Mark = await getRepository(Mark).save({
                    code: 1,
                    name: 'test',
                    fwCloudId: fwCloud.id
                });

                ruleOrder1 = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: mark.id,
                        order: 1
                    }]
                });
                
                ruleOrder2 = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: mark.id,
                        order: 1
                    }]
                });
            });

            it('guest user should not bulk update rules', async () => {
				return await request(app.express)
					.put(_URL().getURL('fwclouds.firewalls.routing.rules.bulkUpdate', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .query({
                        rules: [ruleOrder1.id, ruleOrder2.id]
                    })
                    .send(data)
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not bulk update rules', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.rules.bulkUpdate', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .query({
                        rules: [ruleOrder1.id, ruleOrder2.id]
                    })
                    .send(data)
					.expect(401)
            });

            it('regular user which belongs to the fwcloud should bulk update rules', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.rules.bulkUpdate', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .query({
                        rules: [ruleOrder1.id, ruleOrder2.id]
                    })
                    .send(data)
					.expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(2);
                    });

                expect((await getRepository(RoutingRule).findOne(ruleOrder1.id)).style).to.eq('style!');
                expect((await getRepository(RoutingRule).findOne(ruleOrder2.id)).style).to.eq('style!');
            });

            it('admin user should bulk update rules', async () => {
                await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.rules.bulkUpdate', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .query({
                        rules: [ruleOrder1.id, ruleOrder2.id]
                    })
                    .send(data)
					.expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(2);
                    });
                
                expect((await getRepository(RoutingRule).findOne(ruleOrder1.id)).style).to.eq('style!');
                expect((await getRepository(RoutingRule).findOne(ruleOrder2.id)).style).to.eq('style!');
            });


        });

        describe('@remove', () => {
            let rule: RoutingRule;
            
            beforeEach(async () => {
                rule = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: (await getRepository(Mark).save({
                            code: 1,
                            name: 'test',
                            fwCloudId: fwCloud.id
                        })).id,
                        order: 0
                    }]
                });
            });

            it('guest user should not remove a rules', async () => {
				return await request(app.express)
					.delete(_URL().getURL('fwclouds.firewalls.routing.rules.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not remove a rules', async () => {
                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.rules.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should remove a rules', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.rules.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200);

                expect(await routingRuleService.findOneInPath({
                    fwCloudId: fwCloud.id,
                    firewallId: firewall.id,
                    id: rule.id
                })).to.be.undefined
            });

            it('admin user should remove a rule', async () => {
                await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.rules.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingRule: rule.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200);
                
                expect(await routingRuleService.findOneInPath({
                    fwCloudId: fwCloud.id,
                    firewallId: firewall.id,
                    id: rule.id
                })).to.be.undefined
            });


        });

        describe('@bulkRemove', () => {
            let ruleOrder1: RoutingRule;
            let ruleOrder2: RoutingRule;
            
            beforeEach(async () => {
                const mark: Mark = await getRepository(Mark).save({
                    code: 1,
                    name: 'test',
                    fwCloudId: fwCloud.id
                });

                ruleOrder1 = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: mark.id,
                        order: 1
                    }]
                });
                
                ruleOrder2 = await routingRuleService.create({
                    routingTableId: table.id,
                    markIds: [{
                        id: mark.id,
                        order: 1
                    }]
                });
            });

            it('guest user should not bulk remove rules', async () => {
				return await request(app.express)
					.delete(_URL().getURL('fwclouds.firewalls.routing.rules.bulkRemove', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .query({
                        rules: [ruleOrder1.id, ruleOrder2.id]
                    })
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not bulk remove rules', async () => {
                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.rules.bulkRemove', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .query({
                        rules: [ruleOrder1.id, ruleOrder2.id]
                    })
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should bulk remove rules', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.rules.bulkRemove', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .query({
                        rules: [ruleOrder1.id, ruleOrder2.id]
                    })
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(2);
                    });

                expect((await getRepository(RoutingRule).findOne(ruleOrder1.id))).to.be.undefined;
                expect((await getRepository(RoutingRule).findOne(ruleOrder2.id))).to.be.undefined;
            });

            it('admin user should bulk remove rules', async () => {
                await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.rules.bulkRemove', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .query({
                        rules: [ruleOrder1.id, ruleOrder2.id]
                    })
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(2);
                    });
                
                expect((await getRepository(RoutingRule).findOne(ruleOrder1.id))).to.be.undefined;
                expect((await getRepository(RoutingRule).findOne(ruleOrder2.id))).to.be.undefined;
            });

            it('should throw validation error if query rules is not provided', async () => {
                await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.rules.bulkRemove', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .query({
                        rules: ruleOrder1.id
                    })
                    .expect(422)
            })


        });
    });
});