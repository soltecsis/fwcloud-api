import { expect } from "chai";
import request = require("supertest");
import { getRepository } from "typeorm";
import { Application } from "../../../../../src/Application";
import { _URL } from "../../../../../src/fonaments/http/router/router.service";
import { Firewall } from "../../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../../src/models/fwcloud/FwCloud";
import { IPObj } from "../../../../../src/models/ipobj/IPObj";
import { RouteGroup } from "../../../../../src/models/routing/route-group/route-group.model";
import { RouteGroupService } from "../../../../../src/models/routing/route-group/route-group.service";
import { Route } from "../../../../../src/models/routing/route/route.model";
import { RoutingTable } from "../../../../../src/models/routing/routing-table/routing-table.model";
import { User } from "../../../../../src/models/user/User";
import StringHelper from "../../../../../src/utils/string.helper";
import { describeName, testSuite } from "../../../../mocha/global-setup";
import { createUser, generateSession, attachSession } from "../../../../utils/utils";

describe(describeName('Route Group E2E Tests'), () => {
    let app: Application;
    let loggedUser: User;
    let loggedUserSessionId: string;
    
    let adminUser: User;
    let adminUserSessionId: string;

    let fwCloud: FwCloud;
    let firewall: Firewall;
    let table: RoutingTable;
    let route: Route;
    let gateway: IPObj;

    let routeGroupService: RouteGroupService;

    beforeEach(async () => {
        app = testSuite.app;
        
        loggedUser = await createUser({role: 0});
        loggedUserSessionId = generateSession(loggedUser);

        adminUser = await createUser({role: 1});
        adminUserSessionId = generateSession(adminUser);

        routeGroupService = await app.getService(RouteGroupService.name);

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

        gateway = await getRepository(IPObj).save(getRepository(IPObj).create({
            name: 'test',
            address: '0.0.0.0',
            ipObjTypeId: 0,
            interfaceId: null
        }));

        route = await getRepository(Route).save({
            routingTableId: table.id,
            gatewayId: gateway.id,
        });

    });

    describe(RouteGroup.name, () => {
        describe('@index', () => {
            let group: RouteGroup;
            
            beforeEach(async () => {
                group = await getRepository(RouteGroup).save({
                    name: 'group',
                    firewallId: firewall.id,
                    routes: [route]
                })
            });

            it('guest user should not see route groups', async () => {
				return await request(app.express)
					.get(_URL().getURL('fwclouds.firewalls.routing.routeGroups.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not see route groups', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.routeGroups.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should see route groups', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.routeGroups.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(1);
                        expect(response.body.data[0].routes).to.have.length(1);
                    });
            });

            it('admin user should see route groups', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.routeGroups.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(1);
                        expect(response.body.data[0].routes).to.have.length(1);
                    });
            });
        });

        describe('@show', () => {
            let group: RouteGroup;

            beforeEach(async () => {
                group = await getRepository(RouteGroup).save({
                    name: 'group',
                    firewallId: firewall.id,
                    routes: [route]
                })
            });

            it('guest user should not see a route group', async () => {
				return await request(app.express)
					.get(_URL().getURL('fwclouds.firewalls.routing.routeGroups.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routeGroup: group.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not see a route group', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.routeGroups.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routeGroup: group.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should see a route group', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.routeGroups.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routeGroup: group.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data.id).to.equal(group.id);
                        expect(response.body.data.routes).to.have.length(1);
                    });
            });

            it('admin user should see a route group', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.routeGroups.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routeGroup: group.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data.id).to.equal(group.id);
                        expect(response.body.data.routes).to.have.length(1);
                    });
            });
        });

        describe('@create', () => {
            let data: Record<string, unknown>;

            beforeEach(async () => {
                data = {
                    name: Date.now().toString(),
                    comment: Date.now().toString()
                }
            });

            it('guest user should not create a route group', async () => {
				return await request(app.express)
					.post(_URL().getURL('fwclouds.firewalls.routing.routeGroups.create', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .send(data)
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not create a route group', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.routing.routeGroups.create', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .send(data)
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should create a route group', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.routing.routeGroups.create', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .send(data)
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(201)
                    .then(response => {
                        expect(response.body.data.name).to.equal(data.name);
                        expect(response.body.data.comment).to.equal(data.comment);
                    });
            });

            it('admin user should create a route group', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.routing.routeGroups.create', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                    }))
                    .send(data)
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(201)
                    .then(response => {
                        expect(response.body.data.name).to.equal(data.name);
                        expect(response.body.data.comment).to.equal(data.comment);
                    });
            });
        });

        describe('@update', () => {
            let group: RouteGroup;
            let data: Record<string, unknown>;

            beforeEach(async () => {
                group = await getRepository(RouteGroup).save({
                    name: 'group',
                    firewallId: firewall.id,
                    routes: [route]
                })

                data = {
                    name: Date.now().toString(),
                    comment: Date.now().toString()
                }
            });

            it('guest user should not update a route group', async () => {
				return await request(app.express)
					.put(_URL().getURL('fwclouds.firewalls.routing.routeGroups.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routeGroup: group.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not update a route group', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.routeGroups.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routeGroup: group.id
                    }))
                    .send(data)
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should update a route group', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.routeGroups.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routeGroup: group.id
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

            it('admin user should update a route group', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.routeGroups.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routeGroup: group.id
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
            let group: RouteGroup;

            beforeEach(async () => {
                group = await getRepository(RouteGroup).save({
                    name: 'group',
                    firewallId: firewall.id,
                    routes: [route]
                });
            });

            it('guest user should not remove a route group', async () => {
				return await request(app.express)
					.delete(_URL().getURL('fwclouds.firewalls.routing.routeGroups.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routeGroup: group.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not remove a route group', async () => {
                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.routeGroups.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routeGroup: group.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should remove a route group', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.routeGroups.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routeGroup: group.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(async () => {
                        expect(await routeGroupService.findOneInPath({fwCloudId: fwCloud.id, firewallId: firewall.id, id: group.id})).to.be.undefined;
                    });
            });

            it('admin user should remove a route group', async () => {
                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.routeGroups.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routeGroup: group.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(async () => {
                        expect(await routeGroupService.findOneInPath({fwCloudId: fwCloud.id, firewallId: firewall.id, id: group.id})).to.be.undefined;
                    });
            });
        });
    });
});