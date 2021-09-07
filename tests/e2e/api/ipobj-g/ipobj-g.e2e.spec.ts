import request = require("supertest");

import { getRepository } from "typeorm";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { User } from "../../../../src/models/user/User";
import StringHelper from "../../../../src/utils/string.helper";
import { describeName, testSuite } from "../../../mocha/global-setup";
import { attachSession, createUser, generateSession } from "../../../utils/utils";
import { Application } from "../../../../src/Application";
import { RoutingTable } from "../../../../src/models/routing/routing-table/routing-table.model";
import { RouteController } from "../../../../src/controllers/routing/route/route.controller";
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { RouteService } from "../../../../src/models/routing/route/route.service";
import { IPObjGroup } from "../../../../src/models/ipobj/IPObjGroup";
import { IPObjToIPObjGroup } from "../../../../src/models/ipobj/IPObjToIPObjGroup";
import db from "../../../../src/database/database-manager";
import { Interface } from "../../../../src/models/interface/Interface";
import { InterfaceIPObj } from "../../../../src/models/interface/InterfaceIPObj";
import { RoutingRuleService } from "../../../../src/models/routing/routing-rule/routing-rule.service";

describe(describeName('IPObjGroup E2E Tests'), () => {
    let app: Application;
    
    let adminUser: User;
    let adminUserSessionId: string;

    let fwCloud: FwCloud;
    let firewall: Firewall;
    

    let routeService: RouteService;
    let routingRuleService: RoutingRuleService;

    beforeEach(async () => {
        app = testSuite.app;
        
        adminUser = await createUser({role: 1});
        adminUserSessionId = generateSession(adminUser);

        routeService = await app.getService<RouteService>(RouteService.name);
        routingRuleService = await app.getService<RoutingRuleService>(RoutingRuleService.name);

        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
            name: StringHelper.randomize(10)
        }));

        adminUser.fwClouds = [fwCloud];
        await getRepository(User).save(adminUser);

        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwCloud.id
        }));
    });

    describe(RouteController.name, () => {
        describe('@delfrom', () => {
            let group: IPObjGroup;
            let ipobj: IPObj;
            let table: RoutingTable;

            beforeEach(async () => {
                const _interface: Interface = await getRepository(Interface).save(getRepository(Interface).create({
                    name: 'eth1',
                    type: '11',
                    interface_type: '11'
                }));
        
                ipobj = await getRepository(IPObj).save(getRepository(IPObj).create({
                    name: 'test',
                    address: '0.0.0.0',
                    ipObjTypeId: 8,
                    interfaceId: _interface.id
                }));
        
                await getRepository(InterfaceIPObj).save(getRepository(InterfaceIPObj).create({
                    interfaceId: _interface.id,
                    ipObjId: ipobj.id,
                    interface_order: '1'
                }));
        
                group = await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({
                    name: 'ipobjs group',
                    type: 20,
                    fwCloudId: fwCloud.id
                }));
        
                await IPObjToIPObjGroup.insertIpobj__ipobjg({
                    dbCon: db.getQuery(),
                    body: {
                        ipobj: ipobj.id,
                        ipobj_g: group.id
                    }
                });
        
                table = await getRepository(RoutingTable).save({
                    firewallId: firewall.id,
                    number: 1,
                    name: 'name',
                });
            })

            it('should throw an exception if the group belongs to a route', async () => {
                const route = await routeService.create({
                    routingTableId: table.id,
                    gatewayId: ipobj.id
                });

                await routeService.update(route.id, {
                    ipObjGroupIds: [{
                        id: group.id, order: 1
                    }]
                });

                return await request(app.express)
					.put('/ipobj/group/delfrom')
                    .send({
                        fwcloud: fwCloud.id,
                        ipobj_g: group.id,
                        ipobj: ipobj.id,
                        obj_type: ipobj.ipObjTypeId
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
					.expect(400)
			});

            it('should throw an exception if the group belongs to a routing_rule', async () => {
                const rule = await routingRuleService.create({
                    routingTableId: table.id,
                });

                await routingRuleService.update(rule.id, {
                    ipObjGroupIds: [{id: group.id, order: 1}]
                });
                return await request(app.express)
					.put('/ipobj/group/delfrom')
                    .send({
                        fwcloud: fwCloud.id,
                        ipobj_g: group.id,
                        ipobj: ipobj.id,
                        obj_type: ipobj.ipObjTypeId
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
					.expect(400)
			});
        });
    });
});