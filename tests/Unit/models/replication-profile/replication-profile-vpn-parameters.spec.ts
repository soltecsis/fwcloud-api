import { strict as assert } from 'node:assert';
import { normalizeProfileVpnRuleParameters } from '../../../../src/models/replication-profile/replication-profile-vpn-parameters';
import { getProfileProvisioning } from '../../../../src/models/replication-profile/policy-replication.types';
import { validateReplicationProfilePayload } from '../../../../src/models/replication-profile/replication-profile-validation.service';
import {
  getProfileParameters,
  resolveParameterValues,
} from '../../../../src/models/replication-profile/replication-profile-parameters';

function legacyModel(): any {
  return {
    vpnTemplate: {
      connections: [
        { id: 'openvpn_2', name: 'Cliente oficina', kind: 'openvpn', role: 'client' },
        { id: 'ipsec_2', name: 'ipsec_2', kind: 'ipsec', role: 'client' },
        { id: 'unused', name: 'Unused', kind: 'wireguard', role: 'client' },
      ],
    },
    provision: {
      interfaces: [],
      rules: [
        {
          action: 'accept',
          ipVersion: 4,
          source: [{ type: 'vpnClient', value: 'Cliente oficina' }],
        },
        { action: 'accept', ipVersion: 4, destination: [{ kind: 'network', value: 'ipsec_2' }] },
      ],
    },
  };
}

describe('VPN rule network parameters', () => {
  it('produces a valid profile definition that can be saved and applied', () => {
    const model = {
      vpnTemplate: {
        version: 1,
        cas: [],
        certificates: [],
        connections: [
          {
            id: 'wireguard_1',
            name: 'Cliente oficina',
            kind: 'wireguard',
            role: 'client',
            endpoint: '',
            port: 51820,
            network: '',
            localNetwork: '',
            remoteNetwork: '',
            transport: 'udp',
            device: 'tun',
          },
        ],
      },
      provision: {
        interfaces: [],
        rules: [{ action: 'accept', source: [{ type: 'vpnClient', value: 'Cliente oficina' }] }],
      },
    };
    const normalized = normalizeProfileVpnRuleParameters(model);
    // A WireGuard client needs both its own tunnel address and the AllowedIPs it will announce.
    assert.deepEqual(
      getProfileParameters(normalized).map((p) => p.name),
      ['vpn_wireguard_1_network', 'vpn_wireguard_1_remoteNetwork'],
    );
    assert.deepEqual(
      validateReplicationProfilePayload({ targetKind: 'firewall', model: normalized }),
      [],
    );
  });

  it('normalizes saved literal references, requires input, and resolves the supplied networks', () => {
    const stored = legacyModel();
    const before = JSON.stringify(stored);
    const normalized = normalizeProfileVpnRuleParameters(stored);
    assert.equal(JSON.stringify(stored), before);
    const parameters = getProfileParameters(normalized);
    // The unreferenced 'unused' WireGuard connection asks for nothing.
    assert.deepEqual(
      parameters.map((p) => p.name),
      ['vpn_openvpn_2_network', 'vpn_ipsec_2_network'],
    );
    assert.ok(parameters.every((p) => p.required && p.type === 'address' && p.ipVersion === 4));
    assert.throws(() => resolveParameterValues(parameters, {}), /required/);
    assert.deepEqual(
      resolveParameterValues(parameters, {
        vpn_openvpn_2_network: '10.8.0.0/24',
        vpn_ipsec_2_network: '192.168.50.0/24',
      }),
      new Map([
        ['vpn_openvpn_2_network', '10.8.0.0/24'],
        ['vpn_ipsec_2_network', '192.168.50.0/24'],
      ]),
    );
    // A VPN client rule reference carries no address of its own (unlike every other kind): it is a
    // direct reference to the connection's own id, resolved against its real, already-created config
    // by policy-replication.service.ts, not parsed here — see PolicyReplicationProvisionObject.vpnId.
    const provision = getProfileProvisioning(normalized)!;
    assert.deepEqual(provision.rules[0].source[0], {
      kind: 'vpnClient',
      vpnId: 'openvpn_2',
      name: 'Cliente oficina',
    });
    assert.deepEqual(provision.rules[1].destination[0], {
      kind: 'vpnClient',
      vpnId: 'ipsec_2',
      name: 'ipsec_2',
    });
    assert.deepEqual(normalizeProfileVpnRuleParameters(normalized), normalized);
  });

  it('does not request data for unused VPNs or reinterpret normal literal networks', () => {
    const model = legacyModel();
    model.provision.rules = [
      { action: 'accept', ipVersion: 4, source: [{ kind: 'network', value: '10.0.0.0/24' }] },
    ];
    const normalized = normalizeProfileVpnRuleParameters(model);
    assert.deepEqual(normalized.provision, model.provision);
    assert.deepEqual(normalized.vpnTemplate, model.vpnTemplate);
    assert.deepEqual(getProfileParameters(normalized), []);
  });

  it('shares one parameter across every rule that references the same connection', () => {
    const model = legacyModel();
    model.provision.rules.push({ ...model.provision.rules[0] });
    const normalized = normalizeProfileVpnRuleParameters(model);
    assert.deepEqual(
      getProfileParameters(normalized).map((p) => p.name),
      ['vpn_openvpn_2_network', 'vpn_ipsec_2_network'],
    );
    assert.equal(normalized.provision.rules[0].source[0].vpnId, 'openvpn_2');
    assert.equal(normalized.provision.rules[2].source[0].vpnId, 'openvpn_2');
  });

  it('reuses the generated parameter (and any edits made to it) on a later normalize', () => {
    const onceNormalized: any = normalizeProfileVpnRuleParameters(legacyModel());
    const parameter = onceNormalized.parameters.find(
      (p: any) => p.name === 'vpn_openvpn_2_network',
    );
    parameter.required = false;
    parameter.default = '10.9.0.0/24';
    const twiceNormalized = normalizeProfileVpnRuleParameters(onceNormalized);
    const reused = getProfileParameters(twiceNormalized).find(
      (p) => p.name === 'vpn_openvpn_2_network',
    )!;
    assert.equal(reused.required, false);
    assert.equal(reused.default, '10.9.0.0/24');
    assert.deepEqual(normalizeProfileVpnRuleParameters(twiceNormalized), twiceNormalized);
  });

  it('avoids collisions with existing user parameters of the same name', () => {
    const model = {
      ...legacyModel(),
      parameters: [{ name: 'vpn_openvpn_2_network', type: 'port', default: 443 }],
    };
    const normalized = normalizeProfileVpnRuleParameters(model);
    const parameters = getProfileParameters(normalized);
    assert.equal(parameters[0].type, 'port');
    assert.equal(parameters[1].name, 'vpn_openvpn_2_network_2');
    assert.equal(normalized.provision.rules[0].source[0].vpnId, 'openvpn_2');
    assert.deepEqual(normalizeProfileVpnRuleParameters(normalized), normalized);
  });
});
