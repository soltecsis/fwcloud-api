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
import { Interface } from '../interface/Interface';
import { IPObj } from '../ipobj/IPObj';
import { Tree } from '../tree/Tree';
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
}

/** One entry per field `normalizeProfileVpnRuleParameters()` turned into an apply-time parameter. */
export type ProfileVpnRuntimeFields = Partial<
  Record<'network' | 'endpoint' | 'remoteNetwork' | 'localNetwork', ReplicationProfileParameterRef>
>;

/** Same fields, dereferenced against the apply-time parameter values supplied by the caller. */
export type ResolvedVpnConnectionValues = Partial<
  Record<'network' | 'endpoint' | 'remoteNetwork' | 'localNetwork', string>
>;

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
}

const OBJ_TYPE_ADDRESS = 5;
const OBJ_TYPE_NETWORK = 7;

interface VpnOpt {
  name: string;
  arg: string;
  scope: OptionScope;
  order: number;
  ipobj?: number | null;
}

/**
 * Creates real OpenVPN and WireGuard server/client configurations for a VPN template, using the
 * exact same model methods (and the same option/tree/interface side effects) the interactive VPN
 * panels use, so applying a profile leaves configs indistinguishable from ones built by hand.
 *
 * IPsec is not covered yet (see the caller for the current scope of what's implemented).
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

  const resolveField = (
    connectionId: string,
    field: keyof ResolvedVpnConnectionValues,
  ): string | undefined => resolvedValues[connectionId]?.[field];

  const openvpnServers = servers.filter((c) => c.kind === 'openvpn');
  const wireguardServers = servers.filter((c) => c.kind === 'wireguard');

  for (const connection of connections.filter((c) => c.kind === 'ipsec')) {
    errors.push(
      `IPsec connection "${connection.name}": creating a real IPsec configuration is not implemented yet; only its CA/certificate were provisioned.`,
    );
  }

  if (openvpnServers.length > 0) {
    const rootNodeId = await findVpnRootNodeId(dbCon, fwCloudId, firewallId, 'OPN');
    if (rootNodeId === null) {
      errors.push(`VPN template: could not find this firewall's OpenVPN tree root ("OPN").`);
    } else {
      for (const server of openvpnServers) {
        await provisionOpenVpnServer(
          dbCon,
          fwCloudId,
          firewallId,
          rootNodeId,
          server,
          clientsByServerId.get(server.id) ?? [],
          pki.certificateIds,
          resolveField,
          errors,
          pki.rollback,
          configIds,
        );
      }
    }
  }

  if (wireguardServers.length > 0) {
    const rootNodeId = await findVpnRootNodeId(dbCon, fwCloudId, firewallId, 'WG');
    if (rootNodeId === null) {
      errors.push(`VPN template: could not find this firewall's WireGuard tree root ("WG").`);
    } else {
      for (const server of wireguardServers) {
        await provisionWireGuardServer(
          dbCon,
          fwCloudId,
          firewallId,
          rootNodeId,
          server,
          clientsByServerId.get(server.id) ?? [],
          pki,
          resolveField,
          errors,
          configIds,
        );
      }
    }
  }

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
  resolveField: (connectionId: string, field: keyof ProfileVpnRuntimeFields) => string | undefined,
  errors: string[],
  rollback: ProfileVpnRollback,
  configIds: Map<string, ResolvedVpnConfig>,
): Promise<void> {
  const crtId = server.certificateId ? certificateIds.get(server.certificateId) : undefined;
  if (crtId === undefined) {
    errors.push(
      `OpenVPN server "${server.name}": its certificate was not created, so it was skipped.`,
    );
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
    const devName = await pickFreeInterfaceName(dbCon, fwCloudId, firewallId, 'tun');
    const installName = `${sanitizeFilenamePart(server.name)}.conf`.slice(-63);

    const networkIpobjId = (await IPObj.insertIpobj(dbCon, {
      id: null,
      fwcloud: fwCloudId,
      interface: null,
      name: `${server.name} network`,
      type: OBJ_TYPE_NETWORK,
      protocol: null,
      address: network.address,
      // OpenVPN.createOpenvpnServerInterface() reads this back and passes it straight to
      // IpUtils.subnet(), which requires dotted-decimal (unlike dumpCfg(), which tolerantly
      // converts a "/24"-style mask itself) — so this must already be dotted, not CIDR-prefix.
      netmask: dottedMask,
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

    rollback.add(`VPN network ${networkIpobjId}`, async () => {
      await IPObj.deleteIpobj(dbCon, fwCloudId, networkIpobjId);
      await Tree.deleteObjFromTree(fwCloudId, networkIpobjId, OBJ_TYPE_NETWORK);
    });

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
    await insertOpenVpnOptions(req, newOpenVpnId, options);

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
    errors.push(`OpenVPN server "${server.name}": ${describeVpnProvisionError(error)}`);
  }
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
  resolveField: (connectionId: string, field: keyof ProfileVpnRuntimeFields) => string | undefined,
  errors: string[],
  rollback: ProfileVpnRollback,
  configIds: Map<string, ResolvedVpnConfig>,
): Promise<void> {
  const crtId = client.certificateId ? certificateIds.get(client.certificateId) : undefined;
  if (crtId === undefined) {
    errors.push(
      `OpenVPN client "${client.name}": its certificate was not created, so it was skipped.`,
    );
    return;
  }

  const endpoint = resolveField(server.id, 'endpoint');
  if (!endpoint) {
    errors.push(`OpenVPN client "${client.name}": the server's endpoint was not provided.`);
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
    await insertOpenVpnOptions(req, newOpenVpnId, options);
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
    errors.push(`OpenVPN client "${client.name}": ${describeVpnProvisionError(error)}`);
  }
}

async function provisionWireGuardServer(
  dbCon: any,
  fwCloudId: number,
  firewallId: number,
  rootNodeId: number,
  server: ProfileVpnConnectionTemplate,
  clients: ProfileVpnConnectionTemplate[],
  pki: ProvisionedVpnPki,
  resolveField: (connectionId: string, field: keyof ProfileVpnRuntimeFields) => string | undefined,
  errors: string[],
  configIds: Map<string, ResolvedVpnConfig>,
): Promise<void> {
  const address = parseReplicationProfileAddress(resolveField(server.id, 'network'), 4);
  if (!address) {
    errors.push(`WireGuard server "${server.name}": missing or invalid interface address.`);
    return;
  }

  // A WireGuard connection never carries a certificateId in the template (see
  // replication-profile-vpn.validation.ts): its certificate exists only to satisfy the crt foreign
  // key, so it is minted here, invisible to the template author.
  const crtId = await ensureWireGuardTechnicalCertificate(
    dbCon,
    fwCloudId,
    pki,
    'server',
    server.id,
    errors,
  );
  if (crtId === null) {
    return;
  }

  try {
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

    await insertWireGuardOptions(req, [
      {
        name: 'Address',
        arg: `${address.address}${address.netmask}`,
        scope: OptionScope.wg_server_interface,
        order: 1,
        wireguard: newWireguardId,
      },
      {
        name: 'ListenPort',
        arg: String(server.port || 51820),
        scope: OptionScope.wg_server_interface,
        order: 2,
        wireguard: newWireguardId,
      },
    ]);

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
    errors.push(`WireGuard server "${server.name}": ${describeVpnProvisionError(error)}`);
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
  resolveField: (connectionId: string, field: keyof ProfileVpnRuntimeFields) => string | undefined,
  errors: string[],
  configIds: Map<string, ResolvedVpnConfig>,
): Promise<void> {
  const endpoint = resolveField(server.id, 'endpoint');
  if (!endpoint) {
    errors.push(`WireGuard client "${client.name}": the server's endpoint was not provided.`);
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

  // Same reasoning as the server: the template never carries a certificateId for WireGuard.
  const crtId = await ensureWireGuardTechnicalCertificate(
    dbCon,
    fwCloudId,
    pki,
    'client',
    client.id,
    errors,
  );
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

    // Same as the server: addCfg() already generated this client's own key pair, and dumpCfg() reads
    // the server's PublicKey (for this client's [Peer] section) from the server row itself.
    const newWireguardId: number = await WireGuard.addCfg(req);
    pki.rollback.add(`WireGuard ${newWireguardId}`, async () => {
      await WireGuard.delCfg(dbCon, fwCloudId, newWireguardId, true);
      await Tree.deleteObjFromTree(fwCloudId, newWireguardId, 321);
    });

    await insertWireGuardOptions(req, [
      {
        name: 'Address',
        arg: `${address.address}${address.netmask}`,
        scope: OptionScope.wg_client_interface,
        order: 1,
        wireguard: newWireguardId,
      },
      {
        name: 'Endpoint',
        arg: `${endpoint}:${server.port || 51820}`,
        scope: OptionScope.wg_client_peer,
        order: 2,
        wireguard: newWireguardId,
      },
      {
        name: 'AllowedIPs',
        arg: allowedIps,
        scope: OptionScope.wg_client_peer,
        order: 3,
        wireguard: newWireguardId,
      },
    ]);

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
    errors.push(`WireGuard client "${client.name}": ${describeVpnProvisionError(error)}`);
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
  options: Array<VpnOpt & { wireguard: number; wireguard_cli?: number }>,
): Promise<void> {
  for (const opt of options) {
    await WireGuard.addCfgOpt(req, opt);
  }
}

/** Every firewall is seeded with a VPN tree ('VPN' > 'OPN'/'WG'/'IS'); see Tree.vpnTree(). */
function findVpnRootNodeId(
  dbCon: any,
  fwCloudId: number,
  firewallId: number,
  nodeType: 'OPN' | 'WG' | 'IS',
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    dbCon.query(
      'SELECT id FROM fwc_tree WHERE fwcloud = ? AND node_type = ? AND id_obj = ? LIMIT 1',
      [fwCloudId, nodeType, firewallId],
      (error: unknown, rows: Array<{ id: number }>) => {
        if (error) return reject(error);
        resolve(rows.length > 0 ? rows[0].id : null);
      },
    );
  });
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
