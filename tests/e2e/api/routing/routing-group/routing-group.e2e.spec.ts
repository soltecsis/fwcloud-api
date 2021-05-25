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

import { expect } from "chai";
import request = require("supertest");
import { getCustomRepository, getRepository } from "typeorm";
import { Application } from "../../../../../src/Application";
import { _URL } from "../../../../../src/fonaments/http/router/router.service";
import { Firewall } from "../../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../../src/models/fwcloud/FwCloud";
import { RoutingGroup } from "../../../../../src/models/routing/routing-group/routing-group.model";
import { RoutingGroupService } from "../../../../../src/models/routing/routing-group/routing-group.service";
import { RoutingRule } from "../../../../../src/models/routing/routing-rule/routing-rule.model";
import { RoutingRuleRepository } from "../../../../../src/models/routing/routing-rule/routing-rule.repository";
import { RoutingTable } from "../../../../../src/models/routing/routing-table/routing-table.model";
import { User } from "../../../../../src/models/user/User";
import StringHelper from "../../../../../src/utils/string.helper";
import { describeName, testSuite } from "../../../../mocha/global-setup";
import { createUser, generateSession, attachSession } from "../../../../utils/utils";

describe(describeName('Routing Group E2E Tests'), () => {
    let app: Application;
    let loggedUser: User;
    let loggedUserSessionId: string;
    
    let adminUser: User;
    let adminUserSessionId: string;

    let fwCloud: FwCloud;
    let firewall: Firewall;
    let table: RoutingTable;
    let rule: RoutingRule;

    let routingGroupService: RoutingGroupService;

    beforeEach(async () => {
        app = testSuite.app;
        
        loggedUser = await createUser({role: 0});
        loggedUserSessionId = generateSession(loggedUser);

        adminUser = await createUser({role: 1});
        adminUserSessionId = generateSession(adminUser);

        routingGroupService = await app.getService(RoutingGroupService.name);

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

        rule = await getCustomRepository(RoutingRuleRepository).save({
            routingTableId: table.id,
        });

    });

    describe(RoutingGroup.name, () => {
        describe('@index', () => {
            let group: RoutingGroup;
            
            beforeEach(async () => {
                group = await getRepository(RoutingGroup).save({
                    name: 'group',
                    firewallId: firewall.id,
                    routingRules: [rule]
                })
            });

            it('guest user should not see routing groups', async () => {
				return await request(app.express)
					.get(_URL().getURL('fwclouds.firewalls.routing.routingGroups.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not see routing groups', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.routingGroups.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should see routing groups', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.routingGroups.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(1);
                        expect(response.body.data[0].routingRules).to.have.length(1);
                    });
            });

            it('admin user should see routing groups', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.routingGroups.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(1);
                        expect(response.body.data[0].routingRules).to.have.length(1);
                    });
            });
        });

        describe('@show', () => {
            let group: RoutingGroup;

            beforeEach(async () => {
                group = await getRepository(RoutingGroup).save({
                    name: 'group',
                    firewallId: firewall.id,
                    routingRules: [rule]
                })
            });

            it('guest user should not see a routing group', async () => {
				return await request(app.express)
					.get(_URL().getURL('fwclouds.firewalls.routing.routingGroups.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingGroup: group.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not see a routing group', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.routingGroups.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingGroup: group.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should see a routing group', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.routingGroups.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingGroup: group.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data.id).to.equal(group.id);
                        expect(response.body.data.routingRules).to.have.length(1);
                    });
            });

            it('admin user should see a routing group', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.routingGroups.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingGroup: group.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data.id).to.equal(group.id);
                        expect(response.body.data.routingRules).to.have.length(1);
                    });
            });
        });

        describe('@create', () => {
            let data: Record<string, unknown>;

            beforeEach(async () => {
                data = {
                    name: Date.now().toString(),
                    comment: Date.now().toString(),
                    routingRules: [rule.id]
                }
            });

            it('guest user should not create a routing group', async () => {
				return await request(app.express)
					.post(_URL().getURL('fwclouds.firewalls.routing.routingGroups.create', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .send(data)
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not create a routing group', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.routing.routingGroups.create', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .send(data)
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should create a routing group', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.routing.routingGroups.create', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .send(data)
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(201)
                    .then(response => {
                        expect(response.body.data.name).to.equal(data.name);
                        expect(response.body.data.comment).to.equal(data.comment);
                        expect(response.body.data.routingRules).to.have.length(1);
                    });
            });

            it('admin user should create a routing group', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.routing.routingGroups.create', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .send(data)
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(201)
                    .then(response => {
                        expect(response.body.data.name).to.equal(data.name);
                        expect(response.body.data.comment).to.equal(data.comment);
                        expect(response.body.data.routingRules).to.have.length(1);
                    });
            });
        });

        describe('@update', () => {
            let group: RoutingGroup;
            let data: Record<string, unknown>;

            beforeEach(async () => {
                group = await getRepository(RoutingGroup).save({
                    name: 'group',
                    firewallId: firewall.id,
                    routingRules: [rule]
                })

                data = {
                    name: Date.now().toString(),
                    comment: Date.now().toString(),
                    routingRules: [rule.id]
                }
            });

            it('guest user should not update a routing group', async () => {
				return await request(app.express)
					.put(_URL().getURL('fwclouds.firewalls.routing.routingGroups.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingGroup: group.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not update a routing group', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.routingGroups.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingGroup: group.id
                    }))
                    .send(data)
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should update a routing group', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.routingGroups.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingGroup: group.id
                    }))
                    .send(data)
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data.id).to.equal(group.id);
                        expect(response.body.data.name).to.equal(data.name);
                        expect(response.body.data.comment).to.equal(data.comment);
                    });
            });

            it('admin user should update a routing group', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.routingGroups.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingGroup: group.id
                    }))
                    .send(data)
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data.id).to.equal(group.id);
                        expect(response.body.data.name).to.equal(data.name);
                        expect(response.body.data.comment).to.equal(data.comment);
                    });
            });
        });

        describe('@remove', () => {
            let group: RoutingGroup;
            let data: Record<string, unknown>;

            beforeEach(async () => {
                group = await getRepository(RoutingGroup).save({
                    name: 'group',
                    firewallId: firewall.id,
                    routingRules: [rule]
                })

                data = {
                    name: Date.now().toString(),
                    comment: Date.now().toString()
                }
            });

            it('guest user should not remove a routing group', async () => {
				return await request(app.express)
					.delete(_URL().getURL('fwclouds.firewalls.routing.routingGroups.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingGroup: group.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not remove a routing group', async () => {
                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.routingGroups.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingGroup: group.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should remove a routing group', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.routingGroups.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingGroup: group.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(async () => {
                        expect(await routingGroupService.findOneInPath({fwCloudId: fwCloud.id, firewallId: firewall.id, id: group.id})).to.be.undefined;
                    });
            });

            it('admin user should update a remove group', async () => {
                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.routingGroups.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingGroup: group.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(async () => {
                        expect(await routingGroupService.findOneInPath({fwCloudId: fwCloud.id, firewallId: firewall.id, id: group.id})).to.be.undefined;
                    });
            });
        });
    });
});