import { strict as assert } from 'node:assert';
import { validateProfileVpnTemplate } from '../../../../src/models/replication-profile/replication-profile-vpn.validation';
import { validateReplicationProfilePayload } from '../../../../src/models/replication-profile/replication-profile-validation.service';
import { getProfileProvisioning } from '../../../../src/models/replication-profile/policy-replication.types';

function design() {
  const connection = (
    id: string,
    kind: string,
    role: string,
    certificateId?: string,
    serverId?: string,
  ) => ({
    id,
    name: id,
    kind,
    role,
    ...(certificateId ? { certificateId } : {}),
    ...(serverId ? { serverId } : {}),
    endpoint: '',
    port: 1194,
    network: '',
    localNetwork: '',
    remoteNetwork: '',
    transport: 'udp',
    device: 'tun',
  });
  return {
    version: 1,
    cas: [{ id: 'ca', name: 'CA', commonName: '', validityDays: 3650, keyAlgorithm: 'rsa4096' }],
    certificates: [
      {
        id: 'server_cert',
        name: 'Server',
        kind: 'server',
        caId: 'ca',
        commonName: '',
        validityDays: 365,
      },
      {
        id: 'client_cert',
        name: 'Client',
        kind: 'client',
        caId: 'ca',
        commonName: '',
        validityDays: 365,
      },
    ],
    connections: [
      connection('ovpn_server', 'openvpn', 'server', 'server_cert'),
      connection('ovpn_client', 'openvpn', 'client', 'client_cert', 'ovpn_server'),
      connection('wg_server', 'wireguard', 'server'),
      connection('wg_client', 'wireguard', 'client', undefined, 'wg_server'),
      connection('ipsec_server', 'ipsec', 'server', 'server_cert'),
      connection('ipsec_client', 'ipsec', 'client', 'client_cert', 'ipsec_server'),
    ],
  };
}

function payload(vpnTemplate: unknown) {
  return {
    targetKind: 'firewall',
    model: { provision: { interfaces: [], rules: [] }, vpnTemplate },
  };
}

describe('VPN template contract', () => {
  it('accepts a reusable PKI and three VPN types without generating runtime provisioning', () => {
    const profile = payload(design());
    assert.deepEqual(validateReplicationProfilePayload(profile), []);
    assert.deepEqual(
      getProfileProvisioning(profile.model),
      getProfileProvisioning({ provision: profile.model.provision }),
    );
    assert.equal(getProfileProvisioning({ vpnTemplate: design() }), null);
  });

  it('enforces reference, role and CA integrity at the API boundary', () => {
    const cases: Array<[(vpn: ReturnType<typeof design>) => void, string]> = [
      [
        (vpn) => {
          vpn.certificates[0].caId = 'missing';
        },
        'missing_ca',
      ],
      [
        (vpn) => {
          vpn.connections[0].certificateId = 'client_cert';
        },
        'invalid_certificate',
      ],
      [
        (vpn) => {
          vpn.connections[1].serverId = 'wg_server';
        },
        'invalid_server',
      ],
      [
        (vpn) => {
          vpn.connections[0].serverId = 'ovpn_client';
        },
        'invalid_server',
      ],
      [
        (vpn) => {
          vpn.cas.push({ ...vpn.cas[0], id: 'other' });
          vpn.certificates[1].caId = 'other';
        },
        'ca_mismatch',
      ],
      [
        (vpn) => {
          vpn.connections[2].certificateId = 'server_cert';
        },
        'wireguard_certificate',
      ],
      [
        (vpn) => {
          vpn.certificates[0].validityDays = 4000;
        },
        'certificate_lifetime',
      ],
    ];
    for (const [mutate, code] of cases) {
      const vpn = design();
      mutate(vpn);
      assert.ok(
        validateReplicationProfilePayload(payload(vpn)).some(
          (error) => error.code === `vpn_${code}`,
        ),
        code,
      );
    }
  });

  it('rejects cryptographic material and raw configuration even when generic secret validation is disabled', () => {
    for (const fields of [
      { privateKey: 'sensitive' },
      { certificatePem: 'PEM' },
      { config: 'raw config' },
    ]) {
      const vpn = design();
      Object.assign(vpn.connections[0], fields);
      assert.ok(
        validateReplicationProfilePayload(payload(vpn), { validateSecrets: false }).some(
          (error) => error.code === 'vpn_unsupported_field',
        ),
      );
    }
    const vpn = design();
    vpn.cas[0].commonName = '-----BEGIN PRIVATE KEY-----';
    assert.ok(validateProfileVpnTemplate(vpn).some((error) => error.code === 'invalid_text'));
  });

  it('rejects malformed collections, unsupported versions and duplicate template identifiers', () => {
    for (const value of [
      null,
      [],
      { ...design(), version: 2 },
      { ...design(), cas: null },
      { ...design(), certificates: [null] },
      { ...design(), connections: Array(501).fill({}) },
    ]) {
      assert.ok(validateProfileVpnTemplate(value).length);
    }
    const vpn = design();
    vpn.connections[0].id = 'ca';
    assert.ok(validateProfileVpnTemplate(vpn).some((error) => error.code === 'invalid_id'));
  });

  it('validates suggested network, endpoint and port values while allowing unbound template values', () => {
    const vpn = design();
    vpn.connections[0].network = '2001:db8::/64';
    vpn.connections[0].endpoint = 'vpn.example.com';
    assert.deepEqual(validateProfileVpnTemplate(vpn), []);
    vpn.connections[0].network = '10.0.0.0/99';
    vpn.connections[0].endpoint = 'https://vpn.example.com';
    vpn.connections[0].port = 0;
    const codes = validateProfileVpnTemplate(vpn).map((error) => error.code);
    for (const code of ['invalid_network', 'invalid_endpoint', 'invalid_number']) {
      assert.ok(codes.includes(code));
    }
  });

  it('resolves duplicate IDs to the first declaration without changing validation error order', () => {
    const vpn = design();
    vpn.cas.push({ ...vpn.cas[0], validityDays: 1 });
    vpn.certificates.push({ ...vpn.certificates[0], kind: 'client', caId: 'missing' });
    vpn.connections.push({ ...vpn.connections[0], kind: 'ipsec' });

    assert.deepEqual(validateProfileVpnTemplate(vpn), [
      { code: 'invalid_id', path: 'model.vpnTemplate.cas[1].id' },
      { code: 'invalid_id', path: 'model.vpnTemplate.certificates[2].id' },
      { code: 'invalid_id', path: 'model.vpnTemplate.connections[6].id' },
      { code: 'missing_ca', path: 'model.vpnTemplate.certificates[2].caId' },
    ]);
  });
});
