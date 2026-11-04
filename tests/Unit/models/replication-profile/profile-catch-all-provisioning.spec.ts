import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import db from '../../../../src/database/database-manager';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { Firewall, FireWallOptMask } from '../../../../src/models/firewall/Firewall';
import { Interface } from '../../../../src/models/interface/Interface';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { PolicyTypesMap } from '../../../../src/models/policy/PolicyType';
import StringHelper from '../../../../src/utils/string.helper';
import { PolicyReplicationService } from '../../../../src/models/replication-profile/policy-replication.service';
import {
  getProfileProvisioning,
  PolicyReplicationMode,
} from '../../../../src/models/replication-profile/policy-replication.types';

const INPUT4 = PolicyTypesMap.get('IPv4:INPUT');
const OUTPUT4 = PolicyTypesMap.get('IPv4:OUTPUT');
const FORWARD4 = PolicyTypesMap.get('IPv4:FORWARD');
const OUTPUT6 = PolicyTypesMap.get('IPv6:OUTPUT');
const typeOf = (rule: { chain: string; ipVersion: number }) =>
  PolicyTypesMap.get(`IPv${rule.ipVersion}:${rule.chain.toUpperCase()}`);

/**
 * A FORWARD rule plus the final actions of a source whose OUTPUT drops and whose FORWARD rejects
 * and logs; INPUT and the IPv6 OUTPUT keep FWCloud's defaults. The IPv6 INPUT and FORWARD
 * policies have no entry.
 */
const CATCH_ALL_RULES = [
  { chain: 'input', ipVersion: 4, action: 'deny', active: true, options: 0 },
  { chain: 'output', ipVersion: 4, action: 'deny', active: true, options: 0 },
  { chain: 'forward', ipVersion: 4, action: 'reject', active: true, options: 4 },
  { chain: 'output', ipVersion: 6, action: 'accept', active: true, options: 2 },
];
const CHANGES = [
  'Catch-all rule of OUTPUT IPv4: action ACCEPT -> DENY, options 2 -> 0.',
  'Catch-all rule of FORWARD IPv4: action DENY -> REJECT, options 0 -> 4.',
];

/** A template without catchAllRules when given null, as templates saved before them are. */
const model = (catchAllRules: unknown[] | null) => ({
  provision: {
    interfaces: [
      { name: 'eth0', role: 'wan' },
      { name: 'eth1', role: 'lan' },
    ],
    rules: [
      { chain: 'forward', action: 'accept', inRole: 'lan', outRole: 'wan', comment: 'LAN out' },
    ],
    ...(catchAllRules ? { catchAllRules } : {}),
  },
});

interface CatchAllRow {
  id: number;
  type: number;
  rule_order: number;
  action: number;
  active: number;
  options: number;
  comment: string;
}

describe(describeName('Replication profile catch-all rules provisioning Unit Tests'), () => {
  let service: PolicyReplicationService;
  let fwc: FwCloudProduct;
  let target: Firewall;

  before(async () => {
    await testSuite.resetDatabaseData();
  });

  beforeEach(async () => {
    service = await testSuite.app.getService<PolicyReplicationService>(
      PolicyReplicationService.name,
    );
    fwc = await new FwCloudFactory().make();
    target = await db
      .getSource()
      .manager.getRepository(Firewall)
      .save({ name: StringHelper.randomize(10), fwCloudId: fwc.fwcloud.id });
  });

  const apply = (mode: PolicyReplicationMode, catchAllRules: unknown[] | null = CATCH_ALL_RULES) =>
    service.provisionPolicyFromProfile(
      { kind: 'firewall', id: target.id },
      getProfileProvisioning(JSON.parse(JSON.stringify(model(catchAllRules)))),
      fwc.fwcloud.id,
      mode,
    );

  const catchAlls = (): Promise<CatchAllRow[]> =>
    db
      .getSource()
      .query(
        'SELECT id, type, rule_order, action, active, options, comment FROM policy_r WHERE firewall = ? AND special = 2 ORDER BY type, id',
        [target.id],
      );

  const policy = async (type: number): Promise<[number, string][]> =>
    (
      await db
        .getSource()
        .query(
          'SELECT special, comment FROM policy_r WHERE firewall = ? AND type = ? ORDER BY rule_order',
          [target.id, type],
        )
    ).map((row: { special: number; comment: string }) => [Number(row.special), row.comment]);

  /** FWCloud B's defaults: OUTPUT accepts, INPUT and FORWARD drop. */
  const withDefaultPolicy = () =>
    PolicyRule.insertDefaultPolicy(target.id, null, FireWallOptMask.STATEFUL);

  describe('a destination with its own default catch-all rules', () => {
    beforeEach(withDefaultPolicy);

    it('should update each catch-all rule in place, keep one per policy and leave the others alone', async () => {
      const before = await catchAlls();

      const result = await apply('replace_defaults');

      expect(result.errors).to.deep.eq([]);
      expect(result.applied).to.be.true;
      const after = await catchAlls();
      expect(after.map((row) => [row.id, row.type])).to.deep.eq(
        before.map((row) => [row.id, row.type]),
      );
      const byType = new Map(after.map((row) => [row.type, row]));
      expect(byType.get(OUTPUT4)).to.include({ action: 2, active: 1, options: 0 });
      expect(byType.get(FORWARD4)).to.include({ action: 3, active: 1, options: 4 });
      expect(byType.get(INPUT4)).to.include({ action: 2, options: 0 });
      expect(byType.get(OUTPUT6)).to.include({ action: 1, options: 2 });
      // The policies the template has no entry for keep the destination's catch-all as it was.
      const untouched = before.filter(
        (row) => !CATCH_ALL_RULES.some((rule) => typeOf(rule) === row.type),
      );
      expect(after.filter((row) => untouched.some((other) => other.id === row.id))).to.deep.eq(
        untouched,
      );
      // FORWARD: the stateful rule, the provisioned rule, and the same catch-all rule, last.
      expect(await policy(FORWARD4)).to.deep.eq([
        [1, 'Stateful firewall rule.'],
        [0, 'LAN out'],
        [2, 'Catch-all rule.'],
      ]);
      expect(result.removedDefaultRules).to.deep.eq([]);
      for (const change of CHANGES) expect(result.warnings).to.include(change);
      expect(
        result.catchAllRules.map(({ chain, ipVersion, targetRuleId, changed }) => [
          chain,
          ipVersion,
          targetRuleId,
          changed,
        ]),
      ).to.deep.eq(
        CATCH_ALL_RULES.map((rule) => [
          rule.chain,
          rule.ipVersion,
          byType.get(typeOf(rule)).id,
          rule.chain !== 'input' && rule.ipVersion === 4,
        ]),
      );
      expect(result.catchAllRules[1]).to.deep.include({
        previous: { action: 'accept', active: true, options: 2, comment: 'Catch-all rule.' },
        next: { action: 'deny', active: true, options: 0, comment: 'Catch-all rule.' },
      });
    });

    it('should preview exactly the changes the application makes, writing nothing', async () => {
      const before = await catchAlls();

      const preview = await apply('dry_run');

      expect(preview.errors).to.deep.eq([]);
      expect(await catchAlls()).to.deep.eq(before);
      const applied = await apply('replace_defaults');
      expect(preview.catchAllRules).to.deep.eq(applied.catchAllRules);
      expect(preview.warnings.filter((warning) => warning.startsWith('Catch-all'))).to.deep.eq(
        CHANGES,
      );
    });

    it('should leave a destination that already has the template final actions unchanged', async () => {
      await apply('replace_defaults');
      const before = await catchAlls();

      const again = await apply('replace_defaults');

      expect(again.errors).to.deep.eq([]);
      expect(again.catchAllRules.every((change) => !change.changed)).to.be.true;
      expect(again.warnings.filter((warning) => warning.startsWith('Catch-all'))).to.be.empty;
      expect(
        (await catchAlls()).map(({ id, action, options }) => [id, action, options]),
      ).to.deep.eq(before.map(({ id, action, options }) => [id, action, options]));
    });

    it('should keep only the settings the template omits from the destination', async () => {
      await db
        .getSource()
        .query(
          'UPDATE policy_r SET options = 4, comment = ? WHERE firewall = ? AND type = ? AND special = 2',
          ['Destination log', target.id, OUTPUT4],
        );

      const result = await apply('replace_defaults', [
        { chain: 'output', ipVersion: 4, action: 'deny' },
      ]);

      expect(result.errors).to.deep.eq([]);
      expect((await catchAlls()).find((row) => row.type === OUTPUT4)).to.include({
        action: 2,
        active: 1,
        options: 4,
        comment: 'Destination log',
      });
      expect(result.warnings).to.include('Catch-all rule of OUTPUT IPv4: action ACCEPT -> DENY.');
    });

    it('should keep the destination catch-all rule of a legacy template policy, below its rules', async () => {
      const before = await catchAlls();

      const result = await apply('replace_defaults', null);

      expect(result.errors).to.deep.eq([]);
      expect(result.catchAllRules).to.be.undefined;
      expect(result.removedDefaultRules).to.deep.eq([]);
      expect(await catchAlls()).to.have.deep.members(
        before.map((row) =>
          row.type === FORWARD4 ? { ...row, rule_order: row.rule_order + 1 } : row,
        ),
      );
      expect(await policy(FORWARD4)).to.deep.eq([
        [1, 'Stateful firewall rule.'],
        [0, 'LAN out'],
        [2, 'Catch-all rule.'],
      ]);
    });

    it('should report every different catch-all rule in merge mode and change none', async () => {
      const before = await catchAlls();

      const result = await apply('merge');

      expect(result.errors).to.deep.eq([]);
      expect(result.catchAllRules).to.be.undefined;
      expect(
        result.conflicts.filter((conflict) => conflict.type === 'different_catch_all_rule'),
      ).to.deep.eq([
        {
          type: 'different_catch_all_rule',
          message:
            "Catch-all rule of OUTPUT IPv4: merge mode keeps the destination's catch-all rule; the template sets action ACCEPT -> DENY, options 2 -> 0.",
          targetRuleId: before.find((row) => row.type === OUTPUT4).id,
        },
        {
          type: 'different_catch_all_rule',
          message:
            "Catch-all rule of FORWARD IPv4: merge mode keeps the destination's catch-all rule; the template sets action DENY -> REJECT, options 0 -> 4.",
          targetRuleId: before.find((row) => row.type === FORWARD4).id,
        },
      ]);
      expect(
        (await catchAlls()).map(({ id, action, options }) => [id, action, options]),
      ).to.deep.eq(before.map(({ id, action, options }) => [id, action, options]));
    });

    it('should refuse a destination policy holding two catch-all rules before writing anything', async () => {
      const duplicate = await PolicyRule.insertPolicy_r({
        firewall: target.id,
        type: OUTPUT4,
        rule_order: 9,
        action: 1,
        active: 1,
        options: 0,
        special: 2,
        comment: 'Catch-all rule.',
      });

      const result = await apply('replace_defaults');

      expect(result.applied).to.be.false;
      expect(result.errors).to.have.length(1);
      expect(result.errors[0])
        .to.contain('Catch-all rule of OUTPUT IPv4')
        .and.contain(String(duplicate));
      expect(
        await db.getSource().manager.getRepository(Interface).countBy({ firewallId: target.id }),
      ).to.eq(0);
      expect(await policy(FORWARD4)).to.deep.eq([
        [1, 'Stateful firewall rule.'],
        [2, 'Catch-all rule.'],
      ]);
    });

    for (const [description, catchAllRules] of [
      ['an unsupported action', [{ chain: 'output', ipVersion: 4, action: 'drop' }]],
      ['a missing action', [{ chain: 'output', ipVersion: 4 }]],
      ['a NAT policy', [{ chain: 'snat', ipVersion: 4, action: 'accept' }]],
    ] as const) {
      it(`should reject ${description} before writing anything, never applying a default`, async () => {
        const before = await catchAlls();

        const result = await apply('replace_defaults', [...catchAllRules]);

        expect(result.applied).to.be.false;
        expect(result.errors).to.have.length(1);
        expect(result.errors[0]).to.match(/^catchAllRules\[0\]: Catch-all rule/);
        expect(await catchAlls()).to.deep.eq(before);
        expect(
          await db.getSource().manager.getRepository(Interface).countBy({ firewallId: target.id }),
        ).to.eq(0);
      });
    }
  });

  it('should add the missing catch-all rules last, as a preview plans them', async () => {
    const preview = await apply('dry_run');
    expect(preview.errors).to.deep.eq([]);
    expect(
      preview.catchAllRules.map((change) => [change.targetRuleId, change.previous, change.changed]),
    ).to.deep.eq(CATCH_ALL_RULES.map(() => [null, null, true]));
    expect(await catchAlls()).to.deep.eq([]);

    const result = await apply('replace_defaults');

    expect(result.errors).to.deep.eq([]);
    const rows = await catchAlls();
    expect(
      rows.map(({ type, action, active, options, comment }) => [
        type,
        action,
        active,
        options,
        comment,
      ]),
    ).to.deep.eq([
      [INPUT4, 2, 1, 0, 'Catch-all rule.'],
      [OUTPUT4, 2, 1, 0, 'Catch-all rule.'],
      [FORWARD4, 3, 1, 4, 'Catch-all rule.'],
      [OUTPUT6, 1, 1, 2, 'Catch-all rule.'],
    ]);
    expect(result.catchAllRules.map((change) => change.targetRuleId)).to.deep.eq(
      rows.map((row) => row.id),
    );
    expect(result.catchAllRules.map(({ previous, next }) => [previous, next])).to.deep.eq(
      preview.catchAllRules.map(({ previous, next }) => [previous, next]),
    );
    expect(await policy(FORWARD4)).to.deep.eq([
      [0, 'LAN out'],
      [2, 'Catch-all rule.'],
    ]);
    expect(result.warnings).to.include('Catch-all rule of OUTPUT IPv4: added with action DENY.');
  });

  it('should report each missing catch-all rule in merge mode and add none', async () => {
    const result = await apply('merge');

    expect(result.errors).to.deep.eq([]);
    expect(await catchAlls()).to.deep.eq([]);
    expect(
      result.conflicts
        .filter((conflict) => conflict.type === 'different_catch_all_rule')
        .map((conflict) => conflict.message),
    ).to.deep.eq(
      ['INPUT IPv4', 'OUTPUT IPv4', 'FORWARD IPv4', 'OUTPUT IPv6'].map(
        (policy, index) =>
          `Catch-all rule of ${policy}: the destination has none and merge mode does not add one; the template's action is ${['DENY', 'DENY', 'REJECT', 'ACCEPT'][index]}.`,
      ),
    );
  });
});
