import ipaddr from 'ipaddr.js';

type FamilyType = 'ipv4' | 'ipv6';
export class IpUtils {
  public static toBuffer(ip: string, buff?: Buffer, offset: number = 0): Buffer {
    const address = ipaddr.parse(ip);
    const bytes = address.toByteArray();
    const result = buff || Buffer.alloc(offset + bytes.length);

    for (let i = 0; i < bytes.length; i++) {
      result[offset + i] = bytes[i];
    }

    return result;
  }

  public static fromPrefixLen(prefixlen: number, family?: FamilyType): string {
    if (
      isNaN(prefixlen) ||
      prefixlen < 1 ||
      prefixlen > 128 ||
      (family === 'ipv4' && prefixlen > 32)
    ) {
      throw new Error('ipaddr: Invalid prefix');
    }
    if (prefixlen > 32) {
      family = 'ipv6';
    } else {
      family = family || 'ipv4';
    }

    const len = family === 'ipv6' ? 16 : 4;
    const bytes = new Array(len).fill(0);

    for (let i = 0; i < len; i++) {
      if (prefixlen >= 8) {
        bytes[i] = 0xff;
        prefixlen -= 8;
      } else if (prefixlen > 0) {
        bytes[i] = ~(0xff >> prefixlen) & 0xff;
        prefixlen = 0;
      }
    }

    const address = ipaddr.fromByteArray(bytes);
    return address.toString();
  }

  public static mask(addr: string, mask: string): string {
    const address = ipaddr.parse(addr);
    const netmask = ipaddr.parse(mask);
    if (address.kind() !== netmask.kind()) {
      throw new Error('ipaddr: address and mask must be of the same kind');
    }

    const addressBytes = address.toByteArray();
    const maskBytes = netmask.toByteArray();
    const resultBytes = new Array(addressBytes.length);

    for (let i = 0; i < addressBytes.length; i++) {
      resultBytes[i] = addressBytes[i] & maskBytes[i];
    }

    const resultAddress = ipaddr.fromByteArray(resultBytes);
    return resultAddress.toString();
  }

  public static subnet(addr: string, maskStr: string) {
    if (!ipaddr.isValid(addr) || !ipaddr.isValid(maskStr)) {
      throw new Error('ipaddr: invalid address or mask');
    }
    const networkAddress = IpUtils.toLong(IpUtils.mask(addr, maskStr));
    const maskBuffer = IpUtils.toBuffer(maskStr);
    let maskLength = 0;

    for (let i = 0; i < maskBuffer.length; i++) {
      if (maskBuffer[i] === 0xff) {
        maskLength += 8;
      } else {
        let octet = maskBuffer[i] & 0xff;
        while (octet) {
          octet = (octet << 1) & 0xff;
          maskLength++;
        }
      }
    }

    const numberOfAddresses = 2 ** (32 - maskLength);

    return {
      networkAddress: IpUtils.fromLong(networkAddress),
      firstAddress:
        numberOfAddresses <= 2
          ? IpUtils.fromLong(networkAddress)
          : IpUtils.fromLong(networkAddress + 1),
      lastAddress:
        numberOfAddresses <= 2
          ? IpUtils.fromLong(networkAddress + numberOfAddresses - 1)
          : IpUtils.fromLong(networkAddress + numberOfAddresses - 2),
      broadcastAddress: IpUtils.fromLong(networkAddress + numberOfAddresses - 1),
      subnetMask: maskStr,
      subnetMaskLength: maskLength,
      numHosts: numberOfAddresses <= 2 ? numberOfAddresses : numberOfAddresses - 2,
      length: numberOfAddresses,
      contains(other: string) {
        return networkAddress === IpUtils.toLong(IpUtils.mask(other, maskStr));
      },
    };
  }

  public static cidrSubnet(cidrString: string) {
    if (!ipaddr.isValidCIDR(cidrString)) {
      throw new Error('ipaddr: invalid CIDR subnet');
    }
    const cidrParts = cidrString.split('/');

    const addr = cidrParts[0];

    const mask = IpUtils.fromPrefixLen(parseInt(cidrParts[1], 10));
    return IpUtils.subnet(addr, mask);
  }

  public static toLong(ip: string): number {
    if (!ipaddr.isValid(ip)) {
      throw new Error('ipaddr: invalid IP address');
    }
    let ipl = 0;
    ip.split('.').forEach((octet) => {
      ipl <<= 8;
      ipl += parseInt(octet, 10);
    });
    return ipl >>> 0;
  }

  public static fromLong(ipl: number): string {
    if (ipl < 0 || ipl > 4294967295) {
      throw new Error('ipaddr: invalid integer');
    }
    return [(ipl >>> 24) & 0xff, (ipl >>> 16) & 0xff, (ipl >>> 8) & 0xff, ipl & 0xff].join('.');
  }
}
