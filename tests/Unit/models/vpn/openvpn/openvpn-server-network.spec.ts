import assert from 'node:assert/strict';
import {
  getOpenVPNServerDevice,
  validateOpenVPNServerNetwork,
} from '../../../../../src/models/vpn/openvpn/openvpn-server-network';

describe('OpenVPN server network validation', () => {
  const network = (address: string, netmask: string) => ({ type: 7, address, netmask });

  for (const [address, prefix, mask] of [
    ['10.99.219.0', '/24', '255.255.255.0'],
    ['10.99.219.0', '/25', '255.255.255.128'],
    ['10.99.219.128', '/25', '255.255.255.128'],
  ]) {
    it(`accepts ${address}${prefix} and its dotted mask`, () => {
      assert.equal(validateOpenVPNServerNetwork(network(address, prefix)), mask);
      assert.equal(validateOpenVPNServerNetwork(network(address, mask)), mask);
    });
  }

  for (const [address, prefix, mask] of [
    ['10.99.219.1', '/24', '255.255.255.0'],
    ['10.99.219.1', '/25', '255.255.255.128'],
    ['10.99.219.64', '/25', '255.255.255.128'],
  ]) {
    it(`rejects host bits in ${address}${prefix} and its dotted equivalent`, () => {
      for (const netmask of [prefix, mask]) {
        assert.throws(
          () => validateOpenVPNServerNetwork(network(address, netmask)),
          (error: { msg: string }) => {
            assert.ok(error.msg.includes(address));
            assert.ok(error.msg.includes(netmask));
            assert.ok(error.msg.includes('10.99.219.0'));
            return true;
          },
        );
      }
    });
  }

  for (const mask of ['/24x', '/33', '255.255.256.0', '255.255.127.0', '255.0.255.0']) {
    it(`rejects the invalid mask ${mask}`, () => {
      assert.throws(() => validateOpenVPNServerNetwork(network('10.99.219.0', mask)));
    });
  }

  it('keeps IPv4 network calculations unsigned', () => {
    assert.equal(validateOpenVPNServerNetwork(network('192.168.10.128', '/25')), '255.255.255.128');
    assert.throws(
      () => validateOpenVPNServerNetwork(network('192.168.10.129', '/25')),
      (error: { msg: string }) => error.msg.includes('Expected network address 192.168.10.128.'),
    );
  });

  it('applies the OpenVPN TUN and TAP prefix limits', () => {
    assert.equal(validateOpenVPNServerNetwork(network('10.99.0.0', '/16')), '255.255.0.0');
    assert.equal(validateOpenVPNServerNetwork(network('10.99.219.0', '/29')), '255.255.255.248');
    assert.throws(() => validateOpenVPNServerNetwork(network('10.98.0.0', '/15')));
    assert.throws(() => validateOpenVPNServerNetwork(network('10.99.219.0', '/30')));
    assert.equal(
      validateOpenVPNServerNetwork(network('10.99.219.0', '/30'), 'tap'),
      '255.255.255.252',
    );
    assert.throws(() => validateOpenVPNServerNetwork(network('10.99.219.0', '/31'), 'tap'));
  });

  it('uses dev-type when present and ignores options scoped to the client config directory', () => {
    assert.equal(getOpenVPNServerDevice([{ name: 'dev', arg: 'tap99', scope: 1 }]), 'tap');
    assert.equal(
      getOpenVPNServerDevice([
        { name: 'dev', arg: 'tap99', scope: 1 },
        { name: 'dev-type', arg: 'tun', scope: 1 },
      ]),
      'tun',
    );
    assert.equal(getOpenVPNServerDevice([{ name: 'dev', arg: 'tap99', scope: 0 }]), 'tun');
  });

  it('requires a network object with an IPv4 address', () => {
    assert.throws(() =>
      validateOpenVPNServerNetwork({ type: 5, address: '10.99.219.0', netmask: '/24' }),
    );
    assert.throws(() => validateOpenVPNServerNetwork(network('2001:db8::', '/24')));
    assert.throws(() => validateOpenVPNServerNetwork(network('10.99.219.256', '/24')));
    assert.throws(() => validateOpenVPNServerNetwork(network(null, '/24')));
    assert.throws(() => validateOpenVPNServerNetwork(network('10.99.219.0', null)));
  });
});
