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
import { Route } from "../../../../../src/models/routing/route/route.model";
import { RouteService } from "../../../../../src/models/routing/route/route.service";
import { IPObj } from "../../../../../src/models/ipobj/IPObj";
import { RouteController } from "../../../../../src/controllers/routing/route.controller";

describe(describeName('Route E2E Tests'), () => {
    let app: Application;
    let loggedUser: User;
    let loggedUserSessionId: string;
    
    let adminUser: User;
    let adminUserSessionId: string;

    let fwCloud: FwCloud;
    let firewall: Firewall;
    let table: RoutingTable;
    let gateway: IPObj;

    let routeService: RouteService;

    beforeEach(async () => {
        app = testSuite.app;
        
        loggedUser = await createUser({role: 0});
        loggedUserSessionId = generateSession(loggedUser);

        adminUser = await createUser({role: 1});
        adminUserSessionId = generateSession(adminUser);

        routeService = await app.getService(RouteService.name);

        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
            name: StringHelper.randomize(10)
        }));

        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwCloud.id
        }));

        gateway = await getRepository(IPObj).save(getRepository(IPObj).create({
            name: 'test',
            address: '0.0.0.0',
            ipObjTypeId: 0,
            interfaceId: null
        }));

        table = await getRepository(RoutingTable).save({
            firewallId: firewall.id,
            number: 1,
            name: 'name',
        });

    });

    describe(RouteController.name, () => {
        describe('@index', () => {
            let route: Route;
            
            beforeEach(async () => {
                route = await routeService.create({
                    routingTableId: table.id,
                    gatewayId: gateway.id
                });
            });

            it('guest user should not see a routes', async () => {
				return await request(app.express)
					.get(_URL().getURL('fwclouds.firewalls.routing.tables.routes.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not see routes', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.tables.routes.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should see routes', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.tables.routes.index', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.have.length(1);
                    });
            });

            it('admin user should see routes', async () => {
                return await request(app.express)
                .get(_URL().getURL('fwclouds.firewalls.routing.tables.routes.index', {
                    fwcloud: fwCloud.id,
                    firewall: firewall.id,
                    routingTable: table.id
                }))
                .set('Cookie', [attachSession(adminUserSessionId)])
                .expect(200)
                .then(response => {
                    expect(response.body.data).to.have.length(1);
                });
            });


        });

        describe('@show', () => {
            let route: Route;
            
            beforeEach(async () => {
                route = await routeService.create({
                    routingTableId: table.id,
                    gatewayId: gateway.id
                });
            });            

            it('guest user should not see a route', async () => {
				return await request(app.express)
					.get(_URL().getURL('fwclouds.firewalls.routing.tables.routes.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id,
                        route: route.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not see a route', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.tables.routes.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id,
                        route: route.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should see a route', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.routing.tables.routes.show', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id,
                        route: route.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data.gatewayId).to.deep.eq(route.gatewayId);
                        expect(response.body.data.id).to.deep.eq(route.id);
                        expect(response.body.data.routingTableId).to.deep.eq(route.routingTableId);
                    });
            });

            it('admin user should see a route', async () => {
                return await request(app.express)
                .get(_URL().getURL('fwclouds.firewalls.routing.tables.routes.show', {
                    fwcloud: fwCloud.id,
                    firewall: firewall.id,
                    routingTable: table.id,
                    route: route.id
                }))           
                .set('Cookie', [attachSession(adminUserSessionId)])
                .expect(200)
                .then(response => {
                    expect(response.body.data.gatewayId).to.deep.eq(route.gatewayId);
                    expect(response.body.data.id).to.deep.eq(route.id);
                    expect(response.body.data.routingTableId).to.deep.eq(route.routingTableId);
                });
            });
        });

        describe('@create', () => {
            it('guest user should not create a route', async () => {
				return await request(app.express)
					.post(_URL().getURL('fwclouds.firewalls.routing.tables.routes.store', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id
                    }))
					.send({
                        gatewayId: gateway.id
                    })
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not create a route', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.routing.tables.routes.store', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id
                    }))
                    .send({
                        gatewayId: gateway.id
                    })
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should create a route', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.routing.tables.routes.store', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id
                    }))
                    .send({
                        gatewayId: gateway.id
                    })
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(201)
                    .then(response => {
                        expect(response.body.data.routingTableId).to.eq(table.id);
                    });
            });

            it('admin user should create a route', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.routing.tables.routes.store', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id
                    }))
                    .send({
                        gatewayId: gateway.id
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(201)
                    .then(response => {
                        expect(response.body.data.routingTableId).to.eq(table.id);
                    });
            });


        });

        describe('@update', () => {
            let route: Route;
            
            beforeEach(async () => {
                route = await routeService.create({
                    routingTableId: table.id,
                    gatewayId: gateway.id
                });
            }); 

            it('guest user should not update a route', async () => {
				return await request(app.express)
					.put(_URL().getURL('fwclouds.firewalls.routing.tables.routes.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id,
                        route: route.id
                    }))
					.send({
                        comment: 'route'
                    })
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not create a route', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.tables.routes.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id,
                        route: route.id
                    }))
                    .send({
                        comment: 'route'
                    })
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should update a route', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.tables.routes.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id,
                        route: route.id
                    }))
                    .send({
                        comment: 'route'
                    })
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data.comment).to.eq('route');
                    });
            });

            it('admin user should create a route', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.firewalls.routing.tables.routes.update', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id,
                        route: route.id
                    }))
                    .send({
                        comment: 'other_route'
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data.comment).to.eq('other_route');
                    });
            });


        });

        describe('@remove', () => {
            let route: Route;
            
            beforeEach(async () => {
                route = await routeService.create({
                    routingTableId: table.id,
                    gatewayId: gateway.id
                });
            }); 

            it('guest user should not remove a route', async () => {
				return await request(app.express)
					.delete(_URL().getURL('fwclouds.firewalls.routing.tables.routes.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id,
                        route: route.id
                    }))
					.expect(401);
			});

            it('regular user which does not belong to the fwcloud should not remove a route', async () => {
                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.tables.routes.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id,
                        route: route.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should remove a route', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.tables.routes.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id,
                        route: route.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(200)
                    .then(async () => {
                        expect(await routeService.findOne(route.id)).to.be.undefined
                    });
            });

            it('admin user should create a route', async () => {
                return await request(app.express)
                    .delete(_URL().getURL('fwclouds.firewalls.routing.tables.routes.delete', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        routingTable: table.id,
                        route: route.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(async () => {
                        expect(await routeService.findOne(route.id)).to.be.undefined
                    });
            });


        });
    });
});