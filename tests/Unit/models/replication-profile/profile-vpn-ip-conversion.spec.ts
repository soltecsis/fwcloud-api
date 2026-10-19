import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReplicationProfileApplyDto } from '../../../../src/controllers/replication-profile/dtos/replication-profile-apply.dto';
import { convertProfileVpnReferencesToIp } from '../../../../src/models/replication-profile/profile-vpn-ip-conversion';
import { normalizeProfileVpnRuleParameters } from '../../../../src/models/replication-profile/replication-profile-vpn-parameters';
import { getProfileProvisioning } from '../../../../src/models/replication-profile/policy-replication.types';

function template(protocol = 'openvpn'): any {
  return normalizeProfileVpnRuleParameters({
    vpnTemplate: {
      version: 1,
      cas: [],
      certificates: [],
      connections: [
        {
          id: 'office',
          name: 'VPN_OFFICE',
          kind: protocol,
          role: 'client',
          network: '192.0.2.10/32',
          remoteNetwork: '10.0.0.0/24',
        },
        {
          id: 'branch',
          name: 'VPN_BRANCH',
          kind: 'ipsec',
          role: 'client',
          network: '192.0.2.20/32',
        },
        { id: 'unused', name: 'VPN_UNUSED', kind: 'wireguard', role: 'client' },
      ],
    },
    provision: {
      interfaces: [],
      rules: [
        {
          chain: 'forward',
          ipVersion: 4,
          source: [{ kind: 'vpnClient', vpnId: 'office' }],
          destination: [{ kind: 'vpnClient', vpnId: 'branch' }],
        },
        {
          chain: 'snat',
          ipVersion: 4,
          source: [{ kind: 'vpnClient', vpnId: 'office' }],
          translatedSource: [{ kind: 'vpnClient', vpnId: 'branch' }],
        },
      ],
    },
  });
}

describe('VPN policy references converted to IP objects', () => {
  for (const protocol of ['openvpn', 'wireguard', 'ipsec']) {
    it(`converts ${protocol} clients in src/dst/NAT through the existing IP object representation`, () => {
      const model = template(protocol);
      const before = JSON.stringify(model);
      const converted = convertProfileVpnReferencesToIp(
        model,
        getProfileProvisioning(model),
        undefined,
      );
      assert.deepEqual(converted.errors, []);
      assert.deepEqual(
        converted.vpnConversions.map(({ vpnId, address }) => [vpnId, address]),
        [
          ['office', '192.0.2.10'],
          ['branch', '192.0.2.20'],
        ],
      );
      assert.equal(converted.provision!.rules[0].source[0].kind, 'address');
      assert.equal(converted.provision!.rules[0].source[0].name, 'VPN_OFFICE');
      assert.equal(converted.provision!.rules[0].destination[0].kind, 'address');
      assert.equal(converted.provision!.rules[1].translatedSource[0].kind, 'address');
      assert.equal(JSON.stringify(model), before, 'the saved VPN identity must remain untouched');
    });
  }

  it('uses deployment parameters instead of guessing an address from the VPN endpoint', () => {
    const model = template();
    const result = convertProfileVpnReferencesToIp(model, getProfileProvisioning(model), {
      [model.vpnRuntime.office.network.param]: '203.0.113.77/24',
    });
    assert.equal(result.vpnConversions[0].address, '203.0.113.77');
    assert.deepEqual(result.errors, []);
  });

  for (const raw of [
    '',
    'not-an-ip',
    '999.1.1.1',
    '192.0.2.1/33',
    '192.0.2.1/24/garbage',
    '2001:db8::1/64',
  ]) {
    it(`rejects missing, malformed or wrong-family conversion data: ${JSON.stringify(raw)}`, () => {
      const model = template();
      const result = convertProfileVpnReferencesToIp(model, getProfileProvisioning(model), {
        [model.vpnRuntime.office.network.param]: raw,
      });
      assert.ok(result.errors.length);
      assert.ok(result.vpnConversions.find((entry) => entry.vpnId === 'office')!.error);
      assert.equal(result.provision!.rules[0].source[0].kind, 'vpnClient');
    });
  }

  it('rejects a missing original VPN instead of binding another VPN with the same name', () => {
    const model = template();
    model.provision.rules[0].source[0] = {
      kind: 'vpnClient',
      vpnId: 'deleted',
      name: 'VPN_OFFICE',
    };
    const result = convertProfileVpnReferencesToIp(model, getProfileProvisioning(model), undefined);
    assert.ok(result.vpnConversions.find((entry) => entry.vpnId === 'deleted')!.error);
  });

  it('keeps malformed references blocking even if the provisioning parser would drop them', () => {
    const model = template();
    model.provision.rules[0].source.push({ kind: 'vpnClient', name: 'Broken VPN' });
    const result = convertProfileVpnReferencesToIp(model, getProfileProvisioning(model), undefined);
    assert.ok(result.errors.some((error) => error.includes('Broken VPN')));
  });

  it('preserves explicit ids through normalization even when two clients have the same name', () => {
    const model = template();
    model.vpnTemplate.connections[1].name = 'VPN_OFFICE';
    const normalized = normalizeProfileVpnRuleParameters(model);
    assert.equal(normalized.provision.rules[0].destination[0].vpnId, 'branch');
    const result = convertProfileVpnReferencesToIp(
      normalized,
      getProfileProvisioning(normalized),
      undefined,
    );
    assert.equal(
      result.vpnConversions.find((entry) => entry.vpnId === 'branch')!.address,
      '192.0.2.20',
    );
  });

  it('uses the selected interface IP override when the VPN binds to the same parameter', () => {
    const model = template();
    model.provision.interfaces = [{ name: 'wan', role: 'wan', addresses: [] }];
    const provision = getProfileProvisioning(model)!;
    provision.interfaces[0].addresses = [
      {
        name: 'Selected IP',
        value: '198.51.100.99/24',
        sourceParameter: model.vpnRuntime.office.network.param,
        useSelectedConfiguration: true,
      },
    ];
    const result = convertProfileVpnReferencesToIp(model, provision, undefined);
    assert.equal(result.vpnConversions[0].address, '198.51.100.99');
    assert.equal(result.provision!.interfaces[0].addresses[0].name, 'Selected IP');
  });

  it('supports IPv6 with the backend address parser and the rule family', () => {
    const model = template();
    for (const rule of model.provision.rules) rule.ipVersion = 6;
    const result = convertProfileVpnReferencesToIp(model, getProfileProvisioning(model), {
      [model.vpnRuntime.office.network.param]: '2001:db8::10/128',
      [model.vpnRuntime.branch.network.param]: '2001:db8::20/128',
    });
    assert.deepEqual(result.errors, []);
    assert.equal(result.vpnConversions[0].ipVersion, 6);
  });

  it('keeps the first matching client when duplicate ids also belong to servers or later clients', () => {
    const model = template();
    const first = model.vpnTemplate.connections[0];
    model.vpnTemplate.connections.unshift({ ...first, role: 'server', network: '203.0.113.1/32' });
    model.vpnTemplate.connections.push({ ...first, network: '203.0.113.2/32' });
    delete model.vpnRuntime.office;
    const result = convertProfileVpnReferencesToIp(model, getProfileProvisioning(model), undefined);
    assert.deepEqual(result.errors, []);
    assert.equal(result.vpnConversions[0].address, '192.0.2.10');
  });

  it('checks every rule family even when multiple rules reference the same VPN', () => {
    const model = template();
    model.provision.rules[1].ipVersion = 6;
    const result = convertProfileVpnReferencesToIp(model, getProfileProvisioning(model), undefined);
    assert.ok(
      result.vpnConversions.find((entry) => entry.vpnId === 'office')!.error!.includes('IPv6'),
    );
    assert.equal(result.provision!.rules[0].source[0].kind, 'vpnClient');
  });

  for (const conflicting of [false, true]) {
    it(`shared interface parameter overrides ${conflicting ? 'reject different destination IPs' : 'accept identical destination IPs'}`, () => {
      const model = template();
      const provision = getProfileProvisioning(model)!;
      provision.interfaces = ['wan', 'lan'].map((role, index) => ({
        name: role,
        role,
        addresses: [
          {
            value: conflicting && index === 1 ? '198.51.100.100/24' : '198.51.100.99/24',
            sourceParameter: model.vpnRuntime.office.network.param,
          },
        ],
      }));
      const result = convertProfileVpnReferencesToIp(model, provision, undefined);
      if (conflicting) {
        assert.ok(result.errors.some((error) => error.includes('multiple destination IP values')));
        assert.equal(result.provision!.rules[0].source[0].kind, 'vpnClient');
      } else {
        assert.deepEqual(result.errors, []);
        assert.equal(result.vpnConversions[0].address, '198.51.100.99');
      }
    });
  }

  it('leaves templates without VPN references unchanged', () => {
    const model = template();
    model.provision.rules = [
      { chain: 'forward', source: [{ kind: 'address', value: '203.0.113.1' }] },
    ];
    const provision = getProfileProvisioning(model);
    const result = convertProfileVpnReferencesToIp(model, provision, undefined);
    assert.deepEqual(result.provision, provision);
    assert.deepEqual(result.vpnConversions, []);
    assert.deepEqual(result.errors, []);
  });
});

describe('VPN conversion request validation', () => {
  for (const mode of ['dry_run', 'replace_defaults']) {
    it(`accepts the UI conversion flag in ${mode}`, async () => {
      const dto = plainToInstance(ReplicationProfileApplyDto, {
        target: { kind: 'firewall', id: 1 },
        mode,
        convertVpnReferencesToIp: true,
      });
      assert.deepEqual(await validate(dto, { whitelist: true, forbidNonWhitelisted: true }), []);
    });
  }
  it('rejects non-boolean conversion flags', async () => {
    const dto = plainToInstance(ReplicationProfileApplyDto, {
      target: { kind: 'firewall', id: 1 },
      mode: 'dry_run',
      convertVpnReferencesToIp: 'yes',
    });
    assert.ok((await validate(dto)).some((error) => error.property === 'convertVpnReferencesToIp'));
  });
});
