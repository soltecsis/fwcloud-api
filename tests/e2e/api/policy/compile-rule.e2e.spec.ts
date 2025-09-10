import { expect } from 'chai';
import request = require('supertest');
import { Application } from '../../../../src/Application';
import { describeName, testSuite } from '../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { createUser, generateSession, attachSession } from '../../../utils/utils';
import { User } from '../../../../src/models/user/User';
import { EntityManager } from 'typeorm';
import db from '../../../../src/database/database-manager';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { PolicyGroup } from '../../../../src/models/policy/PolicyGroup';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { PolicyRuleToInterface } from '../../../../src/models/policy/PolicyRuleToInterface';
import { PolicyRuleToIPObj } from '../../../../src/models/policy/PolicyRuleToIPObj';
import { Interface } from '../../../../src/models/interface/Interface';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';
import { RulePositionsMap } from '../../../../src/models/policy/PolicyPosition';

describe(describeName('Compile rule E2E Tests'), () => {
  let app: Application;
  let manager: EntityManager;
  let fwc: FwCloudProduct;
  let firewall: Firewall;
  let admin: User;
  let adminSession: string;
  let other: User;
  let otherSession: string;
  let rule: PolicyRule;
  let group: PolicyGroup;

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    app = testSuite.app;
    manager = db.getSource().manager;

    fwc = await new FwCloudFactory().make();
    firewall = fwc.firewall;
    firewall.options = 0x2000;
    await manager.getRepository(Firewall).save(firewall);

    admin = await createUser({ role: 1 });
    adminSession = generateSession(admin);
    other = await createUser({ role: 0 });
    otherSession = generateSession(other);

    admin.fwClouds = [fwc.fwcloud];
    await manager.getRepository(User).save(admin);

    const inIf = await manager.getRepository(Interface).save({
      name: 'eth0',
      type: '10',
      interface_type: '10',
      firewallId: firewall.id,
    });
    const outIf = await manager.getRepository(Interface).save({
      name: 'eth1',
      type: '10',
      interface_type: '10',
      firewallId: firewall.id,
    });

    const srcIp = await manager.getRepository(IPObj).save({
      name: 'src',
      address: '192.0.2.1',
      ipObjTypeId: 5,
      fwCloudId: fwc.fwcloud.id,
    });
    const dstIp = await manager.getRepository(IPObj).save({
      name: 'dst',
      address: '198.51.100.2',
      ipObjTypeId: 5,
      fwCloudId: fwc.fwcloud.id,
    });

    group = await manager.getRepository(PolicyGroup).save({
      name: 'group1',
      comment: '',
      groupstyle: 'grp-style',
      firewallId: firewall.id,
    });

    rule = await manager.getRepository(PolicyRule).save({
      rule_order: 1,
      direction: 0,
      action: 1,
      comment: 'comment "with" quotes',
      options: 0,
      active: 1,
      style: 'rule-style',
      policyGroupId: group.id,
      firewallId: firewall.id,
      policyTypeId: PolicyTypesMap.get('IPv4:FORWARD'),
    });

    await manager.getRepository(PolicyRuleToInterface).save({
      policyRuleId: rule.id,
      interfaceId: inIf.id,
      policyPositionId: RulePositionsMap.get('IPv4:FORWARD:In'),
      position_order: 1,
    });
    await manager.getRepository(PolicyRuleToInterface).save({
      policyRuleId: rule.id,
      interfaceId: outIf.id,
      policyPositionId: RulePositionsMap.get('IPv4:FORWARD:Out'),
      position_order: 1,
    });

    await manager.getRepository(PolicyRuleToIPObj).save({
      policyRuleId: rule.id,
      ipObjId: srcIp.id,
      policyPositionId: RulePositionsMap.get('IPv4:FORWARD:Source'),
      position_order: 1,
    });
    await manager.getRepository(PolicyRuleToIPObj).save({
      policyRuleId: rule.id,
      ipObjId: dstIp.id,
      policyPositionId: RulePositionsMap.get('IPv4:FORWARD:Destination'),
      position_order: 1,
    });
  });

  describe('VyOS compile rule', () => {
    const compileBody = () => ({
      fwcloud: fwc.fwcloud.id,
      firewall: firewall.id,
      type: PolicyTypesMap.get('IPv4:FORWARD'),
      rules: [rule.id],
      compiler: 'VyOS',
    });

    it('guest user should not compile rule', async () => {
      await request(app.express).put('/policy/compile/rule').send(compileBody()).expect(401);
    });

    it.skip('regular user which does not belong to fwCloud should not compile rule', async () => {
      await request(app.express)
        .put('/policy/compile/rule')
        .set('Cookie', [attachSession(otherSession)])
        .send(compileBody())
        .expect(403);
    });

    it('regular user should compile rule with escaped description', async () => {
      other.fwClouds = [fwc.fwcloud];
      await manager.getRepository(User).save(other);

      const meta = { fwc_rs: 'rule-style', fwc_rgn: 'group1', fwc_rgs: 'grp-style' };
      const comment = `${JSON.stringify(meta)}comment "with" quotes`;
      const expected = `set firewall name FORWARD rule ${rule.id} description "${comment.replace(/"/g, '\\"')}"`;

      await request(app.express)
        .put('/policy/compile/rule')
        .set('Cookie', [attachSession(otherSession)])
        .send(compileBody())
        .expect(200)
        .then((response) => {
          expect(response.body).to.be.an('array');
          expect(response.body[0].cs).to.include(expected);
        });
    });

    it('admin user should compile rule with escaped description', async () => {
      const meta = { fwc_rs: 'rule-style', fwc_rgn: 'group1', fwc_rgs: 'grp-style' };
      const comment = `${JSON.stringify(meta)}comment "with" quotes`;
      const expected = `set firewall name FORWARD rule ${rule.id} description "${comment.replace(/"/g, '\\"')}"`;

      await request(app.express)
        .put('/policy/compile/rule')
        .set('Cookie', [attachSession(adminSession)])
        .send(compileBody())
        .expect(200)
        .then((response) => {
          expect(response.body).to.be.an('array');
          expect(response.body[0].cs).to.include(expected);
        });
    });
  });
});
