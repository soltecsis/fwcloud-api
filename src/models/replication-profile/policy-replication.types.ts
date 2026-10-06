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

import type { ReplicationProfile } from './replication-profile.model';
import type { ResolvedProfileObjectReference } from './replication-profile-object-reference';
import {
  asReplicationProfileNonEmptyString,
  asReplicationProfileRecord,
  isReplicationProfileExternalObjectUsage,
  isReplicationProfileIpVersion,
  isReplicationProfileStringValue,
  ReplicationProfileExternalObjectUsage,
  REPLICATION_PROFILE_OBJECT_KINDS,
  REPLICATION_PROFILE_RULE_ACTIONS,
  REPLICATION_PROFILE_RULE_CHAINS,
  REPLICATION_PROFILE_RULE_PROTOCOLS,
  REPLICATION_PROFILE_STANDARD_GROUP_KIND,
  REPLICATION_PROFILE_STANDARD_OBJECT_KIND,
} from './replication-profile.constants';
import { isReplicationProfileParameterRef } from './replication-profile-parameters';
import type {
  ReplicationProfileIpVersion,
  ReplicationProfileRuleChain,
  ReplicationProfileTargetKind,
} from './replication-profile.constants';

export const POLICY_REPLICATION_MODES = ['replace_defaults', 'merge', 'dry_run'] as const;
export type PolicyReplicationMode = (typeof POLICY_REPLICATION_MODES)[number];

export function isPolicyReplicationMode(value: string): value is PolicyReplicationMode {
  return (POLICY_REPLICATION_MODES as readonly string[]).includes(value);
}

/**
 * Source side of a replication: the firewall (or cluster master) whose policy
 * acts as the template, plus the logical role assigned to each of its
 * interfaces and, for clusters, to each of its nodes.
 */
export interface PolicyReplicationSourceProfile {
  /** Optional catalog profile this replication is based on. */
  profile?: ReplicationProfile;
  /** Source firewall id. When the source is a cluster, its master firewall id. */
  firewallId: number;
  /** Logical role -> source interface id. */
  interfaceRoles: Record<string, number>;
  /** Logical role -> source node (cluster member firewall) id. */
  nodeRoles?: Record<string, number>;
}

export interface PolicyReplicationTarget {
  kind: ReplicationProfileTargetKind;
  /** Firewall id when kind is 'firewall', cluster id when kind is 'cluster'. */
  id: number;
}

export interface PolicyReplicationRequest {
  /** Source side. Omitted for declarative provisioning profiles. */
  sourceProfile?: PolicyReplicationSourceProfile;
  target: PolicyReplicationTarget;
  /** Logical role -> target interface id. Omitted for provisioning profiles. */
  interfaceRoleMapping?: Record<string, number>;
  /** Logical role -> target node (cluster member firewall) id. */
  nodeRoleMapping?: Record<string, number>;
  mode: PolicyReplicationMode;
}

/**
 * Declarative provisioning describes objects the profile CREATES on the target
 * firewall, with no source firewall involved. A profile is a "provisioning
 * profile" when its model carries a `provision` block (see getProfileProvisioning).
 *
 * Every value below may be written either as a literal or as a
 * `{ "param": "NAME" }` reference to a declared profile parameter. References
 * are what make a profile reusable: the rule keeps its meaning ("allow the LAN
 * network towards the WAN on the service port") while the concrete network and
 * port come from the caller at apply time.
 */

/** A literal value or a reference to a declared profile parameter. */
export type PolicyReplicationValueRef = unknown;

/** One IP address configured on a provisioned interface. */
export interface PolicyReplicationProvisionAddress {
  /** "10.0.0.1/24", "10.0.0.1/255.255.255.0" or a { param } reference. */
  value: PolicyReplicationValueRef;
  /** Optional object name; defaults to the address itself. */
  name?: string;
}

export interface PolicyReplicationProvisionInterface {
  /** Interface name created on the target (e.g. "WAN"). */
  name: string;
  /** Logical role used to wire rules to this interface. */
  role: string;
  /** Addresses configured on the interface. */
  addresses: PolicyReplicationProvisionAddress[];
}

export interface PolicyReplicationProvisionPortService {
  protocol: 'tcp' | 'udp';
  /** Literal port or a { param } reference resolved at apply time. */
  port: PolicyReplicationValueRef;
}

/** A predefined FWCloud service (or service group), referenced by its fixed id. */
export interface PolicyReplicationProvisionStandardService {
  kind: 'std' | 'stdGroup';
  id: number;
}

export type PolicyReplicationProvisionService =
  | PolicyReplicationProvisionPortService
  | PolicyReplicationProvisionStandardService
  | ReplicationProfileExternalObjectUsage;

export function isStandardProvisionService(
  service: PolicyReplicationProvisionService,
): service is PolicyReplicationProvisionStandardService {
  return 'kind' in service && (service.kind === 'std' || service.kind === 'stdGroup');
}

/**
 * One side (source or destination) of a provisioned rule. `interfaceRole`
 * resolves to the addresses of the interface carrying that role, which is how a
 * rule says "only the addresses of my own LAN" without naming them.
 */
export interface PolicyReplicationProvisionObject {
  kind:
    | 'address'
    | 'network'
    | 'range'
    | 'host'
    | 'interfaceRole'
    | 'std'
    | 'stdGroup'
    | 'vpnClient'
    | 'external';
  /** Object reference of the template, when kind is 'external'. */
  referenceId?: string;
  /** Address/network/range literal or { param } reference. Unused for the other kinds. */
  value?: PolicyReplicationValueRef;
  /** Interface role, when kind is 'interfaceRole'. */
  role?: string;
  /** Fixed id of a predefined FWCloud object or group, when kind is 'std' or 'stdGroup'. */
  id?: number;
  name?: string;
  /**
   * The template's own connection id, when kind is 'vpnClient' — a VPN client carries no address of
   * its own here (unlike every other kind, which is a literal or a { param } reference): it is
   * resolved later, in policy-replication.service.ts, against that connection's real, already-created
   * config (see ProvisionOptions.vpnConfigIds there), because a VPN client is referenced in a rule
   * through its own relation table (policy_r__openvpn and its WireGuard/IPsec equivalents), never as
   * a plain address/network object.
   */
  vpnId?: string;
}

export interface PolicyReplicationProvisionRule {
  chain: ReplicationProfileRuleChain;
  /** IP family of the rule. Defaults to 4. */
  ipVersion: ReplicationProfileIpVersion;
  /** Defaults to 'accept'. */
  action?: 'accept' | 'deny';
  /** Roles of the inbound interfaces (match provisioned interface roles). A rule may have several. */
  inRoles: string[];
  /** Roles of the outbound interfaces. */
  outRoles: string[];
  source: PolicyReplicationProvisionObject[];
  destination: PolicyReplicationProvisionObject[];
  /** Services (ports) the rule matches. */
  services: PolicyReplicationProvisionService[];
  /** NAT only: SNAT translated source (empty means masquerade) / DNAT translated destination. */
  translatedSource: PolicyReplicationProvisionObject[];
  translatedDestination: PolicyReplicationProvisionObject[];
  translatedServices: PolicyReplicationProvisionService[];
  comment?: string;
}

export interface PolicyReplicationProvisionRoute {
  destination: PolicyReplicationProvisionObject[];
  /** Gateway address; optional when the route goes out through an interface. */
  gateway?: PolicyReplicationProvisionObject;
  interfaceRole?: string;
  comment?: string;
}

export interface PolicyReplicationProvisionRoutingTable {
  /** Profile-local key rules use to point at the table. */
  key: string;
  number: number;
  name: string;
  comment?: string;
  routes: PolicyReplicationProvisionRoute[];
}

export interface PolicyReplicationProvisionRoutingRule {
  from: PolicyReplicationProvisionObject[];
  /** Key of a table declared in routing.tables. */
  table: string;
  comment?: string;
}

export interface PolicyReplicationProvisionRouting {
  tables: PolicyReplicationProvisionRoutingTable[];
  rules: PolicyReplicationProvisionRoutingRule[];
}

export interface PolicyReplicationProvisionDhcp {
  network: PolicyReplicationProvisionObject | null;
  range: PolicyReplicationProvisionObject | null;
  router: PolicyReplicationProvisionObject | null;
  dns: PolicyReplicationProvisionObject[];
  maxLease: number;
  comment?: string;
}

export interface PolicyReplicationProvisionKeepalived {
  interfaceRole?: string;
  virtualIps: PolicyReplicationProvisionObject[];
  /**
   * Cluster node acting as master: a topologyPreset node role (resolved through the
   * apply request's nodeRoleMapping) or, in older profiles, a 1-based node position.
   */
  masterNode: string | number;
  comment?: string;
}

export interface PolicyReplicationProvisionHaproxy {
  frontendIp: PolicyReplicationProvisionObject | null;
  frontendService: PolicyReplicationProvisionService | null;
  backendIps: PolicyReplicationProvisionObject[];
  backendService: PolicyReplicationProvisionService | null;
  comment?: string;
}

export interface PolicyReplicationProvisionSystem {
  dhcp: PolicyReplicationProvisionDhcp[];
  keepalived: PolicyReplicationProvisionKeepalived[];
  haproxy: PolicyReplicationProvisionHaproxy[];
}

export interface PolicyReplicationProvision {
  interfaces: PolicyReplicationProvisionInterface[];
  rules: PolicyReplicationProvisionRule[];
  routing: PolicyReplicationProvisionRouting;
  system: PolicyReplicationProvisionSystem;
}

export const DEFAULT_DHCP_MAX_LEASE = 86400;

/** Number of entries a provision block creates besides interfaces and filter/NAT rules. */
export function countProvisionExtras(provision: PolicyReplicationProvision): number {
  return (
    provision.routing.tables.length +
    provision.routing.tables.reduce((total, table) => total + table.routes.length, 0) +
    provision.routing.rules.length +
    provision.system.dhcp.length +
    provision.system.keepalived.length +
    provision.system.haproxy.length
  );
}

/** Spellings of the editor's structure, the block read when `provision` declares nothing. */
export const POLICY_STRUCTURE_FIELDS = [
  'policyStructure',
  'policy_structure',
  'templateStructure',
  'template_structure',
] as const;

/** A block of a profile model describing what to provision, and the model field holding it. */
export interface ProfileProvisioningSource {
  field: string;
  value: Record<string, unknown>;
}

/**
 * The block getProfileProvisioning() reads: `provision` when it declares something, otherwise the
 * editor's structure (`policyStructure` or one of its spellings), otherwise an empty `provision`.
 */
export function getProfileProvisioningSource(model: unknown): ProfileProvisioningSource | null {
  const record = asReplicationProfileRecord(model);
  const provision = asReplicationProfileRecord(record?.provision);

  if (hasProvisionCollections(provision)) {
    return { field: 'provision', value: provision };
  }

  return (
    getProfileStructure(record) ?? (provision ? { field: 'provision', value: provision } : null)
  );
}

/**
 * Extracts and validates the declarative provisioning block from a profile
 * model. Returns null for regular (source-based) profiles.
 */
export function getProfileProvisioning(model: unknown): PolicyReplicationProvision | null {
  const source = getProfileProvisioningSource(model);

  if (!source) {
    return null;
  }

  const provision = parseProvision(source.value);

  if (
    provision.interfaces.length === 0 &&
    provision.rules.length === 0 &&
    countProvisionExtras(provision) === 0 &&
    !getProfileStructure(asReplicationProfileRecord(model))
  ) {
    return null;
  }

  return provision;
}

function getProfileStructure(
  record: Record<string, unknown> | null,
): ProfileProvisioningSource | null {
  if (!record) {
    return null;
  }

  for (const field of POLICY_STRUCTURE_FIELDS) {
    const structure = asReplicationProfileRecord(record[field]);

    if (structure) {
      return { field, value: structure };
    }
  }

  return null;
}

function hasProvisionCollections(
  record: Record<string, unknown> | null,
): record is Record<string, unknown> {
  return (
    !!record &&
    (Array.isArray(record.interfaces) ||
      Array.isArray(record.rules) ||
      !!asReplicationProfileRecord(record.routing) ||
      !!asReplicationProfileRecord(record.system))
  );
}

function parseProvision(provisionRaw: Record<string, unknown>): PolicyReplicationProvision {
  const interfacesByRole = new Map<string, PolicyReplicationProvisionInterface>();

  const ensureInterface = (
    role: string,
    name: string = role,
    addresses: PolicyReplicationProvisionAddress[] = [],
  ): string => {
    const key = role.toLowerCase();
    const existing = interfacesByRole.get(key);

    if (!existing) {
      interfacesByRole.set(key, { name, role, addresses });
      return role;
    }

    // A role first seen from a rule reference carries no addressing; a later
    // explicit declaration fills it in.
    if (existing.addresses.length === 0 && addresses.length > 0) {
      existing.addresses = addresses;
    }

    return existing.role;
  };

  for (const item of Array.isArray(provisionRaw.interfaces) ? provisionRaw.interfaces : []) {
    const iface = parseProvisionInterface(item);

    if (iface) {
      ensureInterface(iface.role, iface.name, iface.addresses);
    }
  }

  const rules = (Array.isArray(provisionRaw.rules) ? provisionRaw.rules : [])
    .map((rule) => parseProvisionRule(rule, ensureInterface))
    .filter((item): item is PolicyReplicationProvisionRule => item !== null);

  return {
    interfaces: Array.from(interfacesByRole.values()),
    rules,
    routing: parseProvisionRouting(provisionRaw.routing, ensureInterface),
    system: parseProvisionSystem(provisionRaw.system, ensureInterface),
  };
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return (Array.isArray(value) ? value : [])
    .map(asReplicationProfileRecord)
    .filter((item): item is Record<string, unknown> => item !== null);
}

function optionalComment(record: Record<string, unknown>): string | undefined {
  return typeof record.comment === 'string' ? record.comment : undefined;
}

function optionalRole(
  value: unknown,
  ensureInterface: (role: string) => string,
): string | undefined {
  const role = asReplicationProfileNonEmptyString(value);

  return role ? ensureInterface(role) : undefined;
}

function parseSingleObject(
  value: unknown,
  ensureInterface: (role: string) => string,
): PolicyReplicationProvisionObject | null {
  return parseProvisionRuleSide(value, ensureInterface)[0] ?? null;
}

function parseProvisionRouting(
  value: unknown,
  ensureInterface: (role: string) => string,
): PolicyReplicationProvisionRouting {
  const record = asReplicationProfileRecord(value);

  const tables = recordArray(record?.tables)
    .map((table): PolicyReplicationProvisionRoutingTable | null => {
      const key =
        asReplicationProfileNonEmptyString(table.key) ??
        asReplicationProfileNonEmptyString(table.name);
      const name = asReplicationProfileNonEmptyString(table.name);
      const number = typeof table.number === 'number' ? table.number : Number(table.number);

      if (!key || !name || !Number.isInteger(number)) {
        return null;
      }

      return {
        key,
        number,
        name,
        comment: optionalComment(table),
        routes: recordArray(table.routes).map((route) => ({
          destination: parseProvisionRuleSide(route.destination, ensureInterface),
          gateway: parseSingleObject(route.gateway, ensureInterface) ?? undefined,
          interfaceRole: optionalRole(route.interfaceRole, ensureInterface),
          comment: optionalComment(route),
        })),
      };
    })
    .filter((item): item is PolicyReplicationProvisionRoutingTable => item !== null);

  const rules = recordArray(record?.rules)
    .map((rule): PolicyReplicationProvisionRoutingRule | null => {
      const table = asReplicationProfileNonEmptyString(rule.table);

      return table
        ? {
            from: parseProvisionRuleSide(rule.from, ensureInterface),
            table,
            comment: optionalComment(rule),
          }
        : null;
    })
    .filter((item): item is PolicyReplicationProvisionRoutingRule => item !== null);

  return { tables, rules };
}

function parseProvisionSystem(
  value: unknown,
  ensureInterface: (role: string) => string,
): PolicyReplicationProvisionSystem {
  const record = asReplicationProfileRecord(value);

  return {
    dhcp: recordArray(record?.dhcp).map((entry) => ({
      network: parseSingleObject(entry.network, ensureInterface),
      range: parseSingleObject(entry.range, ensureInterface),
      router: parseSingleObject(entry.router, ensureInterface),
      dns: parseProvisionRuleSide(entry.dns, ensureInterface),
      maxLease:
        typeof entry.maxLease === 'number' && Number.isInteger(entry.maxLease) && entry.maxLease > 0
          ? entry.maxLease
          : DEFAULT_DHCP_MAX_LEASE,
      comment: optionalComment(entry),
    })),
    keepalived: recordArray(record?.keepalived).map((entry) => ({
      interfaceRole: optionalRole(entry.interfaceRole, ensureInterface),
      virtualIps: parseProvisionRuleSide(entry.virtualIps, ensureInterface),
      masterNode:
        asReplicationProfileNonEmptyString(entry.masterNode) ??
        (typeof entry.masterNode === 'number' &&
        Number.isInteger(entry.masterNode) &&
        entry.masterNode > 0
          ? entry.masterNode
          : 1),
      comment: optionalComment(entry),
    })),
    haproxy: recordArray(record?.haproxy).map((entry) => ({
      frontendIp: parseSingleObject(entry.frontendIp, ensureInterface),
      frontendService: parseProvisionServices(entry.frontendService)[0] ?? null,
      backendIps: parseProvisionRuleSide(entry.backendIps, ensureInterface),
      backendService: parseProvisionServices(entry.backendService)[0] ?? null,
      comment: optionalComment(entry),
    })),
  };
}

/**
 * Returns the first of `fields` that holds a non-empty string, or null. Reads
 * the several tolerated spellings of interface/service references in one pass.
 */
function firstNonEmptyString(
  record: Record<string, unknown>,
  fields: readonly string[],
): string | null {
  for (const field of fields) {
    const value = asReplicationProfileNonEmptyString(record[field]);

    if (value) {
      return value;
    }
  }

  return null;
}

/**
 * Returns the first of `fields` holding either a non-empty string or a
 * parameter reference, so `{ "param": "WAN_IP" }` is accepted anywhere a
 * literal is.
 */
function firstValueOrParamRef(
  record: Record<string, unknown>,
  fields: readonly string[],
): PolicyReplicationValueRef {
  for (const field of fields) {
    const raw = record[field];

    if (isReplicationProfileParameterRef(raw)) {
      return raw;
    }

    const value = asReplicationProfileNonEmptyString(raw);

    if (value) {
      return value;
    }

    if (typeof raw === 'number') {
      return raw;
    }
  }

  return null;
}

function parseProvisionAddresses(value: unknown): PolicyReplicationProvisionAddress[] {
  const items = Array.isArray(value) ? value : value === undefined ? [] : [value];

  return items
    .map((item): PolicyReplicationProvisionAddress | null => {
      if (isReplicationProfileParameterRef(item)) {
        return { value: item };
      }

      const literal = asReplicationProfileNonEmptyString(item);

      if (literal) {
        return { value: literal };
      }

      const record = asReplicationProfileRecord(item);

      if (!record) {
        return null;
      }

      const inner = firstValueOrParamRef(record, ['value', 'address', 'cidr', 'ip']);

      return inner === null
        ? null
        : { value: inner, name: firstNonEmptyString(record, ['name']) ?? undefined };
    })
    .filter((item): item is PolicyReplicationProvisionAddress => item !== null);
}

function parseProvisionInterface(value: unknown): PolicyReplicationProvisionInterface | null {
  const record = asReplicationProfileRecord(value);
  if (!record) {
    return null;
  }

  const name = firstNonEmptyString(record, ['name', 'value']);
  const role = asReplicationProfileNonEmptyString(record.role) ?? name;

  if (!name || !role) {
    return null;
  }

  return {
    name,
    role,
    addresses: parseProvisionAddresses(record.addresses ?? record.address ?? record.ips),
  };
}

function parseProvisionRule(
  value: unknown,
  ensureInterface: (
    role: string,
    name?: string,
    addresses?: PolicyReplicationProvisionAddress[],
  ) => string,
): PolicyReplicationProvisionRule | null {
  const record = asReplicationProfileRecord(value);
  if (!record) {
    return null;
  }

  const chainRaw = asReplicationProfileNonEmptyString(record.chain)?.toLowerCase() ?? 'forward';

  if (!isReplicationProfileStringValue(chainRaw, REPLICATION_PROFILE_RULE_CHAINS)) {
    return null;
  }

  const ipVersionRaw = record.ipVersion ?? record.ip_version ?? 4;
  const ipVersion = isReplicationProfileIpVersion(ipVersionRaw) ? ipVersionRaw : null;

  if (ipVersion === null) {
    return null;
  }

  // A single role or a list of roles: FWCloud's In/Out positions accept several interfaces.
  const inRoles = readRoleList(record.inRole ?? record.inRoles ?? record.sourceRole).map((role) =>
    ensureInterface(role),
  );
  const outRoles = readRoleList(record.outRole ?? record.outRoles ?? record.destinationRole).map(
    (role) => ensureInterface(role),
  );

  const comment = typeof record.comment === 'string' ? record.comment : undefined;

  let source = parseProvisionRuleSide(record.source, ensureInterface);
  let destination = parseProvisionRuleSide(record.destination, ensureInterface);

  // Legacy shorthand: a side made only of an interface reference means the
  // rule's inbound/outbound interface, not a source/destination object.
  let effectiveInRoles = inRoles;
  let effectiveOutRoles = outRoles;

  if (effectiveInRoles.length === 0 && isSoleInterfaceRole(source)) {
    effectiveInRoles = [source[0].role];
    source = [];
  }

  if (effectiveOutRoles.length === 0 && isSoleInterfaceRole(destination)) {
    effectiveOutRoles = [destination[0].role];
    destination = [];
  }

  return {
    chain: chainRaw,
    ipVersion,
    action: isReplicationProfileStringValue(record.action, REPLICATION_PROFILE_RULE_ACTIONS)
      ? record.action
      : 'accept',
    inRoles: effectiveInRoles,
    outRoles: effectiveOutRoles,
    source,
    destination,
    services: parseProvisionServices(record.service ?? record.services),
    translatedSource: parseProvisionRuleSide(record.translatedSource, ensureInterface),
    translatedDestination: parseProvisionRuleSide(record.translatedDestination, ensureInterface),
    translatedServices: parseProvisionServices(
      record.translatedService ?? record.translatedServices,
    ),
    comment,
  };
}

/** `{ kind: 'std' | 'stdGroup', id }` reference to a predefined FWCloud object or group. */
function parseStandardReference(
  record: Record<string, unknown>,
): { kind: 'std' | 'stdGroup'; id: number } | null {
  const kind =
    record.kind === REPLICATION_PROFILE_STANDARD_OBJECT_KIND
      ? 'std'
      : record.kind === REPLICATION_PROFILE_STANDARD_GROUP_KIND
        ? 'stdGroup'
        : null;
  const id = typeof record.id === 'number' ? record.id : Number(record.id);

  return kind && Number.isInteger(id) && id > 0 ? { kind, id } : null;
}

function readRoleList(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value])
    .map((item) => asReplicationProfileNonEmptyString(item))
    .filter((item): item is string => item !== null);
}

function isSoleInterfaceRole(side: PolicyReplicationProvisionObject[]): boolean {
  return side.length === 1 && side[0].kind === 'interfaceRole' && side[0].role !== undefined;
}

function parseProvisionRuleSide(
  value: unknown,
  ensureInterface: (role: string) => string,
): PolicyReplicationProvisionObject[] {
  const items = Array.isArray(value) ? value : value === undefined ? [] : [value];

  return items
    .map((item) => parseProvisionObject(item, ensureInterface))
    .filter((item): item is PolicyReplicationProvisionObject => item !== null);
}

/**
 * Parses one rule side entry. A bare string or a `{type:'interface'}` record is
 * read as an interface-role reference, which keeps the pre-existing shorthand
 * working; anything carrying an address/network value becomes an object
 * reference resolved (or created) at apply time.
 */
function parseProvisionObject(
  value: unknown,
  ensureInterface: (role: string) => string,
): PolicyReplicationProvisionObject | null {
  if (isReplicationProfileExternalObjectUsage(value)) {
    return { kind: 'external', referenceId: value.referenceId };
  }

  if (isReplicationProfileParameterRef(value)) {
    return { kind: 'network', value };
  }

  const shorthand = asReplicationProfileNonEmptyString(value);

  if (shorthand) {
    return { kind: 'interfaceRole', role: ensureInterface(shorthand) };
  }

  const record = asReplicationProfileRecord(value);

  if (!record) {
    return null;
  }

  const standard = parseStandardReference(record);

  if (standard) {
    return { ...standard, name: firstNonEmptyString(record, ['name']) ?? undefined };
  }

  const type = firstNonEmptyString(record, ['kind', 'type', 'objectType'])?.toLowerCase();
  const name = firstNonEmptyString(record, ['name']) ?? undefined;

  if (type === 'interface' || type === 'interfacerole') {
    const role = firstNonEmptyString(record, ['role', 'value', 'name', 'ref', 'label']);

    return role ? { kind: 'interfaceRole', role: ensureInterface(role) } : null;
  }

  // A VPN client is Source/Destination only, never an interface role. It is resolved against its
  // real, already-created config downstream (see PolicyReplicationProvisionObject.vpnId), not here:
  // there is no address to parse yet at this point, unlike every other kind.
  if (type === 'vpnclient') {
    const vpnId = firstNonEmptyString(record, ['vpnId', 'vpnid']);

    return vpnId ? { kind: 'vpnClient', vpnId, name } : null;
  }

  const objectValue = firstValueOrParamRef(record, ['value', 'address', 'cidr', 'network', 'ip']);

  if (objectValue === null) {
    // No explicit type and no value: fall back to the interface-role shorthand.
    const role = firstNonEmptyString(record, ['role', 'ref', 'label']);

    return role ? { kind: 'interfaceRole', role: ensureInterface(role) } : null;
  }

  const kind = isReplicationProfileStringValue(type, REPLICATION_PROFILE_OBJECT_KINDS)
    ? type
    : 'network';

  return { kind, value: objectValue, name };
}

function parseProvisionServices(value: unknown): PolicyReplicationProvisionService[] {
  const items = Array.isArray(value) ? value : value === undefined ? [] : [value];

  return items
    .map(parseProvisionServiceEntry)
    .filter((item): item is PolicyReplicationProvisionService => item !== null);
}

function parseProvisionServiceEntry(value: unknown): PolicyReplicationProvisionService | null {
  if (isReplicationProfileExternalObjectUsage(value)) {
    return { kind: 'external', referenceId: value.referenceId };
  }

  const record = asReplicationProfileRecord(value);

  if (record) {
    const standard = parseStandardReference(record);

    if (standard) {
      return standard;
    }

    const protocol = asReplicationProfileNonEmptyString(record.protocol)?.toLowerCase();
    const port = firstValueOrParamRef(record, ['port', 'value']);

    if (
      isReplicationProfileStringValue(protocol, REPLICATION_PROFILE_RULE_PROTOCOLS) &&
      port !== null
    ) {
      return { protocol, port };
    }

    const shorthandValue = firstNonEmptyString(record, ['value', 'name', 'ref', 'label']);

    return shorthandValue ? parseProvisionServiceEntry(shorthandValue) : null;
  }

  const shorthand = asReplicationProfileNonEmptyString(value)?.match(/^(tcp|udp)[/:](\d+)$/i);

  if (!shorthand) {
    return null;
  }

  const protocol = shorthand[1].toLowerCase();

  return isReplicationProfileStringValue(protocol, REPLICATION_PROFILE_RULE_PROTOCOLS)
    ? { protocol, port: Number(shorthand[2]) }
    : null;
}

export type PolicyReplicationConflictType =
  | 'duplicated_rule'
  | 'duplicated_group'
  | 'duplicated_interface_reference'
  | 'duplicated_ipobj_reference'
  | 'incompatible_rule_order'
  | 'unsupported_vpn_reference'
  | 'broken_ipobj_reference';

export interface PolicyReplicationConflict {
  type: PolicyReplicationConflictType;
  message: string;
  sourceRuleId?: number;
  targetRuleId?: number;
}

export interface PolicyReplicationRulePreview {
  sourceRuleId: number;
  /** Null until the rule is actually created (dry_run or not applied). */
  targetRuleId: number | null;
  policyTypeId: number;
  ruleOrder: number;
  comment: string | null;
}

export interface PolicyReplicationGroupPreview {
  sourceGroupId: number;
  /** Null until the group is actually created (dry_run or not applied). */
  targetGroupId: number | null;
  name: string;
}

export type PolicyReplicationReferenceKind = 'interface' | 'ipobj' | 'policy_group' | 'node';

export interface PolicyReplicationResolvedReference {
  kind: PolicyReplicationReferenceKind;
  /** Logical role used for the resolution, when role based. */
  role?: string;
  sourceId: number;
  targetId: number;
}

export interface PolicyReplicationResult {
  mode: PolicyReplicationMode;
  /** True only when changes were committed to the database. */
  applied: boolean;
  createdRules: PolicyReplicationRulePreview[];
  createdGroups: PolicyReplicationGroupPreview[];
  resolvedReferences: PolicyReplicationResolvedReference[];
  /** Target default rule ids removed (or that would be removed) by replace_defaults. */
  removedDefaultRules: number[];
  /** Source rule ids not replicated because of broken or unsupported references. */
  skippedRules: number[];
  conflicts: PolicyReplicationConflict[];
  warnings: string[];
  errors: string[];
  /** Routing and system entries created (or that would be, in dry-run mode) by provisioning. */
  provisioned?: {
    routingTables: number;
    routes: number;
    routingRules: number;
    dhcp: number;
    keepalived: number;
    haproxy: number;
  };
  /** Profiles with external objects: what each of them resolved to (see objectReplacements). */
  objectReferences?: ResolvedProfileObjectReference[];
  /**
   * The external objects the profile uses that no longer exist and were not replaced. Nothing is
   * written while there is any: apply again with an objectReplacements entry for each of them.
   */
  missingObjects?: ResolvedProfileObjectReference[];
}
