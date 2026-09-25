/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ProfileVpnRollback } from './profile-vpn-rollback';
import { OpenVPN } from '../vpn/openvpn/OpenVPN';
import { WireGuard } from '../vpn/wireguard/WireGuard';
import { IPSec } from '../vpn/ipsec/IPSec';
import { Crt } from '../vpn/pki/Crt';
import { IPSecPrefix } from '../vpn/ipsec/IPSecPrefix';
import { IpUtils } from '../../utils/ip-utils';
import { Interface } from '../interface/Interface';
import { IPObj } from '../ipobj/IPObj';
import { Tree } from '../tree/Tree';
import { queryRows } from './replication-sql.helpers';
import {
  dereferenceParameter,
  parseReplicationProfileAddress,
  parseReplicationProfileNetwork,
  ReplicationProfileParameterRef,
} from './replication-profile-parameters';
import {
  describeVpnProvisionError,
  ensureWireGuardTechnicalCertificate,
  ProvisionedVpnPki,
} from './profile-vpn-pki-provisioning.service';
import { ResolvedVpnConfig } from './replication-profile.constants';

/** Template-only shape; mirrors the UI's ProfileVpnConnection. */
export interface ProfileVpnConnectionTemplate {
  id: string;
  name: string;
  kind: 'openvpn' | 'wireguard' | 'ipsec';
  role: 'server' | 'client';
  certificateId?: string;
  serverId?: string;
  endpoint: string;
  port: number;
  network: string;
  localNetwork: string;
  remoteNetwork: string;
  transport: 'udp' | 'tcp';
  device: 'tun' | 'tap';
  /** The connection's options as the template editor's option grid left them. */
  options?: ProfileVpnOptionTemplate[];
}

export interface ProfileVpnOptionTemplate {
  name: string;
  arg: string;
  scope: number;
  comment?: string;
}

/** One entry per field `normalizeProfileVpnRuleParameters()` turned into an apply-time parameter. */
export type ProfileVpnRuntimeFields = Partial<
  Record<'network' | 'endpoint' | 'remoteNetwork' | 'localNetwork', ReplicationProfileParameterRef>
>;

/** Same fields, dereferenced against the apply-time parameter values supplied by the caller. */
export type ResolvedVpnConnectionValues = Partial<
  Record<'network' | 'endpoint' | 'remoteNetwork' | 'localNetwork', string>
>;

/** Looks up one of a connection's resolved runtime fields; every `provisionXxxServer/Client` takes one. */
type ResolveVpnField = (
  connectionId: string,
  field: keyof ProfileVpnRuntimeFields,
) => string | undefined;

/**
 * Dereferences every VPN connection's runtime fields (as built by
 * `normalizeProfileVpnRuleParameters()`, stored on `model.vpnRuntime`) against the resolved
 * apply-time parameter values. Kept separate from `provisionVpnTemplateConfigs()` so the caller can
 * resolve once and reuse the result (e.g. to report unresolved values before writing anything).
 */
export function resolveVpnConnectionValues(
  vpnRuntime: unknown,
  parameterValues: Map<string, unknown>,
): Record<string, ResolvedVpnConnectionValues> {
  const resolved: Record<string, ResolvedVpnConnectionValues> = {};

  if (!vpnRuntime || typeof vpnRuntime !== 'object') {
    return resolved;
  }

  for (const [connectionId, fields] of Object.entries(vpnRuntime as Record<string, unknown>)) {
    if (!fields || typeof fields !== 'object') continue;

    const entry: ResolvedVpnConnectionValues = {};
    for (const field of ['network', 'endpoint', 'remoteNetwork', 'localNetwork'] as const) {
      const ref = (fields as ProfileVpnRuntimeFields)[field];
      if (!ref) continue;

      const value = dereferenceParameter(ref, parameterValues);
      if (typeof value === 'string' && value.trim() !== '') {
        entry[field] = value.trim();
      }
    }
    resolved[connectionId] = entry;
  }

  return resolved;
}

/** A preview creates nothing, so the VPN config a real apply would create has no id yet. */
const PREVIEW_VPN_CONFIG_ID = 0;

const certificateNotCreated = (label: string, name: string): string =>
  `${label} "${name}": its certificate was not created, so it was skipped.`;
const endpointNotProvided = (label: string, name: string): string =>
  `${label} "${name}": the server's endpoint was not provided.`;

/** A client of an external server authenticates with a pre-shared key, which a template cannot carry. */
const isExternalIpsecClient = (connection: ProfileVpnConnectionTemplate): boolean =>
  connection.kind === 'ipsec' && connection.role === 'client' && !connection.serverId;

function externalIpsecClientError(connection: { name: string }): string {
  return `IPsec connection "${connection.name}": a client of an external server needs a pre-shared key, which a profile cannot carry.`;
}

/** What every `provisionXxxServer/Client`'s catch block reports when its own writes fail partway through. */
const provisionFailed = (label: string, name: string, error: unknown): string =>
  `${label} "${name}": ${describeVpnProvisionError(error)}`;

/**
 * What a real apply would be able to create, without creating it: a preview lets rules reference
 * those VPN clients (their real ids only exist once created) and reports what it would refuse,
 * so it never promises more than the apply can do. Mirrors provisionVpnTemplateConfigs()'s scope:
 * IPsec needs a server of the profile.
 */
export function previewVpnTemplateConfigs(connections: ProfileVpnConnectionTemplate[]): {
  vpnConfigIds: Map<string, ResolvedVpnConfig> | undefined;
  errors: string[];
} {
  const errors: string[] = [];

  if (connections.length === 0) {
    return { vpnConfigIds: undefined, errors };
  }

  const vpnConfigIds = new Map<string, ResolvedVpnConfig>();

  for (const connection of connections) {
    if (isExternalIpsecClient(connection)) {
      errors.push(externalIpsecClientError(connection));
      continue;
    }

    vpnConfigIds.set(connection.id, { id: PREVIEW_VPN_CONFIG_ID, protocol: connection.kind });
  }

  return { vpnConfigIds, errors };
}

const VPN_CONFIG_TABLE_BY_PROTOCOL: Record<ProfileVpnConnectionTemplate['kind'], string> = {
  openvpn: 'openvpn',
  wireguard: 'wireguard',
  ipsec: 'ipsec',
};

/**
 * Binds VPN configs the caller says already exist to the template's connections. The ids come
 * straight from the request, and a rule is later linked to them by id alone, so each one must be
 * a config of the target's VPN firewall (a cluster's master node) in this FWCloud: anything else
 * would let a rule reference a VPN of another firewall or another FWCloud.
 */
export async function resolveSuppliedVpnConfigs(
  dbCon: any,
  fwCloudId: number,
  firewallId: number | null,
  connections: ProfileVpnConnectionTemplate[],
  supplied: Record<string, number>,
): Promise<{ vpnConfigIds: Map<string, ResolvedVpnConfig>; errors: string[] }> {
  const vpnConfigIds = new Map<string, ResolvedVpnConfig>();
  const errors: string[] = [];
  const entries = Object.entries(supplied);

  if (entries.length === 0) {
    return { vpnConfigIds, errors };
  }

  if (firewallId === null) {
    errors.push('Existing VPN configurations need a target firewall or cluster to bind them to.');
    return { vpnConfigIds, errors };
  }

  // Independent reads (no shared rollback/ordering state, unlike the writes elsewhere in this
  // file), so they run concurrently; results are then applied in the original entries order, to
  // keep error/id ordering exactly what the sequential version produced.
  type Resolved =
    | { connectionId: string; error: string }
    | { connectionId: string; configId: number; protocol: ProfileVpnConnectionTemplate['kind'] };

  const results = await Promise.all<Resolved>(
    entries.map(async ([connectionId, configId]) => {
      const connection = connections.find((candidate) => candidate.id === connectionId);
      const table = connection ? VPN_CONFIG_TABLE_BY_PROTOCOL[connection.kind] : undefined;

      if (!connection || !table) {
        return {
          connectionId,
          error: `VPN connection "${connectionId}" is not defined by this profile.`,
        };
      }

      const owned = await queryRows(
        dbCon,
        `SELECT T.id FROM ${table} T INNER JOIN firewall F ON F.id = T.firewall WHERE T.id = ? AND F.id = ? AND F.fwcloud = ?`,
        [configId, firewallId, fwCloudId],
      );

      if (owned.length === 0) {
        return {
          connectionId,
          error: `VPN connection "${connectionId}": ${configId} is not a ${connection.kind} configuration of this firewall.`,
        };
      }

      return { connectionId, configId, protocol: connection.kind };
    }),
  );

  for (const result of results) {
    if ('error' in result) {
      errors.push(result.error);
    } else {
      vpnConfigIds.set(result.connectionId, { id: result.configId, protocol: result.protocol });
    }
  }

  return { vpnConfigIds, errors };
}

/**
 * Matches app-options.service.ts's `OptionScope` enum on the UI side. Kept as raw numbers (like the
 * rest of this legacy VPN model code) rather than imported, since the UI and API are separate
 * packages; keep these in sync if that enum ever changes.
 */
const enum OptionScope {
  ccd = 0,
  ovp = 1,
  wg_server_interface = 2,
  wg_server_peer = 3,
  wg_client_interface = 4,
  wg_client_peer = 5,
  ipsec_server = 6,
  ipsec_client = 7,
  ipsec_server_client = 8,
}

const OBJ_TYPE_ADDRESS = 5;
const OBJ_TYPE_NETWORK = 7;

interface VpnOpt {
  name: string;
  arg: string;
  scope: OptionScope;
  order: number;
  ipobj?: number | null;
  comment?: string;
}

/**
 * Options the apply works out itself from what it is given (addresses, certificates, the free
 * tunnel interface), so a template's stored value for them is only a preview and never wins.
 */
const DERIVED_OPTIONS = {
  openvpnServer: new Set(['server', 'dev']),
  openvpnClient: new Set(['remote', 'ifconfig-push']),
  wireguardServer: new Set(['PrivateKey', 'PublicKey', 'Address', '<<vpn_network>>']),
  wireguardClient: new Set(['PrivateKey', 'PublicKey', 'Address', 'Endpoint', 'AllowedIPs']),
  ipsecServer: new Set(['left', 'leftid', 'leftcert', 'leftsubnet', '<<psk>>']),
  ipsecClient: new Set([
    'leftid',
    'leftcert',
    'leftsourceip',
    'right',
    'rightid',
    'rightsubnet',
    '<<psk>>',
  ]),
} as const;

/**
 * Derived options the template editor lets the operator set instead (a client's Endpoint or remotes,
 * picked like in the real panels). Stored with a value only when set, and then those values win.
 */
const PICKABLE_OPTIONS = {
  openvpnClient: new Set(['remote']),
  wireguardClient: new Set(['Endpoint']),
} as const;

/** The values the operator set for a pickable option, if any (OpenVPN takes several remotes). */
function pickedOptions(
  stored: ProfileVpnOptionTemplate[] | undefined,
  name: string,
): ProfileVpnOptionTemplate[] {
  return stored?.filter((option) => option.name === name && option.arg?.trim()) ?? [];
}

/**
 * The options a template's option grid left on a connection, applied over the ones the apply
 * builds: a stored value replaces the built one, an option the operator removed is dropped, and one
 * the operator added is appended. `stored` is only the options of this list's scope; a connection
 * saved before options existed has none, and keeps exactly what the apply builds.
 */
function applyStoredOptions<T extends { name: string; arg: string | null; comment?: string }>(
  built: T[],
  stored: ProfileVpnOptionTemplate[] | undefined,
  derived: ReadonlySet<string>,
  create: (option: ProfileVpnOptionTemplate) => T,
  pickable: ReadonlySet<string> = new Set(),
): T[] {
  if (!stored) {
    return built;
  }

  const builtNames = new Set(built.map((option) => option.name));
  const kept = built.flatMap((option) => {
    const picked = pickable.has(option.name) ? pickedOptions(stored, option.name) : [];
    if (picked.length) {
      return picked.map((item) => ({
        ...option,
        arg: item.arg.trim(),
        ...(item.comment ? { comment: item.comment } : {}),
      }));
    }
    if (derived.has(option.name)) return [option];
    const item = stored.find((candidate) => candidate.name === option.name);
    return item
      ? [{ ...option, arg: item.arg, ...(item.comment ? { comment: item.comment } : {}) }]
      : [];
  });
  const added = stored
    .filter((item) => !builtNames.has(item.name) && !derived.has(item.name))
    .map(create);

  return [...kept, ...added];
}

/** The stored options of one scope, or undefined when the connection has none stored at all. */
function storedOptionsOf(
  connection: ProfileVpnConnectionTemplate,
  ...scopes: number[]
): ProfileVpnOptionTemplate[] | undefined {
  return connection.options?.filter((option) => scopes.includes(option.scope));
}

/**
 * Creates real OpenVPN, WireGuard and IPsec server/client configurations for a VPN template, using
 * the exact same model methods (and the same option/tree/interface side effects) the interactive
 * VPN panels use, so applying a profile leaves configs indistinguishable from ones built by hand.
 *
 * IPsec covers a server and its certificate clients. A client of an external server is refused:
 * it authenticates with a pre-shared key, which a profile cannot carry.
 */
export async function provisionVpnTemplateConfigs(
  dbCon: any,
  fwCloudId: number,
  firewallId: number,
  connections: ProfileVpnConnectionTemplate[],
  pki: ProvisionedVpnPki,
  resolvedValues: Record<string, ResolvedVpnConnectionValues>,
  errors: string[],
): Promise<Map<string, ResolvedVpnConfig>> {
  const configIds = new Map<string, ResolvedVpnConfig>();
  const servers = connections.filter((c) => c.role === 'server');
  const clientsByServerId = new Map<string, ProfileVpnConnectionTemplate[]>();
  for (const client of connections.filter((c) => c.role === 'client')) {
    if (!client.serverId) continue;
    const list = clientsByServerId.get(client.serverId) ?? [];
    list.push(client);
    clientsByServerId.set(client.serverId, list);
  }

  // A connection without apply-time parameters (no rule references it) keeps its template values.
  const connectionsById = new Map(connections.map((c) => [c.id, c]));
  const resolveField = (
    connectionId: string,
    field: keyof ResolvedVpnConnectionValues,
  ): string | undefined =>
    resolvedValues[connectionId]?.[field] ??
    (connectionsById.get(connectionId)?.[field]?.trim() || undefined);

  const serversOf = (kind: ProfileVpnConnectionTemplate['kind']) =>
    servers.filter((c) => c.kind === kind);
  const clientsOf = (server: ProfileVpnConnectionTemplate) =>
    clientsByServerId.get(server.id) ?? [];

  for (const connection of connections.filter(isExternalIpsecClient)) {
    errors.push(externalIpsecClientError(connection));
  }

  // Each protocol keeps its servers under a root node of the firewall's VPN tree.
  const provisionUnderRoot = async (
    label: string,
    rootType: 'OPN' | 'WG' | 'IS',
    protocolServers: ProfileVpnConnectionTemplate[],
    provision: (rootNodeId: number, server: ProfileVpnConnectionTemplate) => Promise<void>,
  ): Promise<void> => {
    if (protocolServers.length === 0) return;

    const rootNodeId = await findVpnRootNodeId(dbCon, fwCloudId, firewallId, rootType);
    if (rootNodeId === null) {
      errors.push(
        `VPN template: could not find this firewall's ${label} tree root ("${rootType}").`,
      );
      return;
    }

    for (const server of protocolServers) {
      await provision(rootNodeId, server);
    }
  };

  await provisionUnderRoot('OpenVPN', 'OPN', serversOf('openvpn'), (rootNodeId, server) =>
    provisionOpenVpnServer(
      dbCon,
      fwCloudId,
      firewallId,
      rootNodeId,
      server,
      clientsOf(server),
      pki.certificateIds,
      resolveField,
      errors,
      pki.rollback,
      configIds,
    ),
  );
  await provisionUnderRoot('WireGuard', 'WG', serversOf('wireguard'), (rootNodeId, server) =>
    provisionWireGuardServer(
      dbCon,
      fwCloudId,
      firewallId,
      rootNodeId,
      server,
      clientsOf(server),
      pki,
      resolveField,
      errors,
      configIds,
    ),
  );
  await provisionUnderRoot('IPsec', 'IS', serversOf('ipsec'), (rootNodeId, server) =>
    provisionIpsecServer(
      dbCon,
      fwCloudId,
      firewallId,
      rootNodeId,
      server,
      clientsOf(server),
      pki.certificateIds,
      resolveField,
      errors,
      pki.rollback,
      configIds,
    ),
  );

  return configIds;
}

/** Minimal `req`-shaped object: every legacy VPN model method here only reads `dbCon`/`body`. */
function makeReq(dbCon: any, body: Record<string, unknown>): any {
  return { dbCon, body };
}

async function provisionOpenVpnServer(
  dbCon: any,
  fwCloudId: number,
  firewallId: number,
  rootNodeId: number,
  server: ProfileVpnConnectionTemplate,
  clients: ProfileVpnConnectionTemplate[],
  certificateIds: Map<string, number>,
  resolveField: ResolveVpnField,
  errors: string[],
  rollback: ProfileVpnRollback,
  configIds: Map<string, ResolvedVpnConfig>,
): Promise<void> {
  const crtId = server.certificateId ? certificateIds.get(server.certificateId) : undefined;
  if (crtId === undefined) {
    errors.push(certificateNotCreated('OpenVPN server', server.name));
    return;
  }

  const network = parseReplicationProfileNetwork(resolveField(server.id, 'network'), 4);
  if (!network) {
    errors.push(`OpenVPN server "${server.name}": missing or invalid network address.`);
    return;
  }

  try {
    const prefix = prefixOf(network.netmask);
    const dottedMask = prefixToDottedMask(prefix);
    const storedOptions = storedOptionsOf(server, OptionScope.ovp);
    const devName = await resolveOpenVpnDevice(dbCon, fwCloudId, firewallId, server, storedOptions);
    const installName = `${sanitizeFilenamePart(server.name)}.conf`.slice(-63);

    // OpenVPN.createOpenvpnServerInterface() reads the mask back and passes it straight to
    // IpUtils.subnet(), which requires dotted-decimal (unlike dumpCfg(), which tolerantly converts a
    // "/24"-style mask itself) — so it must already be dotted here, not a CIDR prefix.
    const networkIpobjId = await insertVpnIpobj(
      dbCon,
      fwCloudId,
      `${server.name} network`,
      OBJ_TYPE_NETWORK,
      network.address,
      dottedMask,
      rollback,
    );

    const req = makeReq(dbCon, {
      fwcloud: fwCloudId,
      firewall: firewallId,
      crt: crtId,
      install_dir: '/etc/openvpn/server',
      install_name: installName,
      comment: `Replication profile: ${server.name}`,
    });

    const newOpenVpnId = (await OpenVPN.addCfg(req)) as number;
    rollback.add(`OpenVPN ${newOpenVpnId}`, async () => {
      await OpenVPN.delCfg(dbCon, fwCloudId, newOpenVpnId);
      await Tree.deleteObjFromTree(fwCloudId, newOpenVpnId, 312);
    });

    const options: VpnOpt[] = [
      {
        name: 'server',
        arg: `${network.address} ${dottedMask}`,
        scope: OptionScope.ovp,
        order: 0,
        ipobj: networkIpobjId as number,
      },
      { name: 'port', arg: String(server.port || 1194), scope: OptionScope.ovp, order: 0 },
      { name: 'proto', arg: server.transport || 'udp', scope: OptionScope.ovp, order: 0 },
      { name: 'dev', arg: devName, scope: OptionScope.ovp, order: 0 },
      { name: 'topology', arg: 'subnet', scope: OptionScope.ovp, order: 0 },
      {
        name: 'ifconfig-pool-persist',
        arg: '/etc/openvpn/ipp.txt',
        scope: OptionScope.ovp,
        order: 0,
      },
      { name: 'ccd-exclusive', arg: '', scope: OptionScope.ovp, order: 0 },
      { name: 'client-config-dir', arg: '/etc/openvpn/ccd', scope: OptionScope.ovp, order: 0 },
      { name: 'keepalive', arg: '10 120', scope: OptionScope.ovp, order: 0 },
      { name: 'cipher', arg: 'AES-128-GCM', scope: OptionScope.ovp, order: 0 },
      {
        name: 'data-ciphers',
        arg: 'AES-128-GCM:CHACHA20-POLY1305',
        scope: OptionScope.ovp,
        order: 0,
      },
      { name: 'user', arg: 'nobody', scope: OptionScope.ovp, order: 0 },
      { name: 'group', arg: 'nogroup', scope: OptionScope.ovp, order: 0 },
      { name: 'persist-key', arg: '', scope: OptionScope.ovp, order: 0 },
      { name: 'persist-tun', arg: '', scope: OptionScope.ovp, order: 0 },
      { name: 'status', arg: '/etc/openvpn/openvpn-status.log', scope: OptionScope.ovp, order: 0 },
      { name: 'verb', arg: '3', scope: OptionScope.ovp, order: 0 },
      { name: 'multihome', arg: '', scope: OptionScope.ovp, order: 0 },
      { name: 'fast-io', arg: '', scope: OptionScope.ovp, order: 0 },
    ];
    await insertOpenVpnOptions(
      req,
      newOpenVpnId,
      applyStoredOptions(options, storedOptions, DERIVED_OPTIONS.openvpnServer, (option) => ({
        ...option,
        scope: OptionScope.ovp,
        order: 0,
      })),
    );

    await Tree.newNode(dbCon, fwCloudId, server.name, rootNodeId, 'OSR', newOpenVpnId, 312);
    await OpenVPN.createOpenvpnServerInterface(req, newOpenVpnId);
    configIds.set(server.id, { id: newOpenVpnId, protocol: 'openvpn' });

    for (const client of clients) {
      await provisionOpenVpnClient(
        dbCon,
        fwCloudId,
        firewallId,
        server,
        client,
        dottedMask,
        newOpenVpnId,
        certificateIds,
        resolveField,
        errors,
        rollback,
        configIds,
      );
    }
  } catch (error) {
    errors.push(provisionFailed('OpenVPN server', server.name, error));
  }
}

/**
 * The tunnel interface of an OpenVPN server. The template's generic "tun"/"tap"/"tun0" means "a
 * free one of that kind"; a specific name the operator typed is kept as it is.
 */
async function resolveOpenVpnDevice(
  dbCon: any,
  fwCloudId: number,
  firewallId: number,
  server: ProfileVpnConnectionTemplate,
  stored: ProfileVpnOptionTemplate[] | undefined,
): Promise<string> {
  const chosen = stored?.find((option) => option.name === 'dev')?.arg?.trim();

  if (chosen && !/^(tun|tap)0?$/.test(chosen)) {
    return chosen;
  }

  const kind = chosen ? (chosen.startsWith('tap') ? 'tap' : 'tun') : server.device || 'tun';

  return pickFreeInterfaceName(dbCon, fwCloudId, firewallId, kind);
}

async function provisionOpenVpnClient(
  dbCon: any,
  fwCloudId: number,
  firewallId: number,
  server: ProfileVpnConnectionTemplate,
  client: ProfileVpnConnectionTemplate,
  serverDottedMask: string,
  serverConfigId: number,
  certificateIds: Map<string, number>,
  resolveField: ResolveVpnField,
  errors: string[],
  rollback: ProfileVpnRollback,
  configIds: Map<string, ResolvedVpnConfig>,
): Promise<void> {
  const crtId = client.certificateId ? certificateIds.get(client.certificateId) : undefined;
  if (crtId === undefined) {
    errors.push(certificateNotCreated('OpenVPN client', client.name));
    return;
  }

  // Remotes picked in the template editor replace the one worked out from the server's endpoint.
  const storedOvpOptions = storedOptionsOf(client, OptionScope.ovp);
  const endpoint = resolveField(server.id, 'endpoint');
  if (!endpoint && !pickedOptions(storedOvpOptions, 'remote').length) {
    errors.push(endpointNotProvided('OpenVPN client', client.name));
    return;
  }

  const address = parseReplicationProfileAddress(resolveField(client.id, 'network'), 4);
  if (!address) {
    errors.push(`OpenVPN client "${client.name}": missing or invalid tunnel address.`);
    return;
  }

  try {
    const req = makeReq(dbCon, {
      fwcloud: fwCloudId,
      firewall: firewallId,
      openvpn: serverConfigId,
      crt: crtId,
      install_name: `${sanitizeFilenamePart(client.name)}.conf`.slice(-63),
      comment: `Replication profile: ${client.name}`,
    });

    const newOpenVpnId = (await OpenVPN.addCfg(req)) as number;
    rollback.add(`OpenVPN ${newOpenVpnId}`, async () => {
      await OpenVPN.delCfg(dbCon, fwCloudId, newOpenVpnId);
      await Tree.deleteObjFromTree(fwCloudId, newOpenVpnId, 311);
    });

    const options: VpnOpt[] = [
      {
        name: 'remote',
        arg: `${endpoint} ${server.port || 1194}`,
        scope: OptionScope.ovp,
        order: 0,
      },
      { name: 'client', arg: '', scope: OptionScope.ovp, order: 0 },
      { name: 'dev', arg: client.device || 'tun', scope: OptionScope.ovp, order: 0 },
      {
        name: 'proto',
        arg: client.transport || server.transport || 'udp',
        scope: OptionScope.ovp,
        order: 0,
      },
      { name: 'resolv-retry', arg: 'infinite', scope: OptionScope.ovp, order: 0 },
      { name: 'nobind', arg: '', scope: OptionScope.ovp, order: 0 },
      { name: 'user', arg: 'nobody', scope: OptionScope.ovp, order: 0 },
      { name: 'group', arg: 'nogroup', scope: OptionScope.ovp, order: 0 },
      { name: 'persist-key', arg: '', scope: OptionScope.ovp, order: 0 },
      { name: 'persist-tun', arg: '', scope: OptionScope.ovp, order: 0 },
      { name: 'cipher', arg: 'AES-128-GCM', scope: OptionScope.ovp, order: 0 },
      { name: 'auth-nocache', arg: '', scope: OptionScope.ovp, order: 0 },
      { name: 'tls-client', arg: '', scope: OptionScope.ovp, order: 0 },
      { name: 'verb', arg: '3', scope: OptionScope.ovp, order: 0 },
      { name: 'float', arg: '', scope: OptionScope.ovp, order: 0 },
      { name: 'remote-cert-tls', arg: 'server', scope: OptionScope.ovp, order: 0 },
    ];
    await insertOpenVpnOptions(
      req,
      newOpenVpnId,
      applyStoredOptions(
        options,
        storedOvpOptions,
        DERIVED_OPTIONS.openvpnClient,
        (option) => ({ ...option, scope: OptionScope.ovp, order: 0 }),
        PICKABLE_OPTIONS.openvpnClient,
      ),
    );
    await insertOpenVpnOptions(req, newOpenVpnId, [
      {
        name: 'ifconfig-push',
        arg: `${address.address} ${serverDottedMask}`,
        scope: OptionScope.ccd,
        order: 1,
      },
    ]);
    configIds.set(client.id, { id: newOpenVpnId, protocol: 'openvpn' });

    // Unlike the OpenVPN server, a client gets no tree node of its own in the interactive editor
    // either (that path is dead code there too) — clients are only reachable through the server.
  } catch (error) {
    errors.push(provisionFailed('OpenVPN client', client.name, error));
  }
}

/**
 * The certificate a WireGuard config is bound to. WireGuard's own keys are an independent key pair,
 * so a template may leave the certificate out: it then gets a technical one that exists only to
 * satisfy the `crt` foreign key. When the template does declare one (dragged onto WireGuard like the
 * real screen allows), that real certificate is used.
 */
async function wireGuardCertificateId(
  dbCon: any,
  fwCloudId: number,
  pki: ProvisionedVpnPki,
  role: 'server' | 'client',
  connection: ProfileVpnConnectionTemplate,
  errors: string[],
): Promise<number | null> {
  if (!connection.certificateId) {
    return ensureWireGuardTechnicalCertificate(dbCon, fwCloudId, pki, role, connection.id, errors);
  }

  const crtId = pki.certificateIds.get(connection.certificateId);
  if (crtId === undefined) {
    errors.push(certificateNotCreated(`WireGuard ${role}`, connection.name));
    return null;
  }

  return crtId;
}

async function provisionWireGuardServer(
  dbCon: any,
  fwCloudId: number,
  firewallId: number,
  rootNodeId: number,
  server: ProfileVpnConnectionTemplate,
  clients: ProfileVpnConnectionTemplate[],
  pki: ProvisionedVpnPki,
  resolveField: ResolveVpnField,
  errors: string[],
  configIds: Map<string, ResolvedVpnConfig>,
): Promise<void> {
  const network = parseReplicationProfileNetwork(resolveField(server.id, 'network'), 4);
  if (!network) {
    errors.push(`WireGuard server "${server.name}": missing or invalid interface address.`);
    return;
  }

  const crtId = await wireGuardCertificateId(dbCon, fwCloudId, pki, 'server', server, errors);
  if (crtId === null) {
    return;
  }

  try {
    // As the interactive panel does: a network object for the VPN network ('<<vpn_network>>'), from
    // which createWireGuardServerInterface() gives the tunnel interface the 'Address' option's first
    // host and links that option to it (the tree reads both).
    const networkIpobjId = await insertVpnIpobj(
      dbCon,
      fwCloudId,
      `LAN-VPN-${server.name}`.slice(0, 64),
      OBJ_TYPE_NETWORK,
      network.address,
      network.netmask,
      pki.rollback,
    );

    const installName = await WireGuard.getConfigFilename(dbCon, firewallId);
    const req = makeReq(dbCon, {
      fwcloud: fwCloudId,
      firewall: firewallId,
      crt: crtId,
      install_dir: '/etc/wireguard',
      install_name: installName,
      comment: `Replication profile: ${server.name}`,
    });

    // WireGuard.addCfg() already generates and stores the real key pair (encrypted, on the config
    // row itself); dumpCfg() reads PrivateKey/PublicKey from there, never from an option row, so no
    // 'PrivateKey' option is created here.
    const newWireguardId: number = await WireGuard.addCfg(req);
    pki.rollback.add(`WireGuard ${newWireguardId}`, async () => {
      await WireGuard.delCfg(dbCon, fwCloudId, newWireguardId, false);
      await Tree.deleteObjFromTree(fwCloudId, newWireguardId, 322);
    });

    await insertWireGuardOptions(
      req,
      applyStoredOptions(
        [
          {
            name: 'Address',
            arg: `${IpUtils.fromLong(IpUtils.toLong(network.address) + 1)}${network.netmask}`,
            scope: OptionScope.wg_server_interface,
            wireguard: newWireguardId,
          },
          {
            name: '<<vpn_network>>',
            arg: `${network.address}${network.netmask}`,
            ipobj: networkIpobjId,
            scope: OptionScope.wg_server_interface,
            wireguard: newWireguardId,
          },
          {
            name: 'ListenPort',
            arg: String(server.port || 51820),
            scope: OptionScope.wg_server_interface,
            wireguard: newWireguardId,
          },
        ],
        storedOptionsOf(server, OptionScope.wg_server_interface),
        DERIVED_OPTIONS.wireguardServer,
        (option) => ({ ...option, wireguard: newWireguardId }),
      ),
    );

    const nodeId = await Tree.newNode(
      dbCon,
      fwCloudId,
      server.name,
      rootNodeId,
      'WGS',
      newWireguardId,
      322,
    );
    await WireGuard.createWireGuardServerInterface(req, newWireguardId);
    configIds.set(server.id, { id: newWireguardId, protocol: 'wireguard' });

    for (const client of clients) {
      await provisionWireGuardClient(
        dbCon,
        fwCloudId,
        firewallId,
        nodeId as number,
        server,
        client,
        newWireguardId,
        pki,
        resolveField,
        errors,
        configIds,
      );
    }
  } catch (error) {
    errors.push(provisionFailed('WireGuard server', server.name, error));
  }
}

async function provisionWireGuardClient(
  dbCon: any,
  fwCloudId: number,
  firewallId: number,
  serverNodeId: number,
  server: ProfileVpnConnectionTemplate,
  client: ProfileVpnConnectionTemplate,
  serverConfigId: number,
  pki: ProvisionedVpnPki,
  resolveField: ResolveVpnField,
  errors: string[],
  configIds: Map<string, ResolvedVpnConfig>,
): Promise<void> {
  const storedClientOptions = storedOptionsOf(
    client,
    OptionScope.wg_client_interface,
    OptionScope.wg_client_peer,
  );
  // An endpoint picked in the template editor replaces the one worked out from the server's.
  const endpoint = resolveField(server.id, 'endpoint');
  if (!endpoint && !pickedOptions(storedClientOptions, 'Endpoint').length) {
    errors.push(endpointNotProvided('WireGuard client', client.name));
    return;
  }

  const address = parseReplicationProfileAddress(resolveField(client.id, 'network'), 4);
  if (!address) {
    errors.push(`WireGuard client "${client.name}": missing or invalid interface address.`);
    return;
  }

  const allowedIps = resolveField(client.id, 'remoteNetwork');
  if (!allowedIps) {
    errors.push(`WireGuard client "${client.name}": missing AllowedIPs (remote network).`);
    return;
  }

  const crtId = await wireGuardCertificateId(dbCon, fwCloudId, pki, 'client', client, errors);
  if (crtId === null) {
    return;
  }

  try {
    const req = makeReq(dbCon, {
      fwcloud: fwCloudId,
      firewall: firewallId,
      wireguard: serverConfigId,
      crt: crtId,
      install_name: `${sanitizeFilenamePart(client.name)}.conf`.slice(-63),
      comment: `Replication profile: ${client.name}`,
    });

    // As the interactive panel does: an address object for the client's tunnel address, referenced
    // by its 'Address' option (the tree reads the client's address from it).
    const addressIpobjId = await insertVpnIpobj(
      dbCon,
      fwCloudId,
      `VPN-${client.name}`.slice(0, 64),
      OBJ_TYPE_ADDRESS,
      address.address,
      address.netmask,
      pki.rollback,
    );

    // Same as the server: addCfg() already generated this client's own key pair, and dumpCfg() reads
    // the server's PublicKey (for this client's [Peer] section) from the server row itself.
    const newWireguardId: number = await WireGuard.addCfg(req);
    pki.rollback.add(`WireGuard ${newWireguardId}`, async () => {
      await WireGuard.delCfg(dbCon, fwCloudId, newWireguardId, true);
      await Tree.deleteObjFromTree(fwCloudId, newWireguardId, 321);
    });

    await insertWireGuardOptions(
      req,
      applyStoredOptions(
        [
          {
            name: 'Address',
            arg: `${address.address}${address.netmask}`,
            ipobj: addressIpobjId,
            scope: OptionScope.wg_client_interface,
            wireguard: newWireguardId,
          },
          {
            name: 'Endpoint',
            arg: `${endpoint}:${server.port || 51820}`,
            scope: OptionScope.wg_client_peer,
            wireguard: newWireguardId,
          },
          {
            name: 'AllowedIPs',
            arg: allowedIps,
            scope: OptionScope.wg_client_peer,
            wireguard: newWireguardId,
          },
        ],
        storedClientOptions,
        DERIVED_OPTIONS.wireguardClient,
        (option) => ({ ...option, wireguard: newWireguardId }),
        PICKABLE_OPTIONS.wireguardClient,
      ),
    );

    // Mirrors the interactive controller: a placeholder peer entry on the server side, so the
    // options-grid shows the client under its server. dumpCfg() derives the real AllowedIPs for
    // the server's [Peer] section from the client's own Address option, not from this row's arg.
    await insertWireGuardOptions(req, [
      {
        name: 'AllowedIPs',
        arg: '',
        scope: OptionScope.wg_server_peer,
        order: 1,
        wireguard: serverConfigId,
        wireguard_cli: newWireguardId,
      },
    ]);

    await Tree.newNode(dbCon, fwCloudId, client.name, serverNodeId, 'WGC', newWireguardId, 321);
    configIds.set(client.id, { id: newWireguardId, protocol: 'wireguard' });
  } catch (error) {
    errors.push(provisionFailed('WireGuard client', client.name, error));
  }
}

const IPSEC_IKE = 'aes256-sha256-modp2048!';
const IPSEC_ESP = 'aes256-sha256!';

interface IpsecOpt {
  name: string;
  arg: string | null;
  ipobj?: number | null;
  comment?: string;
}

async function insertIpsecOptions(
  req: any,
  ipsecId: number,
  scope: OptionScope,
  options: IpsecOpt[],
): Promise<void> {
  let order = 1;
  for (const opt of options) {
    await IPSec.addCfgOpt(req, {
      name: opt.name,
      arg: opt.arg,
      ipobj: opt.ipobj ?? null,
      scope,
      order: order++,
      ipsec: ipsecId,
      ...(opt.comment ? { comment: opt.comment } : {}),
    });
  }
}

async function certificateCn(dbCon: any, crtId: number): Promise<string> {
  return ((await Crt.getCRTdata(dbCon, crtId)) as { cn: string }).cn;
}

/** The address/network object an IPsec option points at, removed again if the apply is rolled back. */
async function insertVpnIpobj(
  dbCon: any,
  fwCloudId: number,
  name: string,
  type: number,
  address: string,
  netmask: string,
  rollback: ProfileVpnRollback,
): Promise<number> {
  const id = (await IPObj.insertIpobj(dbCon, {
    id: null,
    fwcloud: fwCloudId,
    interface: null,
    name,
    type,
    protocol: null,
    address,
    netmask,
    diff_serv: null,
    ip_version: 4,
    icmp_code: null,
    icmp_type: null,
    tcp_flags_mask: null,
    tcp_flags_settings: null,
    range_start: null,
    range_end: null,
    source_port_start: 0,
    source_port_end: 0,
    destination_port_start: 0,
    destination_port_end: 0,
    options: null,
  })) as number;

  rollback.add(`VPN object ${id}`, async () => {
    await IPObj.deleteIpobj(dbCon, fwCloudId, id);
    await Tree.deleteObjFromTree(fwCloudId, id, type);
  });

  return id;
}

/**
 * Mirrors what the interactive IPsec panel + controller do for a new server: a network object for
 * its VPN network, the config with its certificate-based options, its tree node and its tunnel
 * interface. IPsec allows a single server per firewall.
 */
async function provisionIpsecServer(
  dbCon: any,
  fwCloudId: number,
  firewallId: number,
  rootNodeId: number,
  server: ProfileVpnConnectionTemplate,
  clients: ProfileVpnConnectionTemplate[],
  certificateIds: Map<string, number>,
  resolveField: ResolveVpnField,
  errors: string[],
  rollback: ProfileVpnRollback,
  configIds: Map<string, ResolvedVpnConfig>,
): Promise<void> {
  const crtId = server.certificateId ? certificateIds.get(server.certificateId) : undefined;
  if (crtId === undefined) {
    errors.push(certificateNotCreated('IPsec server', server.name));
    return;
  }

  const network = parseReplicationProfileNetwork(resolveField(server.id, 'localNetwork'), 4);
  if (!network) {
    errors.push(`IPsec server "${server.name}": missing or invalid local network.`);
    return;
  }

  // The tunnel interface takes the first address of the network, as the interactive panel does.
  const prefix = prefixOf(network.netmask);
  if (prefix > 30) {
    errors.push(
      `IPsec server "${server.name}": the local network needs room for the tunnel interface address.`,
    );
    return;
  }
  const interfaceAddress = IpUtils.fromLong(IpUtils.toLong(network.address) + 1);

  try {
    const existingServers = (await IPSec.getIPSecServersByFirewall(dbCon, firewallId)) as unknown[];
    if (existingServers.length > 0) {
      throw new Error('This firewall already has an IPsec server configured');
    }

    const cn = await certificateCn(dbCon, crtId);
    const vpnNetwork = `${network.address}${network.netmask}`;
    const networkIpobjId = await insertVpnIpobj(
      dbCon,
      fwCloudId,
      `LAN-VPN-${cn}`.slice(0, 64),
      OBJ_TYPE_NETWORK,
      network.address,
      network.netmask,
      rollback,
    );

    const req = makeReq(dbCon, {
      fwcloud: fwCloudId,
      firewall: firewallId,
      crt: crtId,
      install_dir: '/etc',
      install_name: (await IPSec.getConfigFilename(dbCon, firewallId)) as string,
      comment: `Replication profile: ${server.name}`,
    });

    const newIpsecId = await IPSec.addCfg(req);
    rollback.add(`IPsec ${newIpsecId}`, async () => {
      await IPSec.delCfg(dbCon, fwCloudId, newIpsecId, false);
      await Tree.deleteObjFromTree(fwCloudId, newIpsecId, 332);
    });

    const serverOptions: IpsecOpt[] = [
      { name: 'keyexchange', arg: 'ikev2' },
      { name: 'ike', arg: IPSEC_IKE },
      { name: 'esp', arg: IPSEC_ESP },
      { name: 'dpdaction', arg: 'clear' },
      { name: 'dpddelay', arg: '300s' },
      { name: 'rekey', arg: 'no' },
      { name: 'left', arg: interfaceAddress },
      { name: 'leftid', arg: `"CN=${cn}"` },
      { name: 'leftcert', arg: `${cn}.crt` },
      { name: 'leftsubnet', arg: vpnNetwork, ipobj: networkIpobjId },
      { name: 'leftfirewall', arg: 'yes' },
      { name: 'rightauth', arg: 'pubkey' },
      { name: 'auto', arg: 'ignore' },
      { name: 'charondebug', arg: 'ike 1, knl 1, cfg 0' },
    ];
    await insertIpsecOptions(
      req,
      newIpsecId,
      OptionScope.ipsec_server,
      applyStoredOptions(
        serverOptions,
        storedOptionsOf(server, OptionScope.ipsec_server),
        DERIVED_OPTIONS.ipsecServer,
        (option) => option,
      ),
    );

    const nodeId = (await Tree.newNode(
      dbCon,
      fwCloudId,
      cn,
      rootNodeId,
      'ISS',
      newIpsecId,
      332,
    )) as number;
    await IPSec.createIPSecServerInterface(req, newIpsecId);
    configIds.set(server.id, { id: newIpsecId, protocol: 'ipsec' });

    for (const client of clients) {
      await provisionIpsecClient(
        dbCon,
        fwCloudId,
        firewallId,
        nodeId,
        server,
        client,
        newIpsecId,
        cn,
        vpnNetwork,
        certificateIds,
        resolveField,
        errors,
        rollback,
        configIds,
      );
    }
  } catch (error) {
    errors.push(provisionFailed('IPsec server', server.name, error));
  }
}

/** A client of a server of this profile: its own address object, its options and the server's peer entry. */
async function provisionIpsecClient(
  dbCon: any,
  fwCloudId: number,
  firewallId: number,
  serverNodeId: number,
  server: ProfileVpnConnectionTemplate,
  client: ProfileVpnConnectionTemplate,
  serverConfigId: number,
  serverCn: string,
  vpnNetwork: string,
  certificateIds: Map<string, number>,
  resolveField: ResolveVpnField,
  errors: string[],
  rollback: ProfileVpnRollback,
  configIds: Map<string, ResolvedVpnConfig>,
): Promise<void> {
  const crtId = client.certificateId ? certificateIds.get(client.certificateId) : undefined;
  if (crtId === undefined) {
    errors.push(certificateNotCreated('IPsec client', client.name));
    return;
  }

  const endpoint = resolveField(server.id, 'endpoint');
  if (!endpoint) {
    errors.push(endpointNotProvided('IPsec client', client.name));
    return;
  }

  const address = parseReplicationProfileAddress(resolveField(client.id, 'network'), 4);
  if (!address) {
    errors.push(`IPsec client "${client.name}": missing or invalid tunnel address.`);
    return;
  }

  try {
    const cn = await certificateCn(dbCon, crtId);
    const addressIpobjId = await insertVpnIpobj(
      dbCon,
      fwCloudId,
      cn.slice(0, 64),
      OBJ_TYPE_ADDRESS,
      address.address,
      address.netmask,
      rollback,
    );

    const req = makeReq(dbCon, {
      fwcloud: fwCloudId,
      firewall: firewallId,
      ipsec: serverConfigId,
      crt: crtId,
      comment: `Replication profile: ${client.name}`,
    });

    const newIpsecId = await IPSec.addCfg(req);
    rollback.add(`IPsec ${newIpsecId}`, async () => {
      await IPSec.delCfg(dbCon, fwCloudId, newIpsecId, true);
      await Tree.deleteObjFromTree(fwCloudId, newIpsecId, 331);
    });

    const clientOptions: IpsecOpt[] = [
      { name: 'keyexchange', arg: 'ikev2' },
      { name: 'ike', arg: IPSEC_IKE },
      { name: 'esp', arg: IPSEC_ESP },
      { name: 'left', arg: '%defaultroute' },
      { name: 'leftid', arg: `"CN=${cn}"` },
      { name: 'leftcert', arg: `${cn}.crt` },
      { name: 'leftauth', arg: 'pubkey' },
      { name: 'leftsourceip', arg: address.address, ipobj: addressIpobjId },
      { name: 'right', arg: endpoint },
      { name: 'rightid', arg: `"CN=${serverCn}"` },
      { name: 'rightauth', arg: 'pubkey' },
      { name: 'rightsubnet', arg: vpnNetwork },
      { name: 'charondebug', arg: 'ike 1, cfg 0' },
      { name: 'auto', arg: 'start' },
    ];
    await insertIpsecOptions(
      req,
      newIpsecId,
      OptionScope.ipsec_client,
      applyStoredOptions(
        clientOptions,
        storedOptionsOf(client, OptionScope.ipsec_client),
        DERIVED_OPTIONS.ipsecClient,
        (option) => option,
      ),
    );

    // The server-side entries the interactive controller adds for every new client.
    const [{ last }] = await queryRows(
      dbCon,
      'SELECT COALESCE(MAX(`order`), 0) AS last FROM ipsec_opt WHERE ipsec = ?',
      [serverConfigId],
    );
    for (const [index, peerOption] of [
      { name: 'rightsubnet', arg: null },
      { name: 'auto', arg: 'add' },
    ].entries()) {
      await IPSec.addCfgOpt(req, {
        ...peerOption,
        ipsec: serverConfigId,
        ipsec_cli: newIpsecId,
        order: last + 1 + index,
        scope: OptionScope.ipsec_server_client,
      });
    }

    await Tree.newNode(dbCon, fwCloudId, cn, serverNodeId, 'ISC', newIpsecId, 331);
    await IPSecPrefix.applyIPSecPrefixes(dbCon, fwCloudId, serverConfigId);
    await IPSecPrefix.updateIPSecClientPrefixesFWStatus(dbCon, fwCloudId, newIpsecId);
    await IPSec.updateIPSecStatus(dbCon, serverConfigId, '|1');
    configIds.set(client.id, { id: newIpsecId, protocol: 'ipsec' });
  } catch (error) {
    errors.push(provisionFailed('IPsec client', client.name, error));
  }
}

async function insertOpenVpnOptions(req: any, openvpnId: number, options: VpnOpt[]): Promise<void> {
  let order = 1;
  for (const opt of options) {
    await OpenVPN.addCfgOpt(req, { ...opt, openvpn: openvpnId, order: order++ });
  }
}

async function insertWireGuardOptions(
  req: any,
  options: Array<
    Omit<VpnOpt, 'order'> & { order?: number; wireguard: number; wireguard_cli?: number }
  >,
): Promise<void> {
  for (const [index, opt] of options.entries()) {
    await WireGuard.addCfgOpt(req, { ...opt, order: opt.order ?? index + 1 });
  }
}

/** Every firewall is seeded with a VPN tree ('VPN' > 'OPN'/'WG'/'IS'); see Tree.vpnTree(). */
async function findVpnRootNodeId(
  dbCon: any,
  fwCloudId: number,
  firewallId: number,
  nodeType: 'OPN' | 'WG' | 'IS',
): Promise<number | null> {
  const rows = await queryRows(
    dbCon,
    'SELECT id FROM fwc_tree WHERE fwcloud = ? AND node_type = ? AND id_obj = ? LIMIT 1',
    [fwCloudId, nodeType, firewallId],
  );
  return rows.length > 0 ? rows[0].id : null;
}

/**
 * Next unused `<base>N` interface name on this firewall. The interactive OpenVPN panel always
 * defaults to a fixed "tun0" for every new server (createOpenvpnServerInterface only skips
 * creating a second interface with the same name, it doesn't renumber) — provisioning several
 * OpenVPN servers in one profile application needs each to get its own interface, so this picks
 * the next free number instead of repeating that collision.
 */
async function pickFreeInterfaceName(
  dbCon: any,
  fwCloudId: number,
  firewallId: number,
  base: string,
): Promise<string> {
  const interfaces: Array<{ name: string }> = await Interface.getInterfaces(
    dbCon,
    fwCloudId,
    firewallId,
  );
  const used = new Set(
    interfaces
      .map((i) => i.name)
      .filter((name) => name.startsWith(base))
      .map((name) => parseInt(name.slice(base.length), 10))
      .filter((n) => Number.isInteger(n)),
  );
  let n = 0;
  while (used.has(n)) n++;
  return `${base}${n}`;
}

function prefixOf(netmask: string): number {
  return parseInt(netmask.replace('/', ''), 10);
}

/** CIDR prefix length -> dotted-decimal mask, e.g. 24 -> "255.255.255.0". */
function prefixToDottedMask(prefix: number): string {
  const bits = 0xffffffff << (32 - prefix);
  return [24, 16, 8, 0].map((shift) => (bits >>> shift) & 0xff).join('.');
}

function sanitizeFilenamePart(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]/g, '_') || 'vpn';
}
