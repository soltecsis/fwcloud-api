import * as ipaddr from 'ipaddr.js';
import type {
  ProfileVpnConnectionTemplate,
  ProfileVpnOptionTemplate,
} from './profile-vpn-config-provisioning.service';
import type {
  ProfileVpnCaTemplate,
  ProfileVpnCertificateTemplate,
} from './profile-vpn-pki-provisioning.service';
import { dbQuery, sqlPlaceholders } from './replication-sql.helpers';
import {
  isSecretVpnOptionName,
  isValidVpnHost,
  isValidVpnText,
} from './replication-profile-vpn.validation';

type VpnProtocol = ProfileVpnConnectionTemplate['kind'];
type VpnRole = ProfileVpnConnectionTemplate['role'];

export interface SnapshotVpnTemplate {
  version: 1;
  cas: Array<ProfileVpnCaTemplate & { keyAlgorithm: 'rsa2048' }>;
  certificates: ProfileVpnCertificateTemplate[];
  connections: ProfileVpnConnectionTemplate[];
}

interface VpnRow {
  id: number;
  parentId: number | null;
  installName: string | null;
  certificateId: number | null;
  certificateName: string | null;
  certificateType: number | null;
  certificateDays: number | null;
  caId: number | null;
  caName: string | null;
  caDays: number | null;
}

interface VpnOptionRow {
  owner: number;
  peerId: number | null;
  name: string;
  arg: string | null;
  scope: number;
  comment: string | null;
  ipobj: number | null;
  objectName: string | null;
  objectType: number | null;
  address: string | null;
  netmask: string | null;
}

/** Where each protocol keeps a connection's settings. */
interface ProtocolSettings {
  /** Scopes of the connection's own options (a server's peer options are left out). */
  scopes: Record<VpnRole, number[]>;
  endpointOption: string;
  portOption: string;
  defaultPort: number;
  /** Options holding the tunnel address or network, the first one set wins. */
  networkOptions: Record<VpnRole, string[]>;
  localNetworkOption?: string;
  remoteNetworkOption?: string;
}

const PROTOCOL_SETTINGS: Record<VpnProtocol, ProtocolSettings> = {
  openvpn: {
    scopes: { server: [0, 1], client: [0, 1] },
    endpointOption: 'remote',
    portOption: 'port',
    defaultPort: 1194,
    networkOptions: { server: ['server'], client: ['ifconfig-push'] },
  },
  wireguard: {
    scopes: { server: [2], client: [4, 5] },
    endpointOption: 'Endpoint',
    portOption: 'ListenPort',
    defaultPort: 51820,
    networkOptions: { server: ['<<vpn_network>>', 'Address'], client: ['Address'] },
    remoteNetworkOption: 'AllowedIPs',
  },
  ipsec: {
    scopes: { server: [6], client: [7] },
    endpointOption: 'right',
    portOption: 'port',
    defaultPort: 500,
    networkOptions: { server: [], client: ['leftsourceip'] },
    localNetworkOption: 'leftsubnet',
    remoteNetworkOption: 'rightsubnet',
  },
};

const PROTOCOLS = Object.keys(PROTOCOL_SETTINGS) as VpnProtocol[];
const PKI_OPTIONS = new Set(['ca', 'cert', 'key', 'dh', 'extra-certs', 'crl-verify']);
const DISABLE_OPTION = '<<disable>>';

/**
 * Capture VPN definitions, including the clients owned by the source's servers.
 * Only PKI metadata is read: applying the template generates new certificates
 * and keys, never reuses the source firewall's private material.
 *
 * `clients` holds the captured clients by `<protocol>:<source id>`, the key
 * policy rules reference them by.
 */
export async function captureVpnSnapshot(
  firewallId: number,
  fwCloudId: number,
  warnings: string[],
): Promise<{
  vpnTemplate?: SnapshotVpnTemplate;
  clients: Map<string, ProfileVpnConnectionTemplate>;
}> {
  const template: SnapshotVpnTemplate = {
    version: 1,
    cas: [],
    certificates: [],
    connections: [],
  };
  const captured = new Map<string, ProfileVpnConnectionTemplate>();
  const capturedCas = new Set<number>();
  const capturedCertificates = new Set<number>();
  const usedConnectionNames = new Set<string>();

  for (const protocol of PROTOCOLS) {
    // The protocol names are fixed identifiers, never caller-provided SQL.
    const rows = await dbQuery<VpnRow>(
      `SELECT VPN.id, VPN.${protocol} AS parentId, VPN.install_name AS installName,
              CRT.id AS certificateId, CRT.cn AS certificateName,
              CRT.type AS certificateType, CRT.days AS certificateDays,
              CA.id AS caId, CA.cn AS caName, CA.days AS caDays
       FROM ${protocol} VPN
       LEFT JOIN crt CRT ON CRT.id = VPN.crt
       LEFT JOIN ca CA ON CA.id = CRT.ca AND CA.fwcloud = ?
       WHERE VPN.firewall = ? OR VPN.${protocol} IN
         (SELECT SOURCE.id FROM ${protocol} SOURCE WHERE SOURCE.firewall = ?)
       ORDER BY VPN.id`,
      [fwCloudId, firewallId, firewallId],
    );
    if (!rows.length) continue;

    const options = await dbQuery<VpnOptionRow>(
      `SELECT OPT.${protocol} AS owner,
              ${protocol === 'openvpn' ? 'NULL' : `OPT.${protocol}_cli`} AS peerId,
              OPT.name, OPT.arg, OPT.scope, OPT.comment,
              OPT.ipobj, O.name AS objectName, O.type AS objectType, O.address, O.netmask
       FROM ${protocol}_opt OPT
       LEFT JOIN ipobj O ON O.id = OPT.ipobj AND (O.fwcloud = ? OR O.fwcloud IS NULL)
       WHERE OPT.${protocol} IN (${sqlPlaceholders(rows.length)})
       ORDER BY OPT.${protocol}, OPT.\`order\`, OPT.id`,
      [fwCloudId, ...rows.map((row) => row.id)],
    );
    const byOwner = new Map<number, VpnOptionRow[]>();
    for (const option of options) {
      const list = byOwner.get(Number(option.owner)) ?? [];
      list.push(option);
      byOwner.set(Number(option.owner), list);
    }
    // Disabled by its own option or, for a client, by the peer option its server keeps for it.
    const disabled = new Set(
      options
        .filter((option) => option.name === DISABLE_OPTION)
        .map((option) => Number(option.peerId || option.owner)),
    );

    // Parents must already be captured before accepting any client reference.
    const ordered = [...rows].sort((a, b) => Number(!!a.parentId) - Number(!!b.parentId));
    for (const row of ordered) {
      const sourceOptions = byOwner.get(Number(row.id)) ?? [];
      const baseName =
        safeText(row.certificateName) || safeText(row.installName) || `${protocol} ${row.id}`;
      let name = baseName;
      let suffix = 2;
      while (usedConnectionNames.has(name.toLowerCase())) {
        name = `${baseName.slice(0, 225)} (${protocol} ${suffix++})`;
      }
      const label = `${protocol.toUpperCase()} connection "${name}"`;
      const skip = (reason: string) => warnings.push(`${label} was not captured: ${reason}`);
      const role: VpnRole = row.parentId || Number(row.certificateType) === 1 ? 'client' : 'server';
      const server = row.parentId ? captured.get(`${protocol}:${row.parentId}`) : undefined;

      if (disabled.has(Number(row.id))) {
        skip('the connection is disabled.');
        continue;
      }
      if (protocol === 'ipsec' && !row.certificateId) {
        skip('an external IPsec client requires a pre-shared key that a template cannot store.');
        continue;
      }
      if (role === 'client' && !server) {
        skip('its server is outside the captured VPN template.');
        continue;
      }
      if (row.certificateId && !row.caId) {
        skip('its certificate authority is not available in the source FWCloud.');
        continue;
      }
      if (!row.certificateId && protocol !== 'wireguard') {
        skip('its certificate is not available.');
        continue;
      }

      const serverCertificate = template.certificates.find(
        (item) => item.id === server?.certificateId,
      );
      if (serverCertificate && row.caId && serverCertificate.caId !== `ca_${row.caId}`) {
        skip('its certificate authority differs from its server.');
        continue;
      }

      const connection = captureConnection(protocol, row, role, name, sourceOptions, warnings);
      if (server) {
        connection.serverId = server.id;
        // Server endpoints are normally recorded on their clients, not the server row.
        if (!server.endpoint && connection.endpoint) server.endpoint = connection.endpoint;
        const hasClientPort = sourceOptions.some((option) => {
          if (option.name === 'port' || option.name === 'ListenPort') {
            return !!validPort(Number(option.arg));
          }
          return (
            ['remote', 'Endpoint'].includes(option.name) &&
            !!parseEndpoint(optionArgument(protocol, option), protocol).port
          );
        });
        if (!hasClientPort) connection.port = server.port;
      }

      if (row.certificateId && row.caId) {
        const caId = Number(row.caId);
        const certificateId = Number(row.certificateId);
        const validityDays = lifetime(row.caDays);
        if (!capturedCas.has(caId)) {
          template.cas.push({
            id: `ca_${caId}`,
            name: safeText(row.caName) || `CA ${caId}`,
            commonName: safeText(row.caName),
            validityDays,
            keyAlgorithm: 'rsa2048',
          });
          capturedCas.add(caId);
        }
        if (!capturedCertificates.has(certificateId)) {
          template.certificates.push({
            id: `crt_${certificateId}`,
            name: safeText(row.certificateName) || name,
            commonName: safeText(row.certificateName),
            caId: `ca_${caId}`,
            kind: role,
            validityDays: Math.min(lifetime(row.certificateDays), validityDays),
          });
          capturedCertificates.add(certificateId);
        }
        connection.certificateId = `crt_${certificateId}`;
      }

      template.connections.push(connection);
      usedConnectionNames.add(name.toLowerCase());
      captured.set(`${protocol}:${row.id}`, connection);
    }
  }

  return {
    ...(template.connections.length ? { vpnTemplate: template } : {}),
    clients: new Map([...captured].filter(([, connection]) => connection.role === 'client')),
  };
}

function captureConnection(
  kind: VpnProtocol,
  row: VpnRow,
  role: VpnRole,
  name: string,
  options: VpnOptionRow[],
  warnings: string[],
): ProfileVpnConnectionTemplate {
  const settings = PROTOCOL_SETTINGS[kind];
  const ownOptions = options.filter(
    (option) => !option.peerId && settings.scopes[role].includes(Number(option.scope)),
  );
  const option = (key: string | undefined) =>
    key === undefined ? undefined : ownOptions.find((item) => item.name === key);
  const arg = (key: string) => {
    const found = option(key);
    return found ? optionArgument(kind, found) : '';
  };
  const cidr = (key: string | undefined) => {
    const found = option(key);
    return found ? optionCidr(kind, found) : '';
  };
  const endpointParts = parseEndpoint(arg(settings.endpointOption), kind);
  const port =
    validPort(Number(arg(settings.portOption) || endpointParts.port)) || settings.defaultPort;
  const storedOptions: ProfileVpnOptionTemplate[] = [];
  const label = `${kind.toUpperCase()} connection "${name}"`;

  for (const source of ownOptions) {
    const normalizedName = String(source.name).toLowerCase();
    // Generated keys/certificates have their own lifecycle on the target.
    if (PKI_OPTIONS.has(normalizedName) || normalizedName === 'publickey') continue;
    if (normalizedName === '<<vpn_network>>') continue;
    if (isSecretVpnOptionName(normalizedName)) {
      warnings.push(
        `${label}: a credential-bearing option was not captured; configure fresh credentials on the target.`,
      );
      continue;
    }
    const value = optionArgument(kind, source);
    if (
      !isValidVpnText(source.name, true) ||
      !isValidVpnText(value) ||
      (source.ipobj && source.objectType === null)
    ) {
      warnings.push(
        `${label}: an option was not captured because its value cannot be represented by a VPN template.`,
      );
      continue;
    }
    storedOptions.push({
      name: source.name,
      arg: value,
      scope: Number(source.scope),
      ...(source.comment && isValidVpnText(source.comment) ? { comment: source.comment } : {}),
    });
  }

  const network = settings.networkOptions[role].map(cidr).find(Boolean) ?? '';
  const localNetwork = cidr(settings.localNetworkOption);
  const remoteNetwork = cidr(settings.remoteNetworkOption);
  if (!(kind === 'ipsec' && role === 'server' ? localNetwork : network)) {
    warnings.push(
      `${label}: its VPN address/network must be completed in the template before applying it.`,
    );
  }

  return {
    id: `${kind}_${row.id}`,
    name,
    kind,
    role,
    endpoint: endpointParts.host,
    port,
    network,
    localNetwork,
    remoteNetwork,
    transport: arg('proto').startsWith('tcp') ? 'tcp' : 'udp',
    device: arg('dev').startsWith('tap') ? 'tap' : 'tun',
    options: storedOptions,
  };
}

/** Resolve references the same way the protocol's generated configuration does. */
function optionArgument(protocol: VpnProtocol, option: VpnOptionRow): string {
  const raw = String(option.arg ?? '').trim();
  if (!option.ipobj || option.objectType === null) return raw;
  const host = Number(option.objectType) === 9 ? (option.objectName ?? '') : (option.address ?? '');
  if (!host) return raw;
  if (protocol === 'openvpn') {
    if (option.name === 'remote') {
      // An object-backed remote stores just the port in arg (legacy UI).
      const port = /^\d+(?:\s+(?:udp|tcp\S*))?$/.test(raw)
        ? raw
        : raw.split(/\s+/).slice(1).join(' ');
      return [host, port].filter(Boolean).join(' ');
    }
    if (Number(option.objectType) === 7 || option.name === 'ifconfig-push') {
      return [host, dottedMask(option.netmask)].filter(Boolean).join(' ');
    }
    return host;
  }
  // WireGuard/IPsec persist the complete rendered argument; ipobj is a link
  // for the tree. Keep lists and extra endpoint settings from that argument.
  if (raw) return raw;
  if (
    ['Address', 'AllowedIPs', '<<vpn_network>>', 'leftsubnet', 'rightsubnet'].includes(option.name)
  ) {
    return toCidr(host, option.netmask);
  }
  return host;
}

function optionCidr(protocol: VpnProtocol, option: VpnOptionRow): string {
  if (option.ipobj && option.address) return toCidr(option.address, option.netmask);
  const [address, mask] = optionArgument(protocol, option).trim().split(/\s+/);
  return toCidr(address, mask);
}

function toCidr(address: string, mask?: string | null): string {
  if (!address || address.includes(',')) return '';
  try {
    if (address.includes('/')) {
      const [ip, prefix] = ipaddr.parseCIDR(address);
      return `${ip.toString()}/${prefix}`;
    }
    const ip = ipaddr.parse(address);
    const prefix = mask?.startsWith('/')
      ? Number(mask.slice(1))
      : mask && /^\d+$/.test(mask)
        ? Number(mask)
        : mask
          ? ipaddr.IPv4.parse(mask).prefixLengthFromSubnetMask()
          : ip.kind() === 'ipv4'
            ? 32
            : 128;
    if (prefix === null) return '';
    ipaddr.parseCIDR(`${address}/${prefix}`);
    return `${ip.toString()}/${prefix}`;
  } catch {
    return '';
  }
}

function dottedMask(mask: string | null): string {
  if (!mask?.startsWith('/')) return mask ?? '';
  const prefix = Number(mask.slice(1));
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return '';
  return ipaddr.IPv4.subnetMaskFromPrefixLength(prefix).toString();
}

function parseEndpoint(value: string, protocol: VpnProtocol): { host: string; port?: number } {
  let host = value.trim();
  let port: number | undefined;
  if (protocol === 'openvpn') {
    const parts = host.split(/\s+/);
    host = parts[0];
    port = validPort(Number(parts[1]));
  } else if (protocol === 'wireguard') {
    const match = host.match(/^(?:\[([^\]]+)\]|([^:]+)):(\d+)$/);
    if (match) {
      host = match[1] || match[2];
      port = validPort(Number(match[3]));
    }
  }
  if (!isValidVpnText(host) || (host && !isValidVpnHost(host))) {
    host = '';
  }
  return { host, port };
}

function validPort(value: number): number | undefined {
  return Number.isInteger(value) && value > 0 && value <= 65535 ? value : undefined;
}

function lifetime(value: number | null): number {
  const days = Number(value);
  return Number.isInteger(days) && days > 0 ? Math.min(days, 36500) : 3650;
}

function safeText(value: string | null): string {
  return isValidVpnText(value) ? value.trim() : '';
}
