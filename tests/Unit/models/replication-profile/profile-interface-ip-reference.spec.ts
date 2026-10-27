import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import {
  createPolicyReplicationResult,
  getProfileProvisioning,
  POLICY_STRUCTURE_FIELDS,
} from '../../../../src/models/replication-profile/policy-replication.types';
import { ObjectBindingResolver } from '../../../../src/models/replication-profile/object-binding.resolver';
import {
  getProvisionRulePositions,
  PolicyReplicationService,
} from '../../../../src/models/replication-profile/policy-replication.service';
import { getProvisionInterfaceAddressReferenceErrors } from '../../../../src/models/replication-profile/replication-profile-interface-address-reference';
import { validateReplicationProfilePayload } from '../../../../src/models/replication-profile/replication-profile-validation.service';

describe('Specific interface IP references remain policy objects', () => {
  const selected = (index: number, family: 4 | 6 = 4): any => ({
    kind: 'address',
    value: family === 4 ? `192.0.2.${index + 1}/24` : `2001:db8::${index + 1}/64`,
    // Deliberately identical names: neither the name nor the IP's owner determines its role.
    name: 'Interface address',
    interfaceRole: 'wan',
    interfaceAddressIndex: index,
  });
  const structure = (family: 4 | 6 = 4, rule: any = {}): any => ({
    interfaces: [
      {
        name: 'eth0',
        role: 'wan',
        addresses: [0, 1].map((index) => ({
          value: selected(index, family).value,
          name: 'Interface address',
          ipVersion: family,
        })),
      },
      { name: 'eth1', role: 'lan', addresses: [] },
    ],
    rules: [{ chain: 'forward', ipVersion: family, ...rule }],
  });
  const parse = (data: any) => getProfileProvisioning({ provision: data })!;
  const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value));

  for (const field of ['provision', ...POLICY_STRUCTURE_FIELDS]) {
    for (const side of ['source', 'destination', 'both']) {
      it(`${field}: preserves specific IPs in ${side} through JSON without introducing In/Out`, () => {
        const original = structure(4, {
          ...(side !== 'destination' ? { source: [selected(0)] } : {}),
          ...(side !== 'source' ? { destination: [selected(1)] } : {}),
          options: 6,
          action: 'deny',
          negate: side === 'both' ? '7 8' : side === 'source' ? '7' : '8',
        });
        const provision = getProfileProvisioning(roundTrip({ [field]: original }))!;
        const rule = provision.rules[0];
        assert.deepEqual(rule.source, side === 'destination' ? [] : [selected(0)]);
        assert.deepEqual(rule.destination, side === 'source' ? [] : [selected(1)]);
        assert.deepEqual(rule.inRoles, []);
        assert.deepEqual(rule.outRoles, []);
        assert.equal(rule.options, 6);
        assert.equal(rule.action, 'deny');
        assert.equal(rule.negate, original.rules[0].negate);
        assert.deepEqual(getProvisionInterfaceAddressReferenceErrors(provision), []);
        assert.deepEqual(
          validateReplicationProfilePayload({
            targetKind: 'firewall',
            model: { [field]: original },
          }),
          [],
        );
      });
    }
  }

  for (const family of [4, 6] as const) {
    for (const direction of ['none', 'in', 'out', 'both']) {
      it(`IPv${family}: resolves both address objects independently from ${direction} explicit interfaces`, async () => {
        const provision = parse(
          structure(family, {
            source: [selected(0, family)],
            destination: [selected(1, family)],
            ...(direction === 'in' || direction === 'both' ? { inRole: 'lan' } : {}),
            ...(direction === 'out' || direction === 'both' ? { outRole: 'wan' } : {}),
          }),
        );
        const resolver = new ObjectBindingResolver(1, false);
        resolver.registerInterfaceAddress(
          'wan',
          0,
          { id: 501, created: false, name: 'same' },
          family,
        );
        resolver.registerInterfaceAddress(
          'wan',
          1,
          { id: 502, created: false, name: 'same' },
          family,
        );
        // A different interface reuses the same index and name, but never the binding.
        resolver.registerInterfaceAddress(
          'lan',
          0,
          { id: 999, created: false, name: 'same' },
          family,
        );
        const service: any = Object.create(PolicyReplicationService.prototype);
        const acceptedTypes: number[] = [];
        service.acceptsObjectType = async (_target: unknown, type: number) => {
          acceptedTypes.push(type);
          return true;
        };
        const result = createPolicyReplicationResult('dry_run');
        const rule = provision.rules[0];
        const positions = getProvisionRulePositions(family, 'forward');
        const roleIds = new Map([
          ['wan', 201],
          ['lan', 202],
        ]);
        const before = roundTrip(rule);
        const interfaces = service.resolveProvisionRuleInterfaces(
          rule,
          0,
          roleIds,
          positions,
          result,
        );
        const sides = await service.resolveProvisionRuleObjects(
          rule,
          0,
          positions,
          roleIds,
          new Map(),
          resolver,
          result,
          undefined,
        );
        assert.deepEqual(result.errors, []);
        assert.deepEqual(sides.source, [{ ipobjId: 501 }]);
        assert.deepEqual(sides.destination, [{ ipobjId: 502 }]);
        assert.deepEqual(acceptedTypes, [5, 5]);
        assert.deepEqual(interfaces, {
          inIds: direction === 'in' || direction === 'both' ? [202] : [],
          outIds: direction === 'out' || direction === 'both' ? [201] : [],
        });
        assert.deepEqual(roundTrip(rule), before);
      });
    }
  }

  const invalid = [
    { interfaceRole: undefined },
    { interfaceAddressIndex: undefined },
    { interfaceAddressIndex: -1 },
    { interfaceAddressIndex: 0.5 },
    { interfaceAddressIndex: '0' },
    { interfaceAddressIndex: 2 },
    { interfaceRole: 'missing' },
    { value: '192.0.2.99/24' },
    { value: undefined },
    { kind: 'interfaceRole', role: 'wan' },
    { kind: 'std', id: 17 },
    { kind: 'external', referenceId: 'ip' },
    { kind: 'vpnClient', vpnId: 'client' },
    { kind: undefined },
  ];
  for (const replacement of invalid) {
    it(`rejects an invalid or stale interface IP selector: ${JSON.stringify(replacement)}`, async () => {
      const data = structure(4, { source: [{ ...selected(0), ...replacement }] });
      const provision = parse(roundTrip(data));
      assert.equal(
        provision.rules[0].source.length,
        1,
        'never silently drop the original reference',
      );
      assert.deepEqual(provision.rules[0].inRoles, []);
      assert.equal(getProvisionInterfaceAddressReferenceErrors(provision).length, 1);
      const errors = validateReplicationProfilePayload({
        targetKind: 'firewall',
        model: { provision: data },
      });
      assert.ok(errors.some((error) => error.code === 'invalid_interface_address_reference'));
      const service: any = Object.create(PolicyReplicationService.prototype);
      service.resolveProvisionTargetFirewallId = async () => {
        assert.fail('invalid selectors must fail before any database lookup or write');
      };
      const result = await service.provisionPolicyFromProfile(
        { kind: 'firewall', id: 1 },
        provision,
        1,
      );
      assert.equal(result.errors.length, 1);
      assert.deepEqual(result.createdRules, []);
    });
  }

  it('rejects an invalid editor representation even when provision is correct', () => {
    const good = structure(4, { source: [selected(0)] });
    const bad = structure(4, { source: [{ ...selected(0), interfaceAddressIndex: 9 }] });
    const errors = validateReplicationProfilePayload({
      targetKind: 'firewall',
      model: { provision: good, policyStructure: bad },
    });
    assert.ok(
      errors.some(
        (error) =>
          error.code === 'invalid_interface_address_reference' &&
          error.path === 'model.policyStructure.rules[0].source[0]',
      ),
    );
  });

  it('reports a controlled error when an IP family is incompatible with its rule', () => {
    const data = structure(6, { source: [selected(0, 6)] });
    data.rules[0].ipVersion = 4;
    const errors = getProvisionInterfaceAddressReferenceErrors(parse(data));
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /not an IPv4 address/);
  });

  for (const binding of ['missing', 'wrong-family']) {
    it(`does not fall back to an interface or literal when the IP binding is ${binding}`, async () => {
      const resolver = new ObjectBindingResolver(1, false);
      if (binding === 'wrong-family') {
        resolver.registerInterfaceAddress('wan', 0, { id: 501, created: false, name: 'ip' }, 6);
      }
      const service: any = Object.create(PolicyReplicationService.prototype);
      service.resolveLiteralObject = async () =>
        assert.fail('must never resolve a literal fallback');
      const result = createPolicyReplicationResult('dry_run');
      const refs = await service.resolveProvisionObjects(
        [selected(0)],
        { label: 'Rule 1 (source)', ipVersion: 4 },
        new Map([['wan', 201]]),
        new Map(),
        resolver,
        result,
      );
      assert.equal(refs, null);
      assert.equal(result.errors.length, 1);
      assert.match(result.errors[0], binding === 'missing' ? /could not be resolved/ : /IPv4/);
    });
  }

  it('uses declaration identity when parameters and names are shared by multiple addresses', () => {
    const data = structure(4, {
      source: [{ ...selected(0), value: { param: 'IP' } }],
      destination: [{ ...selected(1), value: { param: 'IP' } }],
    });
    data.interfaces[0].addresses.forEach((address: any) => (address.value = { param: 'IP' }));
    const provision = parse(data);
    assert.deepEqual(getProvisionInterfaceAddressReferenceErrors(provision), []);
    const resolver = new ObjectBindingResolver(1, false);
    for (const index of [0, 1]) {
      const binding = { id: index + 501, created: false, name: 'same' };
      resolver.registerInterfaceAddress('wan', index, binding, 4);
      resolver.registerParameterAddress('IP', `wan:${index}`, binding, 4);
    }
    assert.equal(resolver.resolveParameterAddress('IP', 'same'), null);
    assert.equal(resolver.resolveInterfaceAddress('wan', 0)!.id, 501);
    assert.equal(resolver.resolveInterfaceAddress('wan', 1)!.id, 502);
  });

  it('allows selected address overrides while rejecting a stale parameter selector', () => {
    const data = structure(4, { source: [{ ...selected(0), value: { param: 'IP' } }] });
    data.interfaces[0].addresses[0].value = { param: 'IP' };
    const provision = parse(data);
    provision.interfaces[0].addresses[0] = {
      ...provision.interfaces[0].addresses[0],
      value: '198.51.100.99/24',
      name: 'Selected by operator',
      sourceParameter: 'IP',
      useSelectedConfiguration: true,
    };
    assert.deepEqual(getProvisionInterfaceAddressReferenceErrors(provision), []);
    provision.rules[0].source[0].value = { param: 'OTHER_IP' };
    assert.match(
      getProvisionInterfaceAddressReferenceErrors(provision)[0].message,
      /does not match/,
    );
  });

  it('keeps legacy correctly represented interface address sets and In/Out shorthand compatible', () => {
    const provision = parse({
      rules: [
        { source: [{ kind: 'interfaceRole', role: 'wan' }] },
        { source: 'wan', destination: [{ type: 'interface', value: 'lan' }] },
      ],
    });
    assert.deepEqual(provision.rules[0].source, [{ kind: 'interfaceRole', role: 'wan' }]);
    assert.deepEqual(provision.rules[0].inRoles, []);
    assert.deepEqual(provision.rules[1].source, []);
    assert.deepEqual(provision.rules[1].destination, []);
    assert.deepEqual(provision.rules[1].inRoles, ['wan']);
    assert.deepEqual(provision.rules[1].outRoles, ['lan']);
    assert.deepEqual(getProvisionInterfaceAddressReferenceErrors(provision), []);
  });
});
