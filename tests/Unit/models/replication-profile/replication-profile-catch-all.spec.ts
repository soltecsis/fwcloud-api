import { describeName, expect } from '../../../mocha/global-setup';
import { getProfileProvisioning } from '../../../../src/models/replication-profile/policy-replication.types';
import { getProfileCatchAllRuleErrors } from '../../../../src/models/replication-profile/replication-profile-catch-all';
import { validateReplicationProfilePayload } from '../../../../src/models/replication-profile/replication-profile-validation.service';

const STRUCTURE_FIELDS = ['provision', 'policyStructure', 'policy_structure'];

/** One catch-all rule for each filter policy of both families, with every supported action. */
const EVERY_POLICY = [
  { chain: 'input', ipVersion: 4, action: 'deny', active: true, options: 0 },
  { chain: 'output', ipVersion: 4, action: 'deny', active: true, options: 2 },
  { chain: 'forward', ipVersion: 4, action: 'reject', active: true, options: 4 },
  { chain: 'input', ipVersion: 6, action: 'accept', active: false, options: 0 },
  { chain: 'output', ipVersion: 6, action: 'accept', active: true, options: 2, comment: 'Out' },
  { chain: 'forward', ipVersion: 6, action: 'deny', active: true, options: 0 },
];

describe(describeName('Replication profile catch-all rules Unit Tests'), () => {
  it('should accept ACCEPT, DENY and REJECT in every filter policy of both families', () => {
    expect(getProfileCatchAllRuleErrors(EVERY_POLICY)).to.deep.eq([]);
    // Only the action is required: omitted settings keep the destination's own values.
    expect(getProfileCatchAllRuleErrors([{ chain: 'output', ipVersion: 4, action: 'deny' }])).to.be
      .empty;
  });

  it('should never default a missing or unsupported action', () => {
    const errors = getProfileCatchAllRuleErrors([
      { chain: 'output', ipVersion: 4 },
      { chain: 'input', ipVersion: 4, action: 'drop' },
      { chain: 'forward', ipVersion: 4, action: 'accounting' },
      { chain: 'forward', ipVersion: 6, action: null },
    ]);

    expect(errors.map(({ index, field }) => [index, field])).to.deep.eq([
      [0, 'action'],
      [1, 'action'],
      [2, 'action'],
      [3, 'action'],
    ]);
    expect(errors[0].message).to.contain('required');
    expect(errors[1].message).to.contain('"drop" is not supported');
  });

  it('should identify the policy of every invalid entry and reject what a catch-all cannot hold', () => {
    const errors = getProfileCatchAllRuleErrors([
      { chain: 'snat', ipVersion: 4, action: 'accept' },
      { chain: 'output', action: 'deny' },
      { chain: 'output', ipVersion: 4, action: 'deny', active: 1, options: -1, comment: 5 },
      { chain: 'forward', ipVersion: 4, action: 'deny', source: [{ kind: 'address' }] },
      'deny',
    ]);

    expect(errors.map(({ index, field }) => [index, field])).to.deep.eq([
      [0, 'chain'],
      [1, 'ipVersion'],
      [2, 'active'],
      [2, 'options'],
      [2, 'comment'],
      [3, 'source'],
      [4, undefined],
    ]);
    expect(errors[0].message).to.contain('NAT policies have no catch-all rule');
  });

  it('should allow one catch-all rule per policy, each family on its own', () => {
    const errors = getProfileCatchAllRuleErrors([
      { chain: 'output', ipVersion: 4, action: 'deny' },
      { chain: 'output', ipVersion: 6, action: 'accept' },
      { chain: 'output', ipVersion: 4, action: 'accept' },
    ]);

    expect(errors).to.deep.eq([
      {
        index: 2,
        field: undefined,
        message: 'Policy OUTPUT IPv4 can only have one catch-all rule.',
      },
    ]);
  });

  for (const field of STRUCTURE_FIELDS) {
    it(`should keep every catch-all rule through JSON in ${field}, without defaults`, () => {
      const model = JSON.parse(
        JSON.stringify({ [field]: { rules: [], catchAllRules: EVERY_POLICY } }),
      );

      expect(getProfileProvisioning(model).catchAllRules).to.deep.eq(EVERY_POLICY);
      expect(
        getProfileProvisioning({ [field]: { catchAllRules: [{ chain: 'output', ipVersion: 4 }] } })
          .catchAllRules,
      ).to.deep.eq([{ chain: 'output', ipVersion: 4 }]);
    });

    it(`should report invalid catch-all rules with their path when ${field} is saved`, () => {
      const errors = validateReplicationProfilePayload({
        targetKind: 'firewall',
        model: {
          [field]: {
            rules: [],
            catchAllRules: [
              { chain: 'output', ipVersion: 4, action: 'deny' },
              { chain: 'input', ipVersion: 6, action: 'drop' },
            ],
          },
        },
      });

      expect(errors.map(({ code, path }) => [code, path])).to.deep.eq([
        ['invalid_catch_all_rule', `model.${field}.catchAllRules[1].action`],
      ]);
      expect(
        validateReplicationProfilePayload({
          targetKind: 'firewall',
          model: { [field]: { rules: [], catchAllRules: { chain: 'output' } } },
        }).map(({ code }) => code),
      ).to.deep.eq(['invalid_catch_all_rules']);
    });
  }

  it('should read a structure without catch-all rules, as legacy templates have, as declaring none', () => {
    const legacy = getProfileProvisioning({
      provision: { rules: [{ chain: 'forward', action: 'accept' }] },
    });

    expect(legacy.catchAllRules).to.deep.eq([]);
    expect(
      validateReplicationProfilePayload({
        targetKind: 'firewall',
        model: { provision: { rules: [{ chain: 'forward', action: 'accept' }] } },
      }),
    ).to.deep.eq([]);
  });

  it('should treat a structure holding only catch-all rules as a provisioning template', () => {
    const provision = getProfileProvisioning({
      provision: { catchAllRules: [{ chain: 'output', ipVersion: 4, action: 'deny' }] },
    });

    expect(provision).not.to.be.null;
    expect(provision.catchAllRules).to.have.length(1);
  });
});
