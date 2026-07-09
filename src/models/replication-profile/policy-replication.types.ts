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
import {
  asReplicationProfileNonEmptyString,
  asReplicationProfileRecord,
  isReplicationProfilePort,
  isReplicationProfileStringValue,
  REPLICATION_PROFILE_RULE_ACTIONS,
  REPLICATION_PROFILE_RULE_PROTOCOLS,
} from './replication-profile.constants';
import type { ReplicationProfileTargetKind } from './replication-profile.constants';

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
 */
export interface PolicyReplicationProvisionInterface {
  /** Interface name created on the target (e.g. "WAN"). */
  name: string;
  /** Logical role used to wire rules to this interface. */
  role: string;
}

export interface PolicyReplicationProvisionService {
  protocol: 'tcp' | 'udp';
  port: number;
}

export interface PolicyReplicationProvisionRule {
  /** Only the FORWARD chain is supported for now. */
  chain: 'forward';
  /** Defaults to 'accept'. */
  action?: 'accept' | 'deny';
  /** Role of the inbound interface (matches a provisioned interface role). */
  inRole?: string;
  /** Role of the outbound interface. */
  outRole?: string;
  /** Optional service (port) the rule matches. */
  service?: PolicyReplicationProvisionService;
  comment?: string;
}

export interface PolicyReplicationProvision {
  interfaces: PolicyReplicationProvisionInterface[];
  rules: PolicyReplicationProvisionRule[];
}

const POLICY_STRUCTURE_FIELDS = [
  'policyStructure',
  'policy_structure',
  'templateStructure',
  'template_structure',
] as const;

/**
 * Extracts and validates the declarative provisioning block from a profile
 * model. Returns null for regular (source-based) profiles.
 */
export function getProfileProvisioning(model: unknown): PolicyReplicationProvision | null {
  const record = asReplicationProfileRecord(model);
  const provisionRaw = asReplicationProfileRecord(record?.provision);
  const structureRaw = getProfileStructureRecord(record);
  const provisionSource = hasProvisionCollections(provisionRaw)
    ? provisionRaw
    : (structureRaw ?? provisionRaw);

  if (!provisionSource) {
    return null;
  }

  const provision = parseProvision(provisionSource);

  if (provision.interfaces.length === 0 && provision.rules.length === 0 && !structureRaw) {
    return null;
  }

  return provision;
}

function getProfileStructureRecord(
  record: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!record) {
    return null;
  }

  for (const field of POLICY_STRUCTURE_FIELDS) {
    const structure = asReplicationProfileRecord(record[field]);

    if (structure) {
      return structure;
    }
  }

  return null;
}

function hasProvisionCollections(
  record: Record<string, unknown> | null,
): record is Record<string, unknown> {
  return !!record && (Array.isArray(record.interfaces) || Array.isArray(record.rules));
}

function parseProvision(provisionRaw: Record<string, unknown>): PolicyReplicationProvision {
  const interfacesByRole = new Map<string, PolicyReplicationProvisionInterface>();

  const ensureInterface = (role: string, name: string = role): string => {
    const key = role.toLowerCase();
    if (!interfacesByRole.has(key)) {
      interfacesByRole.set(key, { name, role });
    }

    return role;
  };

  for (const item of Array.isArray(provisionRaw.interfaces) ? provisionRaw.interfaces : []) {
    const iface = parseProvisionInterface(item);

    if (iface) {
      ensureInterface(iface.role, iface.name);
    }
  }

  const rules = (Array.isArray(provisionRaw.rules) ? provisionRaw.rules : [])
    .map((rule) => parseProvisionRule(rule, ensureInterface))
    .filter((item): item is PolicyReplicationProvisionRule => item !== null);

  return { interfaces: Array.from(interfacesByRole.values()), rules };
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

function parseProvisionInterface(value: unknown): PolicyReplicationProvisionInterface | null {
  const record = asReplicationProfileRecord(value);
  if (!record) {
    return null;
  }

  const name = firstNonEmptyString(record, ['name', 'value']);
  const role = asReplicationProfileNonEmptyString(record.role) ?? name;

  return name && role ? { name, role } : null;
}

function parseProvisionRule(
  value: unknown,
  ensureInterface: (role: string, name?: string) => string,
): PolicyReplicationProvisionRule | null {
  const record = asReplicationProfileRecord(value);
  if (!record) {
    return null;
  }

  if (record.chain !== undefined && record.chain !== 'forward') {
    return null;
  }

  const inRole =
    asReplicationProfileNonEmptyString(record.inRole) ??
    asReplicationProfileNonEmptyString(record.sourceRole) ??
    parseProvisionRuleSide(record.source, ensureInterface) ??
    undefined;
  const outRole =
    asReplicationProfileNonEmptyString(record.outRole) ??
    asReplicationProfileNonEmptyString(record.destinationRole) ??
    parseProvisionRuleSide(record.destination, ensureInterface) ??
    undefined;
  const comment = typeof record.comment === 'string' ? record.comment : undefined;
  const service = parseProvisionService(record.service);

  return {
    chain: 'forward',
    action: isReplicationProfileStringValue(record.action, REPLICATION_PROFILE_RULE_ACTIONS)
      ? record.action
      : 'accept',
    inRole,
    outRole,
    service,
    comment,
  };
}

function parseProvisionRuleSide(
  value: unknown,
  ensureInterface: (role: string, name?: string) => string,
): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const role = parseInterfaceReference(item, ensureInterface);

      if (role) {
        return role;
      }
    }

    return undefined;
  }

  if (value && typeof value === 'object') {
    return parseInterfaceReference(value, ensureInterface) ?? undefined;
  }

  return asReplicationProfileNonEmptyString(value) ?? undefined;
}

function parseInterfaceReference(
  value: unknown,
  ensureInterface: (role: string, name?: string) => string,
): string | null {
  const record = asReplicationProfileRecord(value);

  if (!record) {
    return null;
  }

  const type = firstNonEmptyString(record, ['type', 'kind', 'objectType'])?.toLowerCase();

  if (type && type !== 'interface') {
    return null;
  }

  const role = firstNonEmptyString(record, ['role', 'value', 'name', 'ref', 'label']);

  return role ? ensureInterface(role) : null;
}

function parseProvisionService(value: unknown): PolicyReplicationProvisionService | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const service = parseProvisionService(item);

      if (service) {
        return service;
      }
    }

    return undefined;
  }

  const record = asReplicationProfileRecord(value);
  if (record) {
    const protocol = isReplicationProfileStringValue(
      record.protocol,
      REPLICATION_PROFILE_RULE_PROTOCOLS,
    )
      ? record.protocol
      : null;
    const port = isReplicationProfilePort(record.port) ? record.port : null;

    if (protocol && port) {
      return { protocol, port };
    }

    const shorthand = firstNonEmptyString(record, ['value', 'name', 'ref', 'label']);

    return shorthand ? parseProvisionService(shorthand) : undefined;
  }

  const shorthand = asReplicationProfileNonEmptyString(value)?.match(/^(tcp|udp)[/:](\d+)$/i);
  if (!shorthand) {
    return undefined;
  }

  const protocol = shorthand[1].toLowerCase();
  const port = Number(shorthand[2]);

  return isReplicationProfileStringValue(protocol, REPLICATION_PROFILE_RULE_PROTOCOLS) &&
    isReplicationProfilePort(port)
    ? { protocol, port }
    : undefined;
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
}
