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
import { RoutingTableController } from "../../../../../src/controllers/routing/routing-tables/routing-tables.controller";
import { Firewall } from "../../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../../src/models/fwcloud/FwCloud";
import { User } from "../../../../../src/models/user/User";
import StringHelper from "../../../../../src/utils/string.helper";
import {
  describeName,
  expect,
  testSuite,
} from "../../../../mocha/global-setup";
import {
  attachSession,
  createUser,
  generateSession,
} from "../../../../utils/utils";
import request = require("supertest");
import { _URL } from "../../../../../src/fonaments/http/router/router.service";
import { RoutingTable } from "../../../../../src/models/routing/routing-table/routing-table.model";
import { RoutingTableService } from "../../../../../src/models/routing/routing-table/routing-table.service";
import { Tree } from "../../../../../src/models/tree/Tree";
import {
  FwCloudFactory,
  FwCloudProduct,
} from "../../../../utils/fwcloud-factory";
import { RouteService } from "../../../../../src/models/routing/route/route.service";
import { Route } from "../../../../../src/models/routing/route/route.model";
import { RoutingRuleService } from "../../../../../src/models/routing/routing-rule/routing-rule.service";
import { RoutingRule } from "../../../../../src/models/routing/routing-rule/routing-rule.model";

describe(describeName("Routing Table E2E Tests"), () => {
  let app: Application;
  let loggedUser: User;
  let loggedUserSessionId: string;

  let adminUser: User;
  let adminUserSessionId: string;

  let fwcProduct: FwCloudProduct;
  let fwCloud: FwCloud;
  let firewall: Firewall;

  beforeEach(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();

    loggedUser = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUser);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    fwcProduct = await new FwCloudFactory().make();

    fwCloud = fwcProduct.fwcloud;

    firewall = fwcProduct.firewall;

    await Tree.createAllTreeCloud(fwCloud);
    const node: { id: number } = (await Tree.getNodeByNameAndType(
      fwCloud.id,
      "FIREWALLS",
      "FDF",
    )) as { id: number };
    await Tree.insertFwc_Tree_New_firewall(fwCloud.id, node.id, firewall.id);
  });

  describe(RoutingTableController.name, () => {
    describe("@index", () => {
      let table: RoutingTable;
      let tableService: RoutingTableService;

      beforeEach(async () => {
        tableService = await app.getService(RoutingTableService.name);
        table = fwcProduct.routingTable;
      });

      it("guest user should not see a routing tables", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.index", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .expect(401);
      });

      it("regular user which does not belong to the fwcloud should not see tables", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.index", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it("regular user which belongs to the fwcloud should see tables", async () => {
        loggedUser.fwClouds = [fwCloud];
        await getRepository(User).save(loggedUser);

        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.index", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(1);
          });
      });

      it("admin user should see routing tables", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.index", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .set("Cookie", [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.have.length(1);
          });
      });
    });

    describe("@show", () => {
      let table: RoutingTable;
      let tableService: RoutingTableService;

      beforeEach(async () => {
        tableService = await app.getService(RoutingTableService.name);
        table = await tableService.create({
          firewallId: firewall.id,
          name: "name",
          number: 1,
          comment: null,
        });
      });

      it("guest user should not see a routing table", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.show", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .expect(401);
      });

      it("regular user which does not belong to the fwcloud should not see the table", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.show", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it("regular user which belongs to the fwcloud should see the table", async () => {
        loggedUser.fwClouds = [fwCloud];
        await getRepository(User).save(loggedUser);

        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.show", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data.id).to.eq(table.id);
          });
      });

      it("admin user should see routing table", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.show", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set("Cookie", [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data.id).to.eq(table.id);
          });
      });
    });

    describe("@grid", () => {
      let table: RoutingTable;
      let tableService: RoutingTableService;

      beforeEach(async () => {
        tableService = await app.getService(RoutingTableService.name);
        table = await tableService.create({
          firewallId: firewall.id,
          name: "name",
          number: 1,
          comment: null,
        });
      });

      it("guest user should not see a routing table grid", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.grid", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .expect(401);
      });

      it("regular user which does not belong to the fwcloud should not see the table grid", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.grid", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it("regular user which belongs to the fwcloud should see the table grid", async () => {
        loggedUser.fwClouds = [fwCloud];
        await getRepository(User).save(loggedUser);

        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.grid", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.deep.eq([]);
          });
      });

      it("admin user should see routing table grid", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.grid", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set("Cookie", [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.deep.eq([]);
          });
      });
    });

    describe("@create", () => {
      it("guest user should not create a routing table", async () => {
        return await request(app.express)
          .post(
            _URL().getURL("fwclouds.firewalls.routing.tables.store", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .send({
            number: 1,
            name: "table",
          })
          .expect(401);
      });

      it("regular user which does not belong to the fwcloud should not create the table", async () => {
        return await request(app.express)
          .post(
            _URL().getURL("fwclouds.firewalls.routing.tables.store", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .send({
            number: 1,
            name: "table",
          })
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it("regular user which belongs to the fwcloud should create the table", async () => {
        loggedUser.fwClouds = [fwCloud];
        await getRepository(User).save(loggedUser);

        return await request(app.express)
          .post(
            _URL().getURL("fwclouds.firewalls.routing.tables.store", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .send({
            number: 1,
            name: "table",
          })
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(201)
          .then((response) => {
            expect(response.body.data.firewallId).to.eq(firewall.id);
            expect(response.body.data.name).to.eq("table");
            expect(response.body.data.number).to.eq(1);
          });
      });

      it("admin user should create routing table", async () => {
        return await request(app.express)
          .post(
            _URL().getURL("fwclouds.firewalls.routing.tables.store", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
            }),
          )
          .send({
            number: 1,
            name: "table",
          })
          .set("Cookie", [attachSession(adminUserSessionId)])
          .expect(201)
          .then((response) => {
            expect(response.body.data.firewallId).to.eq(firewall.id);
            expect(response.body.data.name).to.eq("table");
            expect(response.body.data.number).to.eq(1);
          });
      });
    });

    describe("@update", () => {
      let table: RoutingTable;
      let tableService: RoutingTableService;

      beforeEach(async () => {
        tableService = await app.getService(RoutingTableService.name);
        table = await tableService.create({
          firewallId: firewall.id,
          name: "name",
          number: 1,
          comment: null,
        });
      });

      it("guest user should not update a routing table", async () => {
        return await request(app.express)
          .put(
            _URL().getURL("fwclouds.firewalls.routing.tables.update", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .send({
            name: "table",
            comment: "table",
          })
          .expect(401);
      });

      it("regular user which does not belong to the fwcloud should not create the table", async () => {
        return await request(app.express)
          .put(
            _URL().getURL("fwclouds.firewalls.routing.tables.update", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .send({
            name: "table",
            comment: "table",
          })
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it("regular user which belongs to the fwcloud should update the table", async () => {
        loggedUser.fwClouds = [fwCloud];
        await getRepository(User).save(loggedUser);

        return await request(app.express)
          .put(
            _URL().getURL("fwclouds.firewalls.routing.tables.update", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .send({
            name: "table",
            comment: "table",
          })
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data.comment).to.eq("table");
          });
      });

      it("admin user should create routing table", async () => {
        return await request(app.express)
          .put(
            _URL().getURL("fwclouds.firewalls.routing.tables.update", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .send({
            name: "table",
            comment: "other_table",
          })
          .set("Cookie", [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data.comment).to.eq("other_table");
          });
      });
    });

    describe("@restrictions", () => {
      let table: RoutingTable;
      let tableService: RoutingTableService;
      let rule: RoutingRule;

      beforeEach(async () => {
        tableService = await app.getService(RoutingTableService.name);
        table = await tableService.create({
          firewallId: firewall.id,
          name: "name",
          number: 1,
          comment: null,
        });

        rule = await (
          await app.getService<RoutingRuleService>(RoutingRuleService.name)
        ).create({
          routingTableId: table.id,
          markIds: [
            {
              id: fwcProduct.mark.id,
              order: 1,
            },
          ],
        });
      });

      it("guest user should not see a routing table restrictions", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.restrictions", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .expect(401);
      });

      it("regular user which does not belong to the fwcloud should not see the table restrictions", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.restrictions", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it("regular user which belongs to the fwcloud should see the table restrictions", async () => {
        loggedUser.fwClouds = [fwCloud];
        await getRepository(User).save(loggedUser);

        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.restrictions", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(403)
          .then((response) => {
            expect(
              response.body.data.restrictions.routingTableUsedInRule,
            ).to.has.length(1);
            expect(
              response.body.data.restrictions.routingTableUsedInRule[0]
                .routing_rule_id,
            ).to.eq(rule.id);
          });
      });

      it("admin user should see routing table restrictions", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.restrictions", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set("Cookie", [attachSession(adminUserSessionId)])
          .expect(403)
          .then((response) => {
            expect(
              response.body.data.restrictions.routingTableUsedInRule,
            ).to.has.length(1);
            expect(
              response.body.data.restrictions.routingTableUsedInRule[0]
                .routing_rule_id,
            ).to.eq(rule.id);
          });
      });
    });
    describe("@remove", () => {
      let table: RoutingTable;
      let tableService: RoutingTableService;

      beforeEach(async () => {
        tableService = await app.getService(RoutingTableService.name);
        table = await tableService.create({
          firewallId: firewall.id,
          name: "name",
          number: 1,
          comment: null,
        });
      });

      it("guest user should not remove a routing table", async () => {
        return await request(app.express)
          .delete(
            _URL().getURL("fwclouds.firewalls.routing.tables.delete", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .expect(401);
      });

      it("regular user which does not belong to the fwcloud should not remove the table", async () => {
        return await request(app.express)
          .delete(
            _URL().getURL("fwclouds.firewalls.routing.tables.delete", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it("regular user which belongs to the fwcloud should remove the table", async () => {
        loggedUser.fwClouds = [fwCloud];
        await getRepository(User).save(loggedUser);

        return await request(app.express)
          .delete(
            _URL().getURL("fwclouds.firewalls.routing.tables.delete", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(200)
          .then(async () => {
            expect(
              await tableService.findOneInPath({
                fwCloudId: fwCloud.id,
                firewallId: firewall.id,
                id: table.id,
              }),
            ).to.be.undefined;
          });
      });

      it("admin user should create routing table", async () => {
        return await request(app.express)
          .delete(
            _URL().getURL("fwclouds.firewalls.routing.tables.delete", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set("Cookie", [attachSession(adminUserSessionId)])
          .expect(200)
          .then(async () => {
            expect(
              await tableService.findOneInPath({
                fwCloudId: fwCloud.id,
                firewallId: firewall.id,
                id: table.id,
              }),
            ).to.be.undefined;
          });
      });
    });

    describe("@compileRoutes", () => {
      let fwcProduct: FwCloudProduct;
      let table: RoutingTable;
      let routeService: RouteService;
      let route1: Route;
      let route2: Route;

      beforeEach(async () => {
        fwcProduct = await new FwCloudFactory().make();
        fwCloud = fwcProduct.fwcloud;
        firewall = fwcProduct.firewall;
        table = fwcProduct.routingTable;
        routeService = await app.getService<RouteService>(RouteService.name);

        route1 = await routeService.create({
          routingTableId: table.id,
          gatewayId: fwcProduct.ipobjs.get("gateway").id,
        });

        route2 = await routeService.create({
          routingTableId: table.id,
          gatewayId: fwcProduct.ipobjs.get("gateway").id,
        });
      });

      it("guest user should not see a routing table grid", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.compile", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .expect(401);
      });

      it("regular user which does not belong to the fwcloud should not see the table grid", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.compile", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(401);
      });

      it("regular user which belongs to the fwcloud should see the table grid", async () => {
        loggedUser.fwClouds = [fwCloud];
        await getRepository(User).save(loggedUser);

        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.compile", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set("Cookie", [attachSession(loggedUserSessionId)])
          .expect(200);
      });

      it("admin user should see routing table grid", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.compile", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .set("Cookie", [attachSession(adminUserSessionId)])
          .expect(200);
      });

      it("should compile a list of routes", async () => {
        return await request(app.express)
          .get(
            _URL().getURL("fwclouds.firewalls.routing.tables.compile", {
              fwcloud: fwCloud.id,
              firewall: firewall.id,
              routingTable: table.id,
            }),
          )
          .query({
            routes: [route1.id, route2.id],
          })
          .set("Cookie", [attachSession(adminUserSessionId)])
          .expect(200)
          .expect((response) => {
            expect(response.body.data).to.have.length(2);
          });
      });
    });
  });
});
