import { EntityManager } from "typeorm";
import { Application } from "../../../../src/Application";
import { IPObj } from "../../../../src/models/ipobj/IPObj";
import { IPObjGroup } from "../../../../src/models/ipobj/IPObjGroup";
import { IPObjToIPObjGroup } from "../../../../src/models/ipobj/IPObjToIPObjGroup";
import { RoutingRule } from "../../../../src/models/routing/routing-rule/routing-rule.model";
import { User } from "../../../../src/models/user/User";
import { describeName, expect, testSuite } from "../../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../../utils/fwcloud-factory";
import { attachSession, createUser, generateSession } from "../../../utils/utils";
import request = require("supertest");
import { RoutingRuleService } from "../../../../src/models/routing/routing-rule/routing-rule.service";
import { RouteService } from "../../../../src/models/routing/route/route.service";
import { PolicyRuleToIPObj } from "../../../../src/models/policy/PolicyRuleToIPObj";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { PolicyRule } from "../../../../src/models/policy/PolicyRule";
import { Route } from "../../../../src/models/routing/route/route.model";
import { OpenVPN } from "../../../../src/models/vpn/openvpn/OpenVPN";
import { OpenVPNPrefix } from "../../../../src/models/vpn/openvpn/OpenVPNPrefix";
import { Mark } from "../../../../src/models/ipobj/Mark";
import db from "../../../../src/database/database-manager";


enum PolicyColumn {
    SOURCE = 1,
    DESTINATION = 2,
    SERVICE = 3
}

enum PolicyTypeId {
    INPUT = 1,
    OUTPUT = 2,
    FORWARD = 3,
    SNAT = 4,
    DNAT = 5
}

describe(describeName('Ipobj group delfrom E2E Tests'), () => {
    let app: Application;
    let fwcProduct: FwCloudProduct;
    let adminUser: User;
    let session: string;
    let group: IPObjGroup;
    let requestData: Record<string,unknown>;
    let firewall: Firewall;
    
    let inputRuleId: number;
    let outputRuleId: number;
    let forwardRuleId: number;
    let snatRuleId: number;
    let dnatRuleId: number;

    let routingRule: RoutingRule;
    let route: Route;

    let routingRuleService: RoutingRuleService;
    let routeService: RouteService;

    let manager: EntityManager;

    beforeEach(async () => {
        await testSuite.resetDatabaseData();

        app = testSuite.app;
        manager = db.getSource().manager;
        fwcProduct = await new FwCloudFactory().make();

        routeService = await app.getService<RouteService>(RouteService.name);
        routingRuleService = await app.getService<RoutingRuleService>(RoutingRuleService.name);

        adminUser = await createUser({role: 1});
        session = generateSession(adminUser);

        await PolicyRule.insertDefaultPolicy(fwcProduct.firewall.id, fwcProduct.interfaces.get('firewall-interface1').id, {});
        inputRuleId = await PolicyRule.insertPolicy_r({
            id: null,
            idgroup: null,
            firewall: fwcProduct.firewall.id,
            rule_order: 1,
            type: PolicyTypeId.INPUT,
            action: 1
        });

        outputRuleId = await PolicyRule.insertPolicy_r({
            id: null,
            idgroup: null,
            firewall: fwcProduct.firewall.id,
            rule_order: 1,
            type: PolicyTypeId.OUTPUT,
            action: 1
        });
        forwardRuleId = await PolicyRule.insertPolicy_r({
            id: null,
            idgroup: null,
            firewall: fwcProduct.firewall.id,
            rule_order: 1,
            type: PolicyTypeId.FORWARD,
            action: 1
        });
        snatRuleId = await PolicyRule.insertPolicy_r({
            id: null,
            idgroup: null,
            firewall: fwcProduct.firewall.id,
            rule_order: 1,
            type: PolicyTypeId.SNAT,
            action: 1
        });
        
        dnatRuleId = await PolicyRule.insertPolicy_r({
            id: null,
            idgroup: null,
            firewall: fwcProduct.firewall.id,
            rule_order: 1,
            type: PolicyTypeId.DNAT,
            action: 1
        });

        routingRule = await routingRuleService.create({
            routingTableId: fwcProduct.routingTable.id,
            markIds: [
                {id: fwcProduct.mark.id, order: 1}
            ]
        });

        route = await routeService.create({
            gatewayId: fwcProduct.ipobjs.get('address').id,
            routingTableId: fwcProduct.routingTable.id,
        });

        firewall = await manager.getRepository(Firewall).findOneOrFail({
            where: {id: fwcProduct.firewall.id},
            relations: ['policyRules']
        });

        adminUser.fwClouds = [
            fwcProduct.fwcloud
        ];

        await manager.getRepository(User).save(adminUser);

        group = await manager.getRepository(IPObjGroup).save({
            name: 'group',
            type: 20,
            fwCloudId: fwcProduct.fwcloud.id
        });

        requestData = {
            fwcloud: fwcProduct.fwcloud.id,
            ipobj_g: group.id,
        }
    })
    
    describe('ipObj', () => {
        let ipObj: IPObj;

        beforeEach(async () => {
            ipObj = fwcProduct.ipobjs.get('address');
            
            await manager.getRepository(IPObjToIPObjGroup).save({
                ipObjGroupId: group.id,
                ipObjId: ipObj.id
            });

            requestData.ipobj = ipObj.id;
            requestData.obj_type = ipObj.ipObjTypeId;
        });

        it('should remove the item from the group if it is not used', async () => {

            return await request(app.express)
					.put('/ipobj/group/delfrom')
					.set('Cookie', [attachSession(session)])
					.send(requestData)
					.expect(200);
        });

        describe('used in routing rule', () => {
            it('should throw an exception if item is used in a routing rule', async () => {
                await routingRuleService.update(routingRule.id, {
                    ipObjGroupIds: [{
                        id: group.id,
                        order: 1
                    }]
                });

                return await request(app.express)
                    .put('/ipobj/group/delfrom')
                    .set('Cookie', [attachSession(session)])
                    .send(requestData)
                    .expect(400)
                    .then(response => {
                        expect((response.body as any).fwcErr).to.eq(5001);
                });
            });
        })

        

        describe('used in route', () => {
            it('should throw an exception if item is used in a route', async () => {
                await routeService.update(route.id, {
                        ipObjGroupIds: [{
                            id: group.id,
                            order: 1
                        }]
                    });
    
                return await request(app.express)
                    .put('/ipobj/group/delfrom')
                    .set('Cookie', [attachSession(session)])
                    .send(requestData)
                    .expect(400)
                    .then(response => {
                        expect((response.body as any).fwcErr).to.eq(5001);
                });
            });
        });

        describe('used in policy rules', () => {
            let rule: PolicyRule;

            describe('INPUT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: inputRuleId }});
                });

                it('should throw an exception if item is used in a policy (SOURCE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SOURCE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
    
                it('should throw an exception if item is used in a policy (DESTINATION)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.DESTINATION,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('OUTPUT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: outputRuleId }});
                });

                it('should throw an exception if item is used in a policy (SOURCE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SOURCE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
    
                it('should throw an exception if item is used in a policy (DESTINATION)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.DESTINATION,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('FORWARD', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: forwardRuleId }});
                });

                it('should throw an exception if item is used in a policy (SOURCE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SOURCE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
    
                it('should throw an exception if item is used in a policy (DESTINATION)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.DESTINATION,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('DNAT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: dnatRuleId }});
                });

                it('should throw an exception if item is used in a policy (SOURCE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SOURCE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
    
                it('should throw an exception if item is used in a policy (DESTINATION)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.DESTINATION,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('SNAT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: snatRuleId }});
                });

                it('should throw an exception if item is used in a policy (SOURCE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SOURCE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
    
                it('should throw an exception if item is used in a policy (DESTINATION)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.DESTINATION,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })
        });
    });

    describe('openvpn', () => {
        let openvpn: OpenVPN;

        beforeEach(async () => {
            openvpn = fwcProduct.openvpnClients.get('OpenVPN-Cli-1');
            openvpn.ipObjGroups = [{id: group.id} as IPObjGroup];
            await manager.getRepository(OpenVPN).save(openvpn);
            
            requestData.ipobj = openvpn.id;
            requestData.obj_type = 311;
        });

        it('should remove the item from the group if it is not used', async () => {
            return await request(app.express)
					.put('/ipobj/group/delfrom')
					.set('Cookie', [attachSession(session)])
					.send(requestData)
					.expect(200);
        });

        describe('used in routing rule', () => {
            it('should throw an exception if item is used in a routing rule', async () => {
                await routingRuleService.update(routingRule.id, {
                    ipObjGroupIds: [{
                        id: group.id,
                        order: 1
                    }]
                });

                return await request(app.express)
                    .put('/ipobj/group/delfrom')
                    .set('Cookie', [attachSession(session)])
                    .send(requestData)
                    .expect(400)
                    .then(response => {
                        expect((response.body as any).fwcErr).to.eq(5001);
                });
            });
        });

        describe('used in route', () => {
            it('should throw an exception if item is used in a route', async () => {
                await routeService.update(route.id, {
                        ipObjGroupIds: [{
                            id: group.id,
                            order: 1
                        }]
                    });
    
                return await request(app.express)
                    .put('/ipobj/group/delfrom')
                    .set('Cookie', [attachSession(session)])
                    .send(requestData)
                    .expect(400)
                    .then(response => {
                        expect((response.body as any).fwcErr).to.eq(5001);
                });
            });
        });

        describe('used in policy rules', () => {
            let rule: PolicyRule;

            describe('INPUT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: inputRuleId }});
                });

                it('should throw an exception if item is used in a policy (SOURCE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SOURCE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
    
                it('should throw an exception if item is used in a policy (DESTINATION)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.DESTINATION,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('OUTPUT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: outputRuleId }});
                });

                it('should throw an exception if item is used in a policy (SOURCE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SOURCE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
    
                it('should throw an exception if item is used in a policy (DESTINATION)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.DESTINATION,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('FORWARD', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: forwardRuleId }});
                });

                it('should throw an exception if item is used in a policy (SOURCE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SOURCE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
    
                it('should throw an exception if item is used in a policy (DESTINATION)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.DESTINATION,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('DNAT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: dnatRuleId }});
                });

                it('should throw an exception if item is used in a policy (SOURCE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SOURCE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
    
                it('should throw an exception if item is used in a policy (DESTINATION)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.DESTINATION,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('SNAT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: snatRuleId }});
                });

                it('should throw an exception if item is used in a policy (SOURCE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SOURCE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
    
                it('should throw an exception if item is used in a policy (DESTINATION)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.DESTINATION,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })
        });
    });

    describe('openvpn prefix', () => {
        let prefix: OpenVPNPrefix;

        beforeEach(async () => {
            prefix = fwcProduct.openvpnPrefix;
            prefix.ipObjGroups = [{id: group.id} as IPObjGroup];
            await manager.getRepository(OpenVPNPrefix).save(prefix);
            
            requestData.ipobj = prefix.id;
            requestData.obj_type = 401;
        });

        it('should remove the item from the group if it is not used', async () => {
            return await request(app.express)
					.put('/ipobj/group/delfrom')
					.set('Cookie', [attachSession(session)])
					.send(requestData)
					.expect(200);
        });

        describe('used in routing rule', () => {
            it('should throw an exception if item is used in a routing rule', async () => {
                await routingRuleService.update(routingRule.id, {
                    ipObjGroupIds: [{
                        id: group.id,
                        order: 1
                    }]
                });

                return await request(app.express)
                    .put('/ipobj/group/delfrom')
                    .set('Cookie', [attachSession(session)])
                    .send(requestData)
                    .expect(400)
                    .then(response => {
                        expect((response.body as any).fwcErr).to.eq(5001);
                });
            });
        });

        describe('used in route', () => {
            it('should throw an exception if item is used in a route', async () => {
                await routeService.update(route.id, {
                        ipObjGroupIds: [{
                            id: group.id,
                            order: 1
                        }]
                    });
    
                return await request(app.express)
                    .put('/ipobj/group/delfrom')
                    .set('Cookie', [attachSession(session)])
                    .send(requestData)
                    .expect(400)
                    .then(response => {
                        expect((response.body as any).fwcErr).to.eq(5001);
                });
            });
        });

        describe('used in policy rules', () => {
            let rule: PolicyRule;

            describe('INPUT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: inputRuleId }});
                });

                it('should throw an exception if item is used in a policy (SOURCE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SOURCE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
    
                it('should throw an exception if item is used in a policy (DESTINATION)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.DESTINATION,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('OUTPUT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: outputRuleId }});
                });

                it('should throw an exception if item is used in a policy (SOURCE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SOURCE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
    
                it('should throw an exception if item is used in a policy (DESTINATION)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.DESTINATION,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('FORWARD', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: forwardRuleId }});
                });

                it('should throw an exception if item is used in a policy (SOURCE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SOURCE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
    
                it('should throw an exception if item is used in a policy (DESTINATION)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.DESTINATION,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('DNAT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: dnatRuleId }});
                });

                it('should throw an exception if item is used in a policy (SOURCE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SOURCE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
    
                it('should throw an exception if item is used in a policy (DESTINATION)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.DESTINATION,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('SNAT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: snatRuleId }});
                });

                it('should throw an exception if item is used in a policy (SOURCE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SOURCE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
    
                it('should throw an exception if item is used in a policy (DESTINATION)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.DESTINATION,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })
        });
    });

    describe('Services', () => {
        let service: IPObj;

        beforeEach(async () => {
            service = await manager.getRepository(IPObj).findOneOrFail({ where: { id: 10040 }});
            
            group = await manager.getRepository(IPObjGroup).save({
                name: 'group',
                type: 21,
                fwCloudId: fwcProduct.fwcloud.id
            });

            await manager.getRepository(IPObjToIPObjGroup).save({
                ipObjGroupId: group.id,
                ipObjId: service.id
            });

            requestData.ipobj_g = group.id;
            requestData.ipobj = service.id;
            requestData.obj_type = 1;
        });

        it('should remove the item from the group if it is not used', async () => {
            return await request(app.express)
					.put('/ipobj/group/delfrom')
					.set('Cookie', [attachSession(session)])
					.send(requestData)
					.expect(200);
        });

        describe('used in policy rules', () => {
            let rule: PolicyRule;

            describe('INPUT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: inputRuleId }});
                });

                it('should throw an exception if item is used in a policy (SERVICE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SERVICE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('OUTPUT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: outputRuleId }});
                });

                it('should throw an exception if item is used in a policy (SERVICE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SERVICE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('FORWARD', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: forwardRuleId }});
                });

                it('should throw an exception if item is used in a policy (SERVICE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SERVICE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('DNAT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: dnatRuleId }});
                });

                it('should throw an exception if item is used in a policy (SERVICE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SERVICE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })

            describe('SNAT', () => {

                beforeEach(async () => {
                    rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: snatRuleId }});
                });

                it('should throw an exception if item is used in a policy (SERVICE)', async () => {
                    await PolicyRuleToIPObj.insertPolicy_r__ipobj({
                        rule: rule.id,
                        ipobj: -1,
                        ipobj_g: group.id,
                        interface: -1,
                        position: PolicyColumn.SERVICE,
                        position_order: 1
                    });
    
                    return await request(app.express)
                        .put('/ipobj/group/delfrom')
                        .set('Cookie', [attachSession(session)])
                        .send(requestData)
                        .expect(400)
                        .then(response => {
                            expect((response.body as any).fwcErr).to.eq(5001);
                    });
                });
            })
        });
    });
});