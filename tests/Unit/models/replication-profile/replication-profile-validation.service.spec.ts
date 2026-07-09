import { describeName, expect } from '../../../mocha/global-setup';
import defaultReplicationProfile from '../../../../src/models/replication-profile/presets/default-replication-profile.v1.json';
import {
  assertReplicationProfilePayloadIsValid,
  ReplicationProfileValidationError,
  ReplicationProfileValidationException,
  validateReplicationProfilePayload,
} from '../../../../src/models/replication-profile/replication-profile-validation.service';

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

describe(describeName('Replication Profile Validation Service Unit Tests'), () => {
  it('should accept valid built-in, firewall and cluster profiles', () => {
    expect(errorsFor(defaultReplicationProfile)).to.be.empty;
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
