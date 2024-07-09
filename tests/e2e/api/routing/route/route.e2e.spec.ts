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

import { EntityManager } from 'typeorm';
import { Application } from '../../../../../src/Application';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../../src/models/fwcloud/FwCloud';
import { User } from '../../../../../src/models/user/User';
import StringHelper from '../../../../../src/utils/string.helper';
import { describeName, expect, testSuite } from '../../../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../../../utils/utils';
import request = require('supertest');
import { _URL } from '../../../../../src/fonaments/http/router/router.service';
import { RoutingTable } from '../../../../../src/models/routing/routing-table/routing-table.model';
import { Route } from '../../../../../src/models/routing/route/route.model';
import { RouteService } from '../../../../../src/models/routing/route/route.service';
import { IPObj } from '../../../../../src/models/ipobj/IPObj';
import { RouteController } from '../../../../../src/controllers/routing/route/route.controller';
import { IPObjGroup } from '../../../../../src/models/ipobj/IPObjGroup';
import { OpenVPN } from '../../../../../src/models/vpn/openvpn/OpenVPN';
import { Crt } from '../../../../../src/models/vpn/pki/Crt';
import { Ca } from '../../../../../src/models/vpn/pki/Ca';
import { RouteControllerMoveDto } from '../../../../../src/controllers/routing/route/dtos/move.dto';
import { RouteControllerBulkUpdateDto } from '../../../../../src/controllers/routing/route/dtos/bulk-update.dto';
import { RouteControllerCopyDto } from '../../../../../src/controllers/routing/route/dtos/copy.dto';
import { RouteRepository } from '../../../../../src/models/routing/route/route.repository';
import { Offset } from '../../../../../src/offset';
import { RouteMoveToDto } from '../../../../../src/controllers/routing/route/dtos/move-to.dto';
import { FwCloudFactory, FwCloudProduct } from '../../../../utils/fwcloud-factory';
import { RouteMoveInterfaceDto } from '../../../../../src/controllers/routing/route/dtos/move-interface.dto';
import { RouteMoveToGatewayDto } from '../../../../../src/controllers/routing/route/dtos/move-to-gateway.dto';
import db from '../../../../../src/database/database-manager';

describe(describeName('Route E2E Tests'), () => {
  let app: Application;
  let loggedUser: User;
  let loggedUserSessionId: string;

  let adminUser: User;
  let adminUserSessionId: string;

  let fwcProduct: FwCloudProduct;
  let fwCloud: FwCloud;
  let firewall: Firewall;
  let table: RoutingTable;
  let gateway: IPObj;

  let routeService: RouteService;
  let manager: EntityManager;

  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();

    loggedUser = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUser);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    routeService = await app.getService(RouteService.name);

    fwcProduct = await new FwCloudFactory().make();

    fwCloud = fwcProduct.fwcloud;

    firewall = fwcProduct.firewall;

    gateway = fwcProduct.ipobjs.get('gateway');

    table = await manager.getRepository(RoutingTable).save({
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
          gatewayId: gateway.id,
        });
      });

      it('guest user should not see a routes', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.index', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not see routes', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.index', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should see routes', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.index', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(1);
          });
      });

      it('admin user should see routes', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.index', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(1);
          });
      });
    });

    describe('@move', () => {
      let routeOrder1: Route;
      let routeOrder2: Route;
      let routeOrder3: Route;
      let routeOrder4: Route;
      let data: RouteControllerMoveDto;

      beforeEach(async () => {
        routeOrder1 = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
        });

        routeOrder2 = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
        });

        routeOrder3 = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
        });

        routeOrder4 = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
        });

        data = {
          routes: [routeOrder1.id, routeOrder2.id],
          to: routeOrder3.id,
          offset: Offset.Above,
        };
      });

      it('guest user should not move routes', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.move', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not move routes', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.move', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send(data)
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should move routes', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);
        await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.move', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send(data)
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });

        expect(
          (await manager.getRepository(Route).findOne({ where: { id: routeOrder1.id } }))
            .route_order,
        ).to.eq(1);
        expect(
          (await manager.getRepository(Route).findOne({ where: { id: routeOrder2.id } }))
            .route_order,
        ).to.eq(2);
        expect(
          (await manager.getRepository(Route).findOne({ where: { id: routeOrder3.id } }))
            .route_order,
        ).to.eq(3);
        expect(
          (await manager.getRepository(Route).findOne({ where: { id: routeOrder4.id } }))
            .route_order,
        ).to.eq(4);
      });

      it('admin user should move routes', async () => {
        await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.move', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send(data)
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });

        expect(
          (await manager.getRepository(Route).findOne({ where: { id: routeOrder1.id } }))
            .route_order,
        ).to.eq(1);
        expect(
          (await manager.getRepository(Route).findOne({ where: { id: routeOrder2.id } }))
            .route_order,
        ).to.eq(2);
        expect(
          (await manager.getRepository(Route).findOne({ where: { id: routeOrder3.id } }))
            .route_order,
        ).to.eq(3);
        expect(
          (await manager.getRepository(Route).findOne({ where: { id: routeOrder4.id } }))
            .route_order,
        ).to.eq(4);
      });
    });

    describe('@moveTo', () => {
      let rule1: Route;
      let rule2: Route;
      let data: RouteMoveToDto;

      beforeEach(async () => {
        rule1 = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
          ipObjIds: [{ id: gateway.id, order: 1 }],
        });

        rule2 = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
        });

        data = {
          fromId: rule1.id,
          toId: rule2.id,
          ipObjId: gateway.id,
        };
      });

      it('guest user should not move from items between rules', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.moveTo', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not move from items between rules', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.moveTo', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send(data)
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should move from items between rules', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.moveTo', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send(data)
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });
      });

      it('admin user should move from items between rules', async () => {
        await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.moveTo', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send(data)
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });
      });
    });

    describe('@moveToGateway', () => {
      let route1: Route;
      let route2: Route;
      let gateway2: IPObj;
      let data: RouteMoveToGatewayDto;

      beforeEach(async () => {
        gateway2 = await manager.getRepository(IPObj).save({
          name: 'gateway',
          address: '1.2.3.4',
          ipObjTypeId: 5,
          interfaceId: null,
          fwCloudId: fwcProduct.fwcloud.id,
        });

        route1 = await routeService.create({
          gatewayId: gateway.id,
          routingTableId: fwcProduct.routingTable.id,
          ipObjIds: [
            {
              id: gateway.id,
              order: 1,
            },
          ],
        });

        route2 = await routeService.create({
          routingTableId: fwcProduct.routingTable.id,
          gatewayId: gateway2.id,
        });

        data = {
          fromId: route1.id,
          toId: route2.id,
          ipObjId: gateway.id,
        };
      });

      it('guest user should not move from items to gateway between rules', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.moveToGateway', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: fwcProduct.routingTable.id,
            }),
          )
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not move from items to gateway between rules', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.moveToGateway', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: fwcProduct.routingTable.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send(data)
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should move from items to gateway between rules', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);
        await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.moveToGateway', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: fwcProduct.routingTable.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send(data)
          .expect(200);

        expect(
          (await manager.getRepository(Route).findOneOrFail({ where: { id: route2.id } }))
            .gatewayId,
        ).to.eq(gateway.id);
      });

      it('admin user should move from items to gateway between rules', async () => {
        await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.moveToGateway', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: fwcProduct.routingTable.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send(data)
          .expect(200);

        expect(
          (await manager.getRepository(Route).findOneOrFail({ where: { id: route2.id } }))
            .gatewayId,
        ).to.eq(gateway.id);
      });
    });

    describe('@moveInterface', () => {
      let rule1: Route;
      let rule2: Route;
      let data: RouteMoveInterfaceDto;

      beforeEach(async () => {
        rule1 = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
          interfaceId: fwcProduct.interfaces.get('firewall-interface1').id,
        });

        rule2 = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
        });

        data = {
          fromId: rule1.id,
          toId: rule2.id,
          interfaceId: fwcProduct.interfaces.get('firewall-interface1').id,
        };
      });

      it('guest user should not move interface items between rules', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.moveInterface', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not move interface items between rules', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.moveInterface', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send(data)
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should move interface items between rules', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.moveInterface', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .send(data)
          .expect(200);

        expect(
          (await manager.getRepository(Route).findOneOrFail({ where: { id: rule1.id } }))
            .interfaceId,
        ).to.be.null;
        expect(
          (await manager.getRepository(Route).findOneOrFail({ where: { id: rule2.id } }))
            .interfaceId,
        ).to.eq(fwcProduct.interfaces.get('firewall-interface1').id);
      });

      it('admin user should move from interface between rules', async () => {
        await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.moveInterface', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .send(data)
          .expect(200);

        expect(
          (await manager.getRepository(Route).findOneOrFail({ where: { id: rule1.id } }))
            .interfaceId,
        ).to.be.null;
        expect(
          (await manager.getRepository(Route).findOneOrFail({ where: { id: rule2.id } }))
            .interfaceId,
        ).to.eq(fwcProduct.interfaces.get('firewall-interface1').id);
      });
    });

    describe('@show', () => {
      let route: Route;

      beforeEach(async () => {
        route = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
        });
      });

      it('guest user should not see a route', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.show', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not see a route', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.show', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should see a route', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.show', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data.gatewayId).to.deep.eq(route.gatewayId);
            expect(response.body.data.id).to.deep.eq(route.id);
            expect(response.body.data.routingTableId).to.deep.eq(route.routingTableId);
          });
      });

      it('admin user should see a route', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.show', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data.gatewayId).to.deep.eq(route.gatewayId);
            expect(response.body.data.id).to.deep.eq(route.id);
            expect(response.body.data.routingTableId).to.deep.eq(route.routingTableId);
          });
      });
    });

    describe('@compile', () => {
      let route: Route;

      beforeEach(async () => {
        route = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
        });
      });

      it('guest user should not compile a route', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.compile', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not compile a route', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.compile', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should compile a route', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.compile', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).instanceOf(Array);
          });
      });

      it('admin user should compile a route', async () => {
        return await request(app.express)
          .get(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.compile', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).instanceOf(Array);
          });
      });
    });

    describe('@create', () => {
      it('guest user should not create a route', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.store', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .send({
            gatewayId: gateway.id,
          })
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not create a route', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.store', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .send({
            gatewayId: gateway.id,
          })
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should create a route', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.store', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .send({
            gatewayId: gateway.id,
          })
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(201)
          .then((response) => {
            expect(response.body.data.routingTableId).to.eq(table.id);
          });
      });

      it('admin user should create a route', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.store', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .send({
            gatewayId: gateway.id,
          })
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(201)
          .then((response) => {
            expect(response.body.data.routingTableId).to.eq(table.id);
          });
      });
    });

    describe('@copy', () => {
      let routeOrder1: Route;
      let routeOrder2: Route;
      let data: RouteControllerCopyDto;

      beforeEach(async () => {
        routeOrder1 = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
          comment: 'comment1',
        });

        routeOrder2 = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
          comment: 'comment2',
        });

        data = {
          routes: [routeOrder1.id, routeOrder2.id],
          to: (await new RouteRepository(manager).getLastRouteInRoutingTable(table.id)).id,
          offset: Offset.Below,
        };
      });

      it('guest user should not copy routes', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.copy', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .send(data)
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not copy routes', async () => {
        return await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.copy', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .send(data)
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should copy routes', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.copy', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .send(data)
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(201)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });

        expect(await manager.getRepository(Route).count({ where: { comment: 'comment1' } })).to.eq(
          2,
        );
        expect(await manager.getRepository(Route).count({ where: { comment: 'comment2' } })).to.eq(
          2,
        );
      });

      it('admin user should copy routes', async () => {
        await request(app.express)
          .post(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.copy', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .send(data)
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(201)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });

        expect(await manager.getRepository(Route).count({ where: { comment: 'comment1' } })).to.eq(
          2,
        );
        expect(await manager.getRepository(Route).count({ where: { comment: 'comment2' } })).to.eq(
          2,
        );
      });
    });

    describe('@update', () => {
      let route: Route;

      beforeEach(async () => {
        route = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
        });
      });

      it('guest user should not update a route', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.update', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .send({
            comment: 'route',
          })
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not create a route', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.update', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .send({
            gatewayId: gateway.id,
            comment: 'route',
          })
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should update a route', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.update', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .send({
            gatewayId: gateway.id,
            comment: 'route',
          })
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data.comment).to.eq('route');
          });
      });

      it('admin user should create a route', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.update', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .send({
            gatewayId: gateway.id,
            comment: 'other_route',
          })
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data.comment).to.eq('other_route');
          });
      });

      it('should thrown a validation exception if ipobj type is not valid', async () => {
        const ipobj = await manager.getRepository(IPObj).save(
          manager.getRepository(IPObj).create({
            name: 'test',
            address: '0.0.0.0',
            ipObjTypeId: 0,
            interfaceId: null,
          }),
        );

        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.update', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .send({
            gatewayId: gateway.id,
            comment: 'other_route',
            ipObjIds: [ipobj.id],
          })
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(422);
      });

      it('should thrown a validation exception if ipobj group type is not valid', async () => {
        const group = await manager.getRepository(IPObjGroup).save(
          manager.getRepository(IPObjGroup).create({
            name: 'test',
            type: 0,
          }),
        );

        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.update', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .send({
            gatewayId: gateway.id,
            comment: 'other_route',
            ipObjGroupIds: [group.id],
          })
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(422);
      });

      it('should thrown a validation exception if openvpn type is not valid', async () => {
        const openvpn = await manager.getRepository(OpenVPN).save(
          manager.getRepository(OpenVPN).create({
            firewallId: firewall.id,
            crt: await manager.getRepository(Crt).save(
              manager.getRepository(Crt).create({
                cn: StringHelper.randomize(10),
                days: 100,
                type: 0,
                ca: await manager.getRepository(Ca).save(
                  manager.getRepository(Ca).create({
                    fwCloud: fwCloud,
                    cn: StringHelper.randomize(10),
                    days: 100,
                  }),
                ),
              }),
            ),
            parent: await manager.getRepository(OpenVPN).save(
              manager.getRepository(OpenVPN).create({
                firewallId: firewall.id,
                crt: await manager.getRepository(Crt).save(
                  manager.getRepository(Crt).create({
                    cn: StringHelper.randomize(10),
                    days: 100,
                    type: 0,
                    ca: await manager.getRepository(Ca).save(
                      manager.getRepository(Ca).create({
                        fwCloud: fwCloud,
                        cn: StringHelper.randomize(10),
                        days: 100,
                      }),
                    ),
                  }),
                ),
              }),
            ),
          }),
        );

        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.update', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .send({
            routingTableId: table.id,
            gatewayId: gateway.id,
            comment: 'other_route',
            openVPNIds: [openvpn.id],
          })
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(422);
      });
    });

    describe('@bulkUpdate', () => {
      let routeOrder1: Route;
      let routeOrder2: Route;
      const data: RouteControllerBulkUpdateDto = {
        style: 'style!',
      };

      beforeEach(async () => {
        routeOrder1 = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
        });

        routeOrder2 = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
        });
      });

      it('guest user should not bulk update routes', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.bulkUpdate', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .query({
            routes: [routeOrder1.id, routeOrder2.id],
          })
          .send(data)
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not bulk update routes', async () => {
        return await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.bulkUpdate', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .query({
            routes: [routeOrder1.id, routeOrder2.id],
          })
          .send(data)
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should bulk update routes', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.bulkUpdate', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .query({
            routes: [routeOrder1.id, routeOrder2.id],
          })
          .send(data)
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });

        expect(
          (await manager.getRepository(Route).findOne({ where: { id: routeOrder1.id } })).style,
        ).to.eq('style!');
        expect(
          (await manager.getRepository(Route).findOne({ where: { id: routeOrder2.id } })).style,
        ).to.eq('style!');
      });

      it('admin user should bulk update routes', async () => {
        await request(app.express)
          .put(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.bulkUpdate', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .query({
            routes: [routeOrder1.id, routeOrder2.id],
          })
          .send(data)
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });

        expect(
          (await manager.getRepository(Route).findOne({ where: { id: routeOrder1.id } })).style,
        ).to.eq('style!');
        expect(
          (await manager.getRepository(Route).findOne({ where: { id: routeOrder2.id } })).style,
        ).to.eq('style!');
      });
    });

    describe('@remove', () => {
      let route: Route;

      beforeEach(async () => {
        route = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
        });
      });

      it('guest user should not remove a route', async () => {
        return await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.delete', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not remove a route', async () => {
        return await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.delete', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should remove a route', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        return await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.delete', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(200)
          .then(async () => {
            expect(
              await routeService.findOneInPath({
                fwCloudId: fwCloud.id,
                firewallId: firewall.id,
                routingTableId: table.id,
                id: route.id,
              }),
            ).to.be.null;
          });
      });

      it('admin user should create a route', async () => {
        return await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.delete', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
              route: route.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(200)
          .then(async () => {
            expect(
              await routeService.findOneInPath({
                fwCloudId: fwCloud.id,
                firewallId: firewall.id,
                routingTableId: table.id,
                id: route.id,
              }),
            ).to.be.null;
          });
      });
    });

    describe('@bulkRemove', () => {
      let routeOrder1: Route;
      let routeOrder2: Route;

      beforeEach(async () => {
        routeOrder1 = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
        });

        routeOrder2 = await routeService.create({
          routingTableId: table.id,
          gatewayId: gateway.id,
        });
      });

      it('guest user should not bulk remove routes', async () => {
        return await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.bulkRemove', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .query({
            routes: [routeOrder1.id, routeOrder2.id],
          })
          .expect(401);
      });

      it('regular user which does not belong to the fwcloud should not bulk remove routes', async () => {
        return await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.bulkRemove', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .query({
            routes: [routeOrder1.id, routeOrder2.id],
          })
          .expect(401);
      });

      it('regular user which belongs to the fwcloud should bulk remove routes', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.bulkRemove', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .query({
            routes: [routeOrder1.id, routeOrder2.id],
          })
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });
        expect(await manager.getRepository(Route).findOne({ where: { id: routeOrder1.id } })).to.be
          .null;
        expect(await manager.getRepository(Route).findOne({ where: { id: routeOrder2.id } })).to.be
          .null;
      });

      it('admin user should bulk remove routes', async () => {
        await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.bulkRemove', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .query({
            routes: [routeOrder1.id, routeOrder2.id],
          })
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(2);
          });

        expect(await manager.getRepository(Route).findOne({ where: { id: routeOrder1.id } })).to.be
          .null;
        expect(await manager.getRepository(Route).findOne({ where: { id: routeOrder2.id } })).to.be
          .null;
      });

      it('should throw validation error if query rules is not provided', async () => {
        await request(app.express)
          .delete(
            _URL().getURL('fwclouds.firewalls.routing.tables.routes.bulkRemove', {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .query({
            routes: routeOrder1.id,
          })
          .expect(422);
      });
    });
  });
});
