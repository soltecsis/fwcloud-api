import * as ipaddr from 'ipaddr.js';

/** VPN template contract v1. Kept identical in the API and UI for save/edit validation. */
export interface ProfileVpnValidationIssue {
  code: string;
  path: string;
}
type RecordValue = Record<string, unknown>;

/**
 * VPN options that carry a secret (keys, pre-shared keys, passwords). A template only keeps
 * definitions, never key material, so these are refused wherever they appear.
 */
const SECRET_VPN_OPTION_MARKERS = [
  '<<',
  'psk',
  'privatekey',
  'presharedkey',
  'password',
  'passwd',
  'secret',
  'askpass',
  'auth-user-pass',
  'tls-auth',
  'tls-crypt',
  'pkcs12',
];
export function isSecretVpnOptionName(name: string): boolean {
  const normalized = name.toLowerCase();
  return SECRET_VPN_OPTION_MARKERS.some((marker) => normalized.includes(marker));
}

/** A template text: at most 255 characters, without line breaks, NUL or PEM blocks; `required` also rejects a blank one. */
export function isValidVpnText(value: unknown, required = false): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 255 &&
    (!required || !!value.trim()) &&
    !/-----BEGIN|[\r\n\x00]/.test(value)
  );
}

const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** An endpoint host: an IP address or a DNS name. */
export function isValidVpnHost(host: string): boolean {
  return ipaddr.isValid(host) || HOSTNAME_PATTERN.test(host);
}

export function validateProfileVpnTemplate(value: unknown): ProfileVpnValidationIssue[] {
  const errors: ProfileVpnValidationIssue[] = [];
  const fail = (code: string, path: string) => errors.push({ code, path });
  const record = (v: unknown): v is RecordValue =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  const fields = (v: RecordValue, allowed: string[], path: string) => {
    for (const key of Object.keys(v)) {
      if (!allowed.includes(key)) {
        fail('unsupported_field', `${path}.${key}`);
      }
    }
  };
  const text = (v: unknown, path: string, required = true) => {
    if (!isValidVpnText(v, required)) {
      fail('invalid_text', path);
    }
  };
  const integer = (v: unknown, max: number, path: string, min = 1) => {
    if (!Number.isInteger(v) || (v as number) < min || (v as number) > max) {
      fail('invalid_number', path);
    }
  };
  const choice = (v: unknown, values: unknown[], path: string) => {
    if (!values.includes(v)) {
      fail('invalid_choice', path);
    }
  };
  const root = 'model.vpnTemplate';
  if (!record(value)) {
    fail('invalid_structure', root);
    return errors;
  }
  fields(value, ['version', 'cas', 'certificates', 'connections'], root);
  if (value.version !== 1) {
    fail('invalid_version', `${root}.version`);
  }
  const ids = new Set<string>();
  const list = (key: string): RecordValue[] => {
    const path = `${root}.${key}`;
    const items = value[key];
    if (!Array.isArray(items) || items.length > 500) {
      fail('invalid_list', path);
      return [];
    }
    return items.flatMap((item, i) => {
      if (!record(item)) {
        fail('invalid_structure', `${path}[${i}]`);
        return [];
      }
      text(item.id, `${path}[${i}].id`);
      text(item.name, `${path}[${i}].name`);
      if (typeof item.id === 'string') {
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(item.id) || ids.has(item.id)) {
          fail('invalid_id', `${path}[${i}].id`);
        }
        ids.add(item.id);
      }
      return [item];
    });
  };
  const cas = list('cas');
  const certificates = list('certificates');
  const connections = list('connections');
  // Preserve the first match, including when validating duplicate or missing IDs.
  const indexById = (items: RecordValue[]): Map<unknown, RecordValue> => {
    const index = new Map<unknown, RecordValue>();
    for (const item of items) {
      if (!Number.isNaN(item.id) && !index.has(item.id)) index.set(item.id, item);
    }
    return index;
  };
  const casById = indexById(cas);
  const certificatesById = indexById(certificates);
  const connectionsById = indexById(connections);
  cas.forEach((ca, i) => {
    const path = `${root}.cas[${i}]`;
    fields(ca, ['id', 'name', 'commonName', 'validityDays', 'keyAlgorithm'], path);
    text(ca.commonName, `${path}.commonName`, false);
    integer(ca.validityDays, 36500, `${path}.validityDays`);
    choice(ca.keyAlgorithm, ['rsa2048', 'rsa4096', 'ec256'], `${path}.keyAlgorithm`);
  });
  certificates.forEach((cert, i) => {
    const path = `${root}.certificates[${i}]`;
    fields(cert, ['id', 'name', 'caId', 'kind', 'commonName', 'validityDays'], path);
    text(cert.commonName, `${path}.commonName`, false);
    integer(cert.validityDays, 36500, `${path}.validityDays`);
    choice(cert.kind, ['server', 'client'], `${path}.kind`);
    const ca = casById.get(cert.caId);
    if (!ca) {
      fail('missing_ca', `${path}.caId`);
    } else if (Number(cert.validityDays) > Number(ca.validityDays)) {
      fail('certificate_lifetime', `${path}.validityDays`);
    }
  });
  connections.forEach((vpn, i) => {
    const path = `${root}.connections[${i}]`;
    fields(
      vpn,
      [
        'id',
        'name',
        'kind',
        'role',
        'certificateId',
        'serverId',
        'endpoint',
        'port',
        'network',
        'localNetwork',
        'remoteNetwork',
        'transport',
        'device',
        'options',
      ],
      path,
    );
    choice(vpn.kind, ['openvpn', 'wireguard', 'ipsec'], `${path}.kind`);
    choice(vpn.role, ['server', 'client'], `${path}.role`);
    choice(vpn.transport, ['udp', 'tcp'], `${path}.transport`);
    choice(vpn.device, ['tun', 'tap'], `${path}.device`);
    integer(vpn.port, 65535, `${path}.port`);
    text(vpn.endpoint, `${path}.endpoint`, false);
    if (typeof vpn.endpoint === 'string' && vpn.endpoint && !isValidVpnHost(vpn.endpoint)) {
      fail('invalid_endpoint', `${path}.endpoint`);
    }
    for (const key of ['network', 'localNetwork', 'remoteNetwork']) {
      text(vpn[key], `${path}.${key}`, false);
      if (typeof vpn[key] === 'string' && vpn[key]) {
        try {
          ipaddr.parseCIDR(vpn[key]);
        } catch {
          fail('invalid_network', `${path}.${key}`);
        }
      }
    }
    if (vpn.options !== undefined) {
      const optionsPath = `${path}.options`;
      if (!Array.isArray(vpn.options) || vpn.options.length > 300) {
        fail('invalid_list', optionsPath);
      } else {
        vpn.options.forEach((option: unknown, j: number) => {
          const optionPath = `${optionsPath}[${j}]`;
          if (!record(option)) {
            fail('invalid_structure', optionPath);
            return;
          }
          fields(option, ['name', 'arg', 'scope', 'comment', 'param', 'interfaceRole'], optionPath);
          text(option.name, `${optionPath}.name`);
          text(option.arg, `${optionPath}.arg`, false);
          if (option.comment !== undefined) {
            text(option.comment, `${optionPath}.comment`, false);
          }
          if (option.param !== undefined) {
            text(option.param, `${optionPath}.param`);
          }
          if (option.interfaceRole !== undefined) {
            text(option.interfaceRole, `${optionPath}.interfaceRole`);
          }
          integer(option.scope, 9, `${optionPath}.scope`, 0);
          if (typeof option.name === 'string' && isSecretVpnOptionName(option.name)) {
            fail('secret_option', `${optionPath}.name`);
          }
        });
      }
    }
    const cert = certificatesById.get(vpn.certificateId);
    // WireGuard's keys do not come from a certificate, so declaring one is optional there: without
    // it, applying the profile creates a technical one.
    const optionalCertificate = vpn.kind === 'wireguard' && vpn.certificateId === undefined;
    if (!optionalCertificate && (!cert || cert.kind !== vpn.role)) {
      fail('invalid_certificate', `${path}.certificateId`);
    }
    if (vpn.serverId !== undefined) {
      const server = connectionsById.get(vpn.serverId);
      if (
        vpn.role !== 'client' ||
        !server ||
        server.role !== 'server' ||
        server.kind !== vpn.kind ||
        server.id === vpn.id
      ) {
        fail('invalid_server', `${path}.serverId`);
      } else {
        const serverCert = certificatesById.get(server.certificateId);
        if (cert && serverCert && cert.caId !== serverCert.caId) {
          fail('ca_mismatch', `${path}.certificateId`);
        }
      }
    }
  });
  return errors;
}
