import { getRepository } from 'typeorm';
import { Application } from '../../../../src/Application';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { IPObjGroup } from '../../../../src/models/ipobj/IPObjGroup';
import { IPObjToIPObjGroup } from '../../../../src/models/ipobj/IPObjToIPObjGroup';
import { RoutingRule } from '../../../../src/models/routing/routing-rule/routing-rule.model';
import { User } from '../../../../src/models/user/User';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import {
  attachSession,
  createUser,
  generateSession,
} from '../../../utils/utils';
import request = require('supertest');
import { RoutingRuleService } from '../../../../src/models/routing/routing-rule/routing-rule.service';
import { RouteService } from '../../../../src/models/routing/route/route.service';
import { PolicyRuleToIPObj } from '../../../../src/models/policy/PolicyRuleToIPObj';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { Route } from '../../../../src/models/routing/route/route.model';
import { OpenVPN } from '../../../../src/models/vpn/openvpn/OpenVPN';
import { OpenVPNPrefix } from '../../../../src/models/vpn/openvpn/OpenVPNPrefix';

describe(describeName('Ipobj group delfrom E2E Tests'), () => {
  let app: Application;
  let fwcProduct: FwCloudProduct;
  let adminUser: User;
  let session: string;
  let group: IPObjGroup;
  let requestData: Record<string, unknown>;
  let firewall: Firewall;

  beforeEach(async () => {
    await testSuite.resetDatabaseData();

    app = testSuite.app;
    fwcProduct = await new FwCloudFactory().make();

    adminUser = await createUser({ role: 1 });
    session = generateSession(adminUser);

    firewall = await getRepository(Firewall).findOneOrFail(
      fwcProduct.firewall.id,
      { relations: ['policyRules'] },
    );

    adminUser.fwClouds = [fwcProduct.fwcloud];

    await getRepository(User).save(adminUser);

    group = await getRepository(IPObjGroup).save({
      name: 'group',
      type: 20,
      fwCloudId: fwcProduct.fwcloud.id,
    });

    requestData = {
      fwcloud: fwcProduct.fwcloud.id,
      ipobj_g: group.id,
    };
  });

  it('should throw an exception if the ipObj to attach is an empty host', async () => {
    const host = await getRepository(IPObj).save(
      getRepository(IPObj).create({
        name: 'test',
        ipObjTypeId: 8,
      }),
    );

    requestData.ipobj = host.id;
    requestData.node_parent = 1;
    requestData.node_order = 1;
    requestData.node_type = 'OIH';

    return await request(app.express)
      .put('/ipobj/group/addto')
      .set('Cookie', [attachSession(session)])
      .send(requestData)
      .expect(400);
  });
});
