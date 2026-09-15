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

import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import { NotFoundException } from '../../fonaments/exceptions/not-found-exception';
import { Service } from '../../fonaments/services/service';
import { DefaultPolicyRuleComments } from '../policy/PolicyRule';
import { PolicyTypesMap } from '../policy/PolicyType';
import { getProvisionRulePositions, VPN_RELATION_TABLES } from './policy-replication.service';
import { dbQuery, sqlPlaceholders } from './replication-sql.helpers';
import { ReplicationProfile } from './replication-profile.model';
import {
  REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS,
  REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK,
  REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
  REPLICATION_PROFILE_IPOBJ_TYPE_TCP,
  REPLICATION_PROFILE_IPOBJ_TYPE_UDP,
  type ReplicationProfileTargetKind,
} from './replication-profile.constants';
import {
  ReplicationProfileService,
  type CreateCustomReplicationProfileOptions,
} from './replication-profile.service';

// Comments of the default rules created by PolicyRule.insertDefaultPolicy that
// are not flagged through the special column.
const DEFAULT_RULE_COMMENTS: string[] = Object.values(DefaultPolicyRuleComments);

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

// policy_r.action codes expressible in the profile vocabulary.
const RULE_ACTION_ACCEPT = 1;
const RULE_ACTION_DENY = 2;

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
  rule_order: number;
  action: number;
  active: number;
  special: number;
  comment: string | null;
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
  destination_port_start?: number | null;
  destination_port_end?: number | null;
}

interface SnapshotGroupRow {
  id: number;
  name: string;
  fwcloud: number | null;
}

interface SnapshotObjectLookup {
  objects: Map<number, SnapshotIpObjRow>;
  groups: Map<number, SnapshotGroupRow>;
}

interface SnapshotProvisionAddress {
  value: unknown;
  name?: string;
}

interface SnapshotProvisionObject {
  kind: 'address' | 'network' | 'range' | 'interfaceRole' | 'std' | 'stdGroup';
  value?: unknown;
  role?: string;
  id?: number;
  name?: string;
}

type SnapshotProvisionService =
  | { protocol: 'tcp' | 'udp'; port: unknown }
  | { kind: 'std' | 'stdGroup'; id: number; name?: string };

/** A captured value, or the reason it cannot be expressed in a profile. */
type SnapshotCapture<T> = { value: T } | { reason: string };

interface SnapshotParameter {
  name: string;
  type: 'address' | 'network' | 'range' | 'port';
  label: string;
  required: boolean;
  default: unknown;
}

interface SnapshotProvisionRule {
  chain: SnapshotChain;
  ipVersion: number;
  action: 'accept' | 'deny';
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
 * Collects the parameters a captured profile exposes. Every concrete value the
 * snapshot finds (an interface IP, a network in a rule, a service port) is
 * turned into a named parameter whose default is the captured value, so the
 * profile applies unchanged on the source and can be re-pointed elsewhere by
 * supplying different values.
 */
class SnapshotParameterCollector {
  private readonly parameters: SnapshotParameter[] = [];
  private readonly byLiteral = new Map<string, string>();
  private readonly usedNames = new Set<string>();

  defineInterfaceAddress(role: string, index: number, literal: string): { param: string } {
    const suffix = index === 0 ? '' : `_${index + 1}`;

    return this.define(
      `${this.slug(role)}_IP${suffix}`,
      'address',
      `${role.toUpperCase()} interface address`,
      literal,
    );
  }

  defineAddress(
    kind: 'address' | 'network' | 'range',
    literal: string,
    objectName: string,
  ): { param: string } {
    return this.define(this.slug(objectName), kind, objectName, literal);
  }

  definePort(port: number, label: string): { param: string } {
    return this.define(`PORT_${port}`, 'port', label, port);
  }

  /** Same literal captured twice reuses one parameter instead of duplicating. */
  private define(
    baseName: string,
    type: SnapshotParameter['type'],
    label: string,
    defaultValue: string | number,
  ): { param: string } {
    const literalKey = `${type}:${String(defaultValue)}`;
    const existing = this.byLiteral.get(literalKey);

    if (existing) {
      return { param: existing };
    }

    const name = this.uniqueName(baseName || 'VALUE');

    this.parameters.push({ name, type, label, required: true, default: defaultValue });
    this.byLiteral.set(literalKey, name);

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

  toArray(): SnapshotParameter[] {
    return this.parameters;
  }
}

/**
 * Builds custom replication ("policy template") profiles by capturing the
 * current structure of an existing firewall or cluster: its interfaces become
 * the profile's logical roles and its IPv4 FORWARD policy becomes the
 * declarative `provision`/`policyStructure` rules. The captured profile is
 * self-contained, so it can later be applied without the source firewall.
 *
 * Only rules expressible in the MVP profile vocabulary (accept/deny, in/out
 * interface roles and a single TCP/UDP destination port) are captured; every
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
   * Captures the interfaces and IPv4 FORWARD policy of the source into a
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
    const parameters = new SnapshotParameterCollector();
    const addressesByInterface = await this.loadInterfaceAddresses(
      interfaces.map((iface) => iface.id),
    );
    const rules = await this.capturePolicyRules(
      resolved.firewall.id,
      roleByInterfaceId,
      parameters,
      warnings,
    );

    // assignInterfaceRoles already guarantees uniqueness.
    const roles = Array.from(roleByInterfaceId.values());
    const profileInterfaces = interfaces.map((iface) => {
      const role = roleByInterfaceId.get(iface.id) as string;

      return {
        name: iface.name,
        role,
        addresses: this.captureInterfaceAddresses(
          role,
          addressesByInterface.get(iface.id) ?? [],
          parameters,
          warnings,
        ),
      };
    });
    const routing = await this.captureRouting(
      resolved.firewall.id,
      roleByInterfaceId,
      parameters,
      warnings,
    );
    const system = await this.captureSystem(
      resolved.firewall,
      resolved.topologyNodes,
      roleByInterfaceId,
      parameters,
      warnings,
    );
    const policyStructure = {
      interfaces: profileInterfaces,
      rules,
      ...(routing ? { routing } : {}),
      ...(system ? { system } : {}),
    };

    const model: Record<string, unknown> = {
      parameters: parameters.toArray(),
      compatibility: {
        target_kinds: ['firewall', 'cluster'],
        supportedRoles: roles,
      },
      policyStructure,
      provision: policyStructure,
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

    return {
      targetKind: source.kind,
      sourceName: resolved.sourceName,
      model,
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
   * Default rules are left out; rules the vocabulary cannot express are
   * reported through `warnings` instead of being widened.
   */
  private async capturePolicyRules(
    firewallId: number,
    roleByInterfaceId: Map<number, string>,
    parameters: SnapshotParameterCollector,
    warnings: string[],
  ): Promise<SnapshotProvisionRule[]> {
    const typeIds = CAPTURED_POLICIES.map((policy) => policy.typeId);
    const rules = await dbQuery<SnapshotRuleRow & { type: number }>(
      `SELECT id, type, rule_order, action, active, special, comment FROM policy_r
       WHERE firewall = ? AND type IN (${sqlPlaceholders(typeIds.length)}) ORDER BY rule_order`,
      [firewallId, ...typeIds],
    );
    const candidateRules = rules.filter(
      (rule) => rule.special === 0 && !DEFAULT_RULE_COMMENTS.includes(rule.comment ?? ''),
    );
    const ruleIds = candidateRules.map((rule) => rule.id);
    const [interfaceRefs, ipObjRefs, vpnRefRuleIds] = await Promise.all([
      this.loadRuleInterfaceRefs(ruleIds),
      this.loadRuleIpObjRefs(ruleIds),
      this.loadRuleIdsWithVpnRefs(ruleIds),
    ]);
    const allRefs = Array.from(ipObjRefs.values()).flat();
    const lookup = await this.loadObjectLookup(allRefs);

    const captured: SnapshotProvisionRule[] = [];

    for (const policy of CAPTURED_POLICIES) {
      for (const rule of candidateRules.filter((item) => Number(item.type) === policy.typeId)) {
        const label = this.ruleLabel(rule, policy.label);

        if (rule.active !== 1) {
          warnings.push(`${label} was not captured: the rule is disabled.`);
          continue;
        }

        const provisionRule = this.captureRule(
          rule,
          policy,
          label,
          interfaceRefs.get(rule.id) ?? [],
          ipObjRefs.get(rule.id) ?? [],
          vpnRefRuleIds.has(rule.id),
          roleByInterfaceId,
          lookup,
          parameters,
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
   * Maps one policy_r row into the provision vocabulary. Returns null (and
   * records a warning) when the rule carries references the vocabulary cannot
   * express, because capturing it without them would produce a template rule
   * broader than the original one.
   */
  private captureRule(
    rule: SnapshotRuleRow,
    policy: (typeof CAPTURED_POLICIES)[number],
    label: string,
    interfaceRefs: SnapshotRuleInterfaceRow[],
    ipObjRefs: SnapshotRuleIpObjRow[],
    hasVpnRefs: boolean,
    roleByInterfaceId: Map<number, string>,
    lookup: SnapshotObjectLookup,
    parameters: SnapshotParameterCollector,
    warnings: string[],
  ): SnapshotProvisionRule | null {
    const isNat = policy.chain === 'snat' || policy.chain === 'dnat';

    if (!isNat && rule.action !== RULE_ACTION_ACCEPT && rule.action !== RULE_ACTION_DENY) {
      warnings.push(`${label} was not captured: only ACCEPT and DENY actions are supported.`);
      return null;
    }

    if (hasVpnRefs) {
      warnings.push(`${label} was not captured: VPN references cannot be templated yet.`);
      return null;
    }

    const { positions } = policy;
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

    if (ipObjRefs.some((ref) => !known.has(ref.position))) {
      warnings.push(
        `${label} was not captured: it references objects in positions the vocabulary cannot express.`,
      );
      return null;
    }

    const at = (position: number | undefined) =>
      ipObjRefs.filter((ref) => position !== undefined && ref.position === position);
    const objects = (position: number | undefined) =>
      this.captureObjects(at(position), roleByInterfaceId, lookup, parameters);
    const services = (position: number | undefined) =>
      this.captureServices(at(position), lookup, parameters, label);

    const sides = {
      source: objects(positions.source),
      destination: objects(positions.destination),
      services: services(positions.service),
      translatedSource: objects(positions.translatedSource),
      translatedDestination: objects(positions.translatedDestination),
      translatedService: services(positions.translatedService),
    };
    const failed = Object.values(sides).find((side) => 'reason' in side) as
      { reason: string } | undefined;

    if (failed) {
      warnings.push(`${label} was not captured: ${failed.reason}`);
      return null;
    }

    const value = <T>(side: SnapshotCapture<T[]>): T[] => (side as { value: T[] }).value;
    const inRoles = inRefs.map((ref) => roleByInterfaceId.get(ref.interface));
    const outRoles = outRefs.map((ref) => roleByInterfaceId.get(ref.interface));

    if ([...inRoles, ...outRoles].some((role) => !role)) {
      warnings.push(`${label} was not captured: it references an interface of another firewall.`);
      return null;
    }

    const roleValue = (roles: string[]) => (roles.length === 1 ? roles[0] : roles);

    const captured: SnapshotProvisionRule = {
      chain: policy.chain,
      ipVersion: policy.ipVersion,
      action: rule.action === RULE_ACTION_DENY ? 'deny' : 'accept',
    };

    if (inRoles.length) {
      captured.inRole = roleValue(inRoles);
    }

    if (outRoles.length) {
      captured.outRole = roleValue(outRoles);
    }

    const fields: [keyof SnapshotProvisionRule, unknown[]][] = [
      ['source', value(sides.source)],
      ['destination', value(sides.destination)],
      ['services', value(sides.services)],
      ['translatedSource', value(sides.translatedSource)],
      ['translatedDestination', value(sides.translatedDestination)],
      ['translatedService', value(sides.translatedService)],
    ];

    for (const [field, items] of fields) {
      if (items.length > 0) {
        (captured as unknown as Record<string, unknown>)[field] = items;
      }
    }

    if (rule.comment) {
      captured.comment = rule.comment;
    }

    return captured;
  }

  /**
   * Maps objects into the provision vocabulary. Predefined objects and groups
   * are referenced by id; an object owned by a source interface becomes a role
   * reference; a free-standing address, network or range becomes a parameter.
   */
  private captureObjects(
    refs: SnapshotObjectRef[],
    roleByInterfaceId: Map<number, string>,
    lookup: SnapshotObjectLookup,
    parameters: SnapshotParameterCollector,
  ): SnapshotCapture<SnapshotProvisionObject[]> {
    const captured: SnapshotProvisionObject[] = [];

    for (const ref of refs) {
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
        return { reason: 'it references an object that no longer exists.' };
      }

      if (ipobj.fwcloud === null) {
        captured.push({ kind: 'std', id: ipobj.id, name: ipobj.name });
        continue;
      }

      if (ipobj.interface !== null && roleByInterfaceId.has(ipobj.interface)) {
        captured.push({ kind: 'interfaceRole', role: roleByInterfaceId.get(ipobj.interface)! });
        continue;
      }

      if (
        ipobj.type === REPLICATION_PROFILE_IPOBJ_TYPE_RANGE &&
        ipobj.range_start &&
        ipobj.range_end
      ) {
        captured.push({
          kind: 'range',
          value: parameters.defineAddress(
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
        value: parameters.defineAddress(kind, `${ipobj.address}${ipobj.netmask ?? ''}`, ipobj.name),
        name: ipobj.name,
      });
    }

    return { value: captured };
  }

  /** Predefined services/groups by id; FWCloud single-port TCP/UDP services as port parameters. */
  private captureServices(
    refs: SnapshotObjectRef[],
    lookup: SnapshotObjectLookup,
    parameters: SnapshotParameterCollector,
    label: string,
  ): SnapshotCapture<SnapshotProvisionService[]> {
    const captured: SnapshotProvisionService[] = [];

    for (const ref of refs) {
      if (ref.ipobj_g > 0) {
        const group = lookup.groups.get(ref.ipobj_g);

        if (!group || group.fwcloud !== null) {
          return {
            reason:
              'service groups of the FWCloud cannot be templated; only predefined groups can.',
          };
        }

        captured.push({ kind: 'stdGroup', id: group.id, name: group.name });
        continue;
      }

      const service = ref.ipobj > 0 ? lookup.objects.get(ref.ipobj) : undefined;

      if (service && service.fwcloud === null) {
        captured.push({ kind: 'std', id: service.id, name: service.name });
        continue;
      }

      if (
        !service ||
        (service.type !== REPLICATION_PROFILE_IPOBJ_TYPE_TCP &&
          service.type !== REPLICATION_PROFILE_IPOBJ_TYPE_UDP) ||
        service.destination_port_start !== service.destination_port_end ||
        service.destination_port_start < 1 ||
        service.destination_port_start > 65535
      ) {
        return {
          reason: 'only single-port TCP/UDP services and predefined services are supported.',
        };
      }

      // Every captured port becomes a parameter, so the same template can be
      // applied with a different port without editing the profile.
      captured.push({
        protocol: service.type === REPLICATION_PROFILE_IPOBJ_TYPE_TCP ? 'tcp' : 'udp',
        port: parameters.definePort(service.destination_port_start, `${label} service port`),
      });
    }

    return { value: captured };
  }

  /** Routing tables with their routes, and the policy routing rules. */
  private async captureRouting(
    firewallId: number,
    roleByInterfaceId: Map<number, string>,
    parameters: SnapshotParameterCollector,
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
            parameters,
          );
          const gateway = route.gateway
            ? this.captureObjects([{ ipobj: route.gateway }], roleByInterfaceId, lookup, parameters)
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
        parameters,
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
    parameters: SnapshotParameterCollector,
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
        ? this.captureObjects([{ ipobj: id }], roleByInterfaceId, lookup, parameters)
        : { value: [] as SnapshotProvisionObject[] };
    const port = (id: number | null, label: string) =>
      id
        ? this.captureServices([{ ipobj: id }], lookup, parameters, label)
        : { value: [] as SnapshotProvisionService[] };
    const firstReason = (...captures: SnapshotCapture<unknown[]>[]) =>
      (captures.find((capture) => 'reason' in capture) as { reason: string } | undefined)?.reason;
    const values = <T>(capture: SnapshotCapture<T[]>): T[] => (capture as { value: T[] }).value;
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
            parameters,
          ),
        };
        const reason = !row.active
          ? 'the rule is disabled.'
          : firstReason(...Object.values(captures));
        return reason
          ? skip(label, reason)
          : [
              {
                network: values(captures.network)[0],
                range: values(captures.range)[0],
                router: values(captures.router)[0],
                dns: values(captures.dns),
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
          parameters,
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
              : firstReason(virtualIps);
        return reason
          ? skip(label, reason)
          : [
              {
                interfaceRole,
                virtualIps: values(virtualIps),
                ...(masterNode ? { masterNode } : {}),
                ...(row.comment ? { comment: row.comment } : {}),
              },
            ];
      }),
      haproxy: haproxy.flatMap((row) => {
        const label = `HAProxy rule ${row.rule_order}`;
        const captures = {
          frontendIp: one(row.frontend_ip),
          frontendService: port(row.frontend_port, label),
          backendIps: this.captureObjects(
            haproxyRefs.refs.get(row.id) ?? [],
            roleByInterfaceId,
            lookup,
            parameters,
          ),
          backendService: port(row.backend_port, label),
        };
        const reason = !row.active
          ? 'the rule is disabled.'
          : firstReason(...Object.values(captures));
        return reason
          ? skip(label, reason)
          : [
              {
                frontendIp: values(captures.frontendIp)[0],
                frontendService: values(captures.frontendService)[0],
                backendIps: values(captures.backendIps),
                backendService: values(captures.backendService)[0],
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
            `SELECT id, name, type, ip_version, address, netmask, interface, fwcloud, range_start, range_end,
                    destination_port_start, destination_port_end
             FROM ipobj WHERE id IN (${sqlPlaceholders(objectIds.length)})`,
            objectIds,
          )
        : Promise.resolve([] as SnapshotIpObjRow[]),
      groupIds.length
        ? dbQuery<SnapshotGroupRow>(
            `SELECT id, name, fwcloud FROM ipobj_g WHERE id IN (${sqlPlaceholders(groupIds.length)})`,
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
   * Captures the IPv4 addresses configured on a source interface as parameters,
   * which is what lets the operator assign different IPs when the template is
   * applied to another firewall.
   */
  private captureInterfaceAddresses(
    role: string,
    addresses: SnapshotIpObjRow[],
    parameters: SnapshotParameterCollector,
    warnings: string[],
  ): SnapshotProvisionAddress[] {
    const captured: SnapshotProvisionAddress[] = [];

    for (const address of addresses) {
      if (address.type !== REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS) {
        warnings.push(
          `Object "${address.name}" of interface role "${role}" was not captured: only address objects are templated.`,
        );
        continue;
      }

      captured.push({
        value: parameters.defineInterfaceAddress(
          role,
          captured.length,
          `${address.address}${address.netmask ?? ''}`,
        ),
        name: address.name,
      });
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
      `SELECT id, name, type, ip_version, address, netmask, interface FROM ipobj
       WHERE interface IN (${sqlPlaceholders(interfaceIds.length)}) AND ip_version = 4
       ORDER BY id`,
      interfaceIds,
    );

    const byInterface = new Map<number, SnapshotIpObjRow[]>();

    for (const row of rows) {
      if (!byInterface.has(row.interface!)) {
        byInterface.set(row.interface!, []);
      }

      byInterface.get(row.interface!)!.push(row);
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

  /** Ids of the rules holding VPN (OpenVPN/WireGuard/IPSec) references. */
  private async loadRuleIdsWithVpnRefs(ruleIds: number[]): Promise<Set<number>> {
    if (ruleIds.length === 0) {
      return new Set();
    }

    const results = await Promise.all(
      VPN_RELATION_TABLES.map(({ table }) =>
        dbQuery<{ rule: number }>(
          `SELECT rule FROM ${table} WHERE rule IN (${sqlPlaceholders(ruleIds.length)})`,
          ruleIds,
        ),
      ),
    );

    return new Set(results.flat().map((row) => row.rule));
  }

  private groupByRule<T extends { rule: number }>(rows: T[]): Map<number, T[]> {
    const grouped = new Map<number, T[]>();

    for (const row of rows) {
      const group = grouped.get(row.rule);

      if (group) {
        group.push(row);
      } else {
        grouped.set(row.rule, [row]);
      }
    }

    return grouped;
  }

  private ruleLabel(rule: SnapshotRuleRow, policy: string): string {
    const comment = (rule.comment ?? '').trim();

    return comment
      ? `${policy} rule ${rule.rule_order} ("${comment}")`
      : `${policy} rule ${rule.rule_order}`;
  }
}
