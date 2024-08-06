const ipaddr = require('ipaddr.js');

const toBuffer = function (ip: string, buff?: Buffer, offset: number = 0): Buffer {
  const address = ipaddr.parse(ip);
  const bytes = address.toByteArray();
  const result = buff || Buffer.alloc(offset + bytes.length);

  for (let i = 0; i < bytes.length; i++) {
    result[offset + i] = bytes[i];
  }

  return result;
};

export const fromPrefixLen = function (prefixlen: number, family?: string): string {
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
};

const mask = function (addr: string, mask: string): string {
  const address = ipaddr.parse(addr);
  const netmask = ipaddr.parse(mask);

  if (address.kind() !== netmask.kind()) {
    throw new Error('Address and mask must be of the same kind.');
  }

  const addressBytes = address.toByteArray();
  const maskBytes = netmask.toByteArray();
  const resultBytes = new Array(addressBytes.length);

  for (let i = 0; i < addressBytes.length; i++) {
    resultBytes[i] = addressBytes[i] & maskBytes[i];
  }

  const resultAddress = ipaddr.fromByteArray(resultBytes);
  return resultAddress.toString();
};

export const subnet = function (addr: string, maskStr: string) {
  console.log('entro por subnet');
  const networkAddress = toLong(mask(addr, maskStr));

  const maskBuffer = toBuffer(maskStr);
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
    networkAddress: fromLong(networkAddress),
    firstAddress: numberOfAddresses <= 2 ? fromLong(networkAddress) : fromLong(networkAddress + 1),
    lastAddress:
      numberOfAddresses <= 2
        ? fromLong(networkAddress + numberOfAddresses - 1)
        : fromLong(networkAddress + numberOfAddresses - 2),
    broadcastAddress: fromLong(networkAddress + numberOfAddresses - 1),
    subnetMask: maskStr,
    subnetMaskLength: maskLength,
    numHosts: numberOfAddresses <= 2 ? numberOfAddresses : numberOfAddresses - 2,
    length: numberOfAddresses,
    contains(other: string) {
      return networkAddress === toLong(mask(other, maskStr));
    },
  };
};

export const cidrSubnet = function (cidrString: string) {
  console.log('entro por cirdSubnet');
  const cidrParts = cidrString.split('/');

  const addr = cidrParts[0];
  if (cidrParts.length !== 2) {
    throw new Error(`invalid CIDR subnet: ${addr}`);
  }

  const mask = fromPrefixLen(parseInt(cidrParts[1], 10));
  console.log('mask', mask);
  return subnet(addr, mask);
};

export const toLong = function (ip: string): number {
  let ipl = 0;
  ip.split('.').forEach((octet) => {
    ipl <<= 8;
    ipl += parseInt(octet, 10);
  });
  return ipl >>> 0;
};

export const fromLong = function (ipl: number): string {
  return `${ipl >>> 24}.${(ipl >> 16) & 255}.${(ipl >> 8) & 255}.${ipl & 255}`;
};
