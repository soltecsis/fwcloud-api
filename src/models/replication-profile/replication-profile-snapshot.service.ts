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

import * as ipaddr from 'ipaddr.js';
import { profileSystemRuleErrors } from './replication-profile-system-rule';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import { NotFoundException } from '../../fonaments/exceptions/not-found-exception';
import { Service } from '../../fonaments/services/service';
import { DefaultPolicyRuleComments } from '../policy/PolicyRule';
import { PolicyRuleValidityPeriod, policyRuleDateKey } from '../policy/policy-rule-validity';
import { PolicyTypesMap } from '../policy/PolicyType';
import { getProvisionRulePositions, VPN_RELATION_TABLES } from './policy-replication.service';
import type {
  PolicyReplicationProvisionAddress,
  PolicyReplicationProvisionInterface,
  PolicyReplicationProvisionObject,
} from './policy-replication.types';
import { addToList, dbQuery, sqlPlaceholders } from './replication-sql.helpers';
import { ReplicationProfile } from './replication-profile.model';
import { getProvisionRuleNegationError } from './replication-profile-rule-negation';
import { captureVpnSnapshot } from './replication-profile-vpn-snapshot';
import { captureProfileObjectReferences } from './replication-profile-object-reference.service';
import { validateProfileObjectSnapshot } from './replication-profile-object-snapshot';
import {
  parseReplicationProfileAddress,
  type ReplicationProfileParameter,
} from './replication-profile-parameters';
import {
  getProfileObjectReferenceLocations,
  getProfileObjectReferences,
  getProfileReferenceIpObjType,
  isProfileReferenceGroupType,
  getProfileReferenceObjectType,
  PROFILE_OBJECT_DATA_FIELD_SET as OBJECT_DATA_FIELDS,
  PROFILE_OBJECT_DATA_FIELDS,
  PROFILE_SERVICE_REFERENCE_TYPES,
  type ReplicationProfileObjectReference,
} from './replication-profile-object-reference';
import {
  normalizeProfileObjectOptions,
  REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS,
  REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK,
  REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
  type ReplicationProfileExternalObjectUsage,
  type ReplicationProfileTargetKind,
} from './replication-profile.constants';
import {
  ReplicationProfileService,
  type CreateCustomReplicationProfileOptions,
} from './replication-profile.service';

/** Filter and NAT policies of both families, in FWCloud tree order, with their positions. */
const CAPTURED_POLICIES = (['IPv4', 'IPv6'] as const).flatMap((family) =>
  (['INPUT', 'OUTPUT', 'FORWARD', 'SNAT', 'DNAT'] as const).map((chain) => {
    const ipVersion = family === 'IPv4' ? 4 : 6;
    const ruleChain = chain.toLowerCase() as SnapshotChain;
    const positions = getProvisionRulePositions(ipVersion, ruleChain);

    return {
      typeId: PolicyTypesMap.get(`${family}:${chain}`)!,
      chain: ruleChain,
      ipVersion,
      label: `${chain} ${family}`,
      positions,
      objectPositions: new Set(
        [
          positions.source,
          positions.destination,
          positions.service,
          positions.translatedSource,
          positions.translatedDestination,
          positions.translatedService,
        ].filter((position) => position !== undefined),
      ),
    };
  }),
);

type SnapshotChain = 'input' | 'output' | 'forward' | 'snat' | 'dnat';
type CapturedPolicy = (typeof CAPTURED_POLICIES)[number];

// policy_r.action codes expressible in the profile vocabulary.
const RULE_ACTION_ACCEPT = 1;
const RULE_ACTION_DENY = 2;

// Predefined service group the default "useful ICMP" INPUT rule allows.
const DEFAULT_ICMP_SERVICE_GROUP = 5;

/**
 * Why a routing or system entry is left out whatever it references: it is disabled, or it only
 * applies to one cluster node, which it must not be widened from.
 */
function entrySkipReason(
  entry: { active: number; fw_apply_to: number | null },
  noun: 'route' | 'rule',
): string | null {
  if (!entry.active) {
    return `the ${noun} is disabled.`;
  }
  return entry.fw_apply_to !== null
    ? 'it only applies to one cluster node, which templates keep for policy and Keepalived rules only.'
    : null;
}

/** Normalize database fields and validate both native system-rule formats before capture. */
function captureSystemRuleSettings(row: SnapshotSystemRuleRow, service: 'HAProxy' | 'Keepalived') {
  const settings = {
    rule_type: row.rule_type,
    ...(row.rule_type === 2 ? { cfg_text: row.cfg_text } : {}),
    active: !!row.active,
    ...(row.style !== null ? { style: row.style } : {}),
  };
  const errors = profileSystemRuleErrors(settings, service);
  if (service === 'HAProxy' && row.rule_type === 2 && row.fw_apply_to) {
    errors.push('node-restricted manual configurations are unsupported.');
  }
  if (errors.length) {
    throw new HttpException(
      `${service} rule ${row.rule_order} (ID ${row.id}) cannot be captured: ${errors.join(' ')}`,
      422,
    );
  }
  return settings;
}

/**
 * FWCloud stores an object's netmask as '/24' or as '255.255.255.0' (the interface the OpenVPN
 * server creates uses the latter); profile values are CIDR. A mask that isn't a valid one is kept
 * as-is so validation reports the object instead of silently widening it.
 */
export function ipObjCidr(address: string, netmask: string | null): string {
  if (!netmask) return address;
  if (netmask.startsWith('/')) return `${address}${netmask}`;
  if (/^\d+$/.test(netmask)) return `${address}/${netmask}`;
  try {
    const prefix = ipaddr.parse(netmask).prefixLengthFromSubnetMask();
    if (prefix !== null) return `${address}/${prefix}`;
  } catch {
    // Not a dotted netmask: fall through.
  }
  return `${address}${netmask}`;
}

export interface ReplicationProfileSnapshotSource {
  kind: ReplicationProfileTargetKind;
  id: number;
}

export interface CreateReplicationProfileFromSourcePayload {
  source: ReplicationProfileSnapshotSource;
  name: string;
  description?: string | null;
  code?: string;
  scope?: string;
  category?: string | null;
}

export interface ReplicationProfileSnapshotResult {
  profile: ReplicationProfile;
  /** Rules or references that could not be captured into the template. */
  warnings: string[];
}

interface SnapshotFirewallRow {
  id: number;
  name: string;
  cluster: number | null;
  fwcloud: number;
  fwmaster: number;
}

interface SnapshotClusterRow {
  id: number;
  name: string;
  fwcloud: number;
}

interface SnapshotInterfaceRow {
  id: number;
  name: string;
  labelName: string | null;
}

interface SnapshotSystemRuleRow {
  id: number;
  rule_type: number;
  cfg_text: string | null;
  style: string | null;
  rule_order: number;
  active: number;
  comment: string | null;
  fw_apply_to: number | null;
}

interface SnapshotRuleRow {
  id: number;
  type: number;
  rule_order: number;
  action: number;
  active: number;
  special: number;
  comment: string | null;
  negate: string | null;
  options: number;
  time_start: Date | null;
  time_end: Date | null;
  fw_apply_to: number | null;
}

interface SnapshotRuleInterfaceRow {
  rule: number;
  interface: number;
  position: number;
}

interface SnapshotRuleIpObjRow {
  rule: number;
  ipobj: number;
  ipobj_g: number;
  interface: number;
  position: number;
}

interface SnapshotRuleVpnRef {
  rule: number;
  position: number;
  connectionKey: string;
}

/** Everything a policy rule references, by kind. */
interface SnapshotRuleRefs {
  interfaces: SnapshotRuleInterfaceRow[];
  ipObjs: SnapshotRuleIpObjRow[];
  vpns: SnapshotRuleVpnRef[];
}

/** A reference to capture: one object, one group or one interface of the source firewall. */
interface SnapshotObjectRef {
  ipobj?: number;
  ipobj_g?: number;
  interface?: number;
}

/** Address/network object referenced by a captured rule or interface. */
interface SnapshotIpObjRow {
  id: number;
  name: string;
  type: number;
  ip_version: number;
  address: string;
  netmask: string | null;
  interface: number | null;
  fwcloud?: number | null;
  range_start?: string | null;
  range_end?: string | null;
  comment?: string | null;
  diff_serv?: number | null;
  options?: string | number | null;
}

interface SnapshotGroupRow {
  id: number;
  name: string;
  type: number;
  fwcloud: number | null;
}

interface SnapshotObjectLookup {
  objects: Map<number, SnapshotIpObjRow>;
  groups: Map<number, SnapshotGroupRow>;
}

interface SnapshotProvisionObject extends PolicyReplicationProvisionObject {
  kind: Exclude<PolicyReplicationProvisionObject['kind'], 'host'>;
}

type SnapshotProvisionService =
  ReplicationProfileExternalObjectUsage | { kind: 'std' | 'stdGroup'; id: number; name?: string };

type SnapshotObjectReference = Pick<
  ReplicationProfileObjectReference,
  'referenceId' | 'objectType' | 'sourceObjectId'
>;

/** A captured value, or the reason it cannot be expressed in a profile. */
type SnapshotCapture<T> = { value: T } | { reason: string };

/** Read a capture after its failure reason has been checked. */
function capturedValue<T>(capture: SnapshotCapture<T>): T {
  return (capture as { value: T }).value;
}

function captureFailure(captures: SnapshotCapture<unknown>[]): { reason: string } | undefined {
  return captures.find((capture): capture is { reason: string } => 'reason' in capture);
}

function assertPolicyCaptureComplete(errors: string[]): void {
  if (errors.length > 0) {
    throw new HttpException(`Policy capture failed:\n${errors.join('\n')}`, 422);
  }
}

interface SnapshotProvisionRule extends PolicyRuleValidityPeriod {
  chain: SnapshotChain;
  ipVersion: number;
  action: 'accept' | 'deny';
  /** Native policy_r.active: a disabled rule is captured in place and stays disabled. */
  active: boolean;
  /** Native policy_r.options bitmask, including LOG, STATELESS and STATEFUL. */
  options: number;
  /** Negated policy_position ids, using policy_r's space-separated representation. */
  negate?: string | null;
  /** One role, or a list when the rule matches several interfaces. */
  inRole?: string | string[];
  outRole?: string | string[];
  source?: SnapshotProvisionObject[];
  destination?: SnapshotProvisionObject[];
  services?: SnapshotProvisionService[];
  translatedSource?: SnapshotProvisionObject[];
  translatedDestination?: SnapshotProvisionObject[];
  translatedService?: SnapshotProvisionService[];
  comment?: string;
  /** Role of the only cluster node the rule applies to. */
  nodeRole?: string;
}

interface SnapshotTopologyNode {
  role: string;
  name: string;
  required: boolean;
  master?: boolean;
}

interface SourceSnapshot {
  targetKind: ReplicationProfileTargetKind;
  sourceName: string;
  model: Record<string, unknown>;
  warnings: string[];
}

/**
 * Collects reusable profile values: address parameters default to the captured values,
 * while custom groups and services retain their complete configuration through external snapshots.
 */
class SnapshotValueCollector {
  private readonly byIdentity = new Map<string, ReplicationProfileParameter>();
  private readonly usedNames = new Set<string>();
  private readonly objectReferences = new Map<string, SnapshotObjectReference>();
  private readonly interfaceAddresses = new Map<number, SnapshotProvisionObject>();

  registerInterfaceAddress(
    id: number,
    role: string,
    index: number,
    address: PolicyReplicationProvisionAddress,
  ): void {
    this.interfaceAddresses.set(id, {
      kind: 'address',
      value: address.value,
      name: address.name,
      interfaceRole: role,
      interfaceAddressIndex: index,
    });
  }

  getInterfaceAddress(id: number): SnapshotProvisionObject | undefined {
    return this.interfaceAddresses.get(id);
  }

  defineService(
    service: Pick<SnapshotIpObjRow, 'type' | 'id'>,
  ): ReplicationProfileExternalObjectUsage | undefined {
    const objectType = PROFILE_SERVICE_REFERENCE_TYPES.get(service.type);
    if (!objectType) {
      return undefined;
    }

    return this.defineReference(service, objectType, 'service');
  }

  defineGroup(group: SnapshotGroupRow): ReplicationProfileExternalObjectUsage | undefined {
    const objectType = getProfileReferenceObjectType(group.type);
    if (
      !objectType ||
      !isProfileReferenceGroupType(group.type) ||
      PROFILE_SERVICE_REFERENCE_TYPES.has(group.type)
    ) {
      return undefined;
    }
    return this.defineReference(group, objectType, 'group');
  }

  private defineReference(
    object: Pick<SnapshotIpObjRow, 'type' | 'id'>,
    objectType: SnapshotObjectReference['objectType'],
    prefix: 'service' | 'group',
  ): ReplicationProfileExternalObjectUsage {
    const referenceId = `${prefix}-${object.type}-${object.id}`;
    if (!this.objectReferences.has(referenceId)) {
      this.objectReferences.set(referenceId, {
        referenceId,
        objectType,
        sourceObjectId: object.id,
      });
    }
    return { kind: 'external', referenceId };
  }

  /** Discard references belonging only to skipped rules or system entries. */
  getObjectReferences(model: Record<string, unknown>): SnapshotObjectReference[] {
    const locations = getProfileObjectReferenceLocations(model);
    return Array.from(this.objectReferences.values()).filter((reference) =>
      locations.has(reference.referenceId),
    );
  }

  defineInterfaceAddress(
    role: string,
    index: number,
    literal: string,
    ipVersion: 4 | 6,
  ): { param: string } {
    const suffix = index === 0 ? '' : `_${index + 1}`;

    return this.define(
      `${this.slug(role)}_IP${suffix}`,
      'address',
      `${role.toUpperCase()} interface address`,
      literal,
      ipVersion,
      `interface:${JSON.stringify([role, index])}`,
    );
  }

  defineAddress(
    kind: 'address' | 'network' | 'range',
    literal: string,
    objectName: string,
  ): { param: string } {
    return this.define(this.slug(objectName), kind, objectName, literal);
  }

  /** Free objects reuse literal parameters; assigned IPs retain their declaration identity. */
  private define(
    baseName: string,
    type: ReplicationProfileParameter['type'],
    label: string,
    defaultValue: string | number,
    ipVersion?: 4 | 6,
    identity?: string,
  ): { param: string } {
    const key = identity ?? `literal:${type}:${String(defaultValue)}`;
    const existing = this.byIdentity.get(key);

    if (existing) {
      if (ipVersion !== undefined) {
        existing.ipVersion = ipVersion;
      }
      return { param: existing.name };
    }

    const name = this.uniqueName(baseName || 'VALUE');

    const parameter: ReplicationProfileParameter = {
      name,
      type,
      label,
      required: true,
      default: defaultValue,
      ...(ipVersion === undefined ? {} : { ipVersion }),
    };
    this.byIdentity.set(key, parameter);

    return { param: name };
  }

  private uniqueName(base: string): string {
    let name = base;
    let suffix = 2;

    while (this.usedNames.has(name)) {
      name = `${base}_${suffix++}`;
    }

    this.usedNames.add(name);

    return name;
  }

  private slug(value: string): string {
    const slug = value
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return /^[A-Z]/.test(slug) ? slug : `P_${slug}`;
  }

  getParameters(): ReplicationProfileParameter[] {
    return Array.from(this.byIdentity.values());
  }
}

/**
 * Builds custom replication ("policy template") profiles by capturing the
 * current structure of an existing firewall or cluster: its interfaces become
 * the profile's logical roles, its filter/NAT policies become declarative
 * `provision`/`policyStructure` rules, and its VPNs become `vpnTemplate`
 * definitions. The captured profile is
 * self-contained, so it can later be applied without the source firewall.
 *
 * Every required policy rule must be representable. Incomplete policy captures
 * fail before a profile or its JSON is persisted.
 */
export class ReplicationProfileSnapshotService extends Service {
  protected _replicationProfileService: ReplicationProfileService;

  public async build(): Promise<ReplicationProfileSnapshotService> {
    await super.build();
    this._replicationProfileService = await this._app.getService<ReplicationProfileService>(
      ReplicationProfileService.name,
    );

    return this;
  }

  public async createProfileFromSource(
    payload: CreateReplicationProfileFromSourcePayload,
    options: CreateCustomReplicationProfileOptions,
  ): Promise<ReplicationProfileSnapshotResult> {
    const snapshot = await this.buildSourceSnapshot(payload.source, options.fwCloudId);

    const profile = await this._replicationProfileService.createCustomProfile(
      {
        name: payload.name,
        description:
          payload.description ??
          `Template captured from ${payload.source.kind} "${snapshot.sourceName}".`,
        code: payload.code,
        scope: payload.scope ?? 'fwcloud',
        targetKind: snapshot.targetKind,
        category: payload.category ?? null,
        model: snapshot.model,
      },
      options,
    );

    return { profile, warnings: snapshot.warnings };
  }

  /**
   * Captures the interfaces, policies, services and VPNs of the source into a
   * profile model, without persisting anything.
   */
  public async buildSourceSnapshot(
    source: ReplicationProfileSnapshotSource,
    fwCloudId: number,
  ): Promise<SourceSnapshot> {
    const resolved = await this.resolveSourceFirewall(source, fwCloudId);
    const warnings: string[] = [];

    const interfaces = await dbQuery<SnapshotInterfaceRow>(
      'SELECT id, name, labelName FROM interface WHERE firewall = ? ORDER BY id',
      [resolved.firewall.id],
    );
    const roleByInterfaceId = this.assignInterfaceRoles(interfaces);
    const values = new SnapshotValueCollector();
    const addressesByInterface = await this.loadInterfaceAddresses(
      interfaces.map((iface) => iface.id),
    );
    const { vpnTemplate, clients } = await captureVpnSnapshot(
      resolved.firewall.id,
      fwCloudId,
      warnings,
    );
    const vpnObjects = new Map(
      Array.from(clients, ([key, client]): [string, SnapshotProvisionObject] => [
        key,
        { kind: 'vpnClient', vpnId: client.id, name: client.name },
      ]),
    );
    const loopbackInterfaceIds = new Set(
      interfaces.filter((iface) => iface.name === 'lo').map((iface) => iface.id),
    );
    // assignInterfaceRoles already guarantees uniqueness.
    const roles = Array.from(roleByInterfaceId.values());
    const profileInterfaces: PolicyReplicationProvisionInterface[] = [];
    for (const iface of interfaces) {
      const role = roleByInterfaceId.get(iface.id) as string;
      profileInterfaces.push({
        name: iface.name,
        role,
        addresses: await this.captureInterfaceAddresses(
          iface,
          role,
          addressesByInterface.get(iface.id) ?? [],
          values,
          fwCloudId,
        ),
      });
    }
    // Capture each assigned IP before rules so they can reference that exact address,
    // rather than the interface's entire address set or an In/Out restriction.
    const { rules, objectRuleLabels } = await this.capturePolicyRules(
      resolved.firewall.id,
      resolved.nodeRoleById,
      roleByInterfaceId,
      loopbackInterfaceIds,
      values,
      vpnObjects,
    );
    const routing = await this.captureRouting(
      resolved.firewall.id,
      roleByInterfaceId,
      values,
      warnings,
    );
    const system = await this.captureSystem(
      resolved.firewall,
      resolved.topologyNodes,
      resolved.nodeRoleById,
      roleByInterfaceId,
      values,
      warnings,
    );
    const policyStructure = {
      interfaces: profileInterfaces,
      rules,
      ...(routing ? { routing } : {}),
      ...(system ? { system } : {}),
    };
    const keepalived = (system?.keepalived ?? []) as { masterNode?: string; nodeRole?: string }[];

    const model: Record<string, unknown> = {
      parameters: values.getParameters(),
      compatibility: {
        // Target kind selects the native topology conversion when the template is applied.
        target_kinds: ['firewall', 'cluster'],
        supportedRoles: roles,
      },
      policyStructure,
      provision: policyStructure,
      ...(vpnTemplate ? { vpnTemplate } : {}),
      sourceRef: {
        kind: source.kind,
        id: source.id,
        name: resolved.sourceName,
        capturedAt: new Date().toISOString(),
      },
    };

    if (roles.length > 0) {
      model.roleAssignments = { interfaceRoles: roles };
    }

    if (resolved.topologyNodes) {
      // A node that rules or Keepalived depend on is required wherever the template is applied.
      const usedNodeRoles = new Set([
        ...rules.map((rule) => rule.nodeRole),
        ...keepalived.flatMap((entry) => [entry.masterNode, entry.nodeRole]),
      ]);
      model.topologyPreset = {
        nodes: resolved.topologyNodes.map((node) =>
          usedNodeRoles.has(node.role) ? { ...node, required: true } : node,
        ),
      };

      if (roles.length > 0) {
        (model.roleAssignments as Record<string, unknown>).nodeRoles = resolved.topologyNodes.map(
          (node) => node.role,
        );
      }
    }

    const objectReferences = values.getObjectReferences(model);
    if (objectReferences.length > 0) {
      model.objectReferences = objectReferences;
    }

    const capturedModel = await captureProfileObjectReferences(model, fwCloudId);
    await this.validatePolicyObjects(
      getProfileObjectReferences(capturedModel),
      objectRuleLabels,
      fwCloudId,
    );

    return {
      targetKind: source.kind,
      sourceName: resolved.sourceName,
      model: capturedModel,
      warnings,
    };
  }

  /** Validate each shared object and all its dependencies, retaining affected rule labels. */
  private async validatePolicyObjects(
    references: ReplicationProfileObjectReference[],
    objectRuleLabels: Map<string, Set<string>>,
    fwCloudId: number,
  ): Promise<void> {
    const errors: string[] = [];
    for (const reference of references) {
      const labels = objectRuleLabels.get(reference.referenceId);
      if (!labels) continue;

      const type = getProfileReferenceIpObjType(reference.objectType)!;
      const invalid = await validateProfileObjectSnapshot(reference.snapshot, type, fwCloudId, {
        checkDestination: false,
      });
      if (invalid) {
        errors.push(
          `${Array.from(labels).join(', ')} cannot be captured: ${isProfileReferenceGroupType(type) ? 'group' : 'service'} "${reference.sourceName ?? reference.referenceId}" (${reference.referenceId}): ${invalid}`,
        );
      }
    }
    assertPolicyCaptureComplete(errors);
  }

  private async resolveSourceFirewall(
    source: ReplicationProfileSnapshotSource,
    fwCloudId: number,
  ): Promise<{
    firewall: SnapshotFirewallRow;
    sourceName: string;
    topologyNodes: SnapshotTopologyNode[] | null;
    /** Topology role of each cluster node (policy_r.fw_apply_to); empty for a firewall. */
    nodeRoleById: Map<number, string>;
  }> {
    if (source.kind === 'cluster') {
      const clusters = await dbQuery<SnapshotClusterRow>(
        'SELECT id, name, fwcloud FROM cluster WHERE id = ? AND fwcloud = ?',
        [source.id, fwCloudId],
      );

      if (clusters.length === 0) {
        throw new NotFoundException('Source cluster not found');
      }

      const members = await dbQuery<SnapshotFirewallRow>(
        'SELECT id, name, cluster, fwcloud, fwmaster FROM firewall WHERE cluster = ? ORDER BY fwmaster DESC, id',
        [source.id],
      );
      const master = members.find((member) => member.fwmaster === 1);

      if (!master) {
        throw new HttpException(`Master firewall of source cluster ${source.id} not found.`, 422);
      }

      const topologyNodes = this.buildTopologyNodes(members);

      return {
        firewall: master,
        sourceName: clusters[0].name,
        topologyNodes,
        nodeRoleById: new Map(
          members.map((member, index): [number, string] => [member.id, topologyNodes[index].role]),
        ),
      };
    }

    const firewalls = await dbQuery<SnapshotFirewallRow>(
      'SELECT id, name, cluster, fwcloud, fwmaster FROM firewall WHERE id = ? AND fwcloud = ?',
      [source.id, fwCloudId],
    );

    if (firewalls.length === 0) {
      throw new NotFoundException('Source firewall not found');
    }

    return {
      firewall: firewalls[0],
      sourceName: firewalls[0].name,
      topologyNodes: null,
      nodeRoleById: new Map(),
    };
  }

  /** Master first (required), remaining members become backup roles. */
  private buildTopologyNodes(members: SnapshotFirewallRow[]): SnapshotTopologyNode[] {
    let backupIndex = 0;

    return members.map((member) => {
      if (member.fwmaster === 1) {
        return { role: 'master', name: member.name, required: true, master: true };
      }

      backupIndex++;

      return {
        role: backupIndex === 1 ? 'backup' : `backup${backupIndex}`,
        name: member.name,
        required: false,
      };
    });
  }

  /**
   * Logical role of each interface: the label when set, the name otherwise.
   * Roles must be unique within a profile, so collisions get a numeric suffix.
   */
  private assignInterfaceRoles(interfaces: SnapshotInterfaceRow[]): Map<number, string> {
    const roleByInterfaceId = new Map<number, string>();
    const usedRoles = new Set<string>();

    for (const iface of interfaces) {
      const base = (iface.labelName ?? '').trim() || iface.name.trim() || `iface-${iface.id}`;
      let role = base;
      let suffix = 2;

      while (usedRoles.has(role.toLowerCase())) {
        role = `${base}-${suffix}`;
        suffix++;
      }

      usedRoles.add(role.toLowerCase());
      roleByInterfaceId.set(iface.id, role);
    }

    return roleByInterfaceId;
  }

  /**
   * Captures every filter and NAT policy of the source, in both IP families, enabled and disabled
   * rules alike and in their order. Policies holding only their untouched default rules are left
   * out; rules the vocabulary cannot express cause an explicit validation failure.
   */
  private async capturePolicyRules(
    firewallId: number,
    nodeRoleById: Map<number, string>,
    roleByInterfaceId: Map<number, string>,
    loopbackInterfaceIds: Set<number>,
    values: SnapshotValueCollector,
    vpnObjects: Map<string, SnapshotProvisionObject>,
  ): Promise<{ rules: SnapshotProvisionRule[]; objectRuleLabels: Map<string, Set<string>> }> {
    const typeIds = CAPTURED_POLICIES.map((policy) => policy.typeId);
    const rules = await dbQuery<SnapshotRuleRow>(
      `SELECT id, type, rule_order, action, active, special, comment, negate, options, time_start, time_end, fw_apply_to FROM policy_r
       WHERE firewall = ? AND type IN (${sqlPlaceholders(typeIds.length)}) ORDER BY rule_order`,
      [firewallId, ...typeIds],
    );
    const nonSpecialRules = rules.filter((rule) => rule.special === 0);
    const rulesByType = new Map<number, SnapshotRuleRow[]>();
    for (const rule of nonSpecialRules) {
      addToList(rulesByType, Number(rule.type), rule);
    }
    const ruleIds = nonSpecialRules.map((rule) => rule.id);
    const [interfaceRefs, ipObjRefs, vpnRefs] = await Promise.all([
      this.loadRuleInterfaceRefs(ruleIds),
      this.loadRuleIpObjRefs(ruleIds),
      this.loadRuleVpnRefs(ruleIds),
    ]);
    const refsOf = (ruleId: number): SnapshotRuleRefs => ({
      interfaces: interfaceRefs.get(ruleId) ?? [],
      ipObjs: ipObjRefs.get(ruleId) ?? [],
      vpns: vpnRefs.get(ruleId) ?? [],
    });

    // Applying a profile that brings rules to a policy replaces that policy's default rules, so a
    // policy is captured whole, defaults included, once it holds anything else: a rule of its own or
    // a default rule the user changed. Policies left with their untouched defaults are skipped, as
    // the target generates those itself.
    const customizedPolicies = CAPTURED_POLICIES.filter((policy) =>
      rulesByType
        .get(policy.typeId)
        ?.some(
          (rule) =>
            !this.isUntouchedDefaultRule(rule, policy, refsOf(rule.id), loopbackInterfaceIds),
        ),
    );
    const candidateRules = customizedPolicies.flatMap((policy) => rulesByType.get(policy.typeId)!);
    const lookup = await this.loadObjectLookup(
      candidateRules.flatMap((rule) => ipObjRefs.get(rule.id) ?? []),
    );

    const captured: SnapshotProvisionRule[] = [];
    const objectRuleLabels = new Map<string, Set<string>>();
    const errors: string[] = [];

    for (const policy of customizedPolicies) {
      for (const rule of rulesByType.get(policy.typeId)!) {
        const label = this.ruleLabel(rule, policy.label);
        const nodeRole = rule.fw_apply_to === null ? undefined : nodeRoleById.get(rule.fw_apply_to);
        if (rule.fw_apply_to !== null && !nodeRole) {
          errors.push(
            `${label} cannot be captured: it only applies to a firewall that is not a node of the source.`,
          );
          continue;
        }

        const capture = this.captureRule(
          rule,
          policy,
          refsOf(rule.id),
          vpnObjects,
          roleByInterfaceId,
          lookup,
          values,
        );
        if ('reason' in capture) {
          errors.push(`${label} cannot be captured: ${capture.reason}`);
          continue;
        }

        const provisionRule = capture.value;
        captured.push(nodeRole ? { ...provisionRule, nodeRole } : provisionRule);
        for (const objects of [
          provisionRule.source,
          provisionRule.destination,
          provisionRule.translatedSource,
          provisionRule.translatedDestination,
          provisionRule.services,
          provisionRule.translatedService,
        ]) {
          for (const object of objects ?? []) {
            if (object.kind === 'external' && object.referenceId) {
              const labels = objectRuleLabels.get(object.referenceId) ?? new Set<string>();
              labels.add(label);
              objectRuleLabels.set(object.referenceId, labels);
            }
          }
        }
      }
    }

    assertPolicyCaptureComplete(errors);
    return { rules: captured, objectRuleLabels };
  }

  /**
   * Whether a rule is still exactly one of the INPUT rules PolicyRule.insertDefaultPolicy creates:
   * "self host" accepts anything coming in through the loopback interface, and "useful ICMP" the
   * predefined ICMP group (5) as its only service. Any change (another object, a VPN, a different
   * action, disabling it, restricting it to one node) makes it the user's own.
   */
  private isUntouchedDefaultRule(
    rule: SnapshotRuleRow,
    policy: CapturedPolicy,
    { interfaces, ipObjs, vpns }: SnapshotRuleRefs,
    loopbackInterfaceIds: Set<number>,
  ): boolean {
    if (
      policy.chain !== 'input' ||
      rule.action !== RULE_ACTION_ACCEPT ||
      rule.active !== 1 ||
      rule.options !== 0 ||
      rule.fw_apply_to !== null ||
      !!rule.time_start ||
      !!rule.time_end ||
      !!rule.negate ||
      vpns.length > 0
    ) {
      return false;
    }

    if (rule.comment === DefaultPolicyRuleComments.SELF_HOST_TRAFFIC) {
      return (
        ipObjs.length === 0 &&
        interfaces.length === 1 &&
        interfaces[0].position === policy.positions.in &&
        loopbackInterfaceIds.has(interfaces[0].interface)
      );
    }

    if (rule.comment === DefaultPolicyRuleComments.USEFUL_ICMP) {
      return (
        interfaces.length === 0 &&
        ipObjs.length === 1 &&
        ipObjs[0].position === policy.positions.service &&
        Number(ipObjs[0].ipobj_g) === DEFAULT_ICMP_SERVICE_GROUP
      );
    }

    return false;
  }

  /**
   * Maps one policy_r row into the provision vocabulary, or explains why it cannot
   * be represented without broadening the original rule.
   */
  private captureRule(
    rule: SnapshotRuleRow,
    policy: CapturedPolicy,
    { interfaces: interfaceRefs, ipObjs: ipObjRefs, vpns: vpnRefs }: SnapshotRuleRefs,
    vpnObjects: Map<string, SnapshotProvisionObject>,
    roleByInterfaceId: Map<number, string>,
    lookup: SnapshotObjectLookup,
    values: SnapshotValueCollector,
  ): SnapshotCapture<SnapshotProvisionRule> {
    const isNat = policy.chain === 'snat' || policy.chain === 'dnat';

    if (!isNat && rule.action !== RULE_ACTION_ACCEPT && rule.action !== RULE_ACTION_DENY) {
      return { reason: 'only ACCEPT and DENY actions are supported.' };
    }

    const { positions } = policy;
    if (
      vpnRefs.some(
        (ref) =>
          !vpnObjects.has(ref.connectionKey) ||
          ![positions.source, positions.destination].includes(ref.position),
      )
    ) {
      return {
        reason: 'it contains a VPN reference that cannot be represented by a captured VPN client.',
      };
    }
    const inRefs = interfaceRefs.filter((ref) => ref.position === positions.in);
    const outRefs = interfaceRefs.filter((ref) => ref.position === positions.out);

    if (interfaceRefs.length !== inRefs.length + outRefs.length) {
      return {
        reason: 'it references interfaces in positions the vocabulary cannot express.',
      };
    }

    const refsByPosition = new Map<number, SnapshotObjectRef[]>();
    for (const ref of ipObjRefs) {
      if (!policy.objectPositions.has(ref.position)) {
        return {
          reason: 'it references objects in positions the vocabulary cannot express.',
        };
      }
      addToList(refsByPosition, ref.position, ref);
    }

    const at = (position: number | undefined) =>
      position === undefined ? [] : (refsByPosition.get(position) ?? []);
    const objects = (position: number | undefined) =>
      this.captureObjects(at(position), roleByInterfaceId, lookup, values);
    // Checked above: every VPN reference is a captured client in the source or destination.
    const vpnClientsAt = (position: number | undefined) =>
      vpnRefs
        .filter((ref) => ref.position === position)
        .map((ref) => vpnObjects.get(ref.connectionKey)!);
    const services = (position: number | undefined) =>
      this.captureServices(at(position), lookup, values);

    const sides = {
      source: objects(positions.source),
      destination: objects(positions.destination),
      services: services(positions.service),
      translatedSource: objects(positions.translatedSource),
      translatedDestination: objects(positions.translatedDestination),
      translatedService: services(positions.translatedService),
    };
    const failed = captureFailure(Object.values(sides));

    if (failed) {
      return failed;
    }

    const inRoles = inRefs.map((ref) => roleByInterfaceId.get(ref.interface));
    const outRoles = outRefs.map((ref) => roleByInterfaceId.get(ref.interface));

    if (inRoles.some((role) => !role) || outRoles.some((role) => !role)) {
      return { reason: 'it references an interface of another firewall.' };
    }

    const roleValue = (roles: string[]) => (roles.length === 1 ? roles[0] : roles);

    const captured: SnapshotProvisionRule = {
      chain: policy.chain,
      ipVersion: policy.ipVersion,
      action: rule.action === RULE_ACTION_DENY ? 'deny' : 'accept',
      active: !!rule.active,
      options: rule.options,
      ...(rule.time_start != null ? { time_start: policyRuleDateKey(rule.time_start) } : {}),
      ...(rule.time_end != null ? { time_end: policyRuleDateKey(rule.time_end) } : {}),
    };

    if (inRoles.length) {
      captured.inRole = roleValue(inRoles);
    }

    if (outRoles.length) {
      captured.outRole = roleValue(outRoles);
    }

    const fields: [keyof SnapshotProvisionRule, unknown[]][] = [
      ['source', [...capturedValue(sides.source), ...vpnClientsAt(positions.source)]],
      [
        'destination',
        [...capturedValue(sides.destination), ...vpnClientsAt(positions.destination)],
      ],
      ['services', capturedValue(sides.services)],
      ['translatedSource', capturedValue(sides.translatedSource)],
      ['translatedDestination', capturedValue(sides.translatedDestination)],
      ['translatedService', capturedValue(sides.translatedService)],
    ];

    for (const [field, items] of fields) {
      if (items.length > 0) {
        (captured as unknown as Record<string, unknown>)[field] = items;
      }
    }

    if (rule.comment) {
      captured.comment = rule.comment;
    }

    if (rule.negate) {
      captured.negate = rule.negate;
      const negationError = getProvisionRuleNegationError({
        ...captured,
        ipVersion: policy.ipVersion as 4 | 6,
        inRoles: inRoles as string[],
        outRoles: outRoles as string[],
        source: captured.source ?? [],
        destination: captured.destination ?? [],
        services: captured.services ?? [],
        translatedSource: captured.translatedSource ?? [],
        translatedDestination: captured.translatedDestination ?? [],
        translatedServices: captured.translatedService ?? [],
      });

      if (negationError) {
        return { reason: negationError };
      }
    }

    return { value: captured };
  }

  /**
   * Maps objects into the provision vocabulary. Predefined objects and groups
   * are referenced by id; custom groups keep external snapshots of their members;
   * an assigned IP keeps its exact address and owner; only
   * an actual interface object becomes a role reference. Other addresses become parameters.
   */
  private captureObjects(
    refs: SnapshotObjectRef[],
    roleByInterfaceId: Map<number, string>,
    lookup: SnapshotObjectLookup,
    values: SnapshotValueCollector,
  ): SnapshotCapture<SnapshotProvisionObject[]> {
    const captured: SnapshotProvisionObject[] = [];

    for (const ref of refs) {
      if ([ref.ipobj, ref.ipobj_g, ref.interface].filter((id) => id > 0).length !== 1) {
        throw new HttpException('Cannot capture an ambiguous IP/interface object reference.', 422);
      }
      if (ref.ipobj_g > 0) {
        const group = lookup.groups.get(ref.ipobj_g);

        if (!group) {
          return { reason: `object group ${ref.ipobj_g} no longer exists.` };
        }
        if (group.fwcloud === null) {
          captured.push({ kind: 'stdGroup', id: group.id, name: group.name });
          continue;
        }

        const reference = values.defineGroup(group);
        if (!reference) {
          return {
            reason: `group "${group.name}" has unsupported address group type ${group.type}.`,
          };
        }
        captured.push(reference);
        continue;
      }

      if (ref.ipobj === undefined || ref.ipobj <= 0) {
        const role = ref.interface > 0 ? roleByInterfaceId.get(ref.interface) : undefined;

        if (!role) {
          return { reason: 'it references an interface of another firewall.' };
        }

        captured.push({ kind: 'interfaceRole', role });
        continue;
      }

      const ipobj = lookup.objects.get(ref.ipobj);

      if (!ipobj) {
        throw new HttpException(`Cannot capture IP object ${ref.ipobj}: it no longer exists.`, 422);
      }

      if (ipobj.fwcloud === null) {
        captured.push({ kind: 'std', id: ipobj.id, name: ipobj.name });
        continue;
      }

      if (ipobj.interface !== null && roleByInterfaceId.has(ipobj.interface)) {
        const address = values.getInterfaceAddress(ipobj.id);
        if (!address) {
          throw new HttpException(
            `Cannot capture interface IP object "${ipobj.name}": its assigned address is unresolved.`,
            422,
          );
        }
        captured.push({ ...address });
        continue;
      }

      if (
        ipobj.type === REPLICATION_PROFILE_IPOBJ_TYPE_RANGE &&
        ipobj.range_start &&
        ipobj.range_end
      ) {
        captured.push({
          kind: 'range',
          value: values.defineAddress(
            'range',
            `${ipobj.range_start}-${ipobj.range_end}`,
            ipobj.name,
          ),
          name: ipobj.name,
        });
        continue;
      }

      if (
        ipobj.type !== REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS &&
        ipobj.type !== REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK
      ) {
        return { reason: `object "${ipobj.name}" is of a type the vocabulary cannot express.` };
      }

      const kind = ipobj.type === REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK ? 'network' : 'address';

      captured.push({
        kind,
        value: values.defineAddress(kind, ipObjCidr(ipobj.address, ipobj.netmask), ipobj.name),
        name: ipobj.name,
      });
    }

    return { value: captured };
  }

  /** Predefined services/groups by id; custom services/groups as complete external snapshots. */
  private captureServices(
    refs: SnapshotObjectRef[],
    lookup: SnapshotObjectLookup,
    values: SnapshotValueCollector,
  ): SnapshotCapture<SnapshotProvisionService[]> {
    const captured: SnapshotProvisionService[] = [];

    for (const ref of refs) {
      const group = ref.ipobj_g > 0;
      const service = group ? lookup.groups.get(ref.ipobj_g) : lookup.objects.get(ref.ipobj);

      if (service && service.fwcloud === null) {
        captured.push({ kind: group ? 'stdGroup' : 'std', id: service.id, name: service.name });
        continue;
      }

      const reference = service && values.defineService(service);
      if (!reference) {
        return {
          reason: service
            ? `service "${service.name}" has unsupported object type ${service.type}.`
            : `service reference (object ${ref.ipobj}, group ${ref.ipobj_g}) no longer exists.`,
        };
      }
      captured.push(reference);
    }

    return { value: captured };
  }

  /** Routing tables with their routes, and the policy routing rules. */
  private async captureRouting(
    firewallId: number,
    roleByInterfaceId: Map<number, string>,
    values: SnapshotValueCollector,
    warnings: string[],
  ): Promise<Record<string, unknown> | null> {
    const tables = await dbQuery<{
      id: number;
      number: number;
      name: string;
      comment: string | null;
    }>('SELECT id, number, name, comment FROM routing_table WHERE firewall = ? ORDER BY number', [
      firewallId,
    ]);

    if (tables.length === 0) {
      return null;
    }

    const tableIds = tables.map((table) => table.id);
    const [routes, rules] = await Promise.all([
      dbQuery<{
        id: number;
        routing_table: number;
        gateway: number | null;
        interface: number | null;
        active: number;
        comment: string | null;
        route_order: number;
        fw_apply_to: number | null;
      }>(
        `SELECT id, routing_table, gateway, interface, active, comment, route_order, fw_apply_to FROM route
         WHERE routing_table IN (${sqlPlaceholders(tableIds.length)}) ORDER BY routing_table, route_order`,
        tableIds,
      ),
      dbQuery<{
        id: number;
        routing_table: number;
        active: number;
        comment: string | null;
        rule_order: number;
        fw_apply_to: number | null;
      }>(
        `SELECT id, routing_table, active, comment, rule_order, fw_apply_to FROM routing_r
         WHERE routing_table IN (${sqlPlaceholders(tableIds.length)}) ORDER BY rule_order`,
        tableIds,
      ),
    ]);
    const [routeRefs, ruleRefs] = await Promise.all([
      this.loadJoinRefs(
        'route',
        'route',
        routes.map((route) => route.id),
        ['openvpn', 'openvpn_prefix', 'wireguard', 'wireguard_prefix', 'ipsec', 'ipsec_prefix'],
      ),
      this.loadJoinRefs(
        'routing_r',
        'rule',
        rules.map((rule) => rule.id),
        [
          'openvpn',
          'openvpn_prefix',
          'wireguard',
          'wireguard_prefix',
          'ipsec',
          'ipsec_prefix',
          'mark',
        ],
      ),
    ]);
    const lookup = await this.loadObjectLookup([
      ...Array.from(routeRefs.refs.values()).flat(),
      ...Array.from(ruleRefs.refs.values()).flat(),
      ...routes.filter((route) => route.gateway).map((route) => ({ ipobj: route.gateway! })),
    ]);
    const keyOf = (tableId: number) =>
      `table_${tables.find((table) => table.id === tableId)!.number}`;

    const capturedTables = tables.map((table) => ({
      key: keyOf(table.id),
      number: table.number,
      name: table.name,
      ...(table.comment ? { comment: table.comment } : {}),
      routes: routes
        .filter((route) => route.routing_table === table.id)
        .flatMap((route) => {
          const label = `Route ${route.route_order} of routing table "${table.name}"`;
          const destination = this.captureObjects(
            routeRefs.refs.get(route.id) ?? [],
            roleByInterfaceId,
            lookup,
            values,
          );
          const gateway = route.gateway
            ? this.captureObjects([{ ipobj: route.gateway }], roleByInterfaceId, lookup, values)
            : { value: [] as SnapshotProvisionObject[] };
          const interfaceRole = route.interface
            ? roleByInterfaceId.get(route.interface)
            : undefined;
          const reason =
            entrySkipReason(route, 'route') ??
            (routeRefs.unsupported.has(route.id)
              ? 'VPN references cannot be templated yet.'
              : (captureFailure([destination, gateway])?.reason ??
                (route.interface && !interfaceRole
                  ? 'it references an interface of another firewall.'
                  : null)));

          if (reason) {
            warnings.push(`${label} was not captured: ${reason}`);
            return [];
          }

          const [gatewayObject] = capturedValue(gateway);
          return [
            {
              destination: capturedValue(destination),
              ...(gatewayObject ? { gateway: gatewayObject } : {}),
              ...(interfaceRole ? { interfaceRole } : {}),
              ...(route.comment ? { comment: route.comment } : {}),
            },
          ];
        }),
    }));

    const capturedRules = rules.flatMap((rule) => {
      const label = `Routing rule ${rule.rule_order}`;
      const from = this.captureObjects(
        ruleRefs.refs.get(rule.id) ?? [],
        roleByInterfaceId,
        lookup,
        values,
      );
      const reason =
        entrySkipReason(rule, 'rule') ??
        (ruleRefs.unsupported.has(rule.id)
          ? 'VPN and mark references cannot be templated yet.'
          : captureFailure([from])?.reason);

      if (reason) {
        warnings.push(`${label} was not captured: ${reason}`);
        return [];
      }

      return [
        {
          from: capturedValue(from),
          table: keyOf(rule.routing_table),
          ...(rule.comment ? { comment: rule.comment } : {}),
        },
      ];
    });

    return { tables: capturedTables, rules: capturedRules };
  }

  /** DHCP servers, Keepalived and HAProxy rules of the source. */
  private async captureSystem(
    firewall: SnapshotFirewallRow,
    topologyNodes: SnapshotTopologyNode[] | null,
    nodeRoleById: Map<number, string>,
    roleByInterfaceId: Map<number, string>,
    values: SnapshotValueCollector,
    warnings: string[],
  ): Promise<Record<string, unknown> | null> {
    const [dhcp, keepalived, haproxy] = await Promise.all([
      dbQuery<{
        id: number;
        rule_type: number;
        rule_order: number;
        active: number;
        network: number | null;
        range: number | null;
        router: number | null;
        max_lease: number;
        comment: string | null;
        fw_apply_to: number | null;
      }>(
        'SELECT id, rule_type, rule_order, active, network, `range`, router, max_lease, comment, fw_apply_to FROM dhcp_r WHERE firewall = ? ORDER BY rule_order',
        [firewall.id],
      ),
      dbQuery<SnapshotSystemRuleRow & { interface: number | null; master_node: number | null }>(
        'SELECT id, rule_type, cfg_text, style, rule_order, active, interface, master_node, comment, fw_apply_to FROM keepalived_r WHERE firewall = ? ORDER BY rule_order',
        [firewall.id],
      ),
      dbQuery<
        SnapshotSystemRuleRow & {
          frontend_ip: number | null;
          frontend_port: number | null;
          backend_port: number | null;
        }
      >(
        'SELECT id, rule_type, cfg_text, style, rule_order, active, frontend_ip, frontend_port, backend_port, comment, fw_apply_to FROM haproxy_r WHERE firewall = ? ORDER BY rule_order',
        [firewall.id],
      ),
    ]);

    // Node-local manual rules cannot be widened to the entire destination cluster.
    // The system template currently represents the master's shared service policy only.
    if (firewall.cluster) {
      const localManual = await dbQuery<{ id: number; firewall: number }>(
        'SELECT id, firewall FROM haproxy_r WHERE rule_type = 2 AND firewall <> ? AND firewall IN (SELECT id FROM firewall WHERE cluster = ?)',
        [firewall.id, firewall.cluster],
      );
      if (localManual.length) {
        throw new HttpException(
          `HAProxy manual configuration ${localManual[0].id} on firewall ${localManual[0].firewall} cannot be captured: node-local manual configurations are unsupported.`,
          422,
        );
      }
    }

    if (!dhcp.length && !keepalived.length && !haproxy.length) {
      return null;
    }

    const structuredHAProxy = haproxy.filter((row) => row.rule_type === 1);
    const [dhcpRefs, keepalivedRefs, haproxyRefs] = await Promise.all([
      this.loadJoinRefs(
        'dhcp_r',
        'rule',
        dhcp.map((row) => row.id),
        [],
      ),
      this.loadJoinRefs(
        'keepalived_r',
        'rule',
        keepalived.map((row) => row.id),
        [],
      ),
      this.loadJoinRefs(
        'haproxy_r',
        'rule',
        structuredHAProxy.map((row) => row.id),
        [],
      ),
    ]);
    const singles = [
      ...dhcp.flatMap((row) => [row.network, row.range, row.router]),
      ...structuredHAProxy.flatMap((row) => [row.frontend_ip, row.frontend_port, row.backend_port]),
    ]
      .filter((id): id is number => !!id)
      .map((ipobj) => ({ ipobj }));
    const lookup = await this.loadObjectLookup([
      ...singles,
      ...[dhcpRefs, keepalivedRefs, haproxyRefs].flatMap((refs) =>
        Array.from(refs.refs.values()).flat(),
      ),
    ]);
    const nodes = firewall.cluster
      ? (
          await dbQuery<{ id: number }>(
            'SELECT id FROM firewall WHERE cluster = ? ORDER BY fwmaster DESC, id',
            [firewall.cluster],
          )
        ).map((row) => row.id)
      : [firewall.id];

    const one = (id: number | null) =>
      id
        ? this.captureObjects([{ ipobj: id }], roleByInterfaceId, lookup, values)
        : { value: [] as SnapshotProvisionObject[] };
    const port = (id: number | null) =>
      id
        ? this.captureServices([{ ipobj: id }], lookup, values)
        : { value: [] as SnapshotProvisionService[] };
    const skip = (label: string, reason: string) => {
      warnings.push(`${label} was not captured: ${reason}`);
      return [];
    };

    return {
      dhcp: dhcp.flatMap((row) => {
        const label = `DHCP rule ${row.rule_order}`;
        if (row.rule_type !== 1) {
          return skip(
            label,
            'only DHCP servers are templated; fixed IPs and raw configuration are not.',
          );
        }
        const captures = {
          network: one(row.network),
          range: one(row.range),
          router: one(row.router),
          dns: this.captureObjects(
            dhcpRefs.refs.get(row.id) ?? [],
            roleByInterfaceId,
            lookup,
            values,
          ),
        };
        const reason =
          entrySkipReason(row, 'rule') ?? captureFailure(Object.values(captures))?.reason;
        return reason
          ? skip(label, reason)
          : [
              {
                network: capturedValue(captures.network)[0],
                range: capturedValue(captures.range)[0],
                router: capturedValue(captures.router)[0],
                dns: capturedValue(captures.dns),
                maxLease: row.max_lease,
                ...(row.comment ? { comment: row.comment } : {}),
              },
            ];
      }),
      keepalived: keepalived.flatMap((row) => {
        const label = `Keepalived rule ${row.rule_order}`;
        const settings = captureSystemRuleSettings(row, 'Keepalived');
        // "Apply to" travels as the node's role, as for policy rules; it is never widened.
        const nodeRole = row.fw_apply_to === null ? undefined : nodeRoleById.get(row.fw_apply_to);
        if (row.fw_apply_to !== null && !nodeRole) {
          // FWCloud keeps fw_apply_to when a cluster becomes a firewall.
          return skip(
            label,
            row.fw_apply_to === firewall.id
              ? 'it only applies to this firewall as a node of the cluster it belonged to.'
              : 'it only applies to a firewall that is not a node of the source.',
          );
        }
        const node = nodeRole ? { nodeRole } : {};
        if (row.rule_type === 2) {
          return [
            { ...settings, ...node, ...(row.comment !== null ? { comment: row.comment } : {}) },
          ];
        }
        const virtualIps = this.captureObjects(
          keepalivedRefs.refs.get(row.id) ?? [],
          roleByInterfaceId,
          lookup,
          values,
        );
        const interfaceRole = row.interface ? roleByInterfaceId.get(row.interface) : undefined;
        // Clusters reference the master by its node role; a firewall is its own master.
        const nodeIndex = row.master_node ? nodes.indexOf(row.master_node) : 0;
        const masterNode = topologyNodes ? topologyNodes[nodeIndex]?.role : undefined;
        const reason = !interfaceRole
          ? 'it references an interface of another firewall.'
          : nodeIndex < 0 || (topologyNodes && !masterNode)
            ? 'its master node is not a node of the source.'
            : captureFailure([virtualIps])?.reason;
        return reason
          ? skip(label, reason)
          : [
              {
                ...settings,
                interfaceRole,
                virtualIps: capturedValue(virtualIps),
                ...(masterNode ? { masterNode } : {}),
                ...node,
                ...(row.comment ? { comment: row.comment } : {}),
              },
            ];
      }),
      haproxy: haproxy.flatMap((row) => {
        const label = `HAProxy rule ${row.rule_order}`;
        const settings = captureSystemRuleSettings(row, 'HAProxy');
        if (row.rule_type === 2) {
          return [{ ...settings, ...(row.comment !== null ? { comment: row.comment } : {}) }];
        }
        const captures = {
          frontendIp: one(row.frontend_ip),
          frontendService: port(row.frontend_port),
          backendIps: this.captureObjects(
            haproxyRefs.refs.get(row.id) ?? [],
            roleByInterfaceId,
            lookup,
            values,
          ),
          backendService: port(row.backend_port),
        };
        const reason =
          entrySkipReason(row, 'rule') ?? captureFailure(Object.values(captures))?.reason;
        return reason
          ? skip(label, reason)
          : [
              {
                frontendIp: capturedValue(captures.frontendIp)[0],
                ...settings,
                frontendService: capturedValue(captures.frontendService)[0],
                backendIps: capturedValue(captures.backendIps),
                backendService: capturedValue(captures.backendService)[0],
                ...(row.comment ? { comment: row.comment } : {}),
              },
            ];
      }),
    };
  }

  /**
   * Reads the `<table>__ipobj` / `<table>__ipobj_g` references of routing and
   * system rows, and flags the rows holding references (VPN, marks) that
   * cannot be templated.
   */
  private async loadJoinRefs(
    table: string,
    column: string,
    ids: number[],
    unsupportedSuffixes: string[],
  ): Promise<{ refs: Map<number, SnapshotObjectRef[]>; unsupported: Set<number> }> {
    const refs = new Map<number, SnapshotObjectRef[]>();
    const unsupported = new Set<number>();

    if (ids.length === 0) {
      return { refs, unsupported };
    }

    const placeholders = sqlPlaceholders(ids.length);
    const [objects, groups, unsupportedRows] = await Promise.all([
      dbQuery<{ owner: number; ipobj: number; order: number }>(
        `SELECT ${column} AS owner, ipobj, \`order\` FROM ${table}__ipobj WHERE ${column} IN (${placeholders})`,
        ids,
      ),
      table === 'route' || table === 'routing_r'
        ? dbQuery<{ owner: number; ipobj_g: number; order: number }>(
            `SELECT ${column} AS owner, ipobj_g, \`order\` FROM ${table}__ipobj_g WHERE ${column} IN (${placeholders})`,
            ids,
          )
        : Promise.resolve([]),
      Promise.all(
        unsupportedSuffixes.map((suffix) =>
          dbQuery<{ owner: number }>(
            `SELECT ${column} AS owner FROM ${table}__${suffix} WHERE ${column} IN (${placeholders})`,
            ids,
          ),
        ),
      ),
    ]);

    [...objects, ...groups]
      .sort((a, b) => a.order - b.order)
      .forEach((row) =>
        addToList(
          refs,
          row.owner,
          'ipobj_g' in row ? { ipobj_g: row.ipobj_g } : { ipobj: row.ipobj },
        ),
      );

    unsupportedRows.flat().forEach((row) => unsupported.add(row.owner));

    return { refs, unsupported };
  }

  /** Objects and groups referenced by a capture, including whether they are predefined (NULL fwcloud). */
  private async loadObjectLookup(refs: SnapshotObjectRef[]): Promise<SnapshotObjectLookup> {
    const objectIds = Array.from(new Set(refs.map((ref) => ref.ipobj).filter((id) => id > 0)));
    const groupIds = Array.from(new Set(refs.map((ref) => ref.ipobj_g).filter((id) => id > 0)));

    const [objects, groups] = await Promise.all([
      objectIds.length
        ? dbQuery<SnapshotIpObjRow>(
            `SELECT id, name, type, ip_version, address, netmask, interface, fwcloud, range_start, range_end
             FROM ipobj WHERE id IN (${sqlPlaceholders(objectIds.length)})`,
            objectIds,
          )
        : Promise.resolve([] as SnapshotIpObjRow[]),
      groupIds.length
        ? dbQuery<SnapshotGroupRow>(
            `SELECT id, name, type, fwcloud FROM ipobj_g WHERE id IN (${sqlPlaceholders(groupIds.length)})`,
            groupIds,
          )
        : Promise.resolve([] as SnapshotGroupRow[]),
    ]);

    return {
      objects: new Map(objects.map((row) => [Number(row.id), { ...row, type: Number(row.type) }])),
      groups: new Map(groups.map((row) => [Number(row.id), row])),
    };
  }

  /**
   * Captures every configured IPv4 and IPv6 address on a source interface as parameters,
   * which is what lets the operator assign different IPs when the template is
   * applied to another firewall.
   */
  private async captureInterfaceAddresses(
    iface: SnapshotInterfaceRow,
    role: string,
    addresses: SnapshotIpObjRow[],
    values: SnapshotValueCollector,
    fwCloudId: number,
  ): Promise<PolicyReplicationProvisionAddress[]> {
    const captured: PolicyReplicationProvisionAddress[] = [];

    for (const address of addresses) {
      const label = `Interface "${iface.name}" (role "${role}"), object "${address.name}" (address "${address.address}", netmask "${address.netmask ?? ''}", IPv${address.ip_version})`;
      if (address.type !== REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS) {
        throw new HttpException(
          `${label} cannot be captured: unsupported interface object type ${address.type}; an address object is required.`,
          422,
        );
      }

      const literal = ipObjCidr(address.address, address.netmask);
      const parsed = parseReplicationProfileAddress(literal, address.ip_version as 4 | 6);
      const metadata = {
        comment: address.comment ?? null,
        diff_serv: address.diff_serv ?? null,
        options: (normalizeProfileObjectOptions(address.options) ?? null) as number | null,
      };
      // Legacy interface addresses carry zeroes in the service port columns. Any other
      // configured object field must pass the address API schema instead of being omitted.
      const original = Object.fromEntries(
        Object.entries(address).filter(
          ([field, value]) =>
            OBJECT_DATA_FIELDS.has(field) &&
            !((field.endsWith('_port_start') || field.endsWith('_port_end')) && value === 0),
        ),
      );
      const invalid = await validateProfileObjectSnapshot(
        {
          ...original,
          ...metadata,
        },
        REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS,
        fwCloudId,
        { checkDestination: false },
      );
      if (invalid || !parsed || (address.ip_version !== 4 && address.ip_version !== 6)) {
        throw new HttpException(
          `${label} cannot be captured: ${invalid ?? 'the address, family or netmask cannot be represented by the template.'}`,
          422,
        );
      }

      const declared: PolicyReplicationProvisionAddress = {
        value: values.defineInterfaceAddress(role, captured.length, literal, parsed.ipVersion),
        name: address.name,
        ipVersion: parsed.ipVersion,
        ...metadata,
      };
      values.registerInterfaceAddress(address.id, role, captured.length, declared);
      captured.push(declared);
    }

    return captured;
  }

  private async loadInterfaceAddresses(
    interfaceIds: number[],
  ): Promise<Map<number, SnapshotIpObjRow[]>> {
    if (interfaceIds.length === 0) {
      return new Map();
    }

    const rows = await dbQuery<SnapshotIpObjRow>(
      `SELECT id, interface, ${PROFILE_OBJECT_DATA_FIELDS.join(', ')} FROM ipobj
       WHERE interface IN (${sqlPlaceholders(interfaceIds.length)})
       ORDER BY id`,
      interfaceIds,
    );

    const byInterface = new Map<number, SnapshotIpObjRow[]>();

    for (const row of rows) {
      addToList(byInterface, row.interface!, row);
    }

    return byInterface;
  }

  private async loadRuleInterfaceRefs(
    ruleIds: number[],
  ): Promise<Map<number, SnapshotRuleInterfaceRow[]>> {
    if (ruleIds.length === 0) {
      return new Map();
    }

    const rows = await dbQuery<SnapshotRuleInterfaceRow>(
      `SELECT rule, interface, position FROM policy_r__interface WHERE rule IN (${sqlPlaceholders(ruleIds.length)})`,
      ruleIds,
    );

    return this.groupByRule(rows);
  }

  private async loadRuleIpObjRefs(ruleIds: number[]): Promise<Map<number, SnapshotRuleIpObjRow[]>> {
    if (ruleIds.length === 0) {
      return new Map();
    }

    const rows = await dbQuery<SnapshotRuleIpObjRow>(
      `SELECT rule, ipobj, ipobj_g, interface, position FROM policy_r__ipobj WHERE rule IN (${sqlPlaceholders(ruleIds.length)}) ORDER BY position_order`,
      ruleIds,
    );

    return this.groupByRule(rows);
  }

  /** VPN references retain their side and identity when the client was captured. */
  private async loadRuleVpnRefs(ruleIds: number[]): Promise<Map<number, SnapshotRuleVpnRef[]>> {
    if (ruleIds.length === 0) {
      return new Map();
    }

    const results = await Promise.all(
      VPN_RELATION_TABLES.map(async ({ table, column, ownerKind }) => {
        const rows = await dbQuery<{ rule: number; position: number; vpn: number }>(
          `SELECT rule, position, ${column} AS vpn FROM ${table} WHERE rule IN (${sqlPlaceholders(ruleIds.length)}) ORDER BY position_order`,
          ruleIds,
        );
        return rows.map((row) => ({
          rule: row.rule,
          position: row.position,
          connectionKey: `${ownerKind}:${row.vpn}`,
        }));
      }),
    );

    return this.groupByRule(results.flat());
  }

  private groupByRule<T extends { rule: number }>(rows: T[]): Map<number, T[]> {
    const grouped = new Map<number, T[]>();

    rows.forEach((row) => addToList(grouped, row.rule, row));

    return grouped;
  }

  private ruleLabel(rule: SnapshotRuleRow, policy: string): string {
    const comment = (rule.comment ?? '').trim();

    const label = comment
      ? `${policy} rule ${rule.rule_order} ("${comment}")`
      : `${policy} rule ${rule.rule_order}`;
    return `${label} [id ${rule.id}${rule.active ? '' : ', disabled'}]`;
  }
}
