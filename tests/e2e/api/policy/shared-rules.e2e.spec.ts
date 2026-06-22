import { expect } from 'chai';
import { EntityManager } from 'typeorm';
import { Application } from '../../../../src/Application';
import db from '../../../../src/database/database-manager';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { RulePositionsMap } from '../../../../src/models/policy/PolicyPosition';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { Tree } from '../../../../src/models/tree/Tree';
import { User } from '../../../../src/models/user/User';
import { describeName, testSuite } from '../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { attachSession, createUser, generateSession } from '../../../utils/utils';
import request = require('supertest');

enum PolicyTypeId {
  INPUT = 1,
  SNAT = 4,
}

describe.only(describeName('Shared Rules E2E Tests'), () => {
  let app: Application;
  let manager: EntityManager;
  let fwcProduct: FwCloudProduct;
  let adminUser: User;
  let session: string;

  beforeEach(async () => {
    await testSuite.resetDatabaseData();

    app = testSuite.app;
    app.config.set('confirmation_token', false);
    manager = db.getSource().manager;
    fwcProduct = await new FwCloudFactory().make();
    await Tree.createAllTreeCloud(fwcProduct.fwcloud);

    adminUser = await createUser({ role: 1 });
    adminUser.fwClouds = [fwcProduct.fwcloud];
    await manager.getRepository(User).save(adminUser);
    session = generateSession(adminUser);
  });

  async function unlockFwcloud(): Promise<void> {
    await manager.query(
      'UPDATE fwcloud SET locked = 0, locked_by = NULL, locked_at = NULL WHERE id = ?',
      [fwcProduct.fwcloud.id],
    );
  }

  async function createSharedRuleSet(
    policyType: PolicyTypeId = PolicyTypeId.INPUT,
  ): Promise<number> {
    const response = await request(app.express)
      .post('/policy/shared-rules')
      .set('Cookie', [attachSession(session)])
      .send({
        fwcloud: fwcProduct.fwcloud.id,
        name: `SharedSet${policyType}`,
        policy_type: policyType,
        comment: '',
        active: 1,
      })
      .expect(200);

    expect(response.body.insertId).to.be.a('number');
    expect(response.body.TreeinsertId).to.be.a('number');
    await unlockFwcloud();

    return response.body.insertId;
  }

  it('should create, read, update and delete a shared rule set with its tree node', async () => {
    const sharedRuleSetId = await createSharedRuleSet();

    await request(app.express)
      .put('/policy/shared-rules/get')
      .set('Cookie', [attachSession(session)])
      .send({
        fwcloud: fwcProduct.fwcloud.id,
        shared_rule_set: sharedRuleSetId,
      })
      .expect(200)
      .then((response) => {
        expect(response.body.id).to.eq(sharedRuleSetId);
        expect(response.body.name).to.eq('SharedSet1');
        expect(response.body.policy_type).to.eq(PolicyTypeId.INPUT);
        expect(Number(response.body.rules_count)).to.eq(0);
        expect(Number(response.body.applications_count)).to.eq(0);
        expect(response.body.node_id).to.be.a('number');
        expect(response.body.policy_type_node_id).to.be.a('number');
      });

    await request(app.express)
      .put('/policy/shared-rules')
      .set('Cookie', [attachSession(session)])
      .send({
        fwcloud: fwcProduct.fwcloud.id,
        shared_rule_set: sharedRuleSetId,
        name: 'UpdatedSharedSet',
        comment: 'Updated comment',
        active: 0,
      })
      .expect(204);
    await unlockFwcloud();

    const treeRows = await manager.query(
      `SELECT name, node_type, id_obj
       FROM fwc_tree
       WHERE fwcloud=? AND node_type='SRS' AND id_obj=?`,
      [fwcProduct.fwcloud.id, sharedRuleSetId],
    );

    expect(treeRows).to.have.length(1);
    expect(treeRows[0].name).to.eq('UpdatedSharedSet');

    await request(app.express)
      .put('/policy/shared-rules/del')
      .set('Cookie', [attachSession(session)])
      .send({
        fwcloud: fwcProduct.fwcloud.id,
        shared_rule_set: sharedRuleSetId,
      })
      .expect(204);

    const [sharedRuleSetCount] = await manager.query(
      `SELECT COUNT(*) AS count FROM shared_rule_set WHERE id=?`,
      [sharedRuleSetId],
    );
    const [treeNodeCount] = await manager.query(
      `SELECT COUNT(*) AS count FROM fwc_tree WHERE node_type='SRS' AND id_obj=?`,
      [sharedRuleSetId],
    );

    expect(Number(sharedRuleSetCount.count)).to.eq(0);
    expect(Number(treeNodeCount.count)).to.eq(0);
  });

  it('should create, list, update and delete shared rules with assigned objects', async () => {
    const sharedRuleSetId = await createSharedRuleSet();
    const sourcePosition = RulePositionsMap.get('IPv4:INPUT:Source');
    const ipObj: IPObj = await manager.getRepository(IPObj).save(
      manager.getRepository(IPObj).create({
        name: 'shared-rule-source',
        address: '10.30.40.50',
        ipObjTypeId: 5,
        ip_version: 4,
        interfaceId: null,
        fwCloudId: fwcProduct.fwcloud.id,
      }),
    );

    const createRuleResponse = await request(app.express)
      .post('/policy/shared-rules/rule')
      .set('Cookie', [attachSession(session)])
      .send({
        fwcloud: fwcProduct.fwcloud.id,
        shared_rule_set: sharedRuleSetId,
        action: 1,
        comment: '',
        type: PolicyTypeId.INPUT,
        rule_order: 1,
        active: 1,
        ipobjs: [
          {
            ipobj: ipObj.id,
            position: sourcePosition,
            position_order: 1,
          },
        ],
      })
      .expect(200);

    const sharedRuleId = createRuleResponse.body.insertId;
    expect(sharedRuleId).to.be.a('number');
    await unlockFwcloud();

    await request(app.express)
      .put('/policy/shared-rules/rules/get')
      .set('Cookie', [attachSession(session)])
      .send({
        fwcloud: fwcProduct.fwcloud.id,
        shared_rule_set: sharedRuleSetId,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).to.have.length(1);
        expect(response.body[0].id).to.eq(sharedRuleId);
        expect(response.body[0].type).to.eq(PolicyTypeId.INPUT);
        expect(response.body[0].ipobjs).to.have.length(1);
        expect(response.body[0].ipobjs[0].ipobj).to.eq(ipObj.id);
        expect(response.body[0].ipobjs[0].position).to.eq(sourcePosition);
      });

    await request(app.express)
      .put('/policy/shared-rules/rule')
      .set('Cookie', [attachSession(session)])
      .send({
        fwcloud: fwcProduct.fwcloud.id,
        shared_rule_set: sharedRuleSetId,
        rule: sharedRuleId,
        action: 2,
        comment: 'updated',
        active: 0,
      })
      .expect(204);
    await unlockFwcloud();

    const [updatedRule] = await manager.query(
      `SELECT action, comment, active
       FROM shared_rule
       WHERE id=? AND shared_rule_set=?`,
      [sharedRuleId, sharedRuleSetId],
    );
    expect(updatedRule.action).to.eq(2);
    expect(updatedRule.comment).to.eq('updated');
    expect(updatedRule.active).to.eq(0);

    await request(app.express)
      .put('/policy/shared-rules/rule/del')
      .set('Cookie', [attachSession(session)])
      .send({
        fwcloud: fwcProduct.fwcloud.id,
        shared_rule_set: sharedRuleSetId,
        rulesIds: [sharedRuleId],
      })
      .expect(204);

    const [ruleCount] = await manager.query(
      `SELECT COUNT(*) AS count FROM shared_rule WHERE id=?`,
      [sharedRuleId],
    );
    expect(Number(ruleCount.count)).to.eq(0);
  });

  it('should apply, update and unapply a shared rule set from a firewall policy', async () => {
    const sharedRuleSetId = await createSharedRuleSet();

    await PolicyRule.insertPolicy_r({
      id: null,
      idgroup: null,
      firewall: fwcProduct.firewall.id,
      rule_order: 1,
      type: PolicyTypeId.INPUT,
      action: 1,
    });

    const applyResponse = await request(app.express)
      .post('/policy/shared-rules/apply')
      .set('Cookie', [attachSession(session)])
      .send({
        fwcloud: fwcProduct.fwcloud.id,
        firewall: fwcProduct.firewall.id,
        shared_rule_set: sharedRuleSetId,
        type: PolicyTypeId.INPUT,
        rule_order: 1,
        active: 1,
      })
      .expect(200);

    const policyApplyId = applyResponse.body.insertId;
    expect(policyApplyId).to.be.a('number');
    await unlockFwcloud();

    const firewall = await manager.getRepository(Firewall).findOneOrFail({
      where: { id: fwcProduct.firewall.id },
    });
    expect(firewall.status & 3).to.eq(3);

    await request(app.express)
      .put('/policy/shared-rules/applications/get')
      .set('Cookie', [attachSession(session)])
      .send({
        fwcloud: fwcProduct.fwcloud.id,
        shared_rule_set: sharedRuleSetId,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).to.have.length(1);
        expect(response.body[0].id).to.eq(policyApplyId);
        expect(response.body[0].firewall).to.eq(fwcProduct.firewall.id);
        expect(response.body[0].rule_order).to.eq(1);
      });

    await request(app.express)
      .put('/policy/shared-rules/apply')
      .set('Cookie', [attachSession(session)])
      .send({
        fwcloud: fwcProduct.fwcloud.id,
        policyApplyId,
        rule_order: 2,
        active: 0,
      })
      .expect(204);
    await unlockFwcloud();

    const [updatedPolicyApply] = await manager.query(
      `SELECT rule_order, active
       FROM policy_r__shared_rule_set
       WHERE id=?`,
      [policyApplyId],
    );
    expect(updatedPolicyApply.rule_order).to.eq(2);
    expect(updatedPolicyApply.active).to.eq(0);

    await request(app.express)
      .put('/policy/shared-rules/unapply')
      .set('Cookie', [attachSession(session)])
      .send({
        fwcloud: fwcProduct.fwcloud.id,
        policyApplyId,
      })
      .expect(204);

    const [policyApplyCount] = await manager.query(
      `SELECT COUNT(*) AS count FROM policy_r__shared_rule_set WHERE id=?`,
      [policyApplyId],
    );
    const [policyRule] = await manager.query(
      `SELECT rule_order
       FROM policy_r
       WHERE firewall=? AND type=?`,
      [fwcProduct.firewall.id, PolicyTypeId.INPUT],
    );

    expect(Number(policyApplyCount.count)).to.eq(0);
    expect(policyRule.rule_order).to.eq(1);
  });

  it('should reject marks in NAT shared rules', async () => {
    const sharedRuleSetId = await createSharedRuleSet(PolicyTypeId.SNAT);

    await request(app.express)
      .post('/policy/shared-rules/rule')
      .set('Cookie', [attachSession(session)])
      .send({
        fwcloud: fwcProduct.fwcloud.id,
        shared_rule_set: sharedRuleSetId,
        action: 1,
        comment: '',
        type: PolicyTypeId.SNAT,
        mark: fwcProduct.mark.id,
      })
      .expect(400)
      .then((response) => {
        expect(response.body.fwcErr).to.eq(1006);
      });
  });
});
