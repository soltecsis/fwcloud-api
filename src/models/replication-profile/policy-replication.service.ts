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
import { PolicyTypesMap } from '../policy/PolicyType';
import { Interface } from '../interface/Interface';
import { Tree } from '../tree/Tree';
import { ObjectBindingResolver } from './object-binding.resolver';
import {
  dereferenceParameter,
  describeReplicationProfileValue,
  parseReplicationProfileAddress,
  parseReplicationProfileNetwork,
  parseReplicationProfilePort,
  parseReplicationProfileRange,
  ReplicationProfileParameter,
  ReplicationProfileParameterValues,
  resolveParameterValues,
} from './replication-profile-parameters';
import {
  REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS,
  REPLICATION_PROFILE_IPOBJ_TYPE_BY_KIND,
  REPLICATION_PROFILE_IPOBJ_TYPE_GROUP,
  REPLICATION_PROFILE_IPOBJ_TYPE_HOST,
  REPLICATION_PROFILE_IPOBJ_TYPE_INTERFACE,
  REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK,
  REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
  REPLICATION_PROFILE_IPOBJ_TYPE_TCP,
  REPLICATION_PROFILE_IPOBJ_TYPE_UDP,
  ReplicationProfileIpVersion,
  ReplicationProfileObjectKind,
  ReplicationProfileRuleChain,
} from './replication-profile.constants';
import {
  isPolicyReplicationMode,
  PolicyReplicationConflict,
  PolicyReplicationGroupPreview,
  PolicyReplicationMode,
  PolicyReplicationProvision,
  PolicyReplicationProvisionInterface,
  PolicyReplicationProvisionObject,
  PolicyReplicationProvisionRule,
  PolicyReplicationProvisionService,
  countProvisionExtras,
  isStandardProvisionService,
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
const RULE_ACTION_ACCEPT = 1;
const RULE_ACTION_DENY = 2;

/** Extra context a profile application passes down to provisioning. */
export interface ProvisionOptions {
  parameters?: ReplicationProfileParameter[];
  parameterValues?: ReplicationProfileParameterValues;
  /** Identify the profile so its object bindings can be recorded and reused. */
  profileCode?: string;
  profileVersion?: number;
  /** Cluster node role → created node firewall id, used by Keepalived's master node. */
  nodeRoleMapping?: Record<string, number>;
  /**
   * Existing target interfaces (by name) the operator assigned to profile roles,
   * e.g. { lan: 'eth1' }. They are bound instead of creating the profile interface.
   */
  interfaceNameMapping?: Record<string, string>;
}

export interface ProvisionRulePositions {
  in?: number;
  out?: number;
  source?: number;
  destination?: number;
  service?: number;
  translatedSource?: number;
  translatedDestination?: number;
  translatedService?: number;
}

/** A predefined object or group row, as a profile reference resolves it. */
interface StandardReferenceRow {
  id: number;
  name: string;
  type: number;
  ip_version: number | string | null;
}

/** One resolved rule-side entry: an interface, an ip object or an object group. */
interface ProvisionSideRef {
  interfaceId?: number;
  ipobjId?: number;
  ipobjGroupId?: number;
}

interface ProvisionRuleInterfaces {
  inIds: number[];
  outIds: number[];
}

interface ProvisionRuleSides {
  source: ProvisionSideRef[];
  destination: ProvisionSideRef[];
  services: ProvisionSideRef[];
  translatedSource: ProvisionSideRef[];
  translatedDestination: ProvisionSideRef[];
  translatedServices: ProvisionSideRef[];
}

/** Where a set of profile objects is being placed, to report and check them. */
interface ProvisionObjectTarget {
  /** Human prefix for error messages, e.g. `Rule 2 (source)`. */
  label: string;
  /** IP family the objects must belong to, when the destination has one. */
  ipVersion?: ReplicationProfileIpVersion;
  /** policy_position id: the object types it accepts are read from ipobj_type__policy_position. */
  position?: number;
  /** Explicit ipobj types accepted, for grids without a policy_position (routing, system). */
  allowedTypes?: number[];
}

const ADDRESS_TYPES = [REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS];
const PORT_SERVICE_TYPES = [REPLICATION_PROFILE_IPOBJ_TYPE_TCP, REPLICATION_PROFILE_IPOBJ_TYPE_UDP];
/** Route destinations and routing rule sources: addresses, ranges, networks, hosts and object groups. */
const ROUTING_OBJECT_TYPES = [
  REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS,
  REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
  REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK,
  REPLICATION_PROFILE_IPOBJ_TYPE_HOST,
  REPLICATION_PROFILE_IPOBJ_TYPE_GROUP,
];
const NAT_CHAINS: ReadonlyArray<string> = ['snat', 'dnat'];

/** Position ids of one policy (family + chain), undefined for the positions it does not have. */
export function getProvisionRulePositions(
  ipVersion: ReplicationProfileIpVersion,
  chain: ReplicationProfileRuleChain,
): ProvisionRulePositions {
  const prefix = `IPv${ipVersion}:${chain.toUpperCase()}`;

  return {
    in: RulePositionsMap.get(`${prefix}:In`),
    out: RulePositionsMap.get(`${prefix}:Out`),
    source: RulePositionsMap.get(`${prefix}:Source`),
    destination: RulePositionsMap.get(`${prefix}:Destination`),
    service: RulePositionsMap.get(`${prefix}:Service`),
    translatedSource: RulePositionsMap.get(`${prefix}:Translated Source`),
    translatedDestination: RulePositionsMap.get(`${prefix}:Translated Destination`),
    translatedService: RulePositionsMap.get(`${prefix}:Translated Service`),
  };
}

interface ProvisionBinding {
  kind: 'interface' | 'ipobj' | 'rule';
  key: string;
  objectId: number;
  created: boolean;
}

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
  /** Every address of each SOURCE interface, ordered by id. */
  sourceAddressesByInterface: Map<number, IPObjRow[]>;
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
   * creates on the target firewall the interfaces and policy rules declared in
   * the profile's `provision` block (or only previews them in dry-run mode).
   * Used by provisioning profiles, which do not need a source firewall.
   * Returns the same result shape as regular replication.
   */
  public async provisionPolicyFromProfile(
    target: PolicyReplicationTarget,
    provision: PolicyReplicationProvision,
    fwCloudId: number,
    mode: PolicyReplicationMode = 'replace_defaults',
    options: ProvisionOptions = {},
  ): Promise<PolicyReplicationResult> {
    const result = this.createEmptyResult(mode);
    const firewallId = await this.resolveProvisionTargetFirewallId(target);
    const isDryRun = mode === 'dry_run';

    let parameterValues: Map<string, unknown>;

    try {
      parameterValues = resolveParameterValues(options.parameters ?? [], options.parameterValues);
    } catch (error) {
      result.errors.push((error as Error).message);
      return result;
    }

    const existingInterfaces = await this.loadFirewallInterfaces(firewallId);
    const mappedInterfaceIds = this.resolveMappedInterfaces(
      provision,
      existingInterfaces,
      options.interfaceNameMapping,
      result,
    );

    if (result.errors.length > 0) {
      return result;
    }

    // Bindings recorded by a previous application of this same profile version.
    // Reusing them is what makes a re-apply idempotent instead of additive.
    const previousBindings = options.profileCode
      ? await this.loadProfileBindings(
          fwCloudId,
          options.profileCode,
          options.profileVersion ?? 0,
          firewallId,
        )
      : new Map<string, number>();

    const resolver = new ObjectBindingResolver(fwCloudId, !isDryRun);
    const bindings: ProvisionBinding[] = [];

    const interfaceIdByRole = await this.provisionInterfaces(
      provision,
      firewallId,
      existingInterfaces,
      fwCloudId,
      parameterValues,
      resolver,
      previousBindings,
      mappedInterfaceIds,
      bindings,
      result,
      isDryRun,
    );

    await this.provisionRules(
      provision,
      firewallId,
      interfaceIdByRole,
      parameterValues,
      resolver,
      result,
      mode,
      isDryRun,
    );

    if (countProvisionExtras(provision) > 0) {
      result.provisioned = {
        routingTables: 0,
        routes: 0,
        routingRules: 0,
        dhcp: 0,
        keepalived: 0,
        haproxy: 0,
      };

      // Routing and system entries are only written once the policy went in cleanly.
      if (result.errors.length === 0 || isDryRun) {
        await this.provisionRouting(
          provision,
          firewallId,
          interfaceIdByRole,
          parameterValues,
          resolver,
          result,
          isDryRun,
        );
      }

      if (result.errors.length === 0 || isDryRun) {
        await this.provisionSystem(
          provision,
          firewallId,
          interfaceIdByRole,
          parameterValues,
          resolver,
          result,
          isDryRun,
          options,
        );
      }
    }

    if (isDryRun) {
      result.warnings.push(
        `Dry run: ${provision.interfaces.length} interface(s), ${provision.rules.length} rule(s) and ${countProvisionExtras(provision)} routing/system entr${countProvisionExtras(provision) === 1 ? 'y' : 'ies'} would be provisioned on firewall ${firewallId}.`,
      );

      return result;
    }

    if (result.errors.length > 0) {
      return result;
    }

    if (options.profileCode) {
      await this.persistProfileBindings(
        fwCloudId,
        options.profileCode,
        options.profileVersion ?? 0,
        firewallId,
        bindings,
      );
    }

    result.applied = true;

    return result;
  }

  /**
   * Creates (or reuses) the declared interfaces and their addresses. Addressing
   * is what lets a rule refer to "the LAN network" and still mean the right
   * thing on every firewall the profile is applied to.
   */
  private async provisionInterfaces(
    provision: PolicyReplicationProvision,
    firewallId: number,
    existingInterfaces: Map<number, InterfaceRow>,
    fwCloudId: number,
    parameterValues: Map<string, unknown>,
    resolver: ObjectBindingResolver,
    previousBindings: Map<string, number>,
    mappedInterfaceIds: Map<string, number>,
    bindings: ProvisionBinding[],
    result: PolicyReplicationResult,
    isDryRun: boolean,
  ): Promise<Map<string, number>> {
    const interfaceIdByRole = new Map<string, number>();
    const existingByName = new Map<string, number>();

    for (const [id, row] of existingInterfaces) {
      existingByName.set(row.name.toLowerCase(), id);
    }

    const manager = db.getSource().manager;
    const dbCon = isDryRun ? null : db.getQuery();
    const fdiNode = isDryRun
      ? null
      : (
          await dbQuery<{ id: number }>(
            "SELECT id FROM fwc_tree WHERE id_obj = ? AND node_type = 'FDI' AND fwcloud = ?",
            [firewallId, fwCloudId],
          )
        )[0];

    for (const iface of provision.interfaces) {
      const bindingKey = `interface:${iface.role}`;
      const mapped = mappedInterfaceIds.get(iface.role);
      const reused =
        mapped ?? previousBindings.get(bindingKey) ?? existingByName.get(iface.name.toLowerCase());
      let interfaceId: number;

      if (reused !== undefined && existingInterfaces.has(reused)) {
        interfaceId = reused;

        // An explicit assignment is what the operator asked for, not something to warn about.
        if (mapped === undefined) {
          result.warnings.push(
            `Interface "${iface.name}" already exists on the target; reusing it for role "${iface.role}".`,
          );
        }
      } else if (isDryRun) {
        interfaceId = 0;
      } else {
        const created = await manager.getRepository(Interface).save({
          name: iface.name,
          type: '10',
          interface_type: '10',
          firewallId,
        });

        interfaceId = created.id;

        if (fdiNode && dbCon) {
          await Tree.newNode(dbCon, fwCloudId, iface.name, fdiNode.id, 'IFF', created.id, 10);
        }
      }

      interfaceIdByRole.set(iface.role, interfaceId);
      bindings.push({
        kind: 'interface',
        key: iface.role,
        objectId: interfaceId,
        created: reused === undefined,
      });
      result.resolvedReferences.push({
        kind: 'interface',
        role: iface.role,
        sourceId: 0,
        targetId: interfaceId,
      });

      await this.provisionInterfaceAddresses(
        iface,
        interfaceId,
        parameterValues,
        resolver,
        bindings,
        result,
        isDryRun,
      );
    }

    return interfaceIdByRole;
  }

  /**
   * Resolves the target interfaces the operator assigned (by name) to profile
   * roles. Unknown roles, missing interfaces or an interface assigned twice are
   * reported as errors before anything is written.
   */
  private resolveMappedInterfaces(
    provision: PolicyReplicationProvision,
    existingInterfaces: Map<number, InterfaceRow>,
    mapping: Record<string, string> | undefined,
    result: PolicyReplicationResult,
  ): Map<string, number> {
    const mappedIds = new Map<string, number>();
    const entries = Object.entries(mapping ?? {});

    if (entries.length === 0) {
      return mappedIds;
    }

    const roles = new Set(provision.interfaces.map((iface) => iface.role));
    const idByName = new Map<string, number>();

    for (const [id, row] of existingInterfaces) {
      idByName.set(row.name.toLowerCase(), id);
    }

    for (const [role, name] of entries) {
      const interfaceId = idByName.get(name.toLowerCase());

      if (!roles.has(role)) {
        result.errors.push(`Role "${role}" is not declared by the profile interfaces.`);
      } else if (interfaceId === undefined) {
        result.errors.push(
          `Interface "${name}" assigned to role "${role}" does not exist on the target.`,
        );
      } else if ([...mappedIds.values()].includes(interfaceId)) {
        result.errors.push(`Interface "${name}" is assigned to more than one role.`);
      } else {
        mappedIds.set(role, interfaceId);
      }
    }

    return mappedIds;
  }

  private async provisionInterfaceAddresses(
    iface: PolicyReplicationProvisionInterface,
    interfaceId: number,
    parameterValues: Map<string, unknown>,
    resolver: ObjectBindingResolver,
    bindings: ProvisionBinding[],
    result: PolicyReplicationResult,
    isDryRun: boolean,
  ): Promise<void> {
    for (const [index, declared] of iface.addresses.entries()) {
      const raw = dereferenceParameter(declared.value, parameterValues);

      if (raw === undefined) {
        continue;
      }

      const parsed = parseReplicationProfileAddress(raw);

      if (!parsed) {
        result.errors.push(
          `Interface "${iface.name}": "${describeReplicationProfileValue(raw)}" is not a valid IP address.`,
        );
        continue;
      }

      const binding = await resolver.resolve({
        kind: 'address',
        ipVersion: parsed.ipVersion,
        address: parsed.address,
        netmask: parsed.netmask,
        name: declared.name ?? `${iface.name}-${index === 0 ? 'ip' : `ip${index + 1}`}`,
        interfaceId: isDryRun ? undefined : interfaceId,
      });

      bindings.push({
        kind: 'ipobj',
        key: `${iface.role}:address:${index}`,
        objectId: binding.id,
        created: binding.created,
      });
      result.resolvedReferences.push({
        kind: 'ipobj',
        role: iface.role,
        sourceId: 0,
        targetId: binding.id,
      });
    }
  }

  private async provisionRules(
    provision: PolicyReplicationProvision,
    firewallId: number,
    interfaceIdByRole: Map<string, number>,
    parameterValues: Map<string, unknown>,
    resolver: ObjectBindingResolver,
    result: PolicyReplicationResult,
    mode: PolicyReplicationMode,
    isDryRun: boolean,
  ): Promise<void> {
    // In merge mode an equivalent rule already on the target is left alone;
    // replace_defaults appends the profile rules above the catch-all.
    const existingSignatures =
      mode === 'merge' || isDryRun
        ? await this.loadProvisionRuleSignatures(firewallId)
        : new Set<string>();

    const plannedByType = new Map<number, number>();

    for (const [index, rule] of provision.rules.entries()) {
      const policyTypeId = PolicyTypesMap.get(`IPv${rule.ipVersion}:${rule.chain.toUpperCase()}`);

      if (!policyTypeId) {
        result.errors.push(
          `Rule ${index + 1}: unsupported chain "${rule.chain}" for IPv${rule.ipVersion}.`,
        );
        continue;
      }

      const positions = getProvisionRulePositions(rule.ipVersion, rule.chain);
      const resolvedInterfaces = this.resolveProvisionRuleInterfaces(
        rule,
        index,
        interfaceIdByRole,
        positions,
        result,
      );

      if (resolvedInterfaces === null) {
        continue;
      }

      const sides = await this.resolveProvisionRuleObjects(
        rule,
        index,
        positions,
        interfaceIdByRole,
        parameterValues,
        resolver,
        result,
      );

      if (sides === null) {
        continue;
      }

      const signature = this.buildProvisionRuleSignature(
        rule,
        policyTypeId,
        resolvedInterfaces,
        sides,
      );

      if (existingSignatures.has(signature)) {
        if (mode === 'merge') {
          result.conflicts.push({
            type: 'duplicated_rule',
            message: `Rule ${index + 1}: an equivalent rule already exists on the target; skipped in merge mode.`,
          });
          continue;
        }

        result.warnings.push(`Rule ${index + 1}: an equivalent rule already exists on the target.`);
      }

      const planned = (plannedByType.get(policyTypeId) ?? 0) + 1;
      plannedByType.set(policyTypeId, planned);
      const ruleOrder = 1 + planned;

      const targetRuleId = isDryRun
        ? null
        : await this.insertProvisionRule(
            rule,
            firewallId,
            policyTypeId,
            ruleOrder,
            positions,
            resolvedInterfaces,
            sides,
          );

      result.createdRules.push({
        sourceRuleId: 0,
        targetRuleId,
        policyTypeId,
        ruleOrder,
        comment: rule.comment ?? null,
      });
    }

    // Wherever the profile puts rules it is the whole policy, so FWCloud's default
    // rules there are dropped (merge mode keeps everything). Skipped on errors so a
    // failed apply never leaves a policy without its defaults.
    if (mode !== 'merge' && result.errors.length === 0) {
      result.removedDefaultRules = await this.removeProvisionDefaultRules(
        provision,
        firewallId,
        isDryRun,
      );
    }

    if (!isDryRun) {
      await this.pushProvisionCatchAllRules(firewallId, plannedByType);
    }
  }

  private resolveProvisionRuleInterfaces(
    rule: PolicyReplicationProvisionRule,
    index: number,
    interfaceIdByRole: Map<string, number>,
    positions: ProvisionRulePositions,
    result: PolicyReplicationResult,
  ): ProvisionRuleInterfaces | null {
    const resolve = (
      roles: string[],
      position: number | undefined,
      direction: string,
    ): number[] | null => {
      if (roles.length > 0 && position === undefined) {
        result.errors.push(
          `Rule ${index + 1}: chain "${rule.chain}" has no ${direction} interface position.`,
        );
        return null;
      }

      const ids: number[] = [];

      for (const role of roles) {
        const id = interfaceIdByRole.get(role);

        if (id === undefined) {
          result.errors.push(`Rule ${index + 1}: unknown interface role "${role}".`);
          return null;
        }

        if (!ids.includes(id)) {
          ids.push(id);
        }
      }

      return ids;
    };

    const inIds = resolve(rule.inRoles, positions.in, 'inbound');
    const outIds = inIds === null ? null : resolve(rule.outRoles, positions.out, 'outbound');

    return inIds === null || outIds === null ? null : { inIds, outIds };
  }

  /**
   * Turns the declarative source/destination/service references of one rule
   * (and, for NAT, its translated ones) into concrete ids, creating what does
   * not exist yet. Every object is checked against the position it lands in.
   */
  private async resolveProvisionRuleObjects(
    rule: PolicyReplicationProvisionRule,
    index: number,
    positions: ProvisionRulePositions,
    interfaceIdByRole: Map<string, number>,
    parameterValues: Map<string, unknown>,
    resolver: ObjectBindingResolver,
    result: PolicyReplicationResult,
  ): Promise<ProvisionRuleSides | null> {
    const label = (side: string) => `Rule ${index + 1} (${side})`;
    const isNat = NAT_CHAINS.includes(rule.chain);
    const translated: [string, unknown[], number | undefined][] = [
      ['translated source', rule.translatedSource, positions.translatedSource],
      ['translated destination', rule.translatedDestination, positions.translatedDestination],
      ['translated service', rule.translatedServices, positions.translatedService],
    ];

    for (const [side, items, position] of translated) {
      if (items.length > 0 && (!isNat || position === undefined)) {
        result.errors.push(`${label(side)}: chain "${rule.chain}" has no ${side} position.`);
        return null;
      }
    }

    const objects = (items: PolicyReplicationProvisionObject[], side: string, position?: number) =>
      this.resolveProvisionObjects(
        items,
        { label: label(side), ipVersion: rule.ipVersion, position },
        interfaceIdByRole,
        parameterValues,
        resolver,
        result,
      );
    const services = (
      items: PolicyReplicationProvisionService[],
      side: string,
      position?: number,
    ) =>
      this.resolveProvisionServices(
        items,
        { label: label(side), position },
        parameterValues,
        resolver,
        result,
      );

    const sides: ProvisionRuleSides = {
      source: await objects(rule.source, 'source', positions.source),
      destination: await objects(rule.destination, 'destination', positions.destination),
      services: await services(rule.services, 'service', positions.service),
      translatedSource: await objects(
        rule.translatedSource,
        'translated source',
        positions.translatedSource,
      ),
      translatedDestination: await objects(
        rule.translatedDestination,
        'translated destination',
        positions.translatedDestination,
      ),
      translatedServices: await services(
        rule.translatedServices,
        'translated service',
        positions.translatedService,
      ),
    };

    return Object.values(sides).some((refs) => refs === null) ? null : sides;
  }

  /**
   * Resolves profile object references (literals, parameters, interface roles
   * and predefined FWCloud objects) into ids. Returns null after reporting an
   * error; references to optional parameters without a value are skipped.
   */
  private async resolveProvisionObjects(
    objects: PolicyReplicationProvisionObject[],
    target: ProvisionObjectTarget,
    interfaceIdByRole: Map<string, number>,
    parameterValues: Map<string, unknown>,
    resolver: ObjectBindingResolver,
    result: PolicyReplicationResult,
  ): Promise<ProvisionSideRef[] | null> {
    const refs: ProvisionSideRef[] = [];

    for (const object of objects) {
      let ref: ProvisionSideRef;
      let type: number;

      if (object.kind === 'interfaceRole') {
        const interfaceId = interfaceIdByRole.get(object.role!);

        if (interfaceId === undefined) {
          result.errors.push(`${target.label}: unknown interface role "${object.role}".`);
          return null;
        }

        ref = { interfaceId };
        type = REPLICATION_PROFILE_IPOBJ_TYPE_INTERFACE;
      } else if (object.kind === 'std' || object.kind === 'stdGroup') {
        const standard = await this.resolveStandardReference(
          object.kind,
          object.id!,
          target,
          result,
        );

        if (!standard) {
          return null;
        }

        ref = standard.ref;
        type = standard.type;
      } else {
        const raw = dereferenceParameter(object.value, parameterValues);

        if (raw === undefined) {
          continue;
        }

        const resolved = await this.resolveLiteralObject(object, raw, target, resolver, result);

        // A dry run resolves to id 0, so only null means failure.
        if (resolved === null) {
          return null;
        }

        ref = { ipobjId: resolved };
        type = REPLICATION_PROFILE_IPOBJ_TYPE_BY_KIND[object.kind as ReplicationProfileObjectKind];
      }

      if (!(await this.acceptsObjectType(target, type, result))) {
        return null;
      }

      refs.push(ref);
    }

    return refs;
  }

  private async resolveLiteralObject(
    object: PolicyReplicationProvisionObject,
    raw: unknown,
    target: ProvisionObjectTarget,
    resolver: ObjectBindingResolver,
    result: PolicyReplicationResult,
  ): Promise<number | null> {
    const family = target.ipVersion ? `IPv${target.ipVersion} ` : '';

    if (object.kind === 'range') {
      const range = parseReplicationProfileRange(raw, target.ipVersion);

      if (!range) {
        result.errors.push(
          `${target.label}: "${describeReplicationProfileValue(raw)}" is not a valid ${family}address range.`,
        );
        return null;
      }

      return (await resolver.resolve({ kind: 'range', ...range, name: object.name })).id;
    }

    const parsed =
      object.kind === 'network'
        ? parseReplicationProfileNetwork(raw, target.ipVersion)
        : parseReplicationProfileAddress(raw, target.ipVersion);

    if (!parsed) {
      result.errors.push(
        `${target.label}: "${describeReplicationProfileValue(raw)}" is not a valid ${family}${object.kind}.`,
      );
      return null;
    }

    const binding = await resolver.resolve({
      kind: object.kind as 'address' | 'network' | 'host',
      ipVersion: parsed.ipVersion,
      address: parsed.address,
      netmask: parsed.netmask,
      name: object.name,
    });

    return binding.id;
  }

  private async resolveProvisionServices(
    services: PolicyReplicationProvisionService[],
    target: ProvisionObjectTarget,
    parameterValues: Map<string, unknown>,
    resolver: ObjectBindingResolver,
    result: PolicyReplicationResult,
  ): Promise<ProvisionSideRef[] | null> {
    const refs: ProvisionSideRef[] = [];

    for (const service of services) {
      if (isStandardProvisionService(service)) {
        const standard = await this.resolveStandardReference(
          service.kind,
          service.id,
          target,
          result,
        );

        if (!standard || !(await this.acceptsObjectType(target, standard.type, result))) {
          return null;
        }

        refs.push(standard.ref);
        continue;
      }

      const rawPort = dereferenceParameter(service.port, parameterValues);

      if (rawPort === undefined) {
        continue;
      }

      const port = parseReplicationProfilePort(rawPort);

      if (port === null) {
        result.errors.push(
          `${target.label}: "${describeReplicationProfileValue(rawPort)}" is not a valid ${service.protocol.toUpperCase()} port.`,
        );
        return null;
      }

      const type =
        service.protocol === 'tcp'
          ? REPLICATION_PROFILE_IPOBJ_TYPE_TCP
          : REPLICATION_PROFILE_IPOBJ_TYPE_UDP;

      if (!(await this.acceptsObjectType(target, type, result))) {
        return null;
      }

      const binding = await resolver.resolve({ kind: 'service', protocol: service.protocol, port });
      refs.push({ ipobjId: binding.id });
    }

    return refs;
  }

  /**
   * Predefined objects and groups have a NULL fwcloud and the same id in every
   * installation, which is what makes a reference to them portable.
   */
  private async resolveStandardReference(
    kind: 'std' | 'stdGroup',
    id: number,
    target: ProvisionObjectTarget,
    result: PolicyReplicationResult,
  ): Promise<{ ref: ProvisionSideRef; type: number } | null> {
    const cacheKey = `${kind}:${id}`;
    let rows = this.standardRowsCache.get(cacheKey);

    if (!rows) {
      rows =
        kind === 'std'
          ? await dbQuery<StandardReferenceRow>(
              'SELECT id, name, type, ip_version FROM ipobj WHERE id = ? AND fwcloud IS NULL',
              [id],
            )
          : await dbQuery<StandardReferenceRow>(
              'SELECT id, name, type, NULL AS ip_version FROM ipobj_g WHERE id = ? AND fwcloud IS NULL',
              [id],
            );
      this.standardRowsCache.set(cacheKey, rows);
    }

    if (rows.length === 0) {
      result.errors.push(
        `${target.label}: predefined ${kind === 'std' ? 'object' : 'group'} ${id} does not exist in this FWCloud.`,
      );
      return null;
    }

    const row = rows[0];

    if (
      target.ipVersion &&
      row.ip_version !== null &&
      Number(row.ip_version) !== target.ipVersion
    ) {
      result.errors.push(
        `${target.label}: predefined object "${row.name}" is IPv${row.ip_version} and cannot be used in an IPv${target.ipVersion} rule.`,
      );
      return null;
    }

    return {
      ref: kind === 'std' ? { ipobjId: row.id } : { ipobjGroupId: row.id },
      type: Number(row.type),
    };
  }

  private positionTypesCache: Map<number, Set<number>> | null = null;
  /** Predefined objects and groups are seeded rows that never change, like the position types. */
  private standardRowsCache = new Map<string, StandardReferenceRow[]>();

  /** Checks an object type against the position (or explicit type list) it is placed in. */
  private async acceptsObjectType(
    target: ProvisionObjectTarget,
    type: number,
    result: PolicyReplicationResult,
  ): Promise<boolean> {
    let allowed: Set<number> | undefined;

    if (target.allowedTypes) {
      allowed = new Set(target.allowedTypes);
    } else if (target.position !== undefined) {
      if (!this.positionTypesCache) {
        const rows = await dbQuery<{ type: number; position: number }>(
          'SELECT type, position FROM ipobj_type__policy_position',
        );
        this.positionTypesCache = new Map();

        for (const row of rows) {
          const types = this.positionTypesCache.get(row.position) ?? new Set<number>();
          types.add(Number(row.type));
          this.positionTypesCache.set(Number(row.position), types);
        }
      }

      allowed = this.positionTypesCache.get(target.position);
    }

    if (!allowed || allowed.has(type)) {
      return true;
    }

    result.errors.push(
      `${target.label}: objects of type ${type} are not allowed in this position.`,
    );
    return false;
  }

  /**
   * Signature of a rule as it will exist in the database, so it can be compared
   * against the rules already on the target. It mirrors exactly what
   * loadProvisionRuleSignatures() reads back.
   */
  private buildProvisionRuleSignature(
    rule: PolicyReplicationProvisionRule,
    policyTypeId: number,
    interfaces: ProvisionRuleInterfaces,
    sides: ProvisionRuleSides,
  ): string {
    const interfaceIds = [...interfaces.inIds, ...interfaces.outIds];
    const ipobjIds = [
      ...sides.source,
      ...sides.destination,
      ...sides.services,
      ...sides.translatedSource,
      ...sides.translatedDestination,
      ...sides.translatedServices,
    ].map((ref) => (ref.ipobjGroupId ? `g${ref.ipobjGroupId}` : String(ref.ipobjId ?? -1)));

    return [
      policyTypeId,
      rule.action === 'deny' ? RULE_ACTION_DENY : RULE_ACTION_ACCEPT,
      this.concatKey('i', interfaceIds),
      this.concatKey('o', ipobjIds),
    ].join('|');
  }

  /** Mirrors MySQL's GROUP_CONCAT(DISTINCT ... ORDER BY ...) output. */
  private concatKey(prefix: string, ids: (number | string)[]): string {
    return Array.from(new Set(ids.map((id) => `${prefix}${id}`)))
      .sort()
      .join(',');
  }

  /** Signatures of the rules already on the target, in the same shape. */
  private async loadProvisionRuleSignatures(firewallId: number): Promise<Set<string>> {
    const rows = await dbQuery<{
      id: number;
      type: number;
      action: number;
      interfaces: string | null;
      ipobjs: string | null;
    }>(
      `SELECT R.id, R.type, R.action,
              GROUP_CONCAT(DISTINCT CONCAT('i', RI.interface) ORDER BY CONCAT('i', RI.interface)) AS interfaces,
              GROUP_CONCAT(DISTINCT CONCAT('o', IF(RO.ipobj_g > 0, CONCAT('g', RO.ipobj_g), RO.ipobj)) ORDER BY CONCAT('o', IF(RO.ipobj_g > 0, CONCAT('g', RO.ipobj_g), RO.ipobj))) AS ipobjs
       FROM policy_r R
       LEFT JOIN policy_r__interface RI ON RI.rule = R.id
       LEFT JOIN policy_r__ipobj RO ON RO.rule = R.id
       WHERE R.firewall = ? AND R.special = 0
       GROUP BY R.id, R.type, R.action`,
      [firewallId],
    );

    // Coarse signature: enough to spot an already-provisioned equivalent rule
    // without re-deriving the full positional layout.
    return new Set(
      rows.map((row) => `${row.type}|${row.action}|${row.interfaces ?? ''}|${row.ipobjs ?? ''}`),
    );
  }

  private async insertProvisionRule(
    rule: PolicyReplicationProvisionRule,
    firewallId: number,
    policyTypeId: number,
    ruleOrder: number,
    positions: ProvisionRulePositions,
    interfaces: ProvisionRuleInterfaces,
    sides: ProvisionRuleSides,
  ): Promise<number> {
    const ruleId = await PolicyRule.insertPolicy_r({
      firewall: firewallId,
      type: policyTypeId,
      rule_order: ruleOrder,
      action: rule.action === 'deny' ? RULE_ACTION_DENY : RULE_ACTION_ACCEPT,
      active: 1,
      options: 0,
      special: 0,
      comment: rule.comment ?? 'Provisioned by replication profile.',
    });

    for (const [order, interfaceId] of interfaces.inIds.entries()) {
      await this.insertRuleInterface(ruleId, interfaceId, positions.in!, order + 1);
    }

    for (const [order, interfaceId] of interfaces.outIds.entries()) {
      await this.insertRuleInterface(ruleId, interfaceId, positions.out!, order + 1);
    }

    await this.insertRuleSide(ruleId, sides.source, positions.source);
    await this.insertRuleSide(ruleId, sides.destination, positions.destination);
    await this.insertRuleSide(ruleId, sides.services, positions.service);
    await this.insertRuleSide(ruleId, sides.translatedSource, positions.translatedSource);
    await this.insertRuleSide(ruleId, sides.translatedDestination, positions.translatedDestination);
    await this.insertRuleSide(ruleId, sides.translatedServices, positions.translatedService);

    return ruleId;
  }

  private async insertRuleInterface(
    ruleId: number,
    interfaceId: number,
    position: number,
    order: number,
  ): Promise<void> {
    await dbQuery(
      'INSERT INTO policy_r__interface (rule, interface, position, position_order) VALUES (?, ?, ?, ?)',
      [ruleId, interfaceId, position, order],
    );
  }

  private async insertRuleSide(
    ruleId: number,
    refs: ProvisionSideRef[],
    position: number | undefined,
  ): Promise<void> {
    if (position === undefined) {
      return;
    }

    for (const [index, ref] of refs.entries()) {
      await dbQuery(
        'INSERT INTO policy_r__ipobj (rule, ipobj, ipobj_g, interface, position, position_order) VALUES (?, ?, ?, ?, ?, ?)',
        [
          ruleId,
          ref.ipobjId ?? -1,
          ref.ipobjGroupId ?? -1,
          ref.interfaceId ?? -1,
          position,
          index + 1,
        ],
      );
    }
  }

  /**
   * Drops FWCloud's default rules (catch-all plus the commented self-host and
   * ICMP ones) from every policy the profile puts rules in. The stateful rule is
   * kept: without it the replies of the allowed connections would be discarded.
   * Returns the ids of the rules removed (or that would be, in dry-run mode).
   */
  private async removeProvisionDefaultRules(
    provision: PolicyReplicationProvision,
    firewallId: number,
    isDryRun: boolean,
  ): Promise<number[]> {
    const policyTypeIds = new Set<number>();

    for (const rule of provision.rules) {
      const policyTypeId = PolicyTypesMap.get(`IPv${rule.ipVersion}:${rule.chain.toUpperCase()}`);

      if (policyTypeId !== undefined) {
        policyTypeIds.add(policyTypeId);
      }
    }

    if (policyTypeIds.size === 0) {
      return [];
    }

    const types = [...policyTypeIds];
    const rules = await dbQuery<{ id: number; special: number; comment: string | null }>(
      `SELECT id, special, comment FROM policy_r WHERE firewall = ? AND type IN (${sqlPlaceholders(types.length)})`,
      [firewallId, ...types],
    );
    const ruleIds = rules
      .filter(
        (rule) =>
          rule.special === SPECIAL_CATCHALL || DEFAULT_RULE_COMMENTS.includes(rule.comment ?? ''),
      )
      .map((rule) => rule.id);

    if (isDryRun || ruleIds.length === 0) {
      return ruleIds;
    }

    const queryRunner: QueryRunner = db.getSource().createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.removeRules(queryRunner, ruleIds);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    return ruleIds;
  }

  /** Moves each chain's catch-all below the rules just provisioned for it. */
  private async pushProvisionCatchAllRules(
    firewallId: number,
    plannedByType: Map<number, number>,
  ): Promise<void> {
    for (const [policyTypeId, count] of plannedByType) {
      await dbQuery(
        'UPDATE policy_r SET rule_order = rule_order + ? WHERE firewall = ? AND type = ? AND special = ?',
        [count, firewallId, policyTypeId, SPECIAL_CATCHALL],
      );
    }
  }

  private async loadProfileBindings(
    fwCloudId: number,
    profileCode: string,
    profileVersion: number,
    firewallId: number,
  ): Promise<Map<string, number>> {
    const rows = await dbQuery<{ binding_kind: string; binding_key: string; object_id: number }>(
      `SELECT binding_kind, binding_key, object_id FROM profile_object_binding
       WHERE fwcloud = ? AND profile_code = ? AND profile_version = ? AND target_firewall = ?`,
      [fwCloudId, profileCode, profileVersion, firewallId],
    );

    return new Map(rows.map((row) => [`${row.binding_kind}:${row.binding_key}`, row.object_id]));
  }

  private async persistProfileBindings(
    fwCloudId: number,
    profileCode: string,
    profileVersion: number,
    firewallId: number,
    bindings: ProvisionBinding[],
  ): Promise<void> {
    for (const binding of bindings) {
      if (!binding.objectId) {
        continue;
      }

      await dbQuery(
        `INSERT INTO profile_object_binding
           (fwcloud, profile_code, profile_version, target_firewall, binding_kind, binding_key, object_id, created_by_profile)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE object_id = VALUES(object_id)`,
        [
          fwCloudId,
          profileCode,
          profileVersion,
          firewallId,
          binding.kind,
          binding.key,
          binding.objectId,
          binding.created ? 1 : 0,
        ],
      );
    }
  }

  /**
   * Routing tables with their routes, then policy routing rules pointing at
   * them. The FWCloud routing services do the writing so their own checks
   * (object types, table numbers, tree nodes, compile status) still apply.
   */
  private async provisionRouting(
    provision: PolicyReplicationProvision,
    firewallId: number,
    interfaceIdByRole: Map<string, number>,
    parameterValues: Map<string, unknown>,
    resolver: ObjectBindingResolver,
    result: PolicyReplicationResult,
    isDryRun: boolean,
  ): Promise<void> {
    const summary = result.provisioned!;
    const tableIdByKey = new Map<string, number>();
    const existingTables = await dbQuery<{ id: number; number: number; name: string }>(
      'SELECT id, number, name FROM routing_table WHERE firewall = ?',
      [firewallId],
    );
    const tableService = isDryRun ? null : await this._app.getService<any>('RoutingTableService');
    const routeService = isDryRun ? null : await this._app.getService<any>('RouteService');
    const ruleService = isDryRun ? null : await this._app.getService<any>('RoutingRuleService');

    for (const table of provision.routing.tables) {
      const label = `Routing table "${table.name}"`;
      const existing = existingTables.find((row) => Number(row.number) === table.number);
      let tableId = existing?.id ?? 0;

      if (existing) {
        result.warnings.push(
          `${label}: table number ${table.number} already exists on the target; reusing it.`,
        );
      } else if (!isDryRun) {
        tableId = await this.runFwcService(
          label,
          result,
          async () =>
            (
              await tableService.create({
                firewallId,
                number: table.number,
                name: table.name,
                comment: table.comment,
              })
            ).id,
        );

        if (!tableId) {
          return;
        }
      }

      if (!existing) {
        summary.routingTables++;
      }

      tableIdByKey.set(table.key, tableId);

      for (const [routeIndex, route] of table.routes.entries()) {
        const routeLabel = `${label}, route ${routeIndex + 1}`;
        const destination = await this.resolveProvisionObjects(
          route.destination,
          { label: `${routeLabel} (destination)`, allowedTypes: ROUTING_OBJECT_TYPES },
          interfaceIdByRole,
          parameterValues,
          resolver,
          result,
        );
        const gateway = route.gateway
          ? await this.resolveProvisionObjects(
              [route.gateway],
              { label: `${routeLabel} (gateway)`, allowedTypes: ADDRESS_TYPES },
              interfaceIdByRole,
              parameterValues,
              resolver,
              result,
            )
          : [];
        const interfaceId = this.resolveOptionalRole(
          route.interfaceRole,
          `${routeLabel} (interface)`,
          interfaceIdByRole,
          result,
        );

        if (destination === null || gateway === null || interfaceId === null) {
          return;
        }

        if (gateway.length === 0 && (interfaceId === undefined || destination.length === 0)) {
          result.errors.push(
            `${routeLabel}: a route needs a gateway, or a destination and an interface.`,
          );
          return;
        }

        summary.routes++;

        if (isDryRun) {
          continue;
        }

        const created = await this.runFwcService(
          routeLabel,
          result,
          async () =>
            (
              await routeService.create({
                routingTableId: tableId,
                gatewayId: gateway[0]?.ipobjId,
                interfaceId,
                active: true,
                comment: route.comment,
                ...this.orderedObjectIds(destination),
              })
            ).id,
        );

        if (!created) {
          return;
        }
      }
    }

    for (const [index, rule] of provision.routing.rules.entries()) {
      const label = `Routing rule ${index + 1}`;
      const tableId = tableIdByKey.get(rule.table);

      if (tableId === undefined) {
        result.errors.push(
          `${label}: routing table "${rule.table}" is not declared by the profile.`,
        );
        return;
      }

      const from = await this.resolveProvisionObjects(
        rule.from,
        { label: `${label} (from)`, allowedTypes: ROUTING_OBJECT_TYPES },
        interfaceIdByRole,
        parameterValues,
        resolver,
        result,
      );

      if (from === null) {
        return;
      }

      if (from.length === 0) {
        result.errors.push(`${label}: a routing rule needs at least one source object.`);
        return;
      }

      summary.routingRules++;

      if (!isDryRun) {
        const created = await this.runFwcService(
          label,
          result,
          async () =>
            (
              await ruleService.create({
                routingTableId: tableId,
                active: true,
                comment: rule.comment,
                ...this.orderedObjectIds(from),
              })
            ).id,
        );

        if (!created) {
          return;
        }
      }
    }
  }

  /** DHCP servers, Keepalived VIPs and HAProxy balancers, written through their FWCloud services. */
  private async provisionSystem(
    provision: PolicyReplicationProvision,
    firewallId: number,
    interfaceIdByRole: Map<string, number>,
    parameterValues: Map<string, unknown>,
    resolver: ObjectBindingResolver,
    result: PolicyReplicationResult,
    isDryRun: boolean,
    options: ProvisionOptions,
  ): Promise<void> {
    const summary = result.provisioned!;
    const { dhcp, keepalived, haproxy } = provision.system;
    const single = async (
      object: PolicyReplicationProvisionObject | null,
      label: string,
      allowedTypes: number[],
    ): Promise<number | null> => {
      if (!object) {
        result.errors.push(`${label} is required.`);
        return null;
      }

      const refs = await this.resolveProvisionObjects(
        [object],
        { label, allowedTypes },
        interfaceIdByRole,
        parameterValues,
        resolver,
        result,
      );

      if (refs === null) {
        return null;
      }

      if (refs.length === 0 || refs[0].ipobjId === undefined) {
        result.errors.push(`${label} has no value.`);
        return null;
      }

      return refs[0].ipobjId;
    };

    for (const [index, entry] of dhcp.entries()) {
      const label = `DHCP ${index + 1}`;
      const networkId = await single(entry.network, `${label} network`, [
        REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK,
      ]);
      const rangeId =
        networkId === null
          ? null
          : await single(entry.range, `${label} range`, [REPLICATION_PROFILE_IPOBJ_TYPE_RANGE]);
      const routerId =
        rangeId === null ? null : await single(entry.router, `${label} router`, ADDRESS_TYPES);
      const dns =
        routerId === null
          ? null
          : await this.resolveProvisionObjects(
              entry.dns,
              { label: `${label} DNS`, allowedTypes: ADDRESS_TYPES },
              interfaceIdByRole,
              parameterValues,
              resolver,
              result,
            );

      if (dns === null) {
        return;
      }

      summary.dhcp++;

      if (isDryRun) {
        continue;
      }

      const service = await this._app.getService<any>('DHCPRuleService');
      const created = await this.runFwcService(label, result, async () => {
        const rule = await service.store({
          firewallId,
          rule_type: 1,
          active: true,
          networkId,
          rangeId,
          routerId,
          max_lease: entry.maxLease,
          comment: entry.comment ?? '',
        });

        if (dns.length > 0) {
          await service.update(rule.id, { ipObjIds: this.orderedIds(dns) });
        }

        return rule.id;
      });

      if (!created) {
        return;
      }
    }

    // Node ids of the target cluster (null for a firewall), read once for every Keepalived entry.
    let clusterNodeIds: number[] | null | undefined;

    for (const [index, entry] of keepalived.entries()) {
      const label = `Keepalived ${index + 1}`;
      const interfaceId = this.resolveOptionalRole(
        entry.interfaceRole,
        `${label} interface`,
        interfaceIdByRole,
        result,
      );
      const virtualIps = await this.resolveProvisionObjects(
        entry.virtualIps,
        { label: `${label} virtual IPs`, allowedTypes: ADDRESS_TYPES },
        interfaceIdByRole,
        parameterValues,
        resolver,
        result,
      );
      clusterNodeIds ??= await this.loadClusterNodeIds(firewallId);
      const masterNodeId = this.resolveClusterNode(
        firewallId,
        clusterNodeIds,
        entry.masterNode,
        options.nodeRoleMapping,
        `${label} master node`,
        result,
      );

      if (interfaceId === null || virtualIps === null || masterNodeId === null) {
        return;
      }

      if (interfaceId === undefined || virtualIps.length === 0) {
        result.errors.push(`${label}: an interface and at least one virtual IP are required.`);
        return;
      }

      // Keepalived binds to a real NIC: FWCloud refuses interfaces without a MAC address,
      // which a freshly provisioned interface only has once it has been discovered.
      const mac = isDryRun
        ? 'dry-run'
        : (
            await dbQuery<{ mac: string | null }>('SELECT mac FROM interface WHERE id = ?', [
              interfaceId,
            ])
          )[0]?.mac;

      if (!mac) {
        result.warnings.push(
          `${label}: skipped because interface "${entry.interfaceRole}" has no MAC address yet. Discover the interfaces and add it from System > Keepalived.`,
        );
        continue;
      }

      summary.keepalived++;

      if (isDryRun) {
        continue;
      }

      const service = await this._app.getService<any>('KeepalivedRuleService');
      const created = await this.runFwcService(
        label,
        result,
        async () =>
          (
            await service.store({
              firewallId,
              rule_type: 1,
              active: true,
              interfaceId,
              masterNodeId,
              virtualIpsIds: this.orderedIds(virtualIps),
              comment: entry.comment ?? '',
            })
          ).id,
      );

      if (!created) {
        return;
      }
    }

    for (const [index, entry] of haproxy.entries()) {
      const label = `HAProxy ${index + 1}`;
      const frontendIpId = await single(entry.frontendIp, `${label} frontend IP`, ADDRESS_TYPES);
      const services =
        frontendIpId === null
          ? null
          : await this.resolveProvisionServices(
              [entry.frontendService, entry.backendService].filter((service) => !!service),
              { label: `${label} ports`, allowedTypes: PORT_SERVICE_TYPES },
              parameterValues,
              resolver,
              result,
            );
      const backendIps =
        services === null
          ? null
          : await this.resolveProvisionObjects(
              entry.backendIps,
              { label: `${label} backend IPs`, allowedTypes: ADDRESS_TYPES },
              interfaceIdByRole,
              parameterValues,
              resolver,
              result,
            );

      if (backendIps === null) {
        return;
      }

      if (services.length !== 2 || backendIps.length === 0) {
        result.errors.push(
          `${label}: the frontend and backend ports and at least one backend IP are required.`,
        );
        return;
      }

      summary.haproxy++;

      if (isDryRun) {
        continue;
      }

      const service = await this._app.getService<any>('HAProxyRuleService');
      const created = await this.runFwcService(
        label,
        result,
        async () =>
          (
            await service.store({
              firewallId,
              rule_type: 1,
              active: true,
              frontendIpId,
              frontendPortId: services[0].ipobjId,
              backendPortId: services[1].ipobjId,
              backendIpsIds: this.orderedIds(backendIps),
              comment: entry.comment ?? '',
            })
          ).id,
      );

      if (!created) {
        return;
      }
    }
  }

  /** undefined when no role was given, null after reporting an unknown role. */
  private resolveOptionalRole(
    role: string | undefined,
    label: string,
    interfaceIdByRole: Map<string, number>,
    result: PolicyReplicationResult,
  ): number | undefined | null {
    if (role === undefined) {
      return undefined;
    }

    const id = interfaceIdByRole.get(role);

    if (id === undefined) {
      result.errors.push(`${label}: unknown interface role "${role}".`);
      return null;
    }

    return id;
  }

  /**
   * The node of the target cluster acting as master: the one mapped to a profile node role,
   * or (older profiles) the n-th node, 1 being the master. A firewall is its own node.
   */
  private resolveClusterNode(
    firewallId: number,
    nodes: number[] | null,
    node: string | number,
    nodeRoleMapping: Record<string, number> | undefined,
    label: string,
    result: PolicyReplicationResult,
  ): number | null {
    if (!nodes) {
      return firewallId;
    }

    if (typeof node === 'string') {
      const mapped = nodeRoleMapping?.[node];

      if (mapped === undefined || !nodes.includes(Number(mapped))) {
        result.errors.push(
          `${label}: cluster node role "${node}" is not assigned to a node of the target cluster.`,
        );
        return null;
      }

      return Number(mapped);
    }

    const nodeId = nodes[node - 1];

    if (nodeId === undefined) {
      result.errors.push(
        `${label}: the target has ${nodes.length} node(s), node ${node} does not exist.`,
      );
      return null;
    }

    return nodeId;
  }

  /** Node ids of the firewall's cluster, the master first; null when the firewall is not a cluster node. */
  private async loadClusterNodeIds(firewallId: number): Promise<number[] | null> {
    const firewall = (
      await dbQuery<{ cluster: number | null }>('SELECT cluster FROM firewall WHERE id = ?', [
        firewallId,
      ])
    )[0];

    if (!firewall?.cluster) {
      return null;
    }

    const rows = await dbQuery<{ id: number }>(
      'SELECT id FROM firewall WHERE cluster = ? ORDER BY fwmaster DESC, id ASC',
      [firewall.cluster],
    );

    return rows.map((row) => row.id);
  }

  /** Object ids with their 1-based order, as the system rule services expect them. */
  private orderedIds(refs: ProvisionSideRef[]): { id: number; order: number }[] {
    return refs.map((ref, order) => ({ id: ref.ipobjId, order: order + 1 }));
  }

  /** Splits resolved references into the ordered id lists the routing services expect. */
  private orderedObjectIds(refs: ProvisionSideRef[]): {
    ipObjIds: { id: number; order: number }[];
    ipObjGroupIds: { id: number; order: number }[];
  } {
    return {
      ipObjIds: refs
        .map((ref, index) => ({ id: ref.ipobjId, order: index + 1 }))
        .filter((item) => !!item.id),
      ipObjGroupIds: refs
        .map((ref, index) => ({ id: ref.ipobjGroupId, order: index + 1 }))
        .filter((item) => !!item.id),
    };
  }

  /** Runs a FWCloud service call, turning its exceptions into a provisioning error. */
  private async runFwcService<T>(
    label: string,
    result: PolicyReplicationResult,
    call: () => Promise<T>,
  ): Promise<T | null> {
    try {
      return await call();
    } catch (error) {
      const details = (error as { errors?: Record<string, string[]> }).errors;
      const message = details
        ? Object.entries(details)
            .map(([field, messages]) => `${field}: ${[].concat(messages).join(', ')}`)
            .join('; ')
        : (error as Error).message;

      result.errors.push(`${label}: ${message}`);
      return null;
    }
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
      sourceAddressesByInterface: new Map(),
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

    const sourceInterfaceIds = Array.from(context.sourceInterfaces.keys());
    if (sourceInterfaceIds.length > 0) {
      const rows = await dbQuery<IPObjRow>(
        `SELECT id, name, type, ip_version, address, interface FROM ipobj WHERE interface IN (${sqlPlaceholders(sourceInterfaceIds.length)}) ORDER BY id`,
        sourceInterfaceIds,
      );
      for (const row of rows) {
        if (!context.sourceAddressesByInterface.has(row.interface)) {
          context.sourceAddressesByInterface.set(row.interface, []);
        }
        context.sourceAddressesByInterface.get(row.interface).push(row);
      }
    }

    const targetInterfaceIds = Array.from(context.targetInterfaces.keys());
    if (targetInterfaceIds.length > 0) {
      const rows = await dbQuery<IPObjRow>(
        `SELECT id, name, type, ip_version, address, interface FROM ipobj WHERE interface IN (${sqlPlaceholders(targetInterfaceIds.length)}) ORDER BY id`,
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

    // Resolution is by function, not by literal value. The source object's
    // ordinal among the addresses of its own interface ("the 2nd IPv4 address
    // of the WAN") is what carries over to the target, so a rule keeps meaning
    // the same thing on a firewall whose addressing is completely different.
    // A literal match still wins when the target genuinely holds that address,
    // which keeps same-network replication byte-identical.
    let resolved = candidates.find((candidate) => candidate.address === ipobj.address);

    if (!resolved) {
      const ordinal = this.sourceAddressOrdinal(context, ipobj);

      resolved = candidates[Math.min(ordinal, candidates.length - 1)];

      if (ordinal > candidates.length - 1) {
        context.result.warnings.push(
          `Rule ${ruleId}: source object "${ipobj.name}" (id ${ipobjId}) is address #${ordinal + 1} of its interface, but the target interface only has ${candidates.length}; using "${resolved.name}" (id ${resolved.id})`,
        );
      } else if (candidates.length > 1) {
        context.result.warnings.push(
          `Rule ${ruleId}: source object "${ipobj.name}" (id ${ipobjId}) resolved by position (address #${ordinal + 1} of its interface) to "${resolved.name}" (id ${resolved.id})`,
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

  /**
   * Position of a source address among the addresses of the same family and
   * type on its own interface. This ordinal is the role-free way of saying
   * which address of the interface a rule meant.
   */
  private sourceAddressOrdinal(context: ReplicationContext, ipobj: IPObjRow): number {
    const siblings = (context.sourceAddressesByInterface.get(ipobj.interface) ?? []).filter(
      (candidate) => candidate.type === ipobj.type && candidate.ip_version === ipobj.ip_version,
    );
    const index = siblings.findIndex((candidate) => candidate.id === ipobj.id);

    return index === -1 ? 0 : index;
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
