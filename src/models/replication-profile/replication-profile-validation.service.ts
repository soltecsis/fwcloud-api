import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import { ErrorPayload } from '../../fonaments/http/response-builder';
import { Service } from '../../fonaments/services/service';
import { findSecretLikePaths } from './replication-profile-secret.guard';
import {
  asReplicationProfileRecord,
  asReplicationProfileNonEmptyString,
  isReplicationProfilePort,
  isReplicationProfileStringValue,
  REPLICATION_PROFILE_COMPATIBILITY_TARGET_KIND_FIELDS,
  REPLICATION_PROFILE_INTERFACE_ROLE_FIELDS,
  REPLICATION_PROFILE_RULE_ACTIONS,
  REPLICATION_PROFILE_RULE_PROTOCOLS,
  REPLICATION_PROFILE_TARGET_KIND_FIELDS,
  REPLICATION_PROFILE_TARGET_KINDS,
} from './replication-profile.constants';

type ValidationSeverity = 'error' | 'warning';
type ValidationRecord = Record<string, unknown>;

export interface ReplicationProfileValidationError {
  code: string;
  message: string;
  path?: string;
  severity: ValidationSeverity;
}

interface PathValue<T = unknown> {
  path: string;
  value: T;
}

type FieldVisitor = (key: string, value: unknown, path: string) => boolean;

const COMPATIBILITY_FIELDS = ['compatibility'] as const;
const PROVISION_FIELDS = ['provision'] as const;
const TOPOLOGY_FIELDS = ['topologyPreset', 'topology_preset'] as const;
const TOPOLOGY_FIREWALL_KIND_FIELDS = [
  'targetKind',
  'target_kind',
  'kind',
  'type',
  'mode',
] as const;
const TOPOLOGY_FIREWALL_FLAG_FIELDS = [
  'firewallOnly',
  'firewall_only',
  'singleFirewall',
  'single_firewall',
] as const;
const TOPOLOGY_NODE_ROLE_FIELDS = ['nodeRoles', 'node_roles'] as const;
const TOPOLOGY_REQUIRED_NODE_FIELDS = ['requiredNodes', 'required_nodes'] as const;
const TOPOLOGY_INTERFACE_ROLE_FIELDS = ['role', 'interfaceRole', 'interface_role'] as const;
const TOPOLOGY_MAPPING_INTERFACE_ROLE_FIELDS = ['interfaceRole', 'interface_role', 'role'] as const;
const TOPOLOGY_MAPPING_NODE_ROLE_FIELDS = ['nodeRole', 'node_role'] as const;
const TOPOLOGY_MAPPING_FIELDS = [
  'interfaceNodeMappings',
  'interface_node_mappings',
  'interfaceNodes',
  'interface_nodes',
] as const;
const ROLE_ASSIGNMENT_NODE_ROLE_FIELDS = ['nodeRoles', 'node_roles'] as const;
const GENERIC_ROLE_NAME_FIELDS = ['role', 'nodeRole', 'node_role'] as const;
const NORMALIZED_INTERFACE_ROLE_FIELDS = new Set(
  REPLICATION_PROFILE_INTERFACE_ROLE_FIELDS.map(normalizeProfileKey),
);

function normalizeProfileKey(key: string): string {
  return key.replace(/[_-]/g, '').toLowerCase();
}

export interface ReplicationProfileValidationOptions {
  validateSecrets?: boolean;
}

export class ReplicationProfileValidationException extends HttpException {
  constructor(public readonly validationErrors: ReplicationProfileValidationError[]) {
    super('Replication profile definition is invalid.', 422);
  }

  public toResponse(): ErrorPayload {
    const response = super.toResponse();
    response.errors = {
      profile: this.validationErrors,
    };

    return response;
  }
}

export class ReplicationProfileValidationService extends Service {
  public async build(): Promise<ReplicationProfileValidationService> {
    await super.build();
    return this;
  }

  public validate(
    payload: unknown,
    options?: ReplicationProfileValidationOptions,
  ): ReplicationProfileValidationError[] {
    return validateReplicationProfilePayload(payload, options);
  }

  public assertValid(payload: unknown, options?: ReplicationProfileValidationOptions): void {
    assertReplicationProfilePayloadIsValid(payload, options);
  }
}

export function validateReplicationProfilePayload(
  payload: unknown,
  options?: ReplicationProfileValidationOptions,
): ReplicationProfileValidationError[] {
  return new ReplicationProfileDefinitionValidator(options).validate(payload);
}

export function assertReplicationProfilePayloadIsValid(
  payload: unknown,
  options?: ReplicationProfileValidationOptions,
): void {
  const errors = validateReplicationProfilePayload(payload, options);

  if (errors.length > 0) {
    throw new ReplicationProfileValidationException(errors);
  }
}

class ReplicationProfileDefinitionValidator {
  public constructor(private readonly options: ReplicationProfileValidationOptions = {}) {}

  public validate(payload: unknown): ReplicationProfileValidationError[] {
    const errors: ReplicationProfileValidationError[] = [];
    const root = asReplicationProfileRecord(payload);

    if (!root) {
      this.addError(
        errors,
        'invalid_profile_payload',
        'Replication profile payload must be an object.',
      );
      return errors;
    }

    if (this.options.validateSecrets !== false) {
      this.validateSecrets(payload, errors);
    }

    const targetKind = this.getFirstField(root, '', REPLICATION_PROFILE_TARGET_KIND_FIELDS);
    const rootTargetKind = this.validateTargetKind(targetKind, errors);
    const model = root.model === undefined ? root : asReplicationProfileRecord(root.model);

    if (!model) {
      this.addError(
        errors,
        'invalid_model',
        'Replication profile model must be an object.',
        'model',
      );
      return errors;
    }

    this.validateCompatibility(model, rootTargetKind, errors);
    this.validateProvision(model, errors);

    if (rootTargetKind === 'cluster') {
      this.validateClusterTopology(model, errors);
    }

    return errors;
  }

  private validateSecrets(payload: unknown, errors: ReplicationProfileValidationError[]): void {
    for (const path of findSecretLikePaths(payload)) {
      this.addError(
        errors,
        'forbidden_secret_key',
        `Profile payload must not contain credential-like key "${this.pathLeaf(path)}".`,
        path,
      );
    }
  }

  private validateTargetKind(
    targetKind: PathValue | null,
    errors: ReplicationProfileValidationError[],
  ): string | null {
    if (
      !targetKind ||
      !isReplicationProfileStringValue(targetKind.value, REPLICATION_PROFILE_TARGET_KINDS)
    ) {
      this.addError(
        errors,
        'invalid_target_kind',
        'targetKind must be one of: firewall, cluster.',
        targetKind?.path ?? 'targetKind',
      );
      return null;
    }

    return targetKind.value;
  }

  private validateCompatibility(
    model: ValidationRecord,
    rootTargetKind: string | null,
    errors: ReplicationProfileValidationError[],
  ): void {
    const compatibility = this.getFirstField(model, 'model', COMPATIBILITY_FIELDS);
    if (!compatibility || compatibility.value === undefined) {
      return;
    }

    const compatibilityRecord = asReplicationProfileRecord(compatibility.value);
    if (!compatibilityRecord) {
      this.addError(
        errors,
        'invalid_compatibility',
        'model.compatibility must be an object when present.',
        compatibility.path,
      );
      return;
    }

    const targetKinds = this.getFirstField(
      compatibilityRecord,
      compatibility.path,
      REPLICATION_PROFILE_COMPATIBILITY_TARGET_KIND_FIELDS,
    );
    if (!targetKinds) {
      return;
    }

    const compatibleKinds = this.validateTargetKindCollection(
      targetKinds.value,
      targetKinds.path,
      errors,
    );

    if (rootTargetKind && compatibleKinds.length > 0 && !compatibleKinds.includes(rootTargetKind)) {
      this.addError(
        errors,
        'compatibility_target_kind_mismatch',
        `model.compatibility target kinds must include root targetKind "${rootTargetKind}".`,
        targetKinds.path,
      );
    }
  }

  private validateTargetKindCollection(
    value: unknown,
    path: string,
    errors: ReplicationProfileValidationError[],
  ): string[] {
    if (Array.isArray(value) && value.length === 0) {
      this.addError(
        errors,
        'invalid_compatibility_target_kind',
        'model.compatibility target kinds must not be empty when present.',
        path,
      );
      return [];
    }

    const rawItems = Array.isArray(value) ? value : [value];
    const kinds: string[] = [];
    rawItems.forEach((item, index) => {
      const itemPath = Array.isArray(value) ? `${path}[${index}]` : path;
      if (!isReplicationProfileStringValue(item, REPLICATION_PROFILE_TARGET_KINDS)) {
        this.addError(
          errors,
          'invalid_compatibility_target_kind',
          'model.compatibility target kinds must be firewall or cluster.',
          itemPath,
        );
        return;
      }

      kinds.push(item);
    });

    return kinds;
  }

  private validateProvision(
    model: ValidationRecord,
    errors: ReplicationProfileValidationError[],
  ): void {
    const provision = this.getFirstField(model, 'model', PROVISION_FIELDS);
    if (!provision || provision.value === undefined || provision.value === null) {
      return;
    }

    const provisionRecord = asReplicationProfileRecord(provision.value);
    if (!provisionRecord) {
      this.addError(
        errors,
        'invalid_provision',
        'model.provision must be an object when present.',
        provision.path,
      );
      return;
    }

    const interfaceRoles = this.validateProvisionInterfaces(
      provisionRecord,
      provision.path,
      errors,
    );
    this.validateProvisionRules(provisionRecord, provision.path, interfaceRoles, errors);
  }

  private validateProvisionInterfaces(
    provision: ValidationRecord,
    provisionPath: string,
    errors: ReplicationProfileValidationError[],
  ): Set<string> {
    const roles = new Set<string>();
    const interfacesPath = `${provisionPath}.interfaces`;

    if (provision.interfaces === undefined) {
      return roles;
    }

    if (!Array.isArray(provision.interfaces)) {
      this.addError(
        errors,
        'invalid_interfaces',
        'model.provision.interfaces must be an array when present.',
        interfacesPath,
      );
      return roles;
    }

    provision.interfaces.forEach((item, index) => {
      const path = `${interfacesPath}[${index}]`;
      const record = asReplicationProfileRecord(item);
      if (!record) {
        this.addError(
          errors,
          'invalid_interface',
          'Provision interface entries must be objects.',
          path,
        );
        return;
      }

      const rolePath = `${path}.role`;
      const role = asReplicationProfileNonEmptyString(record.role);

      if (!role) {
        this.addError(
          errors,
          'invalid_interface_role',
          'Provision interface role must be a non-empty string.',
          rolePath,
        );
        return;
      }

      if (roles.has(role)) {
        this.addError(
          errors,
          'duplicate_interface_role',
          `Interface role "${role}" is assigned more than once.`,
          rolePath,
        );
        return;
      }

      roles.add(role);
    });

    return roles;
  }

  private validateProvisionRules(
    provision: ValidationRecord,
    provisionPath: string,
    interfaceRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (provision.rules === undefined) {
      return;
    }

    const rulesPath = `${provisionPath}.rules`;
    if (!Array.isArray(provision.rules)) {
      this.addError(errors, 'invalid_rules', 'model.provision.rules must be an array.', rulesPath);
      return;
    }

    provision.rules.forEach((rule, index) => {
      const rulePath = `${rulesPath}[${index}]`;
      const record = asReplicationProfileRecord(rule);
      if (!record) {
        this.addError(errors, 'invalid_rule', 'Provision rule entries must be objects.', rulePath);
        return;
      }

      this.validateRuleAction(record, rulePath, errors);
      this.validateRuleInterfaceRoles(record, rulePath, interfaceRoles, errors);
      this.validatePortsAndProtocols(record, rulePath, errors);
    });
  }

  private validateRuleAction(
    rule: ValidationRecord,
    rulePath: string,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (rule.action === undefined) {
      return;
    }

    if (!isReplicationProfileStringValue(rule.action, REPLICATION_PROFILE_RULE_ACTIONS)) {
      this.addError(
        errors,
        'invalid_rule_action',
        'Rule action must be one of: accept, deny.',
        `${rulePath}.action`,
      );
    }
  }

  private validateRuleInterfaceRoles(
    value: unknown,
    path: string,
    interfaceRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    this.visitNestedFields(value, path, (key, item, itemPath) => {
      if (this.isInterfaceRoleField(key)) {
        this.validateInterfaceRoleValue(item, itemPath, interfaceRoles, errors);
        return true;
      }

      return false;
    });
  }

  private validateInterfaceRoleValue(
    value: unknown,
    path: string,
    interfaceRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        this.validateInterfaceRoleValue(item, `${path}[${index}]`, interfaceRoles, errors),
      );
      return;
    }

    if (typeof value !== 'string') {
      this.addError(errors, 'invalid_rule_role', 'Rule role references must be strings.', path);
      return;
    }

    const role = value.trim();
    if (!interfaceRoles.has(role)) {
      this.addError(
        errors,
        'invalid_rule_role',
        `Rule references role "${role}", but this role is not defined in model.provision.interfaces.`,
        path,
      );
    }
  }

  private validatePortsAndProtocols(
    value: unknown,
    path: string,
    errors: ReplicationProfileValidationError[],
  ): void {
    this.visitNestedFields(value, path, (key, item, itemPath) => {
      if (this.isProtocolField(key)) {
        this.validateProtocolValue(item, itemPath, errors);
        return true;
      }

      if (this.isPortField(key)) {
        this.validatePortValue(item, itemPath, errors);
        return true;
      }

      return false;
    });
  }

  private validateProtocolValue(
    value: unknown,
    path: string,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (!isReplicationProfileStringValue(value, REPLICATION_PROFILE_RULE_PROTOCOLS)) {
      this.addError(errors, 'invalid_protocol', 'Rule protocol must be one of: tcp, udp.', path);
    }
  }

  private validatePortValue(
    value: unknown,
    path: string,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => this.validatePortValue(item, `${path}[${index}]`, errors));
      return;
    }

    if (!isReplicationProfilePort(value)) {
      this.addError(errors, 'invalid_port', 'Rule port must be an integer from 1 to 65535.', path);
    }
  }

  private validateClusterTopology(
    model: ValidationRecord,
    errors: ReplicationProfileValidationError[],
  ): void {
    const topology = this.getFirstField(model, 'model', TOPOLOGY_FIELDS);
    if (!topology || topology.value === undefined || topology.value === null) {
      return;
    }

    const topologyRecord = asReplicationProfileRecord(topology.value);
    if (!topologyRecord) {
      this.addError(
        errors,
        'invalid_cluster_topology',
        'Cluster topologyPreset must be an object.',
        topology.path,
      );
      return;
    }

    this.validateNotFirewallOnlyTopology(topologyRecord, topology.path, errors);

    const nodeRoles = this.collectTopologyNodeRoles(topologyRecord, topology.path, errors);
    if (nodeRoles.size === 0) {
      this.addError(
        errors,
        'invalid_cluster_topology',
        'Cluster topologyPreset must define at least one node role.',
        topology.path,
      );
    }

    const interfaceRoles = this.collectProfileInterfaceRoles(model);
    this.validateTopologyInterfaces(
      topologyRecord,
      topology.path,
      interfaceRoles,
      nodeRoles,
      errors,
    );
    this.validateTopologyMappings(topologyRecord, topology.path, interfaceRoles, nodeRoles, errors);
    this.validateRoleAssignmentNodeRoles(model, nodeRoles, errors);
    this.validateRuleNodeRoles(model, nodeRoles, errors);
  }

  private validateNotFirewallOnlyTopology(
    topology: ValidationRecord,
    topologyPath: string,
    errors: ReplicationProfileValidationError[],
  ): void {
    for (const key of TOPOLOGY_FIREWALL_KIND_FIELDS) {
      const value = topology[key];
      if (value === 'firewall') {
        this.addError(
          errors,
          'invalid_cluster_topology',
          'Cluster profiles cannot use a firewall-only topology preset.',
          `${topologyPath}.${key}`,
        );
      }
    }

    for (const key of TOPOLOGY_FIREWALL_FLAG_FIELDS) {
      if (topology[key] === true) {
        this.addError(
          errors,
          'invalid_cluster_topology',
          'Cluster profiles cannot use a firewall-only topology preset.',
          `${topologyPath}.${key}`,
        );
      }
    }
  }

  private collectTopologyNodeRoles(
    topology: ValidationRecord,
    topologyPath: string,
    errors: ReplicationProfileValidationError[],
  ): Set<string> {
    const nodeRoles = new Set<string>();
    const nodeDefinitionsFound = this.collectNodeDefinitions(
      topology,
      topologyPath,
      nodeRoles,
      errors,
    );
    const requiredRoles = this.collectRequiredNodeRoles(topology, topologyPath, errors);

    for (const requiredRole of requiredRoles) {
      if (nodeDefinitionsFound && !nodeRoles.has(requiredRole.value)) {
        this.addError(
          errors,
          'invalid_topology_node_role',
          `Required cluster node role "${requiredRole.value}" is not defined in topologyPreset nodes.`,
          requiredRole.path,
        );
      }

      if (!nodeDefinitionsFound) {
        nodeRoles.add(requiredRole.value);
      }
    }

    return nodeRoles;
  }

  private collectNodeDefinitions(
    topology: ValidationRecord,
    topologyPath: string,
    nodeRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): boolean {
    let found = false;

    const nodes = this.getFirstField(topology, topologyPath, ['nodes']);
    if (nodes && nodes.value !== undefined) {
      found = true;
      this.addNodeRolesFromList(nodes.value, nodes.path, nodeRoles, errors);
    }

    const roleDefinitions = this.getFirstField(topology, topologyPath, TOPOLOGY_NODE_ROLE_FIELDS);
    if (roleDefinitions && roleDefinitions.value !== undefined) {
      found = true;
      this.addNodeRolesFromUnknown(roleDefinitions.value, roleDefinitions.path, nodeRoles, errors);
    }

    return found;
  }

  private collectRequiredNodeRoles(
    topology: ValidationRecord,
    topologyPath: string,
    errors: ReplicationProfileValidationError[],
  ): PathValue<string>[] {
    const required = this.getFirstField(topology, topologyPath, TOPOLOGY_REQUIRED_NODE_FIELDS);
    if (!required || required.value === undefined) {
      return [];
    }

    if (!Array.isArray(required.value)) {
      this.addError(
        errors,
        'invalid_cluster_topology',
        'topologyPreset.requiredNodes must be an array when present.',
        required.path,
      );
      return [];
    }

    const roles: PathValue<string>[] = [];
    const seen = new Set<string>();
    required.value.forEach((item, index) => {
      const path = `${required.path}[${index}]`;
      const role = this.extractRoleName(item);

      if (!role) {
        this.addError(
          errors,
          'invalid_topology_node_role',
          'Required cluster node roles must be non-empty strings.',
          path,
        );
        return;
      }

      if (seen.has(role)) {
        this.addError(
          errors,
          'duplicate_topology_node_role',
          `Cluster node role "${role}" is listed more than once.`,
          path,
        );
        return;
      }

      seen.add(role);
      roles.push({ value: role, path });
    });

    return roles;
  }

  private addNodeRolesFromUnknown(
    value: unknown,
    path: string,
    nodeRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (Array.isArray(value)) {
      this.addNodeRolesFromList(value, path, nodeRoles, errors);
      return;
    }

    const record = asReplicationProfileRecord(value);
    if (record) {
      for (const key of Object.keys(record)) {
        this.addNodeRole(key, `${path}.${key}`, nodeRoles, errors);
      }
      return;
    }

    this.addError(
      errors,
      'invalid_cluster_topology',
      'Cluster node roles must be an array or object map when present.',
      path,
    );
  }

  private addNodeRolesFromList(
    value: unknown,
    path: string,
    nodeRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (!Array.isArray(value)) {
      this.addError(
        errors,
        'invalid_cluster_topology',
        'Cluster topology nodes must be an array when present.',
        path,
      );
      return;
    }

    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      const role = this.extractRoleName(item);
      this.addNodeRole(role, itemPath, nodeRoles, errors);
    });
  }

  private addNodeRole(
    role: string | null,
    path: string,
    nodeRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (!role) {
      this.addError(
        errors,
        'invalid_topology_node_role',
        'Cluster topology nodes must define a non-empty role.',
        path,
      );
      return;
    }

    if (nodeRoles.has(role)) {
      this.addError(
        errors,
        'duplicate_topology_node_role',
        `Cluster node role "${role}" is defined more than once.`,
        path,
      );
      return;
    }

    nodeRoles.add(role);
  }

  private validateTopologyInterfaces(
    topology: ValidationRecord,
    topologyPath: string,
    interfaceRoles: Set<string>,
    nodeRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (topology.interfaces === undefined) {
      return;
    }

    const interfacesPath = `${topologyPath}.interfaces`;
    if (!Array.isArray(topology.interfaces)) {
      this.addError(
        errors,
        'invalid_cluster_topology',
        'topologyPreset.interfaces must be an array when present.',
        interfacesPath,
      );
      return;
    }

    topology.interfaces.forEach((item, index) => {
      const itemPath = `${interfacesPath}[${index}]`;
      const record = asReplicationProfileRecord(item);
      if (!record) {
        this.addError(
          errors,
          'invalid_cluster_topology',
          'topologyPreset.interfaces entries must be objects.',
          itemPath,
        );
        return;
      }

      const interfaceRole = this.getStringField(record, TOPOLOGY_INTERFACE_ROLE_FIELDS);
      if (interfaceRole && interfaceRoles.size > 0 && !interfaceRoles.has(interfaceRole.value)) {
        this.addError(
          errors,
          'invalid_topology_interface_role',
          `Topology interface role "${interfaceRole.value}" is not defined by the profile interfaces.`,
          `${itemPath}.${interfaceRole.path}`,
        );
      }

      const nodeRole = this.getStringField(record, TOPOLOGY_MAPPING_NODE_ROLE_FIELDS);
      if (nodeRole) {
        this.validateTopologyNodeRoleValue(
          nodeRole.value,
          `${itemPath}.${nodeRole.path}`,
          nodeRoles,
          errors,
          'Topology interface',
        );
      }
    });
  }

  private validateTopologyMappings(
    topology: ValidationRecord,
    topologyPath: string,
    interfaceRoles: Set<string>,
    nodeRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    for (const key of TOPOLOGY_MAPPING_FIELDS) {
      if (topology[key] === undefined) {
        continue;
      }

      this.validateTopologyMappingValue(
        topology[key],
        `${topologyPath}.${key}`,
        interfaceRoles,
        nodeRoles,
        errors,
      );
    }
  }

  private validateTopologyMappingValue(
    value: unknown,
    path: string,
    interfaceRoles: Set<string>,
    nodeRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        const record = asReplicationProfileRecord(item);
        if (!record) {
          this.addError(
            errors,
            'invalid_cluster_topology',
            'Topology interface/node mappings must be objects.',
            itemPath,
          );
          return;
        }

        const interfaceRole = this.getStringField(record, TOPOLOGY_MAPPING_INTERFACE_ROLE_FIELDS);
        const nodeRole = this.getStringField(record, TOPOLOGY_MAPPING_NODE_ROLE_FIELDS);

        if (!interfaceRole || !nodeRole) {
          this.addError(
            errors,
            'invalid_cluster_topology',
            'Topology interface/node mappings must define interfaceRole and nodeRole.',
            itemPath,
          );
          return;
        }

        this.validateTopologyInterfaceRole(
          interfaceRole.value,
          `${itemPath}.${interfaceRole.path}`,
          interfaceRoles,
          errors,
        );
        this.validateTopologyNodeRoleValue(
          nodeRole.value,
          `${itemPath}.${nodeRole.path}`,
          nodeRoles,
          errors,
          'Topology mapping',
        );
      });
      return;
    }

    const record = asReplicationProfileRecord(value);
    if (!record) {
      this.addError(
        errors,
        'invalid_cluster_topology',
        'Topology interface/node mappings must be an object or array.',
        path,
      );
      return;
    }

    for (const [interfaceRole, nodeRole] of Object.entries(record)) {
      const itemPath = `${path}.${interfaceRole}`;
      this.validateTopologyInterfaceRole(interfaceRole, itemPath, interfaceRoles, errors);
      this.validateTopologyNodeRoleValue(nodeRole, itemPath, nodeRoles, errors, 'Topology mapping');
    }
  }

  private validateTopologyInterfaceRole(
    role: unknown,
    path: string,
    interfaceRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    const trimmed = asReplicationProfileNonEmptyString(role);

    if (!trimmed) {
      this.addError(
        errors,
        'invalid_topology_interface_role',
        'Topology interface role must be a non-empty string.',
        path,
      );
      return;
    }

    if (interfaceRoles.size > 0 && !interfaceRoles.has(trimmed)) {
      this.addError(
        errors,
        'invalid_topology_interface_role',
        `Topology interface role "${trimmed}" is not defined by the profile interfaces.`,
        path,
      );
    }
  }

  private validateTopologyNodeRoleValue(
    value: unknown,
    path: string,
    nodeRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
    label: string,
  ): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        this.validateTopologyNodeRoleValue(item, `${path}[${index}]`, nodeRoles, errors, label),
      );
      return;
    }

    const role = asReplicationProfileNonEmptyString(value);

    if (!role) {
      this.addError(
        errors,
        'invalid_topology_node_role',
        `${label} node role must be a non-empty string.`,
        path,
      );
      return;
    }

    if (!nodeRoles.has(role)) {
      this.addError(
        errors,
        'invalid_topology_node_role',
        `${label} references node role "${role}", but this role is not defined in topologyPreset.`,
        path,
      );
    }
  }

  private validateRoleAssignmentNodeRoles(
    model: ValidationRecord,
    nodeRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    const roleAssignments = asReplicationProfileRecord(model.roleAssignments);
    if (!roleAssignments) {
      return;
    }

    const assigned = this.getFirstField(
      roleAssignments,
      'model.roleAssignments',
      ROLE_ASSIGNMENT_NODE_ROLE_FIELDS,
    );
    if (!assigned || assigned.value === undefined) {
      return;
    }

    this.validateAssignedNodeRoles(assigned.value, assigned.path, nodeRoles, errors);
  }

  private validateAssignedNodeRoles(
    value: unknown,
    path: string,
    nodeRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        this.validateTopologyNodeRoleValue(
          item,
          `${path}[${index}]`,
          nodeRoles,
          errors,
          'Role assignment',
        ),
      );
      return;
    }

    const record = asReplicationProfileRecord(value);
    if (record) {
      for (const role of Object.keys(record)) {
        this.validateTopologyNodeRoleValue(
          role,
          `${path}.${role}`,
          nodeRoles,
          errors,
          'Role assignment',
        );
      }
      return;
    }

    this.addError(
      errors,
      'invalid_topology_node_role',
      'Role assignment nodeRoles must be an array or object map when present.',
      path,
    );
  }

  private validateRuleNodeRoles(
    model: ValidationRecord,
    nodeRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    const provision = asReplicationProfileRecord(model.provision);
    if (!provision || !Array.isArray(provision.rules)) {
      return;
    }

    provision.rules.forEach((rule, index) => {
      this.validateNodeRoleReferences(rule, `model.provision.rules[${index}]`, nodeRoles, errors);
    });
  }

  private validateNodeRoleReferences(
    value: unknown,
    path: string,
    nodeRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    this.visitNestedFields(value, path, (key, item, itemPath) => {
      if (this.isNodeRoleField(key)) {
        this.validateTopologyNodeRoleValue(item, itemPath, nodeRoles, errors, 'Rule');
        return true;
      }

      return false;
    });
  }

  private collectProfileInterfaceRoles(model: ValidationRecord): Set<string> {
    const roles = new Set<string>();
    const roleAssignments = asReplicationProfileRecord(model.roleAssignments);
    const provision = asReplicationProfileRecord(model.provision);

    if (roleAssignments) {
      this.addStringRolesFromUnknown(
        roleAssignments.interfaceRoles ?? roleAssignments.interface_roles,
        roles,
      );
    }

    if (provision && Array.isArray(provision.interfaces)) {
      for (const item of provision.interfaces) {
        const record = asReplicationProfileRecord(item);
        const role = asReplicationProfileNonEmptyString(record?.role);

        if (role) {
          roles.add(role);
        }
      }
    }

    return roles;
  }

  private addStringRolesFromUnknown(value: unknown, roles: Set<string>): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        const role = asReplicationProfileNonEmptyString(item);

        if (role) {
          roles.add(role);
        }
      }
      return;
    }

    const record = asReplicationProfileRecord(value);
    if (record) {
      for (const key of Object.keys(record)) {
        const role = asReplicationProfileNonEmptyString(key);

        if (role) {
          roles.add(role);
        }
      }
    }
  }

  private visitNestedFields(value: unknown, path: string, visitor: FieldVisitor): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => this.visitNestedFields(item, `${path}[${index}]`, visitor));
      return;
    }

    const record = asReplicationProfileRecord(value);
    if (!record) {
      return;
    }

    for (const [key, item] of Object.entries(record)) {
      const itemPath = `${path}.${key}`;
      const handled = visitor(key, item, itemPath);

      if (!handled) {
        this.visitNestedFields(item, itemPath, visitor);
      }
    }
  }

  private getFirstField(
    record: ValidationRecord,
    basePath: string,
    keys: readonly string[],
  ): PathValue | null {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        return {
          value: record[key],
          path: basePath ? `${basePath}.${key}` : key,
        };
      }
    }

    return null;
  }

  private getStringField(
    record: ValidationRecord,
    keys: readonly string[],
  ): PathValue<string> | null {
    for (const key of keys) {
      const value = asReplicationProfileNonEmptyString(record[key]);

      if (value) {
        return {
          value,
          path: key,
        };
      }
    }

    return null;
  }

  private extractRoleName(value: unknown): string | null {
    const role = asReplicationProfileNonEmptyString(value);

    if (role) {
      return role;
    }

    const record = asReplicationProfileRecord(value);
    if (!record) {
      return null;
    }

    const roleField = this.getStringField(record, GENERIC_ROLE_NAME_FIELDS);
    return roleField ? roleField.value : null;
  }

  private isInterfaceRoleField(key: string): boolean {
    const normalized = this.normalizeKey(key);
    return (
      NORMALIZED_INTERFACE_ROLE_FIELDS.has(normalized) ||
      (normalized.endsWith('role') && !normalized.includes('noderole'))
    );
  }

  private isNodeRoleField(key: string): boolean {
    return this.normalizeKey(key).endsWith('noderole');
  }

  private isProtocolField(key: string): boolean {
    return this.normalizeKey(key) === 'protocol';
  }

  private isPortField(key: string): boolean {
    const normalized = this.normalizeKey(key);
    return normalized === 'ports' || normalized.endsWith('port');
  }

  private normalizeKey(key: string): string {
    return normalizeProfileKey(key);
  }

  private pathLeaf(path: string): string {
    const dotLeaf = path.split('.').pop() ?? path;
    const bracketStart = dotLeaf.lastIndexOf('[');
    return bracketStart >= 0 ? dotLeaf.slice(0, bracketStart) : dotLeaf;
  }

  private addError(
    errors: ReplicationProfileValidationError[],
    code: string,
    message: string,
    path?: string,
  ): void {
    errors.push({
      code,
      message,
      path,
      severity: 'error',
    });
  }
}
