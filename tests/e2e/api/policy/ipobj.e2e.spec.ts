import { expect } from 'chai';
import { EntityManager } from 'typeorm';
import { Application } from '../../../../src/Application';
import request = require('supertest');
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { IPObjGroup } from '../../../../src/models/ipobj/IPObjGroup';
import { IPObjToIPObjGroup } from '../../../../src/models/ipobj/IPObjToIPObjGroup';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { User } from '../../../../src/models/user/User';
import { describeName, testSuite } from '../../../mocha/global-setup';
import { FwCloudProduct, FwCloudFactory } from '../../../utils/fwcloud-factory';
import { createUser, generateSession, attachSession } from '../../../utils/utils';
import db from '../../../../src/database/database-manager';

enum PolicyColumn {
  SOURCE = 1,
  DESTINATION = 2,
  SERVICE = 3,
}

enum PolicyTypeId {
  INPUT = 1,
  OUTPUT = 2,
  FORWARD = 3,
  SNAT = 4,
  DNAT = 5,
}

describe(describeName('Ipobj group policy rule attach E2E Tests'), () => {
  let app: Application;
  let fwcProduct: FwCloudProduct;
  let adminUser: User;
  let session: string;
  let group: IPObjGroup;

  let firewall: Firewall;

  let inputRuleId: number;
  let outputRuleId: number;
  let forwardRuleId: number;
  let snatRuleId: number;
  let dnatRuleId: number;

  let rule: PolicyRule;

  let data: Record<string, unknown>;

  let manager: EntityManager;

  beforeEach(async () => {
    await testSuite.resetDatabaseData();

    app = testSuite.app;
    manager = db.getSource().manager;
    fwcProduct = await new FwCloudFactory().make();

    adminUser = await createUser({ role: 1 });
    session = generateSession(adminUser);

    await PolicyRule.insertDefaultPolicy(
      fwcProduct.firewall.id,
      fwcProduct.interfaces.get('firewall-interface1').id,
      {},
    );
    inputRuleId = await PolicyRule.insertPolicy_r({
      id: null,
      idgroup: null,
      firewall: fwcProduct.firewall.id,
      rule_order: 1,
      type: PolicyTypeId.INPUT,
      action: 1,
    });

    outputRuleId = await PolicyRule.insertPolicy_r({
      id: null,
      idgroup: null,
      firewall: fwcProduct.firewall.id,
      rule_order: 1,
      type: PolicyTypeId.OUTPUT,
      action: 1,
    });
    forwardRuleId = await PolicyRule.insertPolicy_r({
      id: null,
      idgroup: null,
      firewall: fwcProduct.firewall.id,
      rule_order: 1,
      type: PolicyTypeId.FORWARD,
      action: 1,
    });
    snatRuleId = await PolicyRule.insertPolicy_r({
      id: null,
      idgroup: null,
      firewall: fwcProduct.firewall.id,
      rule_order: 1,
      type: PolicyTypeId.SNAT,
      action: 1,
    });

    dnatRuleId = await PolicyRule.insertPolicy_r({
      id: null,
      idgroup: null,
      firewall: fwcProduct.firewall.id,
      rule_order: 1,
      type: PolicyTypeId.DNAT,
      action: 1,
    });

    firewall = await manager.getRepository(Firewall).findOneOrFail({
      where: { id: fwcProduct.firewall.id },
      relations: ['fwCloud'],
    });

    adminUser.fwClouds = [fwcProduct.fwcloud];

    await manager.getRepository(User).save(adminUser);

    const service = await manager.getRepository(IPObj).findOneOrFail({ where: { id: 10040 } });

    group = await manager.getRepository(IPObjGroup).save({
      name: 'group',
      type: 21,
      fwCloudId: fwcProduct.fwcloud.id,
    });

    await manager.getRepository(IPObjToIPObjGroup).save({
      ipObjGroupId: group.id,
      ipObjId: service.id,
    });

    data = {
      fwcloud: fwcProduct.fwcloud.id,
      firewall: fwcProduct.firewall.id,
      interface: -1,
      ipobj: -1,
      ipobj_g: group.id,
      position_order: 1,
    };
  });

  describe('INPUT', () => {
    beforeEach(async () => {
      rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: inputRuleId } });
      data.rule = rule.id;
    });

    it('should not attach a service group into source position', async () => {
      data.position = PolicyColumn.SOURCE;

      return await request(app.express)
        .post('/policy/ipobj')
        .set('Cookie', [attachSession(session)])
        .send(data)
        .expect(400)
        .then((response) => {
          expect(response.body.fwcErr).to.eq(1006);
        });
    });

    it('should not attach a service group into source position', async () => {
      data.position = PolicyColumn.DESTINATION;

      return await request(app.express)
        .post('/policy/ipobj')
        .set('Cookie', [attachSession(session)])
        .send(data)
        .expect(400)
        .then((response) => {
          expect(response.body.fwcErr).to.eq(1006);
        });
    });
  });

  describe('OUTPUT', () => {
    beforeEach(async () => {
      rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: outputRuleId } });
      data.rule = rule.id;
    });

    it('should not attach a service group into source position', async () => {
      data.position = PolicyColumn.SOURCE;

      return await request(app.express)
        .post('/policy/ipobj')
        .set('Cookie', [attachSession(session)])
        .send(data)
        .expect(400)
        .then((response) => {
          expect(response.body.fwcErr).to.eq(1006);
        });
    });

    it('should not attach a service group into source position', async () => {
      data.position = PolicyColumn.DESTINATION;

      return await request(app.express)
        .post('/policy/ipobj')
        .set('Cookie', [attachSession(session)])
        .send(data)
        .expect(400)
        .then((response) => {
          expect(response.body.fwcErr).to.eq(1006);
        });
    });
  });

  describe('FORWARD', () => {
    beforeEach(async () => {
      rule = await manager
        .getRepository(PolicyRule)
        .findOneOrFail({ where: { id: forwardRuleId } });
      data.rule = rule.id;
    });

    it('should not attach a service group into source position', async () => {
      data.position = PolicyColumn.SOURCE;

      return await request(app.express)
        .post('/policy/ipobj')
        .set('Cookie', [attachSession(session)])
        .send(data)
        .expect(400)
        .then((response) => {
          expect(response.body.fwcErr).to.eq(1006);
        });
    });

    it('should not attach a service group into source position', async () => {
      data.position = PolicyColumn.DESTINATION;

      return await request(app.express)
        .post('/policy/ipobj')
        .set('Cookie', [attachSession(session)])
        .send(data)
        .expect(400)
        .then((response) => {
          expect(response.body.fwcErr).to.eq(1006);
        });
    });
  });

  describe('SNAT', () => {
    beforeEach(async () => {
      rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: snatRuleId } });
      data.rule = rule.id;
    });

    it('should not attach a service group into source position', async () => {
      data.position = PolicyColumn.SOURCE;

      return await request(app.express)
        .post('/policy/ipobj')
        .set('Cookie', [attachSession(session)])
        .send(data)
        .expect(400)
        .then((response) => {
          expect(response.body.fwcErr).to.eq(1006);
        });
    });

    it('should not attach a service group into source position', async () => {
      data.position = PolicyColumn.DESTINATION;

      return await request(app.express)
        .post('/policy/ipobj')
        .set('Cookie', [attachSession(session)])
        .send(data)
        .expect(400)
        .then((response) => {
          expect(response.body.fwcErr).to.eq(1006);
        });
    });
  });

  describe('DNAT', () => {
    beforeEach(async () => {
      rule = await manager.getRepository(PolicyRule).findOneOrFail({ where: { id: dnatRuleId } });
      data.rule = rule.id;
    });

    it('should not attach a service group into source position', async () => {
      data.position = PolicyColumn.SOURCE;

      return await request(app.express)
        .post('/policy/ipobj')
        .set('Cookie', [attachSession(session)])
        .send(data)
        .expect(400)
        .then((response) => {
          expect(response.body.fwcErr).to.eq(1006);
        });
    });

    it('should not attach a service group into source position', async () => {
      data.position = PolicyColumn.DESTINATION;

      return await request(app.express)
        .post('/policy/ipobj')
        .set('Cookie', [attachSession(session)])
        .send(data)
        .expect(400)
        .then((response) => {
          expect(response.body.fwcErr).to.eq(1006);
        });
    });
  });
});
