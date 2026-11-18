import request = require('supertest');
import { stub } from 'sinon';
import { EntityManager, In } from 'typeorm';
import db from '../../../../src/database/database-manager';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import { Interface } from '../../../../src/models/interface/Interface';
import { IPObj } from '../../../../src/models/ipobj/IPObj';
import { Mark } from '../../../../src/models/ipobj/Mark';
import { PolicyGroup } from '../../../../src/models/policy/PolicyGroup';
import { RulePositionsMap } from '../../../../src/models/policy/PolicyPosition';
import { PolicyRule, SpecialPolicyRules } from '../../../../src/models/policy/PolicyRule';
import { PolicyRuleToInterface } from '../../../../src/models/policy/PolicyRuleToInterface';
import { PolicyRuleToIPObj } from '../../../../src/models/policy/PolicyRuleToIPObj';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';
import fwcError from '../../../../src/utils/error_table';
import StringHelper from '../../../../src/utils/string.helper';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { useProductionAuthentication } from '../../../utils/production-auth-harness';
import { assignClouds, securityAccount, securityLogin } from '../../../utils/security-fixtures';

describe(describeName('Policy rule copy'), () => {
  const type = PolicyTypesMap.get('IPv4:FORWARD');
  const originalOrder = ['first', 'A', 'B', 'C', 'D', 'last'] as const;
  type RuleName = (typeof originalOrder)[number];

  let manager: EntityManager;
  let firewall: Firewall;
  let sessionCookie: string;
  let rules: Record<RuleName, PolicyRule>;

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
    firewall = await manager.save(Firewall, { name: 'copy-test', fwCloudId: cloud.id });

    const inserted = await manager.save(
      PolicyRule,
      (['C', 'last', 'A', 'first', 'D', 'B'] as const).map((comment) => ({
        comment,
        rule_order: originalOrder.indexOf(comment) + 1,
        action: 1,
        firewallId: firewall.id,
        policyTypeId: type,
      })),
    );
    rules = Object.fromEntries(inserted.map((rule) => [rule.comment, rule])) as typeof rules;
  });

  function paste(
    source: RuleName[],
    destination: RuleName,
    offset: -1 | 0 | 1,
    operation: 'copy' | 'move' = 'copy',
  ): request.Test {
    return request(testSuite.app.express)
      .put(`/policy/rule/${operation}`)
      .set('Cookie', [sessionCookie])
      .send({
        fwcloud: firewall.fwCloudId,
        firewall: firewall.id,
        rulesIds: source.map((name) => rules[name].id),
        pasteOnRuleId: rules[destination].id,
        pasteOffset: offset,
      });
  }

  function reload(): Promise<PolicyRule[]> {
    return manager.find(PolicyRule, {
      where: { firewallId: firewall.id, policyTypeId: type },
      order: { rule_order: 'ASC', id: 'ASC' },
    });
  }

  async function expectOrder(expected: string[], contiguous = true): Promise<PolicyRule[]> {
    const persisted = await reload();
    const originalIds = new Set(Object.values(rules).map((rule) => rule.id));
    expect(
      persisted.map((rule) => (originalIds.has(rule.id) ? rule.comment : `${rule.comment} copy`)),
    ).to.deep.equal(expected);
    const positions = persisted.map((rule) => rule.rule_order);
    if (contiguous) {
      expect(positions).to.deep.equal(expected.map((_, index) => index + 1));
    } else {
      expect(new Set(positions).size).to.equal(positions.length);
    }
    return persisted;
  }

  async function groupRules(name: string, members: RuleName[]): Promise<PolicyGroup> {
    const group = await manager.save(PolicyGroup, { name, firewallId: firewall.id });
    await manager.update(
      PolicyRule,
      { id: In(members.map((member) => rules[member].id)) },
      { policyGroupId: group.id },
    );
    return group;
  }

  async function addObject(name: RuleName, positionOrder: number) {
    const object = await manager.save(IPObj, {
      name: `${name}-address-${positionOrder}`,
      address: `192.0.2.${positionOrder}`,
      ipObjTypeId: 5,
      fwCloudId: firewall.fwCloudId,
    });
    return manager.save(PolicyRuleToIPObj, {
      policyRuleId: rules[name].id,
      ipObjId: object.id,
      policyPositionId: RulePositionsMap.get('IPv4:FORWARD:Source'),
      position_order: positionOrder,
    });
  }

  it('pastes two rules in policy order above the first rule', async () => {
    await paste(['B', 'A'], 'first', -1).expect(204);

    await expectOrder(['A copy', 'B copy', ...originalOrder]);
  });

  it('pastes three rules in policy order below the last rule', async () => {
    await paste(['C', 'B', 'A'], 'last', 1).expect(204);

    await expectOrder([...originalOrder, 'A copy', 'B copy', 'C copy']);
  });

  it('pastes copies above a zero-position rule in a policy with gaps', async () => {
    const positions = [0, 3, 7, 10, 15, 21];
    await manager.save(
      PolicyRule,
      originalOrder.map((name, index) => ({ id: rules[name].id, rule_order: positions[index] })),
    );

    await paste(['C', 'A'], 'first', -1).expect(204);

    await expectOrder(['A copy', 'C copy', ...originalOrder], false);
  });

  it('pastes immediately after the first of two originals with the same position', async () => {
    await manager.update(PolicyRule, rules.B.id, { rule_order: rules.A.rule_order });

    await paste(['D', 'C'], 'A', 1).expect(204);

    await expectOrder(['first', 'A', 'C copy', 'D copy', 'B', 'C', 'D', 'last'], false);
  });

  it('preserves four-rule blocks across repeated pastes around the source rules', async () => {
    const selection: RuleName[] = ['D', 'B', 'C', 'A'];
    const block = ['A copy', 'B copy', 'C copy', 'D copy'];

    await paste(selection, 'B', -1).expect(204);
    await expectOrder(['first', 'A', ...block, 'B', 'C', 'D', 'last']);

    await paste(selection, 'B', 1).expect(204);
    await expectOrder(['first', 'A', ...block, 'B', ...block, 'C', 'D', 'last']);

    await paste(selection, 'B', 1).expect(204);
    await expectOrder(['first', 'A', ...block, 'B', ...block, ...block, 'C', 'D', 'last']);
  });

  it('preserves order and membership when pasting inside the source group', async () => {
    const group = await groupRules('source', ['A', 'B', 'C']);

    await paste(['B', 'A'], 'C', -1).expect(204);

    const persisted = await expectOrder(['first', 'A', 'B', 'A copy', 'B copy', 'C', 'D', 'last']);
    expect(persisted.filter((rule) => rule.policyGroupId === group.id)).to.deep.equal(
      persisted.slice(1, 6),
    );
  });

  it('puts copies in the destination group and leaves the source group intact', async () => {
    const source = await groupRules('source', ['A', 'B', 'C']);
    const destination = await groupRules('destination', ['D', 'last']);

    await paste(['B', 'C', 'A'], 'D', 1).expect(204);

    const persisted = await expectOrder([
      'first',
      'A',
      'B',
      'C',
      'D',
      'A copy',
      'B copy',
      'C copy',
      'last',
    ]);
    expect(persisted.map((rule) => rule.policyGroupId)).to.deep.equal([
      null,
      source.id,
      source.id,
      source.id,
      destination.id,
      destination.id,
      destination.id,
      destination.id,
      destination.id,
    ]);
  });

  it('keeps zero-offset copies above the group anchor', async () => {
    const group = await groupRules('destination', ['D', 'last']);

    await paste(['C', 'A', 'A'], 'D', 0).expect(204);

    const persisted = await expectOrder([
      'first',
      'A',
      'B',
      'C',
      'A copy',
      'A copy',
      'C copy',
      'D',
      'last',
    ]);
    expect(persisted.filter((rule) => rule.policyGroupId === group.id)).to.deep.equal(
      persisted.slice(4),
    );
  });

  it('copies one rule with its configuration, objects, and interface', async () => {
    const mark = await manager.save(Mark, {
      code: 42,
      name: 'copy-test',
      fwCloudId: firewall.fwCloudId,
    });
    const options = {
      action: 2,
      direction: 1,
      active: 0,
      time_start: new Date('2026-01-01T08:00:00Z'),
      time_end: new Date('2026-01-31T08:00:00Z'),
      options: 4,
      style: 'custom-rule-style',
      fw_apply_to: firewall.id,
      negate: String(RulePositionsMap.get('IPv4:FORWARD:Source')),
      markId: mark.id,
      run_before: 'echo before',
      run_after: 'echo after',
    };
    await manager.update(PolicyRule, rules.B.id, options);
    const secondObject = await addObject('B', 2);
    const firstObject = await addObject('B', 1);
    const networkInterface = await manager.save(Interface, {
      name: 'eth0',
      type: '10',
      interface_type: '10',
      firewallId: firewall.id,
    });
    const interfacePosition = {
      interfaceId: networkInterface.id,
      policyPositionId: RulePositionsMap.get('IPv4:FORWARD:In'),
      position_order: 1,
    };
    await manager.save(PolicyRuleToInterface, { policyRuleId: rules.B.id, ...interfacePosition });
    const before = await reload();

    await paste(['B'], 'last', 1).expect(204);

    const persisted = await expectOrder([...originalOrder, 'B copy']);
    const copy = persisted[persisted.length - 1];
    expect(copy).to.deep.include(options);
    expect(persisted.slice(0, -1)).to.deep.equal(before);

    const objectPositions = (objects: PolicyRuleToIPObj[]) =>
      objects.map(({ ipObjId, policyPositionId, position_order }) => ({
        ipObjId,
        policyPositionId,
        position_order,
      }));
    for (const ruleId of [copy.id, rules.B.id]) {
      const objects = await manager.find(PolicyRuleToIPObj, {
        where: { policyRuleId: ruleId },
        order: { position_order: 'ASC' },
      });
      expect(objectPositions(objects)).to.deep.equal(objectPositions([firstObject, secondObject]));
      const interfaces = await manager.findBy(PolicyRuleToInterface, { policyRuleId: ruleId });
      expect(interfaces).to.have.lengthOf(1);
      expect(interfaces[0]).to.deep.include(interfacePosition);
    }
  });

  it('keeps Catch-All restrictions and allows pasting above it', async () => {
    await manager.update(PolicyRule, rules.last.id, { special: SpecialPolicyRules.CATCHALL });
    const before = await reload();

    await paste(['A', 'last'], 'first', -1).expect(400, fwcError.NOT_ALLOWED);
    await paste(['B', 'A'], 'last', 1).expect(400, fwcError.NOT_ALLOWED);
    expect(await reload()).to.deep.equal(before);

    await paste(['B', 'A'], 'last', -1).expect(204);
    const persisted = await expectOrder(['first', 'A', 'B', 'C', 'D', 'A copy', 'B copy', 'last']);
    expect(persisted[persisted.length - 1].special).to.equal(SpecialPolicyRules.CATCHALL);
  });

  it('rolls back inserted rules and order changes when copying an association fails', async () => {
    await addObject('A', 1);
    await addObject('B', 1);
    const before = await reload();
    const duplicateInterfaces = stub(PolicyRuleToInterface, 'duplicatePolicy_r__interface');
    duplicateInterfaces.callThrough();
    duplicateInterfaces.onSecondCall().rejects(new Error('Unable to copy interfaces'));

    try {
      await paste(['A', 'B'], 'first', -1).expect(400);
      expect(duplicateInterfaces.callCount).to.equal(2);
    } finally {
      duplicateInterfaces.restore();
    }

    expect(await reload()).to.deep.equal(before);
    await paste(['A', 'B'], 'first', -1).expect(204);
    await expectOrder(['A copy', 'B copy', ...originalOrder]);
  });

  it('keeps each simultaneous paste in a contiguous block', async () => {
    await Promise.all([
      paste(['B', 'A'], 'last', 1).expect(204),
      paste(['D', 'C'], 'last', 1).expect(204),
    ]);

    const persisted = await reload();
    expect(persisted.map((rule) => rule.rule_order)).to.deep.equal(
      persisted.map((_, index) => index + 1),
    );
    expect(persisted.slice(0, originalOrder.length).map((rule) => rule.id)).to.deep.equal(
      originalOrder.map((name) => rules[name].id),
    );
    expect([
      ['A', 'B', 'C', 'D'],
      ['C', 'D', 'A', 'B'],
    ]).to.deep.include(persisted.slice(originalOrder.length).map((rule) => rule.comment));
  });

  it('still moves rules above and below an existing destination', async () => {
    await paste(['A', 'B'], 'D', -1, 'move').expect(204);
    await expectOrder(['first', 'C', 'A', 'B', 'D', 'last'], false);

    await paste(['last'], 'C', 1, 'move').expect(204);
    await expectOrder(['first', 'C', 'last', 'A', 'B', 'D'], false);
  });
});
