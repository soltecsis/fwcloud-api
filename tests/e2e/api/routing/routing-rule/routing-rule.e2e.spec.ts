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

import { getRepository } from "typeorm";
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
                });
            });

            it('guest user should not see a rules', async () => {
				return await request(app.express)
					.get(_URL().getURL('fwclouds.firewalls.routing.rules.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        rule: rule.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not see rules', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.rules.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        rule: rule.id
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
                        rule: rule.id
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
                    rule: rule.id
                }))
                .set('Cookie', [attachSession(adminUserSessionId)])
                .expect(200)
                .then(response => {
                    expect(response.body.data).to.have.length(1);
                });
            });


        });

        describe('@show', () => {
            let rule: RoutingRule;
            
            beforeEach(async () => {
                rule = await routingRuleService.create({
                    routingTableId: table.id,
                });
            });   

            it('guest user should not see a rules', async () => {
				return await request(app.express)
					.get(_URL().getURL('fwclouds.firewalls.routing.rules.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        rule: rule.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not see a rules', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.rules.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        rule: rule.id
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
                        rule: rule.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
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
                        rule: rule.id
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
                });
            });   

            it('guest user should not compile a rule', async () => {
				return await request(app.express)
					.get(_URL().getURL('fwclouds.firewalls.routing.rules.compile', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        rule: rule.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not compile a rule', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.rules.compile', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        rule: rule.id
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
                        rule: rule.id
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
                        rule: rule.id
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
                        routingTableId: table.id
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
                        routingTableId: table.id
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
                        routingTableId: table.id
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
                        routingTableId: table.id
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(201)
                    .then(response => {
                        expect(response.body.data.routingTableId).to.eq(table.id);
                    });
            });


        });

        describe('@update', () => {
            let rule: RoutingRule;
            
            beforeEach(async () => {
                rule = await routingRuleService.create({
                    routingTableId: table.id,
                });
            });

            it('guest user should not update a rules', async () => {
				return await request(app.express)
					.put(_URL().getURL('fwclouds.firewalls.routing.rules.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        rule: rule.id
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
                        rule: rule.id
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
                        rule: rule.id
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
                        rule: rule.id
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
                        rule: rule.id
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
                        rule: rule.id
                    }))
                    .send({
                        routingTableId: table.id,
                        comment: 'other_route',
                        ipObjGroupIds: [group.id]
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(422);
            });

            it('should thrown a validation exception if openvpn type is not valid', async () => {
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
                        rule: rule.id
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

        describe('@remove', () => {
            let rule: RoutingRule;
            
            beforeEach(async () => {
                rule = await routingRuleService.create({
                    routingTableId: table.id,
                });
            });

            it('guest user should not remove a rules', async () => {
				return await request(app.express)
					.delete(_URL().getURL('fwclouds.firewalls.routing.rules.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        rule: rule.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not remove a rules', async () => {
                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.rules.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        rule: rule.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should remove a rules', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.rules.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        rule: rule.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(async () => {
                        expect(await routingRuleService.findOneInPath({
                            fwCloudId: fwCloud.id,
                            firewallId: firewall.id,
                            id: rule.id
                        })).to.be.undefined
                    });
            });

            it('admin user should remove a rule', async () => {
                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.rules.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        rule: rule.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(async () => {
                        expect(await routingRuleService.findOneInPath({
                            fwCloudId: fwCloud.id,
                            firewallId: firewall.id,
                            id: rule.id
                        })).to.be.undefined
                    });
            });


        });
    });
});