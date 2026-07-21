import {
  ReplicationProfileStoreDto,
  ReplicationProfileStoreModelDto,
} from '../../controllers/replication-profile/dtos/replication-profile-store.dto';
import { asReplicationProfileNonEmptyString } from '../replication-profile/replication-profile.constants';
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
const DEFAULT_CLUSTER_NODES: MappedNode[] = [
  { name: 'node1', role: 'primary' },
  { name: 'node2', role: 'secondary' },
];

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
    const value = proposal as unknown as ProposalShape;
    const receivedVersion = value.metadata?.schemaVersion ?? '<missing>';

    if (receivedVersion === this.currentVersion) {
      return this.mapCurrentVersion(value);
    }

    if (this.previousVersion !== null && receivedVersion === this.previousVersion) {
      return this.mapPreviousVersion(value);
    }

    throw new UnsupportedAssistedProfileContractVersionError(
      receivedVersion,
      this._supportedVersions,
    );
  }

  private mapCurrentVersion(proposal: ProposalShape): ReplicationProfileStoreDto {
    return this.mapMvpProposal(proposal);
  }

  /**
   * API-1 retains only structurally validated N-1 payloads. The current MVP
   * revision has the same generated-content shape, so the adapter is explicit
   * even though it can share the field mapping. When that shape changes, the
   * migration remains local to this method.
   */
  private mapPreviousVersion(proposal: ProposalShape): ReplicationProfileStoreDto {
    return this.mapMvpProposal(proposal);
  }

  private mapMvpProposal(proposal: ProposalShape): ReplicationProfileStoreDto {
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
        ? this.mapNodes(target.nodes ?? [], generated.roleAssignments?.nodeRoles ?? [])
        : [];
    const nodeRoleByName = new Map(nodes.map((node) => [node.name, node.role]));
    const interfaces = this.mapInterfaces(
      target,
      generated.roleAssignments?.interfaceRoles ?? [],
      nodeRoleByName,
    );
    const interfaceRoles = [...new Set(interfaces.map((item) => item.role))];
    const nodeRoles = [...new Set(nodes.map((item) => item.role))];
    const rules = (generated.rules ?? []).map((rule) => this.mapRule(rule));

    if (target.type === 'cluster') {
      rules.push(this.makeSynchronizationRule());
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
        connectionType: 'agent',
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

    return {
      ...(code ? { code } : {}),
      ...(profile?.version ? { version: profile.version } : {}),
      name:
        asReplicationProfileNonEmptyString(profile?.name) ??
        asReplicationProfileNonEmptyString(target.name) ??
        'Assisted Profile',
      ...(typeof profile?.description === 'string' ? { description: profile.description } : {}),
      scope: 'generic',
      category: 'Assisted Profile',
      targetKind: target.type,
      model,
    };
  }

  private mapInterfaces(
    target: ProposalTarget,
    assignments: ProposalInterfaceAssignment[],
    nodeRoleByName: ReadonlyMap<string, string>,
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
      interfaces.push({ name: DEFAULT_SYNC_INTERFACE_NAME, role: 'sync' });
    }

    return interfaces;
  }

  private mapNodes(nodes: ProposalNode[], assignments: ProposalNodeAssignment[]): MappedNode[] {
    const assignmentByName = new Map(assignments.map((item) => [item.nodeName, item.role]));
    const nodeNames = new Set(nodes.map((node) => node.name));
    const mapped = nodes.map((node, index) => ({
      name: node.name,
      role: assignmentByName.get(node.name) ?? node.role ?? `node${index + 1}`,
    }));

    for (const assignment of assignments) {
      if (!nodeNames.has(assignment.nodeName)) {
        mapped.push({ name: assignment.nodeName, role: assignment.role });
        nodeNames.add(assignment.nodeName);
      }
    }

    return mapped.length > 0 ? mapped : DEFAULT_CLUSTER_NODES.map((node) => ({ ...node }));
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
