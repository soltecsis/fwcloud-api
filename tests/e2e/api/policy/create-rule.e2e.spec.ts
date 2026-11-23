import request = require('supertest');
import { stub } from 'sinon';
import { EntityManager } from 'typeorm';
import db from '../../../../src/database/database-manager';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { PolicyGroup } from '../../../../src/models/policy/PolicyGroup';
import { PolicyRule, SpecialPolicyRules } from '../../../../src/models/policy/PolicyRule';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';
import fwcError from '../../../../src/utils/error_table';
import StringHelper from '../../../../src/utils/string.helper';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { useProductionAuthentication } from '../../../utils/production-auth-harness';
import { assignClouds, securityAccount, securityLogin } from '../../../utils/security-fixtures';

describe(describeName('Creating policy rules at a group boundary'), () => {
  const type = PolicyTypesMap.get('IPv4:FORWARD');
  let manager: EntityManager;
  let firewall: Firewall;
  let sessionCookie: string;
  let rules: PolicyRule[];

  useProductionAuthentication();

  beforeEach(async () => {
    manager = db.getSource().manager;
    const account = await securityAccount(1);
    const session = await securityLogin(account);
    sessionCookie = session.cookie;
    const cloud = await manager.save(FwCloud, {
      name: StringHelper.randomize(10),
      locked: true,
      locked_by: session.id,
      locked_at: new Date(),
    });
    await assignClouds(account, [cloud]);
    firewall = await manager.save(Firewall, { name: 'create-rule', fwCloudId: cloud.id });

    const groups = await manager.save(PolicyGroup, [
      { name: 'first', firewallId: firewall.id },
      { name: 'last', firewallId: firewall.id },
    ]);
    rules = await manager.save(
      PolicyRule,
      [1, 2, 2, 3].map((rule_order, index) => ({
        action: 1,
        firewallId: firewall.id,
        policyGroupId: groups[index < 2 ? 0 : 1].id,
        policyTypeId: type,
        rule_order,
      })),
    );
  });

  function create(data: Record<string, unknown>): request.Test {
    return request(testSuite.app.express)
      .post('/policy/rule')
      .set('Cookie', [sessionCookie])
      .send({
        fwcloud: firewall.fwCloudId,
        firewall: firewall.id,
        type,
        action: 1,
        active: 1,
        options: 0,
        comment: '',
        idgroup: null,
        ...data,
      });
  }

  function createNextTo(rule: PolicyRule, pasteOffset: -1 | 1): request.Test {
    return create({ pasteOnRuleId: rule.id, pasteOffset });
  }

  function reload(): Promise<PolicyRule[]> {
    return manager.find(PolicyRule, {
      where: { firewallId: firewall.id, policyTypeId: type },
      order: { rule_order: 'ASC', id: 'ASC' },
    });
  }

  it('inserts before, between, and after groups while preserving tied order and membership', async () => {
    const before = await createNextTo(rules[0], -1).expect(200);
    const between = await createNextTo(rules[1], 1).expect(200);
    const after = await createNextTo(rules[3], 1).expect(200);

    expect((await reload()).map(({ id, policyGroupId }) => [id, policyGroupId])).to.deep.equal([
      [before.body, null],
      [rules[0].id, rules[0].policyGroupId],
      [rules[1].id, rules[1].policyGroupId],
      [between.body, null],
      [rules[2].id, rules[2].policyGroupId],
      [rules[3].id, rules[3].policyGroupId],
      [after.body, null],
    ]);
  });

  it('rejects an insertion inside a group or after Catch-All', async () => {
    await manager.update(PolicyRule, rules[3].id, { special: SpecialPolicyRules.CATCHALL });

    await createNextTo(rules[0], 1).expect(400, fwcError.NOT_ALLOWED);
    await createNextTo(rules[3], 1).expect(400, fwcError.NOT_ALLOWED);

    expect((await reload()).map(({ id }) => id)).to.deep.equal(rules.map(({ id }) => id));
  });

  it('leaves groups unchanged while another session holds the cloud lock', async () => {
    const otherSession = await securityLogin(await securityAccount(1));
    await manager.update(FwCloud, firewall.fwCloudId, { locked_by: otherSession.id });

    await createNextTo(rules[1], 1).expect(403, fwcError.ACC_FWCLOUD_LOCK);

    expect((await reload()).map(({ id }) => id)).to.deep.equal(rules.map(({ id }) => id));
  });

  it('rolls back the order change when insertion fails', async () => {
    const insertRule = stub(PolicyRule, 'insertPolicy_r').rejects(new Error('Unable to add rule'));
    try {
      await createNextTo(rules[1], 1).expect(400);
    } finally {
      insertRule.restore();
    }

    expect((await reload()).map(({ rule_order }) => rule_order)).to.deep.equal([1, 2, 2, 3]);
  });

  it('keeps numeric-order creation inside a group', async () => {
    const idgroup = rules[0].policyGroupId;
    const created = await create({ idgroup, rule_order: 2 }).expect(200);
    const persisted = await reload();

    expect(persisted[1].id).to.equal(created.body);
    expect(persisted[1].policyGroupId).to.equal(idgroup);
  });
});
