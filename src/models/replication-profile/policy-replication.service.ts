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

import { QueryRunner } from 'typeorm';
import db from '../../database/database-manager';
import { Service } from '../../fonaments/services/service';
import { dbQuery, sqlPlaceholders } from './replication-sql.helpers';
import { DefaultPolicyRuleComments, PolicyRule, SpecialPolicyRules } from '../policy/PolicyRule';
import { RulePositionsMap } from '../policy/PolicyPosition';
import { FireWallOptMask } from '../firewall/Firewall';
import { Interface } from '../interface/Interface';
import { IPObj } from '../ipobj/IPObj';
import { Tree } from '../tree/Tree';
import {
  isPolicyReplicationMode,
  PolicyReplicationConflict,
  PolicyReplicationGroupPreview,
  PolicyReplicationMode,
  PolicyReplicationProvision,
  PolicyReplicationProvisionService,
  PolicyReplicationRequest,
  PolicyReplicationResolvedReference,
  PolicyReplicationResult,
  PolicyReplicationRulePreview,
  PolicyReplicationTarget,
} from './policy-replication.types';

// Comments used by PolicyRule.insertDefaultPolicy for the default rules that
// are not flagged through the special column.
const DEFAULT_RULE_COMMENTS: string[] = Object.values(DefaultPolicyRuleComments);

// Plain-number views of the special rule codes, comparable against DB rows.
const SPECIAL_STATEFUL: number = SpecialPolicyRules.STATEFUL;
const SPECIAL_CATCHALL: number = SpecialPolicyRules.CATCHALL;

/**
 * VPN relation tables of a policy_r rule. Besides the table/column shape used
 * to copy the references, each entry carries the query that resolves the
 * owner firewall of a reference (to detect source-owned VPNs) and the prefix
 * used when building rule signatures.
 */
export const VPN_RELATION_TABLES = [
  {
    key: 'openvpns',
    table: 'policy_r__openvpn',
    column: 'openvpn',
    ownerKind: 'openvpn',
    sigPrefix: 'OVPN',
    ownerSql: 'SELECT id, firewall FROM openvpn WHERE id IN',
  },
  {
    key: 'openvpnPrefixes',
    table: 'policy_r__openvpn_prefix',
    column: 'prefix',
    ownerKind: 'openvpn_prefix',
    sigPrefix: 'OPRE',
    ownerSql:
      'SELECT P.id, V.firewall FROM openvpn_prefix P INNER JOIN openvpn V ON V.id = P.openvpn WHERE P.id IN',
  },
  {
    key: 'wireguards',
    table: 'policy_r__wireguard',
    column: 'wireguard',
    ownerKind: 'wireguard',
    sigPrefix: 'WG',
    ownerSql: 'SELECT id, firewall FROM wireguard WHERE id IN',
  },
  {
    key: 'wireguardPrefixes',
    table: 'policy_r__wireguard_prefix',
    column: 'prefix',
    ownerKind: 'wireguard_prefix',
    sigPrefix: 'WPRE',
    ownerSql:
      'SELECT P.id, V.firewall FROM wireguard_prefix P INNER JOIN wireguard V ON V.id = P.wireguard WHERE P.id IN',
  },
  {
    key: 'ipsecs',
    table: 'policy_r__ipsec',
    column: 'ipsec',
    ownerKind: 'ipsec',
    sigPrefix: 'IPS',
    ownerSql: 'SELECT id, firewall FROM ipsec WHERE id IN',
  },
  {
    key: 'ipsecPrefixes',
    table: 'policy_r__ipsec_prefix',
    column: 'prefix',
    ownerKind: 'ipsec_prefix',
    sigPrefix: 'IPRE',
    ownerSql:
      'SELECT P.id, V.firewall FROM ipsec_prefix P INNER JOIN ipsec V ON V.id = P.ipsec WHERE P.id IN',
  },
] as const;

/** All the relation tables holding the references of a policy_r rule. */
const RELATION_TABLES = [
  { key: 'ipobjs', table: 'policy_r__ipobj' },
  { key: 'interfaces', table: 'policy_r__interface' },
  ...VPN_RELATION_TABLES,
] as const;

type PolicyRelationTable = (typeof RELATION_TABLES)[number]['table'];

type RuleRelations = Record<(typeof RELATION_TABLES)[number]['key'], any[]>;

interface FirewallRow {
  id: number;
  name: string;
  cluster: number | null;
  fwcloud: number;
  fwmaster: number;
}

interface InterfaceRow {
  id: number;
  name: string;
  firewall: number | null;
}

interface IPObjRow {
  id: number;
  name: string;
  type: number;
  ip_version: number;
  address: string | null;
  interface: number | null;
}

interface PolicyRuleRow {
  id: number;
  idgroup: number | null;
  firewall: number;
  rule_order: number;
  action: number;
  time_start: Date | null;
  time_end: Date | null;
  active: number;
  options: number;
  comment: string | null;
  type: number;
  style: string | null;
  fw_apply_to: number | null;
  negate: string | null;
  mark: number;
  special: number;
  run_before: string | null;
  run_after: string | null;
}

interface PolicyGroupRow {
  id: number;
  name: string;
  comment: string | null;
  idgroup: number | null;
  groupstyle: string | null;
}

interface PlannedRelation {
  table: PolicyRelationTable;
  values: Record<string, number | null>;
  signatureKey: string;
}

interface PlannedRule {
  sourceRule: PolicyRuleRow;
  relations: PlannedRelation[];
  fwApplyTo: number | null;
  sourceGroupId: number | null;
  signature: string;
  preview: PolicyReplicationRulePreview;
}

interface PlannedGroup {
  source: PolicyGroupRow;
  preview: PolicyReplicationGroupPreview;
}

interface ReplicationContext {
  request: PolicyReplicationRequest;
  result: PolicyReplicationResult;
  sourceFirewall: FirewallRow;
  /** All firewall ids on the source side (cluster members when source is a cluster). */
  sourceFirewallIds: Set<number>;
  /** Firewall holding the target policy (the master when the target is a cluster). */
  targetFirewall: FirewallRow;
  targetClusterId: number | null;
  /** Member firewall ids of the target cluster, when the target is a cluster. */
  targetClusterMemberIds: Set<number> | null;
  sourceInterfaces: Map<number, InterfaceRow>;
  targetInterfaces: Map<number, InterfaceRow>;
  roleBySourceInterface: Map<number, string>;
  roleBySourceNode: Map<number, string>;
  sourceIpObjs: Map<number, IPObjRow>;
  targetAddressesByInterface: Map<number, IPObjRow[]>;
  vpnOwnerFirewall: Map<string, number>;
  resolvedReferences: Map<string, PolicyReplicationResolvedReference>;
}

interface ReplicationPlan {
  rules: PlannedRule[];
  groups: PlannedGroup[];
  defaultRuleIdsToRemove: number[];
  targetRules: PolicyRuleRow[];
  targetSignatures: Map<string, number>;
}

/**
 * Role based policy replication engine.
 *
 * Applies the policy of a source firewall/cluster (the source profile
 * template) to an already existing target firewall or cluster. Unlike the
 * legacy full clone flow, the target keeps its own autodiscovered interfaces
 * and topology: every reference to a source-owned interface, interface
 * address or cluster node is resolved against the target through logical
 * role mappings instead of direct source-to-target id mappings.
 */
export class PolicyReplicationService extends Service {
  public async build(): Promise<PolicyReplicationService> {
    await super.build();
    return this;
  }

  /**
   * Replicates the source profile policy into the target.
   *
   * - 'replace_defaults': removes the default rules generated when the target
   *   firewall/cluster master was created and inserts the replicated rules.
   * - 'merge': keeps the existing target rules; if any collision is detected
   *   nothing is written and the conflicts are reported.
   * - 'dry_run': never writes; returns a full preview including the default
   *   rules that replace_defaults would remove and the collisions that merge
   *   would report.
   *
   * Missing role mappings are reported through result.errors and prevent any
   * database write. Broken or unsupported references (e.g. VPN configurations
   * that belong to the source firewall) are reported as conflicts and the
   * affected rules are skipped so that no invalid rule is ever created.
   */
  public async replicatePolicyFromProfile(
    request: PolicyReplicationRequest,
  ): Promise<PolicyReplicationResult> {
    if (!request.mode || !isPolicyReplicationMode(request.mode)) {
      throw new Error(`Invalid policy replication mode: ${String(request.mode)}`);
    }

    if (!request.sourceProfile || !request.interfaceRoleMapping) {
      throw new Error(
        'A source profile and interface role mapping are required for source-based replication',
      );
    }

    const result = this.createEmptyResult(request.mode);

    const context = await this.loadContext(request, result);

    if (result.errors.length === 0) {
      const plan = await this.buildPlan(context);

      result.resolvedReferences = Array.from(context.resolvedReferences.values());

      if (request.mode === 'dry_run' || result.errors.length > 0) {
        return result;
      }

      if (request.mode === 'merge' && result.conflicts.length > 0) {
        return result;
      }

      await this.applyPlan(context, plan);
    }

    return result;
  }

  /**
   * Declarative provisioning: instead of copying from a source firewall, this
   * CREATES on the target firewall the interfaces and policy rules declared in
   * the profile's `provision` block. Used by provisioning profiles, which do
   * not need a source firewall. Returns the same result shape as the regular
   * replication so the caller/UI can report what was created.
   */
  public async provisionPolicyFromProfile(
    target: PolicyReplicationTarget,
    provision: PolicyReplicationProvision,
    fwCloudId: number,
  ): Promise<PolicyReplicationResult> {
    const result = this.createEmptyResult('replace_defaults');

    const firewallId = await this.resolveProvisionTargetFirewallId(target);
    const manager = db.getSource().manager;
    const dbCon = await this.legacyConnection();

    // 1. Create the declared interfaces and their tree nodes; remember role -> id.
    const fdiNode = (
      await dbQuery<{ id: number }>(
        "SELECT id FROM fwc_tree WHERE id_obj = ? AND node_type = 'FDI' AND fwcloud = ?",
        [firewallId, fwCloudId],
      )
    )[0];
    const interfaceIdByRole = new Map<string, number>();
    for (const iface of provision.interfaces) {
      const created = await manager.getRepository(Interface).save({
        name: iface.name,
        type: '10',
        interface_type: '10',
        firewallId,
      });
      if (fdiNode) {
        await Tree.newNode(dbCon, fwCloudId, iface.name, fdiNode.id, 'IFF', created.id, 10);
      }
      interfaceIdByRole.set(iface.role, created.id);
      result.resolvedReferences.push({
        kind: 'interface',
        role: iface.role,
        sourceId: 0,
        targetId: created.id,
      });
    }

    // 2. Ensure a default policy exists so the catch-all denies everything else.
    const catchAll = await dbQuery<{ id: number }>(
      'SELECT id FROM policy_r WHERE firewall = ? AND type = 3 AND special = ? LIMIT 1',
      [firewallId, SPECIAL_CATCHALL],
    );
    if (catchAll.length === 0) {
      await PolicyRule.insertDefaultPolicy(firewallId, null, FireWallOptMask.STATEFUL);
    }

    // 3. Insert the declared rules just above the FORWARD catch-all.
    const ruleCount = provision.rules.length;
    if (ruleCount > 0) {
      await dbQuery(
        'UPDATE policy_r SET rule_order = rule_order + ? WHERE firewall = ? AND type = 3 AND special = ?',
        [ruleCount, firewallId, SPECIAL_CATCHALL],
      );
    }

    for (let i = 0; i < ruleCount; i++) {
      const rule = provision.rules[i];
      const ruleOrder = 2 + i;
      const serviceId = rule.service
        ? await this.createProvisionService(rule.service, fwCloudId)
        : null;
      const ruleId = await PolicyRule.insertPolicy_r({
        firewall: firewallId,
        type: 3, // IPv4 FORWARD
        rule_order: ruleOrder,
        action: rule.action === 'deny' ? 2 : 1,
        active: 1,
        options: 0,
        special: 0,
        comment: rule.comment ?? 'Provisioned by replication profile.',
      });

      const inId = rule.inRole ? interfaceIdByRole.get(rule.inRole) : undefined;
      const outId = rule.outRole ? interfaceIdByRole.get(rule.outRole) : undefined;
      if (inId) {
        await dbQuery(
          'INSERT INTO policy_r__interface (rule, interface, position, position_order) VALUES (?, ?, ?, 1)',
          [ruleId, inId, RulePositionsMap.get('IPv4:FORWARD:In')],
        );
      }
      if (outId) {
        await dbQuery(
          'INSERT INTO policy_r__interface (rule, interface, position, position_order) VALUES (?, ?, ?, 1)',
          [ruleId, outId, RulePositionsMap.get('IPv4:FORWARD:Out')],
        );
      }
      if (serviceId) {
        await dbQuery(
          'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, ?, -1, -1, ?, 1)',
          [ruleId, serviceId, RulePositionsMap.get('IPv4:FORWARD:Service')],
        );
      }

      result.createdRules.push({
        sourceRuleId: 0,
        targetRuleId: ruleId,
        policyTypeId: 3,
        ruleOrder,
        comment: rule.comment ?? null,
      });
    }

    result.applied = true;
    return result;
  }

  /** Resolves the firewall to provision: the firewall itself, or a cluster master. */
  private async resolveProvisionTargetFirewallId(target: PolicyReplicationTarget): Promise<number> {
    if (target.kind !== 'cluster') {
      return target.id;
    }

    const master = await dbQuery<{ id: number }>(
      'SELECT id FROM firewall WHERE cluster = ? AND fwmaster = 1',
      [target.id],
    );
    if (master.length === 0) {
      throw new Error(`Master firewall of target cluster ${target.id} not found`);
    }

    return master[0].id;
  }

  /** Creates a TCP/UDP service object in the FWCloud and returns its id. */
  private async createProvisionService(
    service: PolicyReplicationProvisionService,
    fwCloudId: number,
  ): Promise<number> {
    const isTcp = service.protocol === 'tcp';
    const created = await db
      .getSource()
      .manager.getRepository(IPObj)
      .save({
        name: `${service.protocol.toUpperCase()}/${service.port}`,
        ipObjTypeId: isTcp ? 2 : 4,
        protocol: isTcp ? 6 : 17,
        source_port_start: 0,
        source_port_end: 0,
        destination_port_start: service.port,
        destination_port_end: service.port,
        fwCloudId,
      });

    return created.id;
  }

  /** Legacy callback-style connection used by the static model helpers (Tree, etc.). */
  private legacyConnection(): Promise<any> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => (error ? reject(error) : resolve(connection)));
    });
  }

  /** Builds an empty replication/provisioning result for the given mode. */
  private createEmptyResult(mode: PolicyReplicationMode): PolicyReplicationResult {
    return {
      mode,
      applied: false,
      createdRules: [],
      createdGroups: [],
      resolvedReferences: [],
      removedDefaultRules: [],
      skippedRules: [],
      conflicts: [],
      warnings: [],
      errors: [],
    };
  }

  private async loadContext(
    request: PolicyReplicationRequest,
    result: PolicyReplicationResult,
  ): Promise<ReplicationContext> {
    const sourceFirewall = await this.findFirewall(request.sourceProfile!.firewallId);
    if (!sourceFirewall) {
      throw new Error(`Source firewall ${request.sourceProfile!.firewallId} not found`);
    }

    let targetFirewall: FirewallRow | null;
    let targetClusterId: number | null = null;
    let targetClusterMemberIds: Set<number> | null = null;

    if (request.target.kind === 'cluster') {
      targetClusterId = request.target.id;
      const members = await dbQuery<FirewallRow>(
        'SELECT id, name, cluster, fwcloud, fwmaster FROM firewall WHERE cluster = ?',
        [targetClusterId],
      );
      targetFirewall = members.find((member) => member.fwmaster === 1) ?? null;
      if (!targetFirewall) {
        throw new Error(`Master firewall of target cluster ${targetClusterId} not found`);
      }
      targetClusterMemberIds = new Set(members.map((member) => member.id));
    } else {
      targetFirewall = await this.findFirewall(request.target.id);
      if (!targetFirewall) {
        throw new Error(`Target firewall ${request.target.id} not found`);
      }
    }

    if (targetFirewall.id === sourceFirewall.id) {
      throw new Error('Source and target firewalls must be different');
    }

    if (targetFirewall.fwcloud !== sourceFirewall.fwcloud) {
      throw new Error('Source and target must belong to the same FWCloud');
    }

    const sourceFirewallIds = new Set<number>([sourceFirewall.id]);
    if (sourceFirewall.cluster) {
      for (const row of await dbQuery<{ id: number }>('SELECT id FROM firewall WHERE cluster = ?', [
        sourceFirewall.cluster,
      ])) {
        sourceFirewallIds.add(row.id);
      }
    }

    const sourceInterfaces = await this.loadFirewallInterfaces(sourceFirewall.id);
    const targetInterfaces = await this.loadFirewallInterfaces(targetFirewall.id);

    const context: ReplicationContext = {
      request,
      result,
      sourceFirewall,
      sourceFirewallIds,
      targetFirewall,
      targetClusterId,
      targetClusterMemberIds,
      sourceInterfaces,
      targetInterfaces,
      roleBySourceInterface: new Map(),
      roleBySourceNode: new Map(),
      sourceIpObjs: new Map(),
      targetAddressesByInterface: new Map(),
      vpnOwnerFirewall: new Map(),
      resolvedReferences: new Map(),
    };

    this.validateRoleMappings(context);

    return context;
  }

  private async findFirewall(id: number): Promise<FirewallRow | null> {
    const rows = await dbQuery<FirewallRow>(
      'SELECT id, name, cluster, fwcloud, fwmaster FROM firewall WHERE id = ?',
      [id],
    );
    return rows.length > 0 ? rows[0] : null;
  }

  private async loadFirewallInterfaces(firewallId: number): Promise<Map<number, InterfaceRow>> {
    const map = new Map<number, InterfaceRow>();
    for (const row of await dbQuery<InterfaceRow>(
      'SELECT id, name, firewall FROM interface WHERE firewall = ?',
      [firewallId],
    )) {
      map.set(row.id, row);
    }
    return map;
  }

  private validateRoleMappings(context: ReplicationContext): void {
    const { request, result } = context;

    for (const [role, interfaceId] of Object.entries(request.sourceProfile!.interfaceRoles)) {
      if (!context.sourceInterfaces.has(interfaceId)) {
        result.errors.push(
          `Interface role "${role}": source interface ${interfaceId} does not belong to source firewall "${context.sourceFirewall.name}"`,
        );
        continue;
      }
      if (context.roleBySourceInterface.has(interfaceId)) {
        result.errors.push(
          `Source interface ${interfaceId} is assigned to more than one role ("${context.roleBySourceInterface.get(interfaceId)}" and "${role}")`,
        );
        continue;
      }
      context.roleBySourceInterface.set(interfaceId, role);
    }

    const usedTargetInterfaces = new Map<number, string>();
    for (const [role, interfaceId] of Object.entries(request.interfaceRoleMapping!)) {
      if (!context.targetInterfaces.has(interfaceId)) {
        result.errors.push(
          `Interface role mapping "${role}": target interface ${interfaceId} does not belong to target firewall "${context.targetFirewall.name}"`,
        );
        continue;
      }
      if (usedTargetInterfaces.has(interfaceId)) {
        result.conflicts.push({
          type: 'duplicated_interface_reference',
          message: `Target interface ${interfaceId} is mapped to more than one role ("${usedTargetInterfaces.get(interfaceId)}" and "${role}")`,
        });
        result.errors.push(
          `Target interface ${interfaceId} is mapped to more than one role ("${usedTargetInterfaces.get(interfaceId)}" and "${role}")`,
        );
        continue;
      }
      usedTargetInterfaces.set(interfaceId, role);
    }

    for (const [role, nodeId] of Object.entries(request.sourceProfile!.nodeRoles ?? {})) {
      if (!context.sourceFirewallIds.has(nodeId)) {
        result.errors.push(
          `Node role "${role}": source node ${nodeId} does not belong to the source cluster`,
        );
        continue;
      }
      context.roleBySourceNode.set(nodeId, role);
    }
  }

  private async buildPlan(context: ReplicationContext): Promise<ReplicationPlan> {
    const { request, result } = context;

    // Validate node role mapping targets against the target cluster members.
    if (context.targetClusterMemberIds) {
      for (const [role, nodeId] of Object.entries(request.nodeRoleMapping ?? {})) {
        if (!context.targetClusterMemberIds.has(nodeId)) {
          result.errors.push(
            `Node role mapping "${role}": target node ${nodeId} does not belong to target cluster ${context.targetClusterId}`,
          );
        }
      }
    }

    const sourceRules = await dbQuery<PolicyRuleRow>(
      'SELECT * FROM policy_r WHERE firewall = ? ORDER BY type, rule_order',
      [context.sourceFirewall.id],
    );
    const sourceRelations = await this.loadRuleRelations(context.sourceFirewall.id);

    await this.preloadReferencedObjects(context, sourceRelations);

    const plannedRules: PlannedRule[] = [];
    for (const rule of sourceRules) {
      const planned = this.planRule(context, rule, sourceRelations);
      if (planned) {
        plannedRules.push(planned);
      }
    }

    const groups = await this.planGroups(context, plannedRules);

    const targetRules = await dbQuery<PolicyRuleRow>(
      'SELECT * FROM policy_r WHERE firewall = ? ORDER BY type, rule_order',
      [context.targetFirewall.id],
    );
    const defaultRuleIdsToRemove = targetRules
      .filter(
        (rule) =>
          rule.special === SPECIAL_STATEFUL ||
          rule.special === SPECIAL_CATCHALL ||
          DEFAULT_RULE_COMMENTS.includes(rule.comment ?? ''),
      )
      .map((rule) => rule.id);

    const targetSignatures = await this.buildTargetSignatures(context, targetRules);

    if (request.mode === 'merge' || request.mode === 'dry_run') {
      const targetGroups = await dbQuery<PolicyGroupRow>(
        'SELECT id, name, comment, idgroup, groupstyle FROM policy_g WHERE firewall = ?',
        [context.targetFirewall.id],
      );
      this.detectMergeConflicts(
        context,
        plannedRules,
        groups,
        targetGroups,
        targetRules,
        targetSignatures,
      );
    }

    if (request.mode === 'replace_defaults' || request.mode === 'dry_run') {
      result.removedDefaultRules = defaultRuleIdsToRemove;
    }

    result.createdRules = plannedRules.map((rule) => rule.preview);
    result.createdGroups = groups.map((group) => group.preview);

    return {
      rules: plannedRules,
      groups,
      defaultRuleIdsToRemove,
      targetRules,
      targetSignatures,
    };
  }

  private async loadRuleRelations(firewallId: number): Promise<Map<number, RuleRelations>> {
    const relations = new Map<number, RuleRelations>();
    const relationsOf = (ruleId: number): RuleRelations => {
      if (!relations.has(ruleId)) {
        relations.set(
          ruleId,
          Object.fromEntries(RELATION_TABLES.map(({ key }) => [key, []])) as RuleRelations,
        );
      }
      return relations.get(ruleId);
    };

    for (const { key, table } of RELATION_TABLES) {
      const rows = await dbQuery(
        `SELECT R.* FROM ${table} R INNER JOIN policy_r P ON P.id = R.rule WHERE P.firewall = ? ORDER BY R.rule, R.position, R.position_order`,
        [firewallId],
      );
      for (const row of rows) {
        relationsOf(row.rule)[key].push(row);
      }
    }

    return relations;
  }

  private async preloadReferencedObjects(
    context: ReplicationContext,
    sourceRelations: Map<number, RuleRelations>,
  ): Promise<void> {
    const ipobjIds = new Set<number>();
    const vpnRefIds = new Map<string, Set<number>>(
      VPN_RELATION_TABLES.map(({ ownerKind }) => [ownerKind, new Set<number>()]),
    );

    for (const relations of sourceRelations.values()) {
      for (const row of relations.ipobjs) {
        if (row.ipobj > 0) ipobjIds.add(row.ipobj);
      }
      for (const { key, column, ownerKind } of VPN_RELATION_TABLES) {
        for (const row of relations[key]) {
          vpnRefIds.get(ownerKind).add(row[column]);
        }
      }
    }

    if (ipobjIds.size > 0) {
      const rows = await dbQuery<IPObjRow>(
        `SELECT id, name, type, ip_version, address, interface FROM ipobj WHERE id IN (${sqlPlaceholders(ipobjIds.size)})`,
        Array.from(ipobjIds),
      );
      for (const row of rows) {
        context.sourceIpObjs.set(row.id, row);
      }
    }

    const targetInterfaceIds = Array.from(context.targetInterfaces.keys());
    if (targetInterfaceIds.length > 0) {
      const rows = await dbQuery<IPObjRow>(
        `SELECT id, name, type, ip_version, address, interface FROM ipobj WHERE interface IN (${sqlPlaceholders(targetInterfaceIds.length)})`,
        targetInterfaceIds,
      );
      for (const row of rows) {
        if (!context.targetAddressesByInterface.has(row.interface)) {
          context.targetAddressesByInterface.set(row.interface, []);
        }
        context.targetAddressesByInterface.get(row.interface).push(row);
      }
    }

    // Owner lookups are independent reads, so they can run in parallel.
    await Promise.all(
      VPN_RELATION_TABLES.map(async ({ ownerKind, ownerSql }) => {
        const ids = vpnRefIds.get(ownerKind);
        if (ids.size === 0) {
          return;
        }
        const rows = await dbQuery<{ id: number; firewall: number }>(
          `${ownerSql} (${sqlPlaceholders(ids.size)})`,
          Array.from(ids),
        );
        for (const row of rows) {
          context.vpnOwnerFirewall.set(`${ownerKind}:${row.id}`, row.firewall);
        }
      }),
    );
  }

  /**
   * Plans the replication of a single source rule. Returns null when the rule
   * must be skipped because of broken or unsupported references.
   */
  private planRule(
    context: ReplicationContext,
    rule: PolicyRuleRow,
    sourceRelations: Map<number, RuleRelations>,
  ): PlannedRule | null {
    const { result } = context;
    const relations = sourceRelations.get(rule.id) ?? null;
    const planned: PlannedRelation[] = [];
    const ruleConflicts: PolicyReplicationConflict[] = [];
    const errorsBefore = result.errors.length;

    const fwApplyTo = this.resolveFwApplyTo(context, rule);

    if (relations) {
      for (const row of relations.ipobjs) {
        const values: Record<string, number | null> = {
          ipobj: row.ipobj > 0 ? row.ipobj : -1,
          ipobj_g: row.ipobj_g > 0 ? row.ipobj_g : -1,
          interface: row.interface > 0 ? row.interface : -1,
          position: row.position,
          position_order: row.position_order,
        };
        let signatureKey: string;

        if (row.interface > 0) {
          const resolved = this.resolveInterface(context, row.interface, rule.id);
          if (resolved === null) {
            continue; // missing role mapping already reported through errors
          }
          values.interface = resolved;
          signatureKey = `${row.position}:IF:${resolved}`;
        } else if (row.ipobj > 0) {
          const resolved = this.resolveIpObj(context, row.ipobj, rule.id, ruleConflicts);
          if (resolved === null) {
            continue;
          }
          values.ipobj = resolved;
          signatureKey = `${row.position}:O:${resolved}`;
        } else {
          signatureKey = `${row.position}:G:${row.ipobj_g}`;
        }

        planned.push({ table: 'policy_r__ipobj', values, signatureKey });
      }

      for (const row of relations.interfaces) {
        const resolved = this.resolveInterface(context, row.interface, rule.id);
        if (resolved === null) {
          continue;
        }
        planned.push({
          table: 'policy_r__interface',
          values: {
            interface: resolved,
            position: row.position,
            position_order: row.position_order,
          },
          signatureKey: `${row.position}:I:${resolved}`,
        });
      }

      for (const { key, table, column, ownerKind, sigPrefix } of VPN_RELATION_TABLES) {
        for (const row of relations[key]) {
          const refId: number = row[column];
          const owner = context.vpnOwnerFirewall.get(`${ownerKind}:${refId}`);

          if (owner === undefined || context.sourceFirewallIds.has(owner)) {
            ruleConflicts.push({
              type: 'unsupported_vpn_reference',
              message:
                owner === undefined
                  ? `Rule ${rule.id}: ${ownerKind} reference ${refId} is broken (referenced VPN configuration not found)`
                  : `Rule ${rule.id}: ${ownerKind} reference ${refId} belongs to the source firewall and has no equivalent on the target; rule skipped`,
              sourceRuleId: rule.id,
            });
            continue;
          }

          planned.push({
            table,
            values: {
              [column]: refId,
              position: row.position,
              position_order: row.position_order,
            },
            signatureKey: `${row.position}:${sigPrefix}:${refId}`,
          });
        }
      }
    }

    // Drop relation duplicates produced by several source references
    // collapsing into the same target reference.
    const seen = new Set<string>();
    const deduped: PlannedRelation[] = [];
    for (const relation of planned) {
      if (seen.has(relation.signatureKey)) {
        ruleConflicts.push({
          type:
            relation.table === 'policy_r__interface'
              ? 'duplicated_interface_reference'
              : 'duplicated_ipobj_reference',
          message: `Rule ${rule.id}: several source references resolve to the same target reference (${relation.signatureKey}); duplicate dropped`,
          sourceRuleId: rule.id,
        });
        continue;
      }
      seen.add(relation.signatureKey);
      deduped.push(relation);
    }

    const hasBlockingConflict = ruleConflicts.some(
      (conflict) =>
        conflict.type === 'unsupported_vpn_reference' || conflict.type === 'broken_ipobj_reference',
    );

    result.conflicts.push(...ruleConflicts);

    if (result.errors.length > errorsBefore) {
      // Missing role mappings: the whole replication fails fast, no rule preview.
      return null;
    }

    if (hasBlockingConflict) {
      result.skippedRules.push(rule.id);
      return null;
    }

    const signature = this.buildRuleSignature(
      rule,
      deduped.map((relation) => relation.signatureKey),
    );

    return {
      sourceRule: rule,
      relations: deduped,
      fwApplyTo,
      sourceGroupId: rule.idgroup > 0 ? rule.idgroup : null,
      signature,
      preview: {
        sourceRuleId: rule.id,
        targetRuleId: null,
        policyTypeId: rule.type,
        ruleOrder: rule.rule_order,
        comment: rule.comment,
      },
    };
  }

  /** Resolves a source firewall interface to the target one through its role. */
  private resolveInterface(
    context: ReplicationContext,
    interfaceId: number,
    ruleId: number,
  ): number | null {
    // Interfaces not owned by the source firewall (e.g. host interfaces) are
    // shared references that remain valid on the target.
    if (!context.sourceInterfaces.has(interfaceId)) {
      return interfaceId;
    }

    const role = context.roleBySourceInterface.get(interfaceId);
    const interfaceName = context.sourceInterfaces.get(interfaceId).name;

    if (!role) {
      this.pushUniqueError(
        context.result,
        `Source interface "${interfaceName}" (id ${interfaceId}), referenced by rule ${ruleId}, has no role assigned in the source profile`,
      );
      return null;
    }

    const targetId = context.request.interfaceRoleMapping![role];
    if (targetId === undefined) {
      this.pushUniqueError(
        context.result,
        `Missing interface role mapping for role "${role}" (source interface "${interfaceName}", id ${interfaceId})`,
      );
      return null;
    }

    this.recordResolvedReference(context, {
      kind: 'interface',
      role,
      sourceId: interfaceId,
      targetId,
    });

    return targetId;
  }

  /**
   * Resolves an IP object reference. Objects bound to a source firewall
   * interface are remapped to a compatible address of the role-mapped target
   * interface; any other object is shared at FWCloud level and kept as is.
   */
  private resolveIpObj(
    context: ReplicationContext,
    ipobjId: number,
    ruleId: number,
    ruleConflicts: PolicyReplicationConflict[],
  ): number | null {
    const ipobj = context.sourceIpObjs.get(ipobjId);

    if (!ipobj) {
      ruleConflicts.push({
        type: 'broken_ipobj_reference',
        message: `Rule ${ruleId}: IP object ${ipobjId} not found; rule skipped`,
        sourceRuleId: ruleId,
      });
      return null;
    }

    if (!ipobj.interface || !context.sourceInterfaces.has(ipobj.interface)) {
      return ipobjId;
    }

    const targetInterfaceId = this.resolveInterface(context, ipobj.interface, ruleId);
    if (targetInterfaceId === null) {
      return null;
    }

    const candidates = (context.targetAddressesByInterface.get(targetInterfaceId) ?? []).filter(
      (candidate) => candidate.type === ipobj.type && candidate.ip_version === ipobj.ip_version,
    );

    if (candidates.length === 0) {
      ruleConflicts.push({
        type: 'broken_ipobj_reference',
        message: `Rule ${ruleId}: no IPv${ipobj.ip_version} address compatible with source object "${ipobj.name}" (id ${ipobjId}) found under the target interface mapped to its role; rule skipped`,
        sourceRuleId: ruleId,
      });
      return null;
    }

    let resolved = candidates.find((candidate) => candidate.address === ipobj.address);
    if (!resolved) {
      resolved = candidates[0];
      if (candidates.length > 1) {
        context.result.warnings.push(
          `Rule ${ruleId}: several target addresses are compatible with source object "${ipobj.name}" (id ${ipobjId}); using "${resolved.name}" (id ${resolved.id})`,
        );
      }
    }

    this.recordResolvedReference(context, {
      kind: 'ipobj',
      sourceId: ipobjId,
      targetId: resolved.id,
    });

    return resolved.id;
  }

  private resolveFwApplyTo(context: ReplicationContext, rule: PolicyRuleRow): number | null {
    if (!rule.fw_apply_to) {
      return null;
    }

    if (context.targetClusterId === null) {
      context.result.warnings.push(
        `Rule ${rule.id}: "apply to" node restriction cleared because the target is a standalone firewall`,
      );
      return null;
    }

    const role = context.roleBySourceNode.get(rule.fw_apply_to);
    if (!role) {
      this.pushUniqueError(
        context.result,
        `Source node ${rule.fw_apply_to}, referenced by rule ${rule.id}, has no role assigned in the source profile`,
      );
      return null;
    }

    const targetNodeId = (context.request.nodeRoleMapping ?? {})[role];
    if (targetNodeId === undefined) {
      this.pushUniqueError(
        context.result,
        `Missing node role mapping for role "${role}" (source node ${rule.fw_apply_to})`,
      );
      return null;
    }

    this.recordResolvedReference(context, {
      kind: 'node',
      role,
      sourceId: rule.fw_apply_to,
      targetId: targetNodeId,
    });

    return targetNodeId;
  }

  private recordResolvedReference(
    context: ReplicationContext,
    reference: PolicyReplicationResolvedReference,
  ): void {
    context.resolvedReferences.set(`${reference.kind}:${reference.sourceId}`, reference);
  }

  private pushUniqueError(result: PolicyReplicationResult, message: string): void {
    if (!result.errors.includes(message)) {
      result.errors.push(message);
    }
  }

  private async planGroups(
    context: ReplicationContext,
    plannedRules: PlannedRule[],
  ): Promise<PlannedGroup[]> {
    const referencedGroupIds = new Set<number>(
      plannedRules.filter((rule) => rule.sourceGroupId !== null).map((rule) => rule.sourceGroupId),
    );

    if (referencedGroupIds.size === 0) {
      return [];
    }

    const rows = await dbQuery<PolicyGroupRow>(
      `SELECT id, name, comment, idgroup, groupstyle FROM policy_g WHERE firewall = ? AND id IN (${sqlPlaceholders(referencedGroupIds.size)})`,
      [context.sourceFirewall.id, ...referencedGroupIds],
    );

    return rows.map((row) => ({
      source: row,
      preview: {
        sourceGroupId: row.id,
        targetGroupId: null,
        name: row.name,
      },
    }));
  }

  /** Canonical rule signature used to detect duplicates between source and target. */
  private buildRuleSignature(
    rule: Pick<PolicyRuleRow, 'type' | 'action' | 'special' | 'negate'>,
    relationKeys: string[],
  ): string {
    return [
      rule.type,
      rule.action,
      rule.special,
      rule.negate ?? '',
      relationKeys.sort().join(','),
    ].join('|');
  }

  private async buildTargetSignatures(
    context: ReplicationContext,
    targetRules: PolicyRuleRow[],
  ): Promise<Map<string, number>> {
    const relations = await this.loadRuleRelations(context.targetFirewall.id);
    const signatures = new Map<string, number>();

    for (const rule of targetRules) {
      const ruleRelations = relations.get(rule.id);
      const keys: string[] = [];

      if (ruleRelations) {
        for (const row of ruleRelations.ipobjs) {
          if (row.interface > 0) keys.push(`${row.position}:IF:${row.interface}`);
          else if (row.ipobj > 0) keys.push(`${row.position}:O:${row.ipobj}`);
          else keys.push(`${row.position}:G:${row.ipobj_g}`);
        }
        for (const row of ruleRelations.interfaces) keys.push(`${row.position}:I:${row.interface}`);
        for (const { key, column, sigPrefix } of VPN_RELATION_TABLES) {
          for (const row of ruleRelations[key]) {
            keys.push(`${row.position}:${sigPrefix}:${row[column]}`);
          }
        }
      }

      const signature = this.buildRuleSignature(rule, keys);

      if (!signatures.has(signature)) {
        signatures.set(signature, rule.id);
      }
    }

    return signatures;
  }

  private detectMergeConflicts(
    context: ReplicationContext,
    plannedRules: PlannedRule[],
    groups: PlannedGroup[],
    targetGroups: PolicyGroupRow[],
    targetRules: PolicyRuleRow[],
    targetSignatures: Map<string, number>,
  ): void {
    const { result } = context;

    const targetGroupNames = new Map<string, number>();
    for (const group of targetGroups) {
      if (!targetGroupNames.has(group.name)) {
        targetGroupNames.set(group.name, group.id);
      }
    }

    for (const group of groups) {
      const duplicatedGroupId = targetGroupNames.get(group.source.name);
      if (duplicatedGroupId !== undefined) {
        result.conflicts.push({
          type: 'duplicated_group',
          message: `Source policy group "${group.source.name}" (id ${group.source.id}) duplicates target group ${duplicatedGroupId}`,
        });
      }
    }

    const specialByType = new Map<string, number>();
    for (const rule of targetRules) {
      if (rule.special === SPECIAL_STATEFUL || rule.special === SPECIAL_CATCHALL) {
        specialByType.set(`${rule.type}:${rule.special}`, rule.id);
      }
    }

    for (const rule of plannedRules) {
      const duplicatedRuleId = targetSignatures.get(rule.signature);
      if (duplicatedRuleId !== undefined) {
        result.conflicts.push({
          type: 'duplicated_rule',
          message: `Source rule ${rule.sourceRule.id} duplicates target rule ${duplicatedRuleId}`,
          sourceRuleId: rule.sourceRule.id,
          targetRuleId: duplicatedRuleId,
        });
        continue;
      }

      const specialCollision = specialByType.get(
        `${rule.sourceRule.type}:${rule.sourceRule.special}`,
      );
      if (specialCollision !== undefined) {
        result.conflicts.push({
          type: 'incompatible_rule_order',
          message: `Source rule ${rule.sourceRule.id} is a ${rule.sourceRule.special === SPECIAL_CATCHALL ? 'catch-all' : 'stateful'} rule but target rule ${specialCollision} already plays that role for policy type ${rule.sourceRule.type}`,
          sourceRuleId: rule.sourceRule.id,
          targetRuleId: specialCollision,
        });
      }
    }
  }

  private async applyPlan(context: ReplicationContext, plan: ReplicationPlan): Promise<void> {
    const { request, result } = context;
    const queryRunner: QueryRunner = db.getSource().createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let remainingTargetRules = plan.targetRules;

      if (request.mode === 'replace_defaults' && plan.defaultRuleIdsToRemove.length > 0) {
        await this.removeRules(queryRunner, plan.defaultRuleIdsToRemove);
        const removedRuleIds = new Set(plan.defaultRuleIdsToRemove);
        remainingTargetRules = plan.targetRules.filter((rule) => !removedRuleIds.has(rule.id));
        result.removedDefaultRules = plan.defaultRuleIdsToRemove;
      }

      const groupIdMap = new Map<number, number>();
      for (const group of plan.groups) {
        const insertResult = await queryRunner.query(
          'INSERT INTO policy_g (firewall, name, comment, groupstyle) VALUES (?, ?, ?, ?)',
          [
            context.targetFirewall.id,
            group.source.name,
            group.source.comment,
            group.source.groupstyle,
          ],
        );
        groupIdMap.set(group.source.id, insertResult.insertId);
        group.preview.targetGroupId = insertResult.insertId;
        this.recordResolvedReference(context, {
          kind: 'policy_group',
          sourceId: group.source.id,
          targetId: insertResult.insertId,
        });
      }

      // Remap nested group parents for the groups that were replicated.
      for (const group of plan.groups) {
        if (group.source.idgroup && groupIdMap.has(group.source.idgroup)) {
          await queryRunner.query('UPDATE policy_g SET idgroup = ? WHERE id = ?', [
            groupIdMap.get(group.source.idgroup),
            groupIdMap.get(group.source.id),
          ]);
        }
      }

      const orderedRules = this.computeFinalOrdering(remainingTargetRules, plan.rules);

      for (const entry of orderedRules) {
        if (entry.kind === 'existing') {
          if (entry.rule.rule_order !== entry.finalOrder) {
            await queryRunner.query('UPDATE policy_r SET rule_order = ? WHERE id = ?', [
              entry.finalOrder,
              entry.rule.id,
            ]);
          }
          continue;
        }

        const planned = entry.planned;
        const source = planned.sourceRule;
        const insertResult = await queryRunner.query(
          `INSERT INTO policy_r
            (idgroup, firewall, rule_order, action, time_start, time_end, active, options, comment, type, style, fw_apply_to, negate, mark, special, run_before, run_after)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            planned.sourceGroupId !== null ? (groupIdMap.get(planned.sourceGroupId) ?? null) : null,
            context.targetFirewall.id,
            entry.finalOrder,
            source.action,
            source.time_start,
            source.time_end,
            source.active,
            source.options,
            source.comment,
            source.type,
            source.style,
            planned.fwApplyTo,
            source.negate,
            source.mark,
            source.special,
            source.run_before,
            source.run_after,
          ],
        );

        const newRuleId: number = insertResult.insertId;
        planned.preview.targetRuleId = newRuleId;
        planned.preview.ruleOrder = entry.finalOrder;

        for (const relation of planned.relations) {
          const columns = ['rule', ...Object.keys(relation.values)];
          await queryRunner.query(
            `INSERT INTO ${relation.table} (${columns.join(', ')}) VALUES (${sqlPlaceholders(columns.length)})`,
            [newRuleId, ...Object.values(relation.values)],
          );
        }
      }

      await queryRunner.commitTransaction();
      result.applied = true;
      result.resolvedReferences = Array.from(context.resolvedReferences.values());
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async removeRules(queryRunner: QueryRunner, ruleIds: number[]): Promise<void> {
    const inClause = sqlPlaceholders(ruleIds.length);

    for (const { table } of RELATION_TABLES) {
      await queryRunner.query(`DELETE FROM ${table} WHERE rule IN (${inClause})`, ruleIds);
    }
    await queryRunner.query(`DELETE FROM policy_r WHERE id IN (${inClause})`, ruleIds);
  }

  /**
   * Computes the final rule_order sequence per policy type. Replicated rules
   * keep their source relative order; in merge mode they are inserted after
   * the existing rules but always before the target catch-all rule so that
   * they are never unreachable.
   */
  private computeFinalOrdering(
    targetRules: PolicyRuleRow[],
    plannedRules: PlannedRule[],
  ): (
    | { kind: 'existing'; rule: PolicyRuleRow; finalOrder: number; type: number }
    | { kind: 'planned'; planned: PlannedRule; finalOrder: number; type: number }
  )[] {
    const types = new Set<number>();
    for (const rule of targetRules) types.add(rule.type);
    for (const rule of plannedRules) types.add(rule.sourceRule.type);

    const ordering: (
      | { kind: 'existing'; rule: PolicyRuleRow; finalOrder: number; type: number }
      | { kind: 'planned'; planned: PlannedRule; finalOrder: number; type: number }
    )[] = [];

    for (const type of types) {
      const target = this.partitionBySpecial(
        targetRules
          .filter((rule) => rule.type === type)
          .sort((a, b) => a.rule_order - b.rule_order),
        (rule) => rule.special,
      );
      const planned = this.partitionBySpecial(
        plannedRules
          .filter((rule) => rule.sourceRule.type === type)
          .sort((a, b) => a.sourceRule.rule_order - b.sourceRule.rule_order),
        (rule) => rule.sourceRule.special,
      );

      const sequence: (
        | { kind: 'existing'; rule: PolicyRuleRow }
        | {
            kind: 'planned';
            planned: PlannedRule;
          }
      )[] = [
        ...target.stateful.map((rule) => ({ kind: 'existing' as const, rule })),
        ...planned.stateful.map((rule) => ({ kind: 'planned' as const, planned: rule })),
        ...target.other.map((rule) => ({ kind: 'existing' as const, rule })),
        ...planned.other.map((rule) => ({ kind: 'planned' as const, planned: rule })),
        ...planned.catchAll.map((rule) => ({ kind: 'planned' as const, planned: rule })),
        ...target.catchAll.map((rule) => ({ kind: 'existing' as const, rule })),
      ];

      sequence.forEach((entry, index) => {
        ordering.push({ ...entry, finalOrder: index + 1, type });
      });
    }

    return ordering;
  }

  /** Splits rules into the stateful / catch-all / other buckets used for ordering. */
  private partitionBySpecial<T>(
    rules: T[],
    specialOf: (rule: T) => number,
  ): { stateful: T[]; catchAll: T[]; other: T[] } {
    const stateful: T[] = [];
    const catchAll: T[] = [];
    const other: T[] = [];

    for (const rule of rules) {
      const special = specialOf(rule);
      if (special === SPECIAL_STATEFUL) stateful.push(rule);
      else if (special === SPECIAL_CATCHALL) catchAll.push(rule);
      else other.push(rule);
    }

    return { stateful, catchAll, other };
  }
}
