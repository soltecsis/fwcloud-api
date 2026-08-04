import {
  ReplicationProfileStoreDto,
  ReplicationProfileStoreModelDto,
} from '../../controllers/replication-profile/dtos/replication-profile-store.dto';
import { asReplicationProfileNonEmptyString } from '../replication-profile/replication-profile.constants';
import type { AssistedProfileAssumption } from './assisted-profile-assumptions';
import { ValidatedAssistedProfileProposal } from './assistant-contract-customs';
import {
  getSupportedContractSchemas,
  VendoredContractSchema,
  VENDORED_CONTRACT_SCHEMAS,
} from './schemas/manifest';

export const UNSUPPORTED_ASSISTED_PROFILE_CONTRACT_VERSION =
  'UNSUPPORTED_ASSISTED_PROFILE_CONTRACT_VERSION' as const;

export interface UnsupportedContractVersionDetails {
  code: typeof UNSUPPORTED_ASSISTED_PROFILE_CONTRACT_VERSION;
  receivedVersion: string;
  supportedVersions: string[];
}

export class UnsupportedAssistedProfileContractVersionError extends Error {
  public readonly details: UnsupportedContractVersionDetails;

  constructor(receivedVersion: string, supportedVersions: readonly string[]) {
    const versions = [...supportedVersions];
    super(
      `Assisted Profile contract version '${receivedVersion}' is not supported. Supported versions: ${versions.join(', ')}.`,
    );
    this.name = UnsupportedAssistedProfileContractVersionError.name;
    this.details = {
      code: UNSUPPORTED_ASSISTED_PROFILE_CONTRACT_VERSION,
      receivedVersion,
      supportedVersions: versions,
    };
  }
}

interface ProposalProfile {
  code?: string | null;
  description?: string | null;
  name?: string | null;
  version?: number | null;
}

interface ProposalInterface {
  name: string;
  node?: string | null;
  role: string;
}

interface ProposalNode {
  name: string;
  role: string | null;
}

interface ProposalTarget {
  interfaces: ProposalInterface[];
  name: string;
  nodes?: ProposalNode[];
  type: 'firewall' | 'cluster';
}

interface ProposalRule {
  action: 'allow' | 'deny';
  description?: string | null;
  destinationRole: string;
  service?: string | null;
  sourceRole: string;
}

interface ProposalInterfaceAssignment {
  interfaceName: string;
  node?: string | null;
  role: string;
}

interface ProposalNodeAssignment {
  nodeName: string;
  role: string;
}

interface ProposalShape {
  generated: {
    profile?: ProposalProfile | null;
    roleAssignments?: {
      interfaceRoles: ProposalInterfaceAssignment[];
      nodeRoles?: ProposalNodeAssignment[];
    } | null;
    rules?: ProposalRule[];
    target?: ProposalTarget | null;
  } | null;
  metadata: { schemaVersion: string };
  status: string;
}

interface MappedInterface {
  name: string;
  role: string;
  node?: string;
}

interface MappedNode {
  name: string;
  role: string;
}

const DEFAULT_SYNC_INTERFACE_NAME = 'sync0';
const DEFAULT_PROFILE_NAME = 'Assisted Profile';
const DEFAULT_CONNECTION_TYPE = 'agent';
const DEFAULT_CLUSTER_NODES: MappedNode[] = [
  { name: 'node1', role: 'primary' },
  { name: 'node2', role: 'secondary' },
];

/** The mapped DTO together with every value the mapper supplied itself. */
export interface AssistedProfileMappingResult {
  readonly dto: ReplicationProfileStoreDto;
  readonly assumptions: AssistedProfileAssumption[];
}

/**
 * The single production bridge from the API-1 proposal contract into the
 * existing replication-profile persistence contract.
 *
 * Its version window is the same ordered N/N-1 window used by the gateway.
 * Keeping dispatch here (instead of in controllers/services) makes removal of
 * an old adapter an explicit decision tied to the API-1 draft-retention rule.
 */
export class AssistedProfileProposalMapper {
  private readonly currentVersion: string;
  private readonly previousVersion: string | null;
  private readonly _supportedVersions: string[];

  constructor(manifest: VendoredContractSchema[] = VENDORED_CONTRACT_SCHEMAS) {
    if (manifest.length === 0) {
      throw new Error('AssistedProfileProposalMapper requires at least one contract version');
    }

    const versionWindow = getSupportedContractSchemas(manifest);
    this.currentVersion = versionWindow[versionWindow.length - 1].schemaVersion;
    this.previousVersion = versionWindow.length === 2 ? versionWindow[0].schemaVersion : null;
    this._supportedVersions = versionWindow.map((entry) => entry.schemaVersion);
  }

  public get supportedVersions(): string[] {
    return [...this._supportedVersions];
  }

  public map(proposal: ValidatedAssistedProfileProposal): ReplicationProfileStoreDto {
    return this.mapWithAssumptions(proposal).dto;
  }

  /**
   * The mapper fills gaps the agent left open (a missing profile name, the
   * cluster synchronization interface and rule, cluster nodes). Those values
   * end up indistinguishable from requested ones inside the stored DTO, so
   * they are reported here and persisted alongside the draft: the preview flow
   * has no way to recover them from the mapped output afterwards.
   */
  public mapWithAssumptions(
    proposal: ValidatedAssistedProfileProposal,
  ): AssistedProfileMappingResult {
    const value = proposal as unknown as ProposalShape;
    const receivedVersion = value.metadata?.schemaVersion ?? '<missing>';
    const assumptions: AssistedProfileAssumption[] = [];

    if (receivedVersion === this.currentVersion) {
      return { dto: this.mapCurrentVersion(value, assumptions), assumptions };
    }

    if (this.previousVersion !== null && receivedVersion === this.previousVersion) {
      return { dto: this.mapPreviousVersion(value, assumptions), assumptions };
    }

    throw new UnsupportedAssistedProfileContractVersionError(
      receivedVersion,
      this._supportedVersions,
    );
  }

  private mapCurrentVersion(
    proposal: ProposalShape,
    assumptions: AssistedProfileAssumption[],
  ): ReplicationProfileStoreDto {
    return this.mapMvpProposal(proposal, assumptions);
  }

  /**
   * API-1 retains only structurally validated N-1 payloads. The current MVP
   * revision has the same generated-content shape, so the adapter is explicit
   * even though it can share the field mapping. When that shape changes, the
   * migration remains local to this method.
   */
  private mapPreviousVersion(
    proposal: ProposalShape,
    assumptions: AssistedProfileAssumption[],
  ): ReplicationProfileStoreDto {
    return this.mapMvpProposal(proposal, assumptions);
  }

  private mapMvpProposal(
    proposal: ProposalShape,
    assumptions: AssistedProfileAssumption[],
  ): ReplicationProfileStoreDto {
    if (proposal.status !== 'success' || !proposal.generated?.target) {
      throw new Error(
        'Only successful Assisted Profile proposals with a generated target can be mapped',
      );
    }

    const generated = proposal.generated;
    const target = generated.target;
    const profile = generated.profile;
    const nodes =
      target.type === 'cluster'
        ? this.mapNodes(target.nodes ?? [], generated.roleAssignments?.nodeRoles ?? [], assumptions)
        : [];
    const nodeRoleByName = new Map(nodes.map((node) => [node.name, node.role]));
    const interfaces = this.mapInterfaces(
      target,
      generated.roleAssignments?.interfaceRoles ?? [],
      nodeRoleByName,
      assumptions,
    );
    const interfaceRoles = [...new Set(interfaces.map((item) => item.role))];
    const nodeRoles = [...new Set(nodes.map((item) => item.role))];
    const rules = (generated.rules ?? []).map((rule) => this.mapRule(rule));

    if (target.type === 'cluster') {
      const synchronizationRule = this.makeSynchronizationRule();
      assumptions.push({
        id: 'normalization.cluster.sync-rule',
        path: `model.provision.rules[${rules.length}]`,
        value: synchronizationRule,
        reason:
          'Cluster profiles need synchronization traffic between nodes, so a rule allowing it was added.',
        source: 'normalization',
      });
      rules.push(synchronizationRule);
    }

    const model: ReplicationProfileStoreModelDto = {
      compatibility: {
        targetKinds: [target.type],
        supportedRoles: interfaceRoles,
      },
      roleAssignments: {
        interfaceRoles,
        ...(nodeRoles.length > 0 ? { nodeRoles } : {}),
      },
      uiDefaults: {
        targetKind: target.type,
        connectionType: DEFAULT_CONNECTION_TYPE,
      },
      provision: {
        interfaces,
        rules,
      },
      options: {
        overwriteExisting: false,
        preserveLocalNames: true,
        preserveTargetSpecificValues: true,
        validateBeforeApply: true,
      },
    };

    if (target.type === 'cluster') {
      model.topologyPreset = {
        type: 'cluster',
        nodes,
        requiredNodes: nodeRoles,
        interfaces,
        interfaceNodeMappings: interfaces
          .filter((item) => item.node)
          .map((item) => ({ interfaceRole: item.role, nodeRole: item.node })),
      };
    }

    const code = asReplicationProfileNonEmptyString(profile?.code);

    assumptions.push({
      id: 'default.ui.connection-type',
      path: 'model.uiDefaults.connectionType',
      value: DEFAULT_CONNECTION_TYPE,
      reason:
        'No connection type was requested, so the FWCloud agent connection is offered by default.',
      source: 'default',
    });

    return {
      ...(code ? { code } : {}),
      ...(profile?.version ? { version: profile.version } : {}),
      name: this.mapProfileName(profile, target, assumptions),
      ...(typeof profile?.description === 'string' ? { description: profile.description } : {}),
      scope: 'generic',
      category: 'Assisted Profile',
      targetKind: target.type,
      model,
    };
  }

  private mapProfileName(
    profile: ProposalProfile | null | undefined,
    target: ProposalTarget,
    assumptions: AssistedProfileAssumption[],
  ): string {
    const requested = asReplicationProfileNonEmptyString(profile?.name);
    if (requested) {
      return requested;
    }

    const fromTarget = asReplicationProfileNonEmptyString(target.name);
    if (fromTarget) {
      assumptions.push({
        id: 'normalization.profile.name-from-target',
        path: 'name',
        value: fromTarget,
        reason: `No profile name was provided, so the target name "${fromTarget}" was reused.`,
        source: 'normalization',
      });
      return fromTarget;
    }

    assumptions.push({
      id: 'normalization.profile.default-name',
      path: 'name',
      value: DEFAULT_PROFILE_NAME,
      reason: 'Neither a profile name nor a target name was provided, so a generic name was used.',
      source: 'normalization',
    });
    return DEFAULT_PROFILE_NAME;
  }

  private mapInterfaces(
    target: ProposalTarget,
    assignments: ProposalInterfaceAssignment[],
    nodeRoleByName: ReadonlyMap<string, string>,
    assumptions: AssistedProfileAssumption[],
  ): MappedInterface[] {
    const assignmentByName = new Map(assignments.map((item) => [item.interfaceName, item]));
    const interfaceNames = new Set(target.interfaces.map((item) => item.name));
    const interfaces = target.interfaces.map((item) => {
      const assignment = assignmentByName.get(item.name);
      const node = assignment?.node ?? item.node;

      return {
        name: item.name,
        role: assignment?.role ?? item.role,
        ...(node ? { node: nodeRoleByName.get(node) ?? node } : {}),
      };
    });

    for (const assignment of assignments) {
      if (!interfaceNames.has(assignment.interfaceName)) {
        assumptions.push({
          id: `normalization.interface.from-role-assignment.${assignment.interfaceName}`,
          path: `model.provision.interfaces[${interfaces.length}]`,
          value: assignment.interfaceName,
          reason: `Role "${assignment.role}" was assigned to interface "${assignment.interfaceName}", which the target did not declare, so the interface was added.`,
          source: 'normalization',
        });
        interfaces.push({
          name: assignment.interfaceName,
          role: assignment.role,
          ...(assignment.node
            ? { node: nodeRoleByName.get(assignment.node) ?? assignment.node }
            : {}),
        });
        interfaceNames.add(assignment.interfaceName);
      }
    }

    if (target.type === 'cluster' && !interfaces.some((item) => item.role === 'sync')) {
      assumptions.push({
        id: 'normalization.cluster.default-sync-interface',
        path: `model.provision.interfaces[${interfaces.length}].name`,
        value: DEFAULT_SYNC_INTERFACE_NAME,
        reason:
          'No synchronization interface was provided for the cluster, so a default one was generated.',
        source: 'normalization',
      });
      interfaces.push({ name: DEFAULT_SYNC_INTERFACE_NAME, role: 'sync' });
    }

    return interfaces;
  }

  private mapNodes(
    nodes: ProposalNode[],
    assignments: ProposalNodeAssignment[],
    assumptions: AssistedProfileAssumption[],
  ): MappedNode[] {
    const assignmentByName = new Map(assignments.map((item) => [item.nodeName, item.role]));
    const nodeNames = new Set(nodes.map((node) => node.name));
    const mapped = nodes.map((node, index) => {
      const role = assignmentByName.get(node.name) ?? node.role;
      if (role) {
        return { name: node.name, role };
      }

      const generated = `node${index + 1}`;
      assumptions.push({
        id: `normalization.cluster.node-role.${node.name}`,
        path: `model.topologyPreset.nodes[${index}].role`,
        value: generated,
        reason: `Cluster node "${node.name}" was given no role, so a positional one was generated.`,
        source: 'normalization',
      });
      return { name: node.name, role: generated };
    });

    for (const assignment of assignments) {
      if (!nodeNames.has(assignment.nodeName)) {
        assumptions.push({
          id: `normalization.cluster.node-from-role-assignment.${assignment.nodeName}`,
          path: `model.topologyPreset.nodes[${mapped.length}]`,
          value: { name: assignment.nodeName, role: assignment.role },
          reason: `Role "${assignment.role}" was assigned to node "${assignment.nodeName}", which the target did not declare, so the node was added.`,
          source: 'normalization',
        });
        mapped.push({ name: assignment.nodeName, role: assignment.role });
        nodeNames.add(assignment.nodeName);
      }
    }

    if (mapped.length > 0) {
      return mapped;
    }

    const defaults = DEFAULT_CLUSTER_NODES.map((node) => ({ ...node }));
    assumptions.push({
      id: 'normalization.cluster.default-nodes',
      path: 'model.topologyPreset.nodes',
      value: defaults,
      reason: 'The cluster declared no nodes, so a default primary/secondary pair was generated.',
      source: 'normalization',
    });
    return defaults;
  }

  private mapRule(rule: ProposalRule): Record<string, unknown> {
    return {
      chain: 'forward',
      action: rule.action === 'allow' ? 'accept' : 'deny',
      inRole: rule.sourceRole,
      outRole: rule.destinationRole,
      ...(rule.service ? { service: rule.service } : {}),
      ...(typeof rule.description === 'string' ? { comment: rule.description } : {}),
    };
  }

  private makeSynchronizationRule(): Record<string, unknown> {
    return {
      chain: 'forward',
      action: 'accept',
      inRole: 'sync',
      outRole: 'sync',
      comment: 'Allow cluster synchronization traffic.',
      generated: 'cluster-sync',
    };
  }
}
