import { describeName, expect } from '../../../mocha/global-setup';
import { getProfileProvisioning } from '../../../../src/models/replication-profile/policy-replication.types';
import { normalizeRuleNegation } from '../../../../src/models/replication-profile/replication-profile-rule-negation';

/** Blocks every parsed provision carries even when the profile does not declare them. */
const EMPTY_BLOCKS = {
  routing: { tables: [], rules: [] },
  system: { dhcp: [], keepalived: [], haproxy: [] },
};
const NO_TRANSLATION = { translatedSource: [], translatedDestination: [], translatedServices: [] };

describe(describeName('Policy Replication Types Unit Tests'), () => {
  for (const field of ['provision', 'policyStructure', 'policy_structure']) {
    it(`should retain the native options mask, explicit zero and missing values in ${field}`, () => {
      const values = [0, 2, 4, 6, 1, 5, 0xffff];
      const parsed = getProfileProvisioning(
        JSON.parse(
          JSON.stringify({
            [field]: {
              rules: [
                ...values.map((options) => ({ chain: 'forward', options })),
                { chain: 'forward' },
              ],
            },
          }),
        ),
      );
      expect(parsed.rules.slice(0, -1).map((rule) => rule.options)).to.deep.eq(values);
      expect(parsed.rules[parsed.rules.length - 1]).not.to.have.property('options');
    });
  }

  for (const field of ['provision', 'policyStructure', 'policy_structure']) {
    it(`should retain explicit enabled and disabled states and missing legacy states in ${field}`, () => {
      const parsed = getProfileProvisioning(
        JSON.parse(
          JSON.stringify({
            [field]: {
              rules: [
                { chain: 'forward', active: true, comment: 'Enabled' },
                { chain: 'forward', active: false, comment: 'Disabled' },
                { chain: 'forward', comment: 'Legacy' },
              ],
            },
          }),
        ),
      );
      expect(parsed.rules.map((rule) => [rule.comment, rule.active])).to.deep.eq([
        ['Enabled', true],
        ['Disabled', false],
        ['Legacy', undefined],
      ]);
      expect(parsed.rules[2]).not.to.have.property('active');
    });
  }

  it('should retain invalid states for validation instead of enabling the rule', () => {
    const values = [null, 0, 1, 'false', 'true', {}, []];
    const parsed = getProfileProvisioning({
      provision: { rules: values.map((active) => ({ active })) },
    });
    expect(parsed.rules.map((rule) => rule.active)).to.deep.eq(values);
  });

  it('should retain invalid options for validation instead of replacing them with defaults', () => {
    const values = [null, false, true, '6', -1, 1.5, 0x10000, {}, []];
    const parsed = getProfileProvisioning({
      provision: { rules: values.map((options) => ({ options })) },
    });
    expect(parsed.rules.map((rule) => rule.options)).to.deep.eq(values);
  });

  it('should preserve native negation only when the template declares it', () => {
    const rules = getProfileProvisioning({
      provision: {
        rules: [{ negate: '9  7 9' }, { negate: null }, { negate: '' }, {}],
      },
    }).rules;

    expect(rules[0].negate).to.equal('9  7 9');
    expect(rules[1]).to.have.property('negate', null);
    expect(rules[2]).to.have.property('negate', '');
    expect(rules[3]).not.to.have.property('negate');
  });

  it('should preserve malformed negation for validation instead of losing the restriction', () => {
    const invalidValues = [true, 7, ['7'], { source: true }, '7,8', '7 invalid'];
    const rules = getProfileProvisioning({
      provision: { rules: invalidValues.map((negate) => ({ negate })) },
    }).rules;

    expect(rules.map((rule) => rule.negate)).to.deep.equal(invalidValues);
  });

  for (const field of ['provision', 'policyStructure', 'policy_structure']) {
    it(`should keep the cluster node a rule is restricted to in ${field}`, () => {
      const rules = getProfileProvisioning(
        JSON.parse(
          JSON.stringify({
            [field]: { rules: [{ chain: 'forward', nodeRole: 'backup' }, { chain: 'forward' }] },
          }),
        ),
      ).rules;

      expect(rules[0].nodeRole).to.equal('backup');
      // No node role means every node, as for rules captured before node roles existed.
      expect(rules[1]).not.to.have.property('nodeRole');
    });
  }

  it('should preserve malformed node roles for validation instead of applying the rule to every node', () => {
    const invalidValues = [null, '', ' ', 2, ['backup'], { role: 'backup' }];
    const rules = getProfileProvisioning({
      provision: { rules: invalidValues.map((nodeRole) => ({ nodeRole })) },
    }).rules;

    expect(rules.map((rule) => rule.nodeRole)).to.deep.equal(invalidValues);
  });

  it('should canonicalize native negation for duplicate-rule comparisons', () => {
    expect(normalizeRuleNegation(' 25 7  9 7 22 ')).to.equal('7 9 22 25');
    expect(normalizeRuleNegation('\t25 7\n9 7 22 ')).to.equal('7 9 22 25');
    for (const value of [undefined, null, '', ' \t\n ']) {
      expect(normalizeRuleNegation(value)).to.equal(null);
    }
  });

  it('should reject malformed negation while computing a rule signature', () => {
    for (const value of [true, 7, ['7'], {}, '7,8', '-7', '7.5', '0']) {
      expect(() => normalizeRuleNegation(value)).to.throw('positive position IDs');
    }
  });

  it('should keep explicit interface address references in negated source and destination positions', () => {
    for (const field of ['kind', 'type', 'objectType']) {
      const rule = getProfileProvisioning({
        provision: {
          rules: [
            {
              source: [{ [field]: 'interfaceRole', role: 'lan' }],
              destination: [{ [field]: 'interfaceRole', role: 'wan' }],
              negate: '7 8',
            },
          ],
        },
      }).rules[0];

      expect(rule.source).to.deep.equal([{ kind: 'interfaceRole', role: 'lan' }]);
      expect(rule.destination).to.deep.equal([{ kind: 'interfaceRole', role: 'wan' }]);
      expect(rule.inRoles).to.deep.equal([]);
      expect(rule.outRoles).to.deep.equal([]);
      expect(rule.negate).to.equal('7 8');
    }
  });

  it('should keep bare interface strings as the legacy In/Out shorthand', () => {
    const rule = getProfileProvisioning({
      provision: { rules: [{ source: 'lan', destination: 'wan', negate: '22 25' }] },
    }).rules[0];

    expect(rule.source).to.deep.equal([]);
    expect(rule.destination).to.deep.equal([]);
    expect(rule.inRoles).to.deep.equal(['lan']);
    expect(rule.outRoles).to.deep.equal(['wan']);
    expect(rule.negate).to.equal('22 25');
  });

  it('should normalize policyStructure interface objects into declarative provisioning', () => {
    const provision = getProfileProvisioning({
      policyStructure: {
        interfaces: [{ name: 'WAN' }],
        rules: [
          {
            action: 'accept',
            source: [{ type: 'interface', value: 'LAN' }],
            destination: [{ type: 'interface', value: 'WAN' }],
            service: [{ type: 'service', value: 'tcp/443' }],
            comment: 'Allow LAN to WAN HTTPS',
          },
        ],
      },
    });

    expect(provision).to.deep.equal({
      interfaces: [
        { name: 'WAN', role: 'WAN', addresses: [] },
        { name: 'LAN', role: 'LAN', addresses: [] },
      ],
      rules: [
        {
          chain: 'forward',
          ipVersion: 4,
          action: 'accept',
          inRoles: ['LAN'],
          outRoles: ['WAN'],
          source: [],
          destination: [],
          services: [{ protocol: 'tcp', port: 443 }],
          ...NO_TRANSLATION,
          comment: 'Allow LAN to WAN HTTPS',
        },
      ],
      ...EMPTY_BLOCKS,
    });
  });

  it('should support custom role names in the legacy provision shape', () => {
    const provision = getProfileProvisioning({
      provision: {
        interfaces: [{ name: 'Office LAN', role: 'office-lan' }],
        rules: [{ action: 'deny', sourceRole: 'office-lan', service: 'udp/53' }],
      },
    });

    expect(provision).to.deep.equal({
      interfaces: [{ name: 'Office LAN', role: 'office-lan', addresses: [] }],
      rules: [
        {
          chain: 'forward',
          ipVersion: 4,
          action: 'deny',
          inRoles: ['office-lan'],
          outRoles: [],
          source: [],
          destination: [],
          services: [{ protocol: 'udp', port: 53 }],
          ...NO_TRANSLATION,
          comment: undefined,
        },
      ],
      ...EMPTY_BLOCKS,
    });
  });

  it('should keep structure-only models in the provisioning apply flow', () => {
    expect(
      getProfileProvisioning({
        policy_structure: {
          mode: 'json',
          value: { policies: { ipv4: { forward: [] } } },
        },
      }),
    ).to.deep.equal({ interfaces: [], rules: [], ...EMPTY_BLOCKS });
  });

  it('should retain both interface IP families and native address settings after a JSON round trip', () => {
    const addresses = [
      {
        name: 'IPv4',
        value: '192.0.2.10/24',
        ipVersion: 4,
        comment: '',
        diff_serv: 0,
        options: null,
      },
      {
        name: 'IPv6',
        value: '2001:0DB8::10/127',
        ipVersion: 6,
        comment: 'Primary IPv6',
        diff_serv: 12,
        options: '0',
      },
      {
        name: 'IPv6 alias',
        value: { param: 'ALIAS' },
        ipVersion: 6,
        comment: null,
        diff_serv: null,
        options: 1,
      },
    ];
    const provision = getProfileProvisioning(
      JSON.parse(
        JSON.stringify({
          provision: { interfaces: [{ name: 'eth0', role: 'lan', addresses }] },
        }),
      ),
    );
    expect(provision.interfaces[0]).to.deep.equal({ name: 'eth0', role: 'lan', addresses });
  });
});
