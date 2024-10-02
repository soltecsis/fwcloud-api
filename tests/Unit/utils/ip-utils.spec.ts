import { describeName, expect } from '../../mocha/global-setup';
import { IpUtils } from '../../../src/utils/ip-utils';

describe(describeName('IpUtils Unit Tests'), () => {
  describe('toBuffer()', () => {
    it('should return the correct buffer for a valid IPv4 address', () => {
      const result = IpUtils.toBuffer('192.168.1.1');
      expect(result).to.be.instanceOf(Buffer);
      expect(result.toString('hex')).to.equal('c0a80101');
    });

    it('should return the correct buffer for a valid IPv6 address', () => {
      const result = IpUtils.toBuffer('2001:db8::1');
      expect(result).to.be.instanceOf(Buffer);
      expect(result.toString('hex')).to.equal('20010db8000000000000000000000001');
    });

    it('should return the correct buffer with offset', () => {
      const result = IpUtils.toBuffer('192.168.1.1', undefined, 2);
      expect(result).to.be.instanceOf(Buffer);
      expect(result.toString('hex')).to.equal('0000c0a80101');
    });

    it('should fill the provided buffer correctly', () => {
      const buffer = Buffer.alloc(6);
      const result = IpUtils.toBuffer('192.168.1.1', buffer, 2);
      expect(result).to.equal(buffer);
      expect(result.toString('hex')).to.equal('0000c0a80101');
    });

    it('should throw an error for an invalid IP address', () => {
      expect(() => IpUtils.toBuffer('invalid_ip')).to.throw(
        'ipaddr: the address has neither IPv6 nor IPv4 format',
      );
    });
  });

  describe('fromPrefixLen()', () => {
    it('should return the correct IPv4 address for a given prefix length', () => {
      expect(IpUtils.fromPrefixLen(24)).to.equal('255.255.255.0');
      expect(IpUtils.fromPrefixLen(16)).to.equal('255.255.0.0');
      expect(IpUtils.fromPrefixLen(8)).to.equal('255.0.0.0');
    });

    it('should return the correct IPv6 address for a given prefix length', () => {
      expect(IpUtils.fromPrefixLen(64, 'ipv6')).to.equal('ffff:ffff:ffff:ffff::');
      expect(IpUtils.fromPrefixLen(32, 'ipv6')).to.equal('ffff:ffff::');
      expect(IpUtils.fromPrefixLen(128, 'ipv6')).to.equal(
        'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
      );
    });

    it('should default to IPv4 when the prefix length is 32 or less and no family is specified', () => {
      expect(IpUtils.fromPrefixLen(32)).to.equal('255.255.255.255');
      expect(IpUtils.fromPrefixLen(24)).to.equal('255.255.255.0');
    });

    it('should default to IPv6 when the prefix length is greater than 32 and no family is specified', () => {
      expect(IpUtils.fromPrefixLen(64)).to.equal('ffff:ffff:ffff:ffff::');
      expect(IpUtils.fromPrefixLen(128)).to.equal('ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff');
    });

    it('should throw an error for invalid prefix lengths', () => {
      expect(() => IpUtils.fromPrefixLen(-1)).to.throw('ipaddr: Invalid prefix');
      expect(() => IpUtils.fromPrefixLen(129)).to.throw('ipaddr: Invalid prefix');
    });

    it('should throw and error for invalid prefix lengths when the family is specified', () => {
      expect(() => IpUtils.fromPrefixLen(35, 'ipv4')).to.throw('ipaddr: Invalid prefix');
    });

    it('should throw an error for non-numeric prefix lengths', () => {
      expect(() => IpUtils.fromPrefixLen(NaN)).to.throw('ipaddr: Invalid prefix');
    });
  });

  describe('mask()', () => {
    it('should return the correct masked IPv4 address', () => {
      const result = IpUtils.mask('192.168.1.1', '255.255.255.0');
      expect(result).to.equal('192.168.1.0');
    });

    it('should return the correct masked IPv4 address with all zeros mask', () => {
      const result = IpUtils.mask('192.168.1.1', '0.0.0.0');
      expect(result).to.equal('0.0.0.0');
    });

    it('should return the correct masked IPv4 address with all ones mask', () => {
      const result = IpUtils.mask('192.168.1.1', '255.255.255.255');
      expect(result).to.equal('192.168.1.1');
    });

    it('should return the correct masked IPv6 address', () => {
      const result = IpUtils.mask('2001:db8::1', 'ffff:ffff:ffff:ffff::');
      expect(result).to.equal('2001:db8::');
    });

    it('should return the correct masked IPv6 address with all zeros mask', () => {
      const result = IpUtils.mask('2001:db8::1', '::');
      expect(result).to.equal('::');
    });

    it('should return the correct masked IPv6 address with all ones mask', () => {
      const result = IpUtils.mask('2001:db8::1', 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff');
      expect(result).to.equal('2001:db8::1');
    });

    it('should throw an error for an invalid address', () => {
      expect(() => IpUtils.mask('', '255.255.255.0')).to.throw(
        'ipaddr: the address has neither IPv6 nor IPv4 format',
      );
      expect(() => IpUtils.mask('', 'ffff:ffff:ffff:ffff::')).to.throw(
        'ipaddr: the address has neither IPv6 nor IPv4 format',
      );
    });

    it('should throw an error for an invalid mask', () => {
      expect(() => IpUtils.mask('192.168.1.1', '')).to.throw(
        'ipaddr: the address has neither IPv6 nor IPv4 format',
      );
      expect(() => IpUtils.mask('2001:db8::1', '')).to.throw(
        'ipaddr: the address has neither IPv6 nor IPv4 format',
      );
    });

    it('should throw an error when address and mask are of different kinds', () => {
      expect(() => IpUtils.mask('192.168.1.1', 'ffff:ffff:ffff:ffff::')).to.throw(
        'ipaddr: address and mask must be of the same kind',
      );
      expect(() => IpUtils.mask('2001:db8::1', '255.255.255.0')).to.throw(
        'ipaddr: address and mask must be of the same kind',
      );
    });
  });

  describe('subnet()', () => {
    it('should return correct subnet details for a given IPv4 address and mask', () => {
      const result = IpUtils.subnet('192.168.1.1', '255.255.255.0');
      expect(result.networkAddress).to.equal('192.168.1.0');
      expect(result.firstAddress).to.equal('192.168.1.1');
      expect(result.lastAddress).to.equal('192.168.1.254');
      expect(result.broadcastAddress).to.equal('192.168.1.255');
      expect(result.subnetMask).to.equal('255.255.255.0');
      expect(result.subnetMaskLength).to.equal(24);
      expect(result.numHosts).to.equal(254);
      expect(result.length).to.equal(256);
    });

    it('should return correct subnet details for a given IPv6 address and mask', () => {
      const result = IpUtils.subnet('2001:db8::1', 'ffff:ffff:ffff:ffff::');
      expect(result.networkAddress).to.equal('0.0.7.209');
      expect(result.firstAddress).to.equal('0.0.7.209');
      expect(result.lastAddress).to.equal('0.0.7.208');
      expect(result.broadcastAddress).to.equal('0.0.7.208');
      expect(result.subnetMask).to.equal('ffff:ffff:ffff:ffff::');
      expect(result.subnetMaskLength).to.equal(64);
      expect(result.numHosts).to.equal(2.3283064365386963e-10);
      expect(result.length).to.equal(2.3283064365386963e-10);
    });

    it('should handle subnets with only one address', () => {
      const result = IpUtils.subnet('192.168.1.1', '255.255.255.255');
      expect(result.networkAddress).to.equal('192.168.1.1');
      expect(result.firstAddress).to.equal('192.168.1.1');
      expect(result.lastAddress).to.equal('192.168.1.1');
      expect(result.broadcastAddress).to.equal('192.168.1.1');
      expect(result.subnetMask).to.equal('255.255.255.255');
      expect(result.subnetMaskLength).to.equal(32);
      expect(result.numHosts).to.equal(1);
      expect(result.length).to.equal(1);
    });

    it('should handle subnets with two addresses', () => {
      const result = IpUtils.subnet('192.168.1.0', '255.255.255.254');
      expect(result.networkAddress).to.equal('192.168.1.0');
      expect(result.firstAddress).to.equal('192.168.1.0');
      expect(result.lastAddress).to.equal('192.168.1.1');
      expect(result.broadcastAddress).to.equal('192.168.1.1');
      expect(result.subnetMask).to.equal('255.255.255.254');
      expect(result.subnetMaskLength).to.equal(31);
      expect(result.numHosts).to.equal(2);
      expect(result.length).to.equal(2);
    });

    it('should correctly determine if an IP is within the subnet', () => {
      const subnet = IpUtils.subnet('192.168.1.1', '255.255.255.0');
      expect(subnet.contains('192.168.1.50')).to.be.true;
      expect(subnet.contains('192.168.2.1')).to.be.false;
    });

    it('should throw an error for an invalid address', () => {
      expect(() => IpUtils.subnet('', '255.255.255.0')).to.throw('ipaddr: invalid address or mask');
      expect(() => IpUtils.subnet('', 'ffff:ffff:ffff:ffff::')).to.throw(
        'ipaddr: invalid address or mask',
      );
    });

    it('should throw an error if the mask is no-numeric', () => {
      expect(() => IpUtils.subnet('192.168.1.1', 'abc')).to.throw(
        'ipaddr: invalid address or mask',
      );
      expect(() => IpUtils.subnet('2001:db8::1', 'abc')).to.throw(
        'ipaddr: invalid address or mask',
      );
    });

    it('should throw an error for an invalid mask', () => {
      expect(() => IpUtils.subnet('192.168.1.1', '')).to.throw('ipaddr: invalid address or mask');
      expect(() => IpUtils.subnet('2001:db8::1', '')).to.throw('ipaddr: invalid address or mask');
    });

    it('should throw an error for address and mask of different kinds', () => {
      expect(() => IpUtils.subnet('192.168.1.1', 'ffff:ffff:ffff:ffff::')).to.throw(
        'ipaddr: address and mask must be of the same kind',
      );
      expect(() => IpUtils.subnet('2001:db8::1', '225.255.255.0')).to.throw(
        'ipaddr: address and mask must be of the same kind',
      );
    });
  });

  describe('cidrSubnet()', () => {
    it('should return correct subnet details for a valid IPv4 CIDR string', () => {
      const result = IpUtils.cidrSubnet('192.168.1.1/24');
      expect(result.networkAddress).to.equal('192.168.1.0');
      expect(result.firstAddress).to.equal('192.168.1.1');
      expect(result.lastAddress).to.equal('192.168.1.254');
      expect(result.broadcastAddress).to.equal('192.168.1.255');
      expect(result.subnetMask).to.equal('255.255.255.0');
      expect(result.subnetMaskLength).to.equal(24);
      expect(result.numHosts).to.equal(254);
      expect(result.length).to.equal(256);
    });

    it('should return correct subnet details for a valid IPv6 CIDR string', () => {
      const result = IpUtils.cidrSubnet('2001:db8::1/64');
      expect(result.networkAddress).to.equal('0.0.7.209');
      expect(result.firstAddress).to.equal('0.0.7.209');
      expect(result.lastAddress).to.equal('0.0.7.208');
      expect(result.broadcastAddress).to.equal('0.0.7.208');
      expect(result.subnetMask).to.equal('ffff:ffff:ffff:ffff::');
      expect(result.subnetMaskLength).to.equal(64);
      expect(result.numHosts).to.equal(2.3283064365386963e-10);
      expect(result.length).to.equal(2.3283064365386963e-10);
    });

    it('should throw an error for an invalid CIDR string without a prefix length', () => {
      expect(() => IpUtils.cidrSubnet('192.168.1.1')).to.throw('ipaddr: invalid CIDR subnet');
      expect(() => IpUtils.cidrSubnet('2001:db8::1')).to.throw('ipaddr: invalid CIDR subnet');
    });

    it('should throw an error for an invalid CIDR string with an invalid prefix length', () => {
      expect(() => IpUtils.cidrSubnet('192.168.1.1/33')).to.throw('ipaddr: invalid CIDR subnet');
      expect(() => IpUtils.cidrSubnet('2001:db8::1/129')).to.throw('ipaddr: invalid CIDR subnet');
    });

    it('should throw an error for an invalid CIDR string with non-numeric prefix', () => {
      expect(() => IpUtils.cidrSubnet('192.168.1.1/abc')).to.throw('ipaddr: invalid CIDR subnet');
      expect(() => IpUtils.cidrSubnet('2001:db8::1/abc')).to.throw('ipaddr: invalid CIDR subnet');
    });

    it('should throw an error for undefined prefix', () => {
      expect(() => IpUtils.cidrSubnet('192.168.1.1/')).to.throw('ipaddr: invalid CIDR subnet');
      expect(() => IpUtils.cidrSubnet('2001:db8::1/')).to.throw('ipaddr: invalid CIDR subnet');
    });

    it('should throw an error for address and mask of different kinds', () => {
      expect(() => IpUtils.cidrSubnet('192.168.1.1/ffff:ffff:ffff:ffff::')).to.throw(
        'ipaddr: invalid CIDR subnet',
      );
      expect(() => IpUtils.cidrSubnet('2001:db8::1/255.255.255.0')).to.throw(
        'ipaddr: invalid CIDR subnet',
      );
    });
  });

  describe('toLong()', () => {
    it('should return the correct long integer for a valid IPv4 address', () => {
      expect(IpUtils.toLong('192.168.1.1')).to.equal(3232235777);
      expect(IpUtils.toLong('10.0.0.1')).to.equal(167772161);
      expect(IpUtils.toLong('172.16.0.1')).to.equal(2886729729);
    });

    it('should return the correct long integer for edge case IPv4 addresses', () => {
      expect(IpUtils.toLong('0.0.0.0')).to.equal(0);
      expect(IpUtils.toLong('255.255.255.255')).to.equal(4294967295);
    });

    it('should throw an error for invalid IPv4 addresses', () => {
      expect(() => IpUtils.toLong('999.999.999.999')).to.throw('ipaddr: invalid IP address');
      expect(() => IpUtils.toLong('abc.def.ghi.jkl')).to.throw('ipaddr: invalid IP address');
    });
  });

  describe('fromLong()', () => {
    it('should return the correct IPv4 address for a given long integer', () => {
      expect(IpUtils.fromLong(3232235777)).to.equal('192.168.1.1');
      expect(IpUtils.fromLong(167772160)).to.equal('10.0.0.0');
      expect(IpUtils.fromLong(4294967295)).to.equal('255.255.255.255');
    });

    it('should return the correct IPv4 address for the minimum long integer', () => {
      expect(IpUtils.fromLong(0)).to.equal('0.0.0.0');
    });

    it('should handle edge cases correctly', () => {
      expect(IpUtils.fromLong(1)).to.equal('0.0.0.1');
      expect(IpUtils.fromLong(256)).to.equal('0.0.1.0');
      expect(IpUtils.fromLong(65536)).to.equal('0.1.0.0');
      expect(IpUtils.fromLong(16777216)).to.equal('1.0.0.0');
    });

    it('should throw an error for invalid long integers', () => {
      expect(() => IpUtils.fromLong(-1)).to.throw('ipaddr: invalid integer');
      expect(() => IpUtils.fromLong(4294967296)).to.throw('ipaddr: invalid integer');
    });
  });
});
