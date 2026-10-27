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
  (['INPUT', 'OUTPUT', 'FORWARD', 'SNAT', 'DNAT'] as const).map((chain) => ({
    typeId: PolicyTypesMap.get(`${family}:${chain}`)!,
    chain: chain.toLowerCase() as SnapshotChain,
    ipVersion: family === 'IPv4' ? 4 : 6,
    label: `${chain} ${family}`,
    positions: getProvisionRulePositions(
      family === 'IPv4' ? 4 : 6,
      chain.toLowerCase() as SnapshotChain,
    ),
  })),
);

type SnapshotChain = 'input' | 'output' | 'forward' | 'snat' | 'dnat';
type CapturedPolicy = (typeof CAPTURED_POLICIES)[number];

// policy_r.action codes expressible in the profile vocabulary.
const RULE_ACTION_ACCEPT = 1;
const RULE_ACTION_DENY = 2;
const OBJECT_DATA_FIELDS: ReadonlySet<string> = new Set(PROFILE_OBJECT_DATA_FIELDS);

// Predefined service group the default "useful ICMP" INPUT rule allows.
const DEFAULT_ICMP_SERVICE_GROUP = 5;

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
  kind: Exclude<PolicyReplicationProvisionObject['kind'], 'host' | 'external'>;
}

type SnapshotProvisionService =
  ReplicationProfileExternalObjectUsage | { kind: 'std' | 'stdGroup'; id: number; name?: string };

type SnapshotServiceReference = Pick<
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

interface SnapshotProvisionRule extends PolicyRuleValidityPeriod {
  chain: SnapshotChain;
  ipVersion: number;
  action: 'accept' | 'deny';
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
 * while services retain their complete configuration through external object references.
 */
class SnapshotValueCollector {
  private readonly parameters: ReplicationProfileParameter[] = [];
  private readonly byIdentity = new Map<string, ReplicationProfileParameter>();
  private readonly usedNames = new Set<string>();
  private readonly serviceReferences = new Map<string, SnapshotServiceReference>();
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

    const referenceId = `service-${service.type}-${service.id}`;
    if (!this.serviceReferences.has(referenceId)) {
      this.serviceReferences.set(referenceId, {
        referenceId,
        objectType,
        sourceObjectId: service.id,
      });
    }
    return { kind: 'external', referenceId };
  }

  /** Discard references belonging only to skipped rules or system entries. */
  getObjectReferences(model: Record<string, unknown>): SnapshotServiceReference[] {
    const locations = getProfileObjectReferenceLocations(model);
    return Array.from(this.serviceReferences.values()).filter((reference) =>
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
    this.parameters.push(parameter);
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
    return this.parameters;
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
 * Only rules expressible in the profile vocabulary are captured; every
 * skipped rule is reported through `warnings` instead of being silently
 * widened or dropped.
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
    const rules = await this.capturePolicyRules(
      resolved.firewall.id,
      roleByInterfaceId,
      loopbackInterfaceIds,
      values,
      warnings,
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

    const model: Record<string, unknown> = {
      parameters: values.getParameters(),
      compatibility: {
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
      model.topologyPreset = { nodes: resolved.topologyNodes };

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

    return {
      targetKind: source.kind,
      sourceName: resolved.sourceName,
      model: await captureProfileObjectReferences(model, fwCloudId),
      warnings,
    };
  }

  private async resolveSourceFirewall(
    source: ReplicationProfileSnapshotSource,
    fwCloudId: number,
  ): Promise<{
    firewall: SnapshotFirewallRow;
    sourceName: string;
    topologyNodes: SnapshotTopologyNode[] | null;
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

      return {
        firewall: master,
        sourceName: clusters[0].name,
        topologyNodes: this.buildTopologyNodes(members),
      };
    }

    const firewalls = await dbQuery<SnapshotFirewallRow>(
      'SELECT id, name, cluster, fwcloud, fwmaster FROM firewall WHERE id = ? AND fwcloud = ?',
      [source.id, fwCloudId],
    );

    if (firewalls.length === 0) {
      throw new NotFoundException('Source firewall not found');
    }

    return { firewall: firewalls[0], sourceName: firewalls[0].name, topologyNodes: null };
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
   * Captures every filter and NAT policy of the source, in both IP families.
   * Policies holding only their untouched default rules are left out; rules the
   * vocabulary cannot express are reported through `warnings` instead of being widened.
   */
  private async capturePolicyRules(
    firewallId: number,
    roleByInterfaceId: Map<number, string>,
    loopbackInterfaceIds: Set<number>,
    values: SnapshotValueCollector,
    warnings: string[],
    vpnObjects: Map<string, SnapshotProvisionObject>,
  ): Promise<SnapshotProvisionRule[]> {
    const typeIds = CAPTURED_POLICIES.map((policy) => policy.typeId);
    const rules = await dbQuery<SnapshotRuleRow>(
      `SELECT id, type, rule_order, action, active, special, comment, negate, options, time_start, time_end FROM policy_r
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
    const customizedTypes = new Set(customizedPolicies.map((policy) => policy.typeId));
    const candidateRules = nonSpecialRules.filter((rule) => customizedTypes.has(Number(rule.type)));
    const lookup = await this.loadObjectLookup(
      candidateRules.flatMap((rule) => ipObjRefs.get(rule.id) ?? []),
    );

    const captured: SnapshotProvisionRule[] = [];

    for (const policy of customizedPolicies) {
      for (const rule of rulesByType.get(policy.typeId)!) {
        const label = this.ruleLabel(rule, policy.label);

        if (rule.active !== 1) {
          warnings.push(`${label} was not captured: the rule is disabled.`);
          continue;
        }

        const provisionRule = this.captureRule(
          rule,
          policy,
          label,
          refsOf(rule.id),
          vpnObjects,
          roleByInterfaceId,
          lookup,
          values,
          warnings,
        );

        if (provisionRule) {
          captured.push(provisionRule);
        }
      }
    }

    return captured;
  }

  /**
   * Whether a rule is still exactly one of the INPUT rules PolicyRule.insertDefaultPolicy creates:
   * "self host" accepts anything coming in through the loopback interface, and "useful ICMP" the
   * predefined ICMP group (5) as its only service. Any change (another object, a VPN, a different
   * action, disabling it) makes it the user's own.
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
   * Maps one policy_r row into the provision vocabulary. Returns null (and
   * records a warning) when the rule carries references the vocabulary cannot
   * express, because capturing it without them would produce a template rule
   * broader than the original one.
   */
  private captureRule(
    rule: SnapshotRuleRow,
    policy: CapturedPolicy,
    label: string,
    { interfaces: interfaceRefs, ipObjs: ipObjRefs, vpns: vpnRefs }: SnapshotRuleRefs,
    vpnObjects: Map<string, SnapshotProvisionObject>,
    roleByInterfaceId: Map<number, string>,
    lookup: SnapshotObjectLookup,
    values: SnapshotValueCollector,
    warnings: string[],
  ): SnapshotProvisionRule | null {
    const isNat = policy.chain === 'snat' || policy.chain === 'dnat';

    if (!isNat && rule.action !== RULE_ACTION_ACCEPT && rule.action !== RULE_ACTION_DENY) {
      warnings.push(`${label} was not captured: only ACCEPT and DENY actions are supported.`);
      return null;
    }

    const { positions } = policy;
    if (
      vpnRefs.some(
        (ref) =>
          !vpnObjects.has(ref.connectionKey) ||
          ![positions.source, positions.destination].includes(ref.position),
      )
    ) {
      warnings.push(
        `${label} was not captured: it contains a VPN reference that cannot be represented by a captured VPN client.`,
      );
      return null;
    }
    const inRefs = interfaceRefs.filter((ref) => ref.position === positions.in);
    const outRefs = interfaceRefs.filter((ref) => ref.position === positions.out);

    if (interfaceRefs.length !== inRefs.length + outRefs.length) {
      warnings.push(
        `${label} was not captured: it references interfaces in positions the vocabulary cannot express.`,
      );
      return null;
    }

    const known = new Set(
      [
        positions.source,
        positions.destination,
        positions.service,
        positions.translatedSource,
        positions.translatedDestination,
        positions.translatedService,
      ].filter((position) => position !== undefined),
    );

    const refsByPosition = new Map<number, SnapshotObjectRef[]>();
    for (const ref of ipObjRefs) {
      if (!known.has(ref.position)) {
        warnings.push(
          `${label} was not captured: it references objects in positions the vocabulary cannot express.`,
        );
        return null;
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
      warnings.push(`${label} was not captured: ${failed.reason}`);
      return null;
    }

    const inRoles = inRefs.map((ref) => roleByInterfaceId.get(ref.interface));
    const outRoles = outRefs.map((ref) => roleByInterfaceId.get(ref.interface));

    if (inRoles.some((role) => !role) || outRoles.some((role) => !role)) {
      warnings.push(`${label} was not captured: it references an interface of another firewall.`);
      return null;
    }

    const roleValue = (roles: string[]) => (roles.length === 1 ? roles[0] : roles);

    const captured: SnapshotProvisionRule = {
      chain: policy.chain,
      ipVersion: policy.ipVersion,
      action: rule.action === RULE_ACTION_DENY ? 'deny' : 'accept',
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
        warnings.push(`${label} was not captured: ${negationError}`);
        return null;
      }
    }

    return captured;
  }

  /**
   * Maps objects into the provision vocabulary. Predefined objects and groups
   * are referenced by id; an assigned IP keeps its exact address and owner; only
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

        if (!group || group.fwcloud !== null) {
          return {
            reason: 'object groups of the FWCloud cannot be templated; only predefined groups can.',
          };
        }

        captured.push({ kind: 'stdGroup', id: group.id, name: group.name });
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
        return { reason: 'the referenced service or service group could not be captured.' };
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
      }>(
        `SELECT id, routing_table, gateway, interface, active, comment, route_order FROM route
         WHERE routing_table IN (${sqlPlaceholders(tableIds.length)}) ORDER BY routing_table, route_order`,
        tableIds,
      ),
      dbQuery<{
        id: number;
        routing_table: number;
        active: number;
        comment: string | null;
        rule_order: number;
      }>(
        `SELECT id, routing_table, active, comment, rule_order FROM routing_r
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
            : { value: [] };
          const interfaceRole = route.interface
            ? roleByInterfaceId.get(route.interface)
            : undefined;
          const reason = !route.active
            ? 'the route is disabled.'
            : routeRefs.unsupported.has(route.id)
              ? 'VPN references cannot be templated yet.'
              : 'reason' in destination
                ? destination.reason
                : 'reason' in gateway
                  ? gateway.reason
                  : route.interface && !interfaceRole
                    ? 'it references an interface of another firewall.'
                    : null;

          if (reason) {
            warnings.push(`${label} was not captured: ${reason}`);
            return [];
          }

          return [
            {
              destination: (destination as { value: SnapshotProvisionObject[] }).value,
              ...((gateway as { value: SnapshotProvisionObject[] }).value[0]
                ? { gateway: (gateway as { value: SnapshotProvisionObject[] }).value[0] }
                : {}),
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
      const reason = !rule.active
        ? 'the rule is disabled.'
        : ruleRefs.unsupported.has(rule.id)
          ? 'VPN and mark references cannot be templated yet.'
          : 'reason' in from
            ? from.reason
            : null;

      if (reason) {
        warnings.push(`${label} was not captured: ${reason}`);
        return [];
      }

      return [
        {
          from: (from as { value: SnapshotProvisionObject[] }).value,
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
      }>(
        'SELECT id, rule_type, rule_order, active, network, `range`, router, max_lease, comment FROM dhcp_r WHERE firewall = ? ORDER BY rule_order',
        [firewall.id],
      ),
      dbQuery<{
        id: number;
        rule_order: number;
        active: number;
        interface: number | null;
        master_node: number | null;
        comment: string | null;
      }>(
        'SELECT id, rule_order, active, interface, master_node, comment FROM keepalived_r WHERE firewall = ? ORDER BY rule_order',
        [firewall.id],
      ),
      dbQuery<{
        id: number;
        rule_order: number;
        active: number;
        frontend_ip: number | null;
        frontend_port: number | null;
        backend_port: number | null;
        comment: string | null;
      }>(
        'SELECT id, rule_order, active, frontend_ip, frontend_port, backend_port, comment FROM haproxy_r WHERE firewall = ? ORDER BY rule_order',
        [firewall.id],
      ),
    ]);

    if (!dhcp.length && !keepalived.length && !haproxy.length) {
      return null;
    }

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
        haproxy.map((row) => row.id),
        [],
      ),
    ]);
    const singles = [
      ...dhcp.flatMap((row) => [row.network, row.range, row.router]),
      ...haproxy.flatMap((row) => [row.frontend_ip, row.frontend_port, row.backend_port]),
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
        const reason = !row.active
          ? 'the rule is disabled.'
          : captureFailure(Object.values(captures))?.reason;
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
        const reason = !row.active
          ? 'the rule is disabled.'
          : !interfaceRole
            ? 'it references an interface of another firewall.'
            : nodeIndex < 0 || (topologyNodes && !masterNode)
              ? 'its master node is not a node of the source.'
              : captureFailure([virtualIps])?.reason;
        return reason
          ? skip(label, reason)
          : [
              {
                interfaceRole,
                virtualIps: capturedValue(virtualIps),
                ...(masterNode ? { masterNode } : {}),
                ...(row.comment ? { comment: row.comment } : {}),
              },
            ];
      }),
      haproxy: haproxy.flatMap((row) => {
        const label = `HAProxy rule ${row.rule_order}`;
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
        const reason = !row.active
          ? 'the rule is disabled.'
          : captureFailure(Object.values(captures))?.reason;
        return reason
          ? skip(label, reason)
          : [
              {
                frontendIp: capturedValue(captures.frontendIp)[0],
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
      .forEach((row) => {
        const list = refs.get(row.owner) ?? [];
        list.push('ipobj_g' in row ? { ipobj_g: row.ipobj_g } : { ipobj: row.ipobj });
        refs.set(row.owner, list);
      });

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

    return comment
      ? `${policy} rule ${rule.rule_order} ("${comment}")`
      : `${policy} rule ${rule.rule_order}`;
  }
}
