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

import { ReplicationProfile, ReplicationProfileTargetKind } from './replication-profile.model';

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

/**
 * Extracts and validates the declarative provisioning block from a profile
 * model. Returns null for regular (source-based) profiles.
 */
export function getProfileProvisioning(model: unknown): PolicyReplicationProvision | null {
  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    return null;
  }

  const raw = (model as Record<string, unknown>).provision;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const provisionRaw = raw as Record<string, unknown>;
  const interfaces = (Array.isArray(provisionRaw.interfaces) ? provisionRaw.interfaces : [])
    .map(parseProvisionInterface)
    .filter((item): item is PolicyReplicationProvisionInterface => item !== null);
  const rules = (Array.isArray(provisionRaw.rules) ? provisionRaw.rules : [])
    .map(parseProvisionRule)
    .filter((item): item is PolicyReplicationProvisionRule => item !== null);

  if (interfaces.length === 0 && rules.length === 0) {
    return null;
  }

  return { interfaces, rules };
}

function parseProvisionInterface(value: unknown): PolicyReplicationProvisionInterface | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const role = typeof record.role === 'string' ? record.role.trim() : '';
  return name && role ? { name, role } : null;
}

function parseProvisionRule(value: unknown): PolicyReplicationProvisionRule | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.chain !== 'forward') {
    return null;
  }
  const inRole = typeof record.inRole === 'string' ? record.inRole.trim() || undefined : undefined;
  const outRole =
    typeof record.outRole === 'string' ? record.outRole.trim() || undefined : undefined;
  const comment = typeof record.comment === 'string' ? record.comment : undefined;

  let service: PolicyReplicationProvisionService | undefined;
  const serviceRaw = record.service;
  if (serviceRaw && typeof serviceRaw === 'object' && !Array.isArray(serviceRaw)) {
    const s = serviceRaw as Record<string, unknown>;
    const protocol = s.protocol === 'udp' ? 'udp' : s.protocol === 'tcp' ? 'tcp' : null;
    const port =
      typeof s.port === 'number' && Number.isInteger(s.port) && s.port > 0 && s.port <= 65535
        ? s.port
        : null;
    if (protocol && port) {
      service = { protocol, port };
    }
  }

  return {
    chain: 'forward',
    action: record.action === 'deny' ? 'deny' : 'accept',
    inRole,
    outRole,
    service,
    comment,
  };
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
