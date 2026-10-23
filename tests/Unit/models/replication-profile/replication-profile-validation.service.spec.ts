import { describeName, expect } from '../../../mocha/global-setup';
import defaultReplicationProfile from '../../../../src/models/replication-profile/presets/default-replication-profile.v1.json';
import {
  assertReplicationProfilePayloadIsValid,
  ReplicationProfileValidationError,
  ReplicationProfileValidationException,
  validateReplicationProfilePayload,
} from '../../../../src/models/replication-profile/replication-profile-validation.service';
import { readVersionedReplicationProfileTemplate } from '../../../utils/replication-profile-fixtures';
import { POLICY_STRUCTURE_FIELDS } from '../../../../src/models/replication-profile/policy-replication.types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function firewallProfile(): Record<string, unknown> {
  return {
    targetKind: 'firewall',
    model: {
      compatibility: {
        target_kinds: ['firewall'],
      },
      provision: {
        interfaces: [
          { name: 'eth0', role: 'wan' },
          { name: 'eth1', role: 'lan' },
        ],
        rules: [
          {
            action: 'accept',
            sourceRole: 'lan',
            destinationRole: 'wan',
            service: { protocol: 'tcp', port: 443 },
          },
        ],
      },
    },
  };
}

function clusterProfile(): Record<string, unknown> {
  return {
    targetKind: 'cluster',
    model: {
      compatibility: {
        target_kinds: ['cluster'],
      },
      roleAssignments: {
        interfaceRoles: ['wan', 'lan'],
        nodeRoles: ['primary', 'secondary'],
      },
      provision: {
        interfaces: [
          { name: 'eth0', role: 'wan' },
          { name: 'eth1', role: 'lan' },
        ],
        rules: [
          {
            action: 'accept',
            sourceRole: 'lan',
            destinationRole: 'wan',
            nodeRole: 'primary',
            service: { protocol: 'udp', port: 53 },
          },
        ],
      },
      topologyPreset: {
        nodes: [{ role: 'primary' }, { role: 'secondary' }],
        requiredNodes: ['primary', 'secondary'],
        interfaces: [
          { role: 'wan', nodeRole: 'primary' },
          { role: 'lan', nodeRole: 'secondary' },
        ],
        interfaceNodeMappings: {
          wan: 'primary',
          lan: 'secondary',
        },
      },
    },
  };
}

function model(payload: Record<string, unknown>): Record<string, unknown> {
  return payload.model as Record<string, unknown>;
}

function provision(payload: Record<string, unknown>): Record<string, unknown> {
  return model(payload).provision as Record<string, unknown>;
}

function topologyPreset(payload: Record<string, unknown>): Record<string, unknown> {
  return model(payload).topologyPreset as Record<string, unknown>;
}

function errorsFor(payload: unknown): ReplicationProfileValidationError[] {
  return validateReplicationProfilePayload(payload);
}

function codesFor(payload: unknown): string[] {
  return errorsFor(payload).map((error) => error.code);
}

function pathsFor(payload: unknown): Array<string | undefined> {
  return errorsFor(payload).map((error) => error.path);
}

describe('Native replication profile rule options validation', () => {
  for (const field of ['provision', 'policyStructure', 'policy_structure']) {
    it(`accepts missing options and every independent LOG/stateless setting in ${field}`, () => {
      expect(
        errorsFor({
          targetKind: 'firewall',
          model: {
            [field]: {
              rules: [
                ...[0, 2, 4, 6, 1, 5, 0xffff].map((options) => ({ chain: 'forward', options })),
                { chain: 'forward' },
              ],
            },
          },
        }),
      ).to.be.empty;
    });

    it(`rejects malformed masks in ${field} instead of silently altering rule behavior`, () => {
      for (const options of [null, false, true, '6', -1, 1.5, 0x10000, {}, []]) {
        const errors = errorsFor({
          targetKind: 'firewall',
          model: { [field]: { rules: [{ chain: 'forward', options }] } },
        });
        expect(errors.map((error) => error.code)).to.include('invalid_rule_options');
        expect(errors.map((error) => error.path)).to.include(`model.${field}.rules[0].options`);
      }
    });

    it(`preserves both validation errors and their order in ${field}`, () => {
      expect(
        errorsFor({
          targetKind: 'firewall',
          model: {
            [field]: {
              rules: [{ chain: 'forward', negate: 'invalid', options: false }],
            },
          },
        }),
      ).to.deep.eq([
        {
          code: 'invalid_rule_negation',
          message:
            'Rule negate must be null or a string of positive position IDs separated by spaces.',
          path: `model.${field}.rules[0].negate`,
          severity: 'error',
        },
        {
          code: 'invalid_rule_options',
          message: 'Rule options must be an integer between 0 and 65535.',
          path: `model.${field}.rules[0].options`,
          severity: 'error',
        },
      ]);
    });

    it(`still validates options when negation is absent or empty in ${field}`, () => {
      for (const negate of [undefined, null, '', ' \t\n ']) {
        const errors = errorsFor({
          targetKind: 'firewall',
          model: {
            [field]: {
              rules: [{ chain: 'forward', negate, options: false }],
            },
          },
        });
        expect(errors.map((error) => error.code)).to.deep.eq(['invalid_rule_options']);
      }
    });
  }
});

describe(describeName('Replication Profile Validation Service Unit Tests'), () => {
  it('should accept valid built-in, firewall and cluster profiles', () => {
    expect(
      errorsFor({
        target_kind: defaultReplicationProfile.target_kind,
        model: readVersionedReplicationProfileTemplate(defaultReplicationProfile.path),
      }),
    ).to.be.empty;
    expect(errorsFor(firewallProfile())).to.be.empty;
    expect(errorsFor(clusterProfile())).to.be.empty;
  });

  it('should reject invalid target kinds', () => {
    const payload = firewallProfile();
    payload.targetKind = 'gateway';

    expect(codesFor(payload)).to.include('invalid_target_kind');
    expect(pathsFor(payload)).to.include('targetKind');
  });

  it('should reject compatibility target kinds that contradict the root targetKind', () => {
    const payload = firewallProfile();
    model(payload).compatibility = { target_kinds: ['cluster'] };

    expect(codesFor(payload)).to.include('compatibility_target_kind_mismatch');
    expect(pathsFor(payload)).to.include('model.compatibility.target_kinds');
  });

  it('should reject duplicated provision interface roles', () => {
    const payload = firewallProfile();
    provision(payload).interfaces = [
      { name: 'eth0', role: 'wan' },
      { name: 'eth1', role: 'wan' },
    ];

    expect(codesFor(payload)).to.include('duplicate_interface_role');
    expect(pathsFor(payload)).to.include('model.provision.interfaces[1].role');
  });

  it('should reject rules that reference undefined interface roles', () => {
    const payload = firewallProfile();
    provision(payload).rules = [
      {
        action: 'accept',
        sourceRole: 'lan',
        destinationRole: 'dmz',
      },
    ];

    expect(codesFor(payload)).to.include('invalid_rule_role');
    expect(pathsFor(payload)).to.include('model.provision.rules[0].destinationRole');
  });

  it('should accept rule roles declared in roleAssignments or compatibility instead of provision.interfaces', () => {
    const payload = firewallProfile();
    delete provision(payload).interfaces;
    model(payload).roleAssignments = { interfaceRoles: ['lan'] };
    model(payload).compatibility = { target_kinds: ['firewall'], supportedRoles: ['wan'] };
    provision(payload).rules = [{ action: 'accept', sourceRole: 'lan', destinationRole: 'wan' }];

    expect(errorsFor(payload)).to.be.empty;
  });

  it('should reject invalid numeric ports', () => {
    const payload = firewallProfile();
    provision(payload).rules = [
      { action: 'accept', sourceRole: 'lan', service: { protocol: 'tcp', port: 0 } },
      { action: 'accept', sourceRole: 'lan', destinationPort: -1 },
      { action: 'accept', sourceRole: 'lan', destinationPort: 65536 },
      { action: 'accept', sourceRole: 'lan', destinationPort: '443' },
    ];

    const errors = errorsFor(payload).filter((error) => error.code === 'invalid_port');

    expect(errors.map((error) => error.path)).to.include.members([
      'model.provision.rules[0].service.port',
      'model.provision.rules[1].destinationPort',
      'model.provision.rules[2].destinationPort',
      'model.provision.rules[3].destinationPort',
    ]);
  });

  it('should reject unsupported protocols and actions', () => {
    const payload = firewallProfile();
    provision(payload).rules = [
      {
        action: 'allow',
        sourceRole: 'lan',
        service: { protocol: 'icmp', port: 8 },
      },
    ];

    expect(codesFor(payload)).to.include.members(['invalid_rule_action', 'invalid_protocol']);
  });

  it('should accept a fully parameterized profile', () => {
    const payload = firewallProfile();
    const model = payload.model as Record<string, unknown>;

    model.parameters = [
      { name: 'WAN_IP', type: 'address', label: 'WAN address' },
      { name: 'LAN_NET', type: 'network', default: '192.168.1.0/24' },
      { name: 'APP_PORT', type: 'port', default: 800 },
    ];
    model.provision = {
      interfaces: [
        { name: 'eth0', role: 'wan', addresses: [{ param: 'WAN_IP' }] },
        { name: 'eth1', role: 'lan', addresses: ['192.168.1.1/24'] },
      ],
      rules: [
        {
          chain: 'forward',
          ipVersion: 4,
          action: 'accept',
          inRole: 'lan',
          outRole: 'wan',
          source: [{ kind: 'network', value: { param: 'LAN_NET' } }],
          services: [{ protocol: 'tcp', port: { param: 'APP_PORT' } }],
        },
      ],
    };

    expect(validateReplicationProfilePayload(payload)).to.be.empty;
  });

  it('should reject malformed parameter declarations', () => {
    const payload = firewallProfile();
    (payload.model as Record<string, unknown>).parameters = [
      { name: '1BAD', type: 'port' },
      { name: 'DUP', type: 'port' },
      { name: 'DUP', type: 'port' },
      { name: 'WRONG', type: 'nope' },
      { name: 'BAD_DEFAULT', type: 'network', default: 'not-a-network' },
    ];

    const codes = validateReplicationProfilePayload(payload).map((error) => error.code);

    expect(codes).to.include('invalid_parameter_name');
    expect(codes).to.include('duplicate_parameter');
    expect(codes).to.include('invalid_parameter_type');
    expect(codes).to.include('invalid_parameter_default');
  });

  it('should reject references to undeclared parameters', () => {
    const payload = firewallProfile();
    const model = payload.model as Record<string, unknown>;

    model.parameters = [{ name: 'KNOWN', type: 'port', default: 80 }];
    model.provision = {
      interfaces: [{ name: 'eth0', role: 'wan', addresses: [{ param: 'MISSING_IP' }] }],
      rules: [
        {
          action: 'accept',
          inRole: 'wan',
          services: [{ protocol: 'tcp', port: { param: 'MISSING_PORT' } }],
        },
      ],
    };

    const errors = validateReplicationProfilePayload(payload);
    const codes = errors.map((error) => error.code);

    expect(codes.filter((code) => code === 'unknown_parameter_reference')).to.have.length(2);
    expect(errors.map((error) => error.message).join(' ')).to.contain('MISSING_IP');
  });

  it('should reject invalid interface addressing and rule objects', () => {
    const payload = firewallProfile();
    (payload.model as Record<string, unknown>).provision = {
      interfaces: [{ name: 'eth0', role: 'wan', addresses: ['999.1.1.1'] }],
      rules: [
        {
          action: 'accept',
          inRole: 'wan',
          source: [{ kind: 'network', value: 'nonsense' }],
        },
      ],
    };

    const codes = validateReplicationProfilePayload(payload).map((error) => error.code);

    expect(codes).to.include('invalid_interface_address');
    expect(codes).to.include('invalid_rule_object');
  });

  it('should validate IPv6 syntax, prefixes, family and native settings on interface addresses', () => {
    for (const address of [
      { value: '2001:db8:::1/64' },
      { value: '2001:db8::1/129' },
      { value: '2001:db8::1/64/128' },
      { value: '2001:db8::1/64', ipVersion: 4 },
      { value: { param: 'V6' }, ipVersion: 7 },
      { value: { param: 'V6' }, diff_serv: -1 },
      { value: { param: 'V6' }, options: 'unsupported' },
      { value: { param: 'V6' }, comment: 123 },
    ]) {
      const payload = firewallProfile();
      model(payload).parameters = [
        { name: 'V6', type: 'address', ipVersion: 6, default: '2001:db8::1/64' },
      ];
      provision(payload).interfaces = [{ name: 'eth0', role: 'wan', addresses: [address] }];
      expect(codesFor(payload), JSON.stringify(address)).to.include('invalid_interface_address');
      expect(pathsFor(payload)).to.include('model.provision.interfaces[0].addresses[0]');
    }
  });

  it('should accept native interface address metadata and legacy IPv4 templates', () => {
    const payload = firewallProfile();
    provision(payload).interfaces = [
      {
        name: 'eth0',
        role: 'wan',
        addresses: [
          '192.0.2.10/24',
          {
            value: '2001:0DB8::10/64',
            ipVersion: 6,
            name: 'IPv6 address',
            comment: null,
            diff_serv: 12,
            options: '0',
          },
        ],
      },
      { name: 'eth1', role: 'lan' },
    ];
    expect(validateReplicationProfilePayload(payload)).to.be.empty;
  });

  it('should reject rule objects of the other IP family', () => {
    const payload = firewallProfile();
    (payload.model as Record<string, unknown>).provision = {
      interfaces: [{ name: 'eth0', role: 'wan' }],
      rules: [
        {
          action: 'accept',
          ipVersion: 4,
          destination: [{ kind: 'address', value: '2001:db8::1' }],
        },
        {
          action: 'accept',
          ipVersion: 6,
          destination: [{ kind: 'address', value: '2001:db8::1' }],
        },
      ],
    };

    const codes = validateReplicationProfilePayload(payload).map((error) => error.code);

    expect(codes.filter((code) => code === 'invalid_rule_object_family')).to.have.length(1);
    expect(codes).to.not.include('invalid_rule_object');
  });

  it('should reject unsupported chains and IP versions', () => {
    const payload = firewallProfile();
    (payload.model as Record<string, unknown>).provision = {
      interfaces: [{ name: 'eth0', role: 'wan' }],
      rules: [{ chain: 'mangle', ipVersion: 5, action: 'accept', inRole: 'wan' }],
    };

    const codes = validateReplicationProfilePayload(payload).map((error) => error.code);

    expect(codes).to.include('invalid_rule_chain');
    expect(codes).to.include('invalid_rule_ip_version');
  });

  it('should accept populated native negation positions in every chain and IP family', () => {
    const policies = [
      [4, 'input', '1 2 3 20'],
      [4, 'output', '4 5 6 21'],
      [4, 'forward', '7 8 9 22 25'],
      [4, 'snat', '11 12 13 24'],
      [4, 'dnat', '30 31 32 36'],
      [6, 'input', '37 38 39 51'],
      [6, 'output', '40 41 42 52'],
      [6, 'forward', '43 44 45 53 55'],
      [6, 'snat', '46 47 48 54'],
      [6, 'dnat', '56 57 58 61'],
    ];
    const payload = firewallProfile();
    provision(payload).rules = policies.map(([ipVersion, chain, negate]) => ({
      ipVersion,
      chain,
      negate,
      inRoles: ['lan'],
      outRoles: ['wan'],
      source: [{ kind: 'std', id: 1 }],
      destination: [{ kind: 'std', id: 1 }],
      services: [{ protocol: 'tcp', port: 443 }],
    }));

    expect(errorsFor(payload)).to.be.empty;
  });

  it('should report malformed negation at its template field', () => {
    const payload = firewallProfile();
    const invalidValues = [true, 7, ['7'], {}, '7,8', '7 invalid', '7.5', '0'];
    provision(payload).rules = invalidValues.map((negate) => ({ negate }));

    const errors = errorsFor(payload).filter((error) => error.code === 'invalid_rule_negation');
    expect(errors).to.have.length(invalidValues.length);
    expect(errors.map((error) => error.path)).to.deep.equal(
      invalidValues.map((_, index) => `model.provision.rules[${index}].negate`),
    );
    expect(errors.every((error) => error.message.includes('positive position IDs'))).to.be.true;
  });

  it('should reject positions belonging to another chain or IP family', () => {
    const payload = firewallProfile();
    provision(payload).rules = [
      { chain: 'forward', ipVersion: 4, negate: '1' },
      { chain: 'forward', ipVersion: 6, negate: '7' },
      { chain: 'input', ipVersion: 4, negate: '25' },
      { chain: 'forward', ipVersion: 4, negate: '999' },
    ];

    const errors = errorsFor(payload).filter((error) => error.code === 'invalid_rule_negation');
    expect(errors).to.have.length(4);
    expect(errors.every((error) => error.message.includes('does not belong'))).to.be.true;
  });

  it('should reject every translated NAT negation position in both IP families', () => {
    const payload = firewallProfile();
    provision(payload).rules = [
      [4, 'snat', '14'],
      [4, 'snat', '16'],
      [4, 'dnat', '34'],
      [4, 'dnat', '35'],
      [6, 'snat', '49'],
      [6, 'snat', '50'],
      [6, 'dnat', '59'],
      [6, 'dnat', '60'],
    ].map(([ipVersion, chain, negate]) => ({ ipVersion, chain, negate }));

    const errors = errorsFor(payload).filter((error) => error.code === 'invalid_rule_negation');
    expect(errors).to.have.length(8);
    expect(errors.every((error) => error.message.includes('Translated NAT'))).to.be.true;
  });

  it('should reject each empty negated position', () => {
    const payload = firewallProfile();
    const populated = {
      chain: 'forward',
      inRoles: ['lan'],
      outRoles: ['wan'],
      source: [{ kind: 'std', id: 1 }],
      destination: [{ kind: 'std', id: 1 }],
      services: [{ protocol: 'tcp', port: 443 }],
    };
    provision(payload).rules = [
      ['inRoles', '22'],
      ['outRoles', '25'],
      ['source', '7'],
      ['destination', '8'],
      ['services', '9'],
    ].map(([field, negate]) => ({ ...populated, [field]: [], negate }));

    const errors = errorsFor(payload).filter((error) => error.code === 'invalid_rule_negation');
    expect(errors).to.have.length(5);
    expect(errors.every((error) => error.message.includes('Empty rule positions'))).to.be.true;
  });

  it('should validate negation against the parsed legacy interface shorthand', () => {
    const payload = firewallProfile();
    provision(payload).rules = [
      { source: [{ type: 'interface', value: 'lan' }], negate: '22' },
      { source: [{ type: 'interface', value: 'lan' }], negate: '7' },
    ];

    const errors = errorsFor(payload).filter((error) => error.code === 'invalid_rule_negation');
    expect(errors).to.have.length(1);
    expect(errors[0].path).to.equal('model.provision.rules[1].negate');
    expect(errors[0].message).to.include('Empty rule positions');
  });

  it('should allow negated explicit source and destination interface address references', () => {
    const payload = firewallProfile();
    provision(payload).rules = ['kind', 'type', 'objectType'].map((field) => ({
      source: [{ [field]: 'interfaceRole', role: 'lan' }],
      destination: [{ [field]: 'interfaceRole', role: 'wan' }],
      negate: '7 8',
    }));

    expect(errorsFor(payload)).to.be.empty;
  });

  it('should accept absent, null and empty negation in legacy templates', () => {
    const payload = firewallProfile();
    provision(payload).rules = [{}, { negate: null }, { negate: '' }];

    expect(errorsFor(payload)).to.be.empty;
  });

  it('should validate negation in every structure-only template spelling', () => {
    for (const field of POLICY_STRUCTURE_FIELDS) {
      const payload = firewallProfile();
      delete model(payload).provision;
      model(payload)[field] = { rules: [{ negate: '7', source: [] }] };

      const errors = errorsFor(payload).filter((error) => error.code === 'invalid_rule_negation');
      expect(errors).to.have.length(1);
      expect(errors[0].path).to.equal(`model.${field}.rules[0].negate`);
      expect(errors[0].message).to.include('Empty rule positions');
    }
  });

  it('should check structure negation when an empty provision block falls back to it', () => {
    const payload = firewallProfile();
    model(payload).provision = {};
    model(payload).policyStructure = { rules: [{ negate: ['7'] }] };

    const errors = errorsFor(payload).filter((error) => error.code === 'invalid_rule_negation');
    expect(errors).to.have.length(1);
    expect(errors[0].path).to.equal('model.policyStructure.rules[0].negate');
  });

  it('should reject negated structure rules whose chain or IP family cannot be parsed', () => {
    for (const field of POLICY_STRUCTURE_FIELDS) {
      const payload = firewallProfile();
      delete model(payload).provision;
      model(payload)[field] = {
        rules: [
          { chain: 'mangle', negate: '7' },
          { ipVersion: 5, negate: '7' },
        ],
      };

      const errors = errorsFor(payload).filter((error) => error.code === 'invalid_rule_negation');
      expect(errors).to.have.length(2);
      expect(errors.map((error) => error.path)).to.deep.equal([
        `model.${field}.rules[0].negate`,
        `model.${field}.rules[1].negate`,
      ]);
      expect(errors.every((error) => error.message.includes('chain or IP version is invalid'))).to
        .be.true;
    }
  });

  it('should reject credential-like keys anywhere in the payload', () => {
    const payload = firewallProfile();
    model(payload).options = {
      privateKey: 'do-not-store',
    };

    expect(codesFor(payload)).to.include('forbidden_secret_key');
    expect(pathsFor(payload)).to.include('model.options.privateKey');
  });

  it('should validate cluster topology definitions', () => {
    const payload = clusterProfile();
    topologyPreset(payload).firewallOnly = true;
    topologyPreset(payload).nodes = [{ role: 'primary' }, { role: 'primary' }];
    topologyPreset(payload).requiredNodes = ['missing'];
    topologyPreset(payload).interfaceNodeMappings = {
      guest: 'primary',
      wan: 'missing',
    };
    model(payload).roleAssignments = {
      interfaceRoles: ['wan', 'lan'],
      nodeRoles: ['ghost'],
    };
    (provision(payload).rules as Record<string, unknown>[])[0].nodeRole = 'missing';

    expect(codesFor(payload)).to.include.members([
      'invalid_cluster_topology',
      'duplicate_topology_node_role',
      'invalid_topology_node_role',
      'invalid_topology_interface_role',
    ]);
  });

  it('should return all detected validation errors in a UI-readable shape', () => {
    const payload = firewallProfile();
    payload.targetKind = 'gateway';
    model(payload).compatibility = { target_kinds: ['router'] };
    model(payload).options = { api_key: 'leaked' };
    provision(payload).interfaces = [
      { name: 'eth0', role: 'wan' },
      { name: 'eth1', role: 'wan' },
    ];
    provision(payload).rules = [
      {
        action: 'allow',
        sourceRole: 'lan',
        service: { protocol: 'icmp', port: 0 },
      },
    ];

    const errors = errorsFor(payload);

    expect(errors.length).to.be.greaterThan(1);
    expect(errors.map((error) => error.code)).to.include.members([
      'invalid_target_kind',
      'invalid_compatibility_target_kind',
      'forbidden_secret_key',
      'duplicate_interface_role',
      'invalid_rule_action',
      'invalid_rule_role',
      'invalid_protocol',
      'invalid_port',
    ]);
    expect(errors.every((error) => error.severity === 'error')).to.be.true;
    expect(errors.every((error) => typeof error.message === 'string')).to.be.true;
  });

  it('should expose validation errors through the exception response payload', () => {
    const payload = clone(firewallProfile());
    payload.targetKind = 'gateway';
    const errors = errorsFor(payload);

    try {
      assertReplicationProfilePayloadIsValid(payload);
      throw new Error('Expected replication profile validation to fail');
    } catch (error) {
      expect(error).to.be.instanceOf(ReplicationProfileValidationException);

      const exception = error as ReplicationProfileValidationException;
      expect(exception.status).to.eq(422);
      expect(exception.validationErrors).to.deep.eq(errors);
      expect(exception.toResponse().errors).to.deep.eq({
        profile: errors,
      });
    }
  });
});
