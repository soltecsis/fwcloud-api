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
import { RulePositionsMap } from '../policy/PolicyPosition';
import { PolicyTypesMap } from '../policy/PolicyType';
import { VPN_RELATION_TABLES } from './policy-replication.service';
import { dbQuery, sqlPlaceholders } from './replication-sql.helpers';
import { ReplicationProfile } from './replication-profile.model';
import type { ReplicationProfileTargetKind } from './replication-profile.constants';
import {
  ReplicationProfileService,
  type CreateCustomReplicationProfileOptions,
} from './replication-profile.service';

// Comments of the default rules created by PolicyRule.insertDefaultPolicy that
// are not flagged through the special column.
const DEFAULT_RULE_COMMENTS: string[] = Object.values(DefaultPolicyRuleComments);

// IPv4 FORWARD chain, the only chain the MVP provision vocabulary covers.
const IPV4_FORWARD_POLICY_TYPE = PolicyTypesMap.get('IPv4:FORWARD');
const FORWARD_IN_POSITION = RulePositionsMap.get('IPv4:FORWARD:In');
const FORWARD_OUT_POSITION = RulePositionsMap.get('IPv4:FORWARD:Out');
const FORWARD_SERVICE_POSITION = RulePositionsMap.get('IPv4:FORWARD:Service');
const FORWARD_SOURCE_POSITION = RulePositionsMap.get('IPv4:FORWARD:Source');
const FORWARD_DESTINATION_POSITION = RulePositionsMap.get('IPv4:FORWARD:Destination');

// policy_r.action codes expressible in the profile vocabulary.
const RULE_ACTION_ACCEPT = 1;
const RULE_ACTION_DENY = 2;

// IPObj protocol numbers / type ids of single-port TCP/UDP services.
const IPOBJ_TYPE_TCP = 2;
const IPOBJ_TYPE_UDP = 4;

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
  position: number;
}

interface SnapshotServiceRow {
  id: number;
  type: number;
  protocol: number | null;
  destination_port_start: number;
  destination_port_end: number;
}

interface SnapshotProvisionRule {
  chain: 'forward';
  action: 'accept' | 'deny';
  inRole?: string;
  outRole?: string;
  service?: { protocol: 'tcp' | 'udp'; port: number };
  comment?: string;
}

interface SnapshotTopologyNode {
  role: string;
  name: string;
  required: boolean;
}

interface SourceSnapshot {
  targetKind: ReplicationProfileTargetKind;
  sourceName: string;
  model: Record<string, unknown>;
  warnings: string[];
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
    const rules = await this.captureForwardRules(resolved.firewall.id, roleByInterfaceId, warnings);

    // assignInterfaceRoles already guarantees uniqueness.
    const roles = Array.from(roleByInterfaceId.values());
    const profileInterfaces = interfaces.map((iface) => ({
      name: iface.name,
      role: roleByInterfaceId.get(iface.id) as string,
    }));
    const policyStructure = { interfaces: profileInterfaces, rules };

    const model: Record<string, unknown> = {
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
        return { role: 'master', name: member.name, required: true };
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

  private async captureForwardRules(
    firewallId: number,
    roleByInterfaceId: Map<number, string>,
    warnings: string[],
  ): Promise<SnapshotProvisionRule[]> {
    const rules = await dbQuery<SnapshotRuleRow>(
      'SELECT id, rule_order, action, active, special, comment FROM policy_r WHERE firewall = ? AND type = ? ORDER BY rule_order',
      [firewallId, IPV4_FORWARD_POLICY_TYPE],
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
    const serviceById = await this.loadReferencedServices(ipObjRefs);

    const captured: SnapshotProvisionRule[] = [];

    for (const rule of candidateRules) {
      const label = this.ruleLabel(rule);

      if (rule.active !== 1) {
        warnings.push(`${label} was not captured: the rule is disabled.`);
        continue;
      }

      const provisionRule = this.captureRule(
        rule,
        interfaceRefs.get(rule.id) ?? [],
        ipObjRefs.get(rule.id) ?? [],
        vpnRefRuleIds.has(rule.id),
        roleByInterfaceId,
        serviceById,
        warnings,
      );

      if (provisionRule) {
        captured.push(provisionRule);
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
    interfaceRefs: SnapshotRuleInterfaceRow[],
    ipObjRefs: SnapshotRuleIpObjRow[],
    hasVpnRefs: boolean,
    roleByInterfaceId: Map<number, string>,
    serviceById: Map<number, SnapshotServiceRow>,
    warnings: string[],
  ): SnapshotProvisionRule | null {
    const label = this.ruleLabel(rule);

    if (rule.action !== RULE_ACTION_ACCEPT && rule.action !== RULE_ACTION_DENY) {
      warnings.push(`${label} was not captured: only ACCEPT and DENY actions are supported.`);
      return null;
    }

    if (hasVpnRefs) {
      warnings.push(`${label} was not captured: VPN references cannot be templated.`);
      return null;
    }

    const inRefs = interfaceRefs.filter((ref) => ref.position === FORWARD_IN_POSITION);
    const outRefs = interfaceRefs.filter((ref) => ref.position === FORWARD_OUT_POSITION);
    const otherInterfaceRefs = interfaceRefs.length - inRefs.length - outRefs.length;

    if (inRefs.length > 1 || outRefs.length > 1 || otherInterfaceRefs > 0) {
      warnings.push(
        `${label} was not captured: only one inbound and one outbound interface per rule are supported.`,
      );
      return null;
    }

    const serviceRefs = ipObjRefs.filter((ref) => ref.position === FORWARD_SERVICE_POSITION);
    const addressRefs = ipObjRefs.filter(
      (ref) =>
        ref.position === FORWARD_SOURCE_POSITION || ref.position === FORWARD_DESTINATION_POSITION,
    );
    const otherIpObjRefs = ipObjRefs.length - serviceRefs.length - addressRefs.length;

    if (addressRefs.length > 0 || otherIpObjRefs > 0) {
      warnings.push(
        `${label} was not captured: source/destination objects cannot be templated yet.`,
      );
      return null;
    }

    if (serviceRefs.length > 1) {
      warnings.push(`${label} was not captured: only one service per rule is supported.`);
      return null;
    }

    let service: SnapshotProvisionRule['service'];

    if (serviceRefs.length === 1) {
      service = this.captureService(serviceRefs[0], serviceById);

      if (!service) {
        warnings.push(
          `${label} was not captured: only single-port TCP/UDP services are supported.`,
        );
        return null;
      }
    }

    const inRole = inRefs.length === 1 ? roleByInterfaceId.get(inRefs[0].interface) : undefined;
    const outRole = outRefs.length === 1 ? roleByInterfaceId.get(outRefs[0].interface) : undefined;

    if ((inRefs.length === 1 && !inRole) || (outRefs.length === 1 && !outRole)) {
      warnings.push(`${label} was not captured: it references an interface of another firewall.`);
      return null;
    }

    const captured: SnapshotProvisionRule = {
      chain: 'forward',
      action: rule.action === RULE_ACTION_DENY ? 'deny' : 'accept',
    };

    if (inRole) {
      captured.inRole = inRole;
    }

    if (outRole) {
      captured.outRole = outRole;
    }

    if (service) {
      captured.service = service;
    }

    if (rule.comment) {
      captured.comment = rule.comment;
    }

    return captured;
  }

  private captureService(
    ref: SnapshotRuleIpObjRow,
    serviceById: Map<number, SnapshotServiceRow>,
  ): SnapshotProvisionRule['service'] | undefined {
    // Group (ipobj_g) or interface based service references are out of scope.
    if (ref.ipobj <= 0) {
      return undefined;
    }

    const service = serviceById.get(ref.ipobj);

    if (
      !service ||
      (service.type !== IPOBJ_TYPE_TCP && service.type !== IPOBJ_TYPE_UDP) ||
      service.destination_port_start !== service.destination_port_end ||
      service.destination_port_start < 1 ||
      service.destination_port_start > 65535
    ) {
      return undefined;
    }

    return {
      protocol: service.type === IPOBJ_TYPE_TCP ? 'tcp' : 'udp',
      port: service.destination_port_start,
    };
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
      `SELECT rule, ipobj, position FROM policy_r__ipobj WHERE rule IN (${sqlPlaceholders(ruleIds.length)})`,
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

  private async loadReferencedServices(
    ipObjRefs: Map<number, SnapshotRuleIpObjRow[]>,
  ): Promise<Map<number, SnapshotServiceRow>> {
    const ids = new Set<number>();

    for (const refs of ipObjRefs.values()) {
      for (const ref of refs) {
        if (ref.position === FORWARD_SERVICE_POSITION && ref.ipobj > 0) {
          ids.add(ref.ipobj);
        }
      }
    }

    if (ids.size === 0) {
      return new Map();
    }

    const idList = Array.from(ids);
    const rows = await dbQuery<SnapshotServiceRow>(
      `SELECT id, type, protocol, destination_port_start, destination_port_end FROM ipobj WHERE id IN (${sqlPlaceholders(idList.length)})`,
      idList,
    );

    return new Map(rows.map((row) => [row.id, row]));
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

  private ruleLabel(rule: SnapshotRuleRow): string {
    const comment = (rule.comment ?? '').trim();

    return comment ? `Rule ${rule.rule_order} ("${comment}")` : `Rule ${rule.rule_order}`;
  }
}
