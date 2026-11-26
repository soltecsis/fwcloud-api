import ipaddr from 'ipaddr.js';
import { IpUtils } from '../../../utils/ip-utils';

const fwcError = require('../../../utils/error_table');

export interface OpenVPNServerNetwork {
  type: number;
  address: string | null;
  netmask: string | null;
}

export interface OpenVPNConfigOption {
  name: string;
  arg?: string | null;
  scope?: number | null;
  ipobj?: number | null;
}

export function getOpenVPNServerDevice(options: OpenVPNConfigOption[]): string {
  let dev: string;
  let devType: string;
  for (const option of options) {
    if (option.scope === 0) continue;
    if (option.name === 'dev-type') devType = option.arg;
    if (option.name === 'dev') dev = option.arg;
  }
  return devType || (dev?.startsWith('tap') ? 'tap' : 'tun');
}

export function validateOpenVPNServerNetwork(
  { type, address, netmask }: OpenVPNServerNetwork,
  device = 'tun',
): string {
  const combination = `OpenVPN server network ${JSON.stringify(address)} with netmask ${JSON.stringify(netmask)}`;
  if (type !== 7 || !address || !ipaddr.IPv4.isValidFourPartDecimal(address)) {
    throw fwcError.other(`${combination} must reference an IPv4 network object.`);
  }

  let prefix: number | null = null;
  if (netmask && /^\/(0|[1-9][0-9]?)$/.test(netmask)) {
    prefix = Number(netmask.slice(1));
  } else if (netmask && ipaddr.IPv4.isValidFourPartDecimal(netmask)) {
    prefix = ipaddr.IPv4.parse(netmask).prefixLengthFromSubnetMask();
  }
  if (prefix === null || prefix > 32) {
    throw fwcError.other(`${combination} has an invalid IPv4 subnet mask.`);
  }

  const maxPrefix = device === 'tap' ? 30 : 29;
  if (prefix < 16 || prefix > maxPrefix) {
    throw fwcError.other(`${combination} must use a prefix from /16 to /${maxPrefix}.`);
  }

  const subnetMask = ipaddr.IPv4.subnetMaskFromPrefixLength(prefix).toString();
  const addressNumber = IpUtils.toLong(address);
  const networkNumber = (addressNumber & IpUtils.toLong(subnetMask)) >>> 0;
  if (addressNumber !== networkNumber) {
    const expectedAddress = IpUtils.fromLong(networkNumber);
    throw fwcError.other(
      `${combination} has host bits set. Expected network address ${expectedAddress}.`,
    );
  }
  return subnetMask;
}
