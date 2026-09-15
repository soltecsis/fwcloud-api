import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import { ErrorPayload } from '../../fonaments/http/response-builder';
import { Service } from '../../fonaments/services/service';
import { IsRoutingTableNumberConstraint } from '../../fonaments/validation/rules/is-routing-table-number.validation';
import { findSecretLikePaths } from './replication-profile-secret.guard';
import {
  asReplicationProfileRecord,
  asReplicationProfileNonEmptyString,
  isReplicationProfileIpVersion,
  isReplicationProfilePort,
  isReplicationProfileStringValue,
  REPLICATION_PROFILE_COMPATIBILITY_TARGET_KIND_FIELDS,
  REPLICATION_PROFILE_INTERFACE_ROLE_FIELDS,
  REPLICATION_PROFILE_OBJECT_KINDS,
  REPLICATION_PROFILE_PARAMETER_TYPES,
  REPLICATION_PROFILE_RULE_ACTIONS,
  REPLICATION_PROFILE_RULE_CHAINS,
  REPLICATION_PROFILE_RULE_PROTOCOLS,
  REPLICATION_PROFILE_STANDARD_GROUP_KIND,
  REPLICATION_PROFILE_STANDARD_OBJECT_KIND,
  REPLICATION_PROFILE_TARGET_KIND_FIELDS,
  REPLICATION_PROFILE_TARGET_KINDS,
} from './replication-profile.constants';
import {
  PARAMETER_FIELDS,
  isReplicationProfileParameterRef,
  isValidReplicationProfileParameterName,
  parseReplicationProfileAddress,
  parseReplicationProfileNetwork,
  parseReplicationProfilePort,
  parseReplicationProfileRange,
  parseReplicationProfileService,
} from './replication-profile-parameters';

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

/** Parser and error message of the parameter types whose default value can be checked. */
const PARAMETER_DEFAULT_CHECKS = new Map<string, [(value: unknown) => unknown, string]>([
  [
    'port',
    [
      (value) => parseReplicationProfilePort(value),
      'Default value for a port parameter must be an integer from 1 to 65535.',
    ],
  ],
  [
    'service',
    [
      (value) => parseReplicationProfileService(value),
      'Default value for a service parameter must be "tcp/800" or { protocol, port }.',
    ],
  ],
  [
    'network',
    [
      (value) => parseReplicationProfileNetwork(value),
      'Default value for a network parameter must be a valid CIDR network.',
    ],
  ],
  [
    'range',
    [
      (value) => parseReplicationProfileRange(value),
      'Default value for a range parameter must be "first-last" addresses of one IP family.',
    ],
  ],
  [
    'address',
    [
      (value) => parseReplicationProfileAddress(value),
      'Default value for an address parameter must be a valid IP address.',
    ],
  ],
  [
    'host',
    [
      (value) => parseReplicationProfileAddress(value),
      'Default value for an address parameter must be a valid IP address.',
    ],
  ],
]);
const ROUTING_TABLE_NUMBER = new IsRoutingTableNumberConstraint();
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
    const parameterNames = this.validateParameters(model, errors);
    this.validateProvision(model, errors, parameterNames);

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

  /**
   * Validates the profile's parameter declarations and returns the names that
   * rules and interfaces may reference with `{ "param": "NAME" }`.
   */
  private validateParameters(
    model: ValidationRecord,
    errors: ReplicationProfileValidationError[],
  ): Set<string> {
    const names = new Set<string>();
    const parameters = this.getFirstField(model, 'model', PARAMETER_FIELDS);

    if (!parameters || parameters.value === undefined || parameters.value === null) {
      return names;
    }

    if (!Array.isArray(parameters.value)) {
      this.addError(
        errors,
        'invalid_parameters',
        'model.parameters must be an array when present.',
        parameters.path,
      );
      return names;
    }

    parameters.value.forEach((item, index) => {
      const path = `${parameters.path}[${index}]`;
      const record = asReplicationProfileRecord(item);

      if (!record) {
        this.addError(errors, 'invalid_parameter', 'Parameter entries must be objects.', path);
        return;
      }

      const name = record.name;

      if (!isValidReplicationProfileParameterName(name)) {
        this.addError(
          errors,
          'invalid_parameter_name',
          'Parameter name must start with a letter and contain only letters, digits or underscores.',
          `${path}.name`,
        );
        return;
      }

      if (names.has(name)) {
        this.addError(
          errors,
          'duplicate_parameter',
          `Parameter "${name}" is declared more than once.`,
          `${path}.name`,
        );
        return;
      }

      if (!isReplicationProfileStringValue(record.type, REPLICATION_PROFILE_PARAMETER_TYPES)) {
        this.addError(
          errors,
          'invalid_parameter_type',
          `Parameter type must be one of: ${REPLICATION_PROFILE_PARAMETER_TYPES.join(', ')}.`,
          `${path}.type`,
        );
        return;
      }

      this.validateParameterDefault(record, path, errors);
      names.add(name);
    });

    return names;
  }

  /** A declared default must already satisfy the parameter's own type. */
  private validateParameterDefault(
    record: ValidationRecord,
    path: string,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (record.default === undefined || record.default === null) {
      return;
    }

    const check = PARAMETER_DEFAULT_CHECKS.get(record.type as string);

    if (check && check[0](record.default) === null) {
      this.addError(errors, 'invalid_parameter_default', check[1], `${path}.default`);
    }
  }

  private validateProvision(
    model: ValidationRecord,
    errors: ReplicationProfileValidationError[],
    parameterNames: Set<string> = new Set<string>(),
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
      parameterNames,
      errors,
    );
    this.addModelDeclaredInterfaceRoles(model, interfaceRoles);
    this.validateProvisionRules(
      provisionRecord,
      provision.path,
      interfaceRoles,
      parameterNames,
      errors,
    );
    this.validateProvisionRouting(
      provisionRecord,
      provision.path,
      interfaceRoles,
      parameterNames,
      errors,
    );
    this.validateProvisionSystem(
      model,
      provisionRecord,
      provision.path,
      interfaceRoles,
      parameterNames,
      errors,
    );
  }

  private validateProvisionRouting(
    provision: ValidationRecord,
    provisionPath: string,
    interfaceRoles: Set<string>,
    parameterNames: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (provision.routing === undefined) {
      return;
    }

    const routingPath = `${provisionPath}.routing`;
    const routing = asReplicationProfileRecord(provision.routing);

    if (!routing) {
      this.addError(
        errors,
        'invalid_routing',
        'model.provision.routing must be an object.',
        routingPath,
      );
      return;
    }

    const tableKeys = new Set<string>();
    const tableNumbers = new Set<number>();

    this.forEachRecord(
      routing.tables,
      `${routingPath}.tables`,
      'routing tables',
      errors,
      (table, path) => {
        const key =
          asReplicationProfileNonEmptyString(table.key) ??
          asReplicationProfileNonEmptyString(table.name);
        const number = table.number;

        if (!asReplicationProfileNonEmptyString(table.name)) {
          this.addError(
            errors,
            'invalid_routing_table',
            'Routing table name must be a non-empty string.',
            `${path}.name`,
          );
        }

        if (
          typeof number !== 'number' ||
          !Number.isInteger(number) ||
          !ROUTING_TABLE_NUMBER.validate(number)
        ) {
          this.addError(
            errors,
            'invalid_routing_table_number',
            'Routing table number must be 1-250 or 254.',
            `${path}.number`,
          );
        } else if (tableNumbers.has(number)) {
          this.addError(
            errors,
            'duplicate_routing_table_number',
            `Routing table number ${number} is used more than once.`,
            `${path}.number`,
          );
        } else {
          tableNumbers.add(number);
        }

        if (key && tableKeys.has(key)) {
          this.addError(
            errors,
            'duplicate_routing_table',
            `Routing table "${key}" is declared more than once.`,
            `${path}.key`,
          );
        } else if (key) {
          tableKeys.add(key);
        }

        this.forEachRecord(table.routes, `${path}.routes`, 'routes', errors, (route, routePath) => {
          this.validateRuleSide(
            route.destination,
            `${routePath}.destination`,
            interfaceRoles,
            parameterNames,
            errors,
          );
          this.validateRuleSide(
            route.gateway,
            `${routePath}.gateway`,
            interfaceRoles,
            parameterNames,
            errors,
          );
          this.validateOptionalRole(
            route.interfaceRole,
            `${routePath}.interfaceRole`,
            interfaceRoles,
            errors,
          );
        });
      },
    );

    this.forEachRecord(
      routing.rules,
      `${routingPath}.rules`,
      'routing rules',
      errors,
      (rule, path) => {
        const table = asReplicationProfileNonEmptyString(rule.table);

        if (!table || !tableKeys.has(table)) {
          this.addError(
            errors,
            'invalid_routing_rule_table',
            'Routing rule table must reference a declared routing table.',
            `${path}.table`,
          );
        }

        this.validateRuleSide(rule.from, `${path}.from`, interfaceRoles, parameterNames, errors);
      },
    );
  }

  private validateProvisionSystem(
    model: ValidationRecord,
    provision: ValidationRecord,
    provisionPath: string,
    interfaceRoles: Set<string>,
    parameterNames: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (provision.system === undefined) {
      return;
    }

    const systemPath = `${provisionPath}.system`;
    const system = asReplicationProfileRecord(provision.system);

    if (!system) {
      this.addError(
        errors,
        'invalid_system',
        'model.provision.system must be an object.',
        systemPath,
      );
      return;
    }

    const side = (value: unknown, path: string) =>
      this.validateRuleSide(value, path, interfaceRoles, parameterNames, errors);
    const positiveInteger = (value: unknown, path: string, message: string) => {
      if (
        value !== undefined &&
        (typeof value !== 'number' || !Number.isInteger(value) || value < 1)
      ) {
        this.addError(errors, 'invalid_system_value', message, path);
      }
    };

    this.forEachRecord(system.dhcp, `${systemPath}.dhcp`, 'DHCP entries', errors, (entry, path) => {
      ['network', 'range', 'router'].forEach((field) => side(entry[field], `${path}.${field}`));
      side(entry.dns, `${path}.dns`);
      positiveInteger(
        entry.maxLease,
        `${path}.maxLease`,
        'DHCP maxLease must be a positive integer (seconds).',
      );
    });

    const topology = asReplicationProfileRecord(model.topologyPreset ?? model.topology_preset);
    const nodeRoles = new Set(
      (Array.isArray(topology?.nodes) ? topology.nodes : [])
        .map((node) => asReplicationProfileNonEmptyString(asReplicationProfileRecord(node)?.role))
        .filter((role): role is string => role !== null),
    );

    this.forEachRecord(
      system.keepalived,
      `${systemPath}.keepalived`,
      'Keepalived entries',
      errors,
      (entry, path) => {
        this.validateOptionalRole(
          entry.interfaceRole,
          `${path}.interfaceRole`,
          interfaceRoles,
          errors,
        );
        side(entry.virtualIps, `${path}.virtualIps`);

        if (typeof entry.masterNode === 'string') {
          if (!nodeRoles.has(entry.masterNode.trim())) {
            this.addError(
              errors,
              'invalid_system_value',
              `Keepalived masterNode "${entry.masterNode}" is not a node role of the cluster topology.`,
              `${path}.masterNode`,
            );
          }
        } else {
          positiveInteger(
            entry.masterNode,
            `${path}.masterNode`,
            'Keepalived masterNode must be a cluster node role or a positive node number.',
          );
        }
      },
    );

    this.forEachRecord(
      system.haproxy,
      `${systemPath}.haproxy`,
      'HAProxy entries',
      errors,
      (entry, path) => {
        side(entry.frontendIp, `${path}.frontendIp`);
        side(entry.backendIps, `${path}.backendIps`);
        this.validatePortsAndProtocols(
          entry.frontendService,
          `${path}.frontendService`,
          parameterNames,
          errors,
        );
        this.validatePortsAndProtocols(
          entry.backendService,
          `${path}.backendService`,
          parameterNames,
          errors,
        );
      },
    );
  }

  private forEachRecord(
    value: unknown,
    path: string,
    label: string,
    errors: ReplicationProfileValidationError[],
    visit: (record: ValidationRecord, path: string) => void,
  ): void {
    if (value === undefined) {
      return;
    }

    if (!Array.isArray(value)) {
      this.addError(errors, 'invalid_collection', `${label} must be an array.`, path);
      return;
    }

    value.forEach((item, index) => {
      const record = asReplicationProfileRecord(item);

      if (record) {
        visit(record, `${path}[${index}]`);
      } else {
        this.addError(
          errors,
          'invalid_collection_item',
          `${label} entries must be objects.`,
          `${path}[${index}]`,
        );
      }
    });
  }

  private validateOptionalRole(
    value: unknown,
    path: string,
    interfaceRoles: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (value !== undefined && value !== null && value !== '') {
      this.validateInterfaceRoleValue(value, path, interfaceRoles, errors);
    }
  }

  /**
   * Interface roles a rule may reference are not only the ones declared inline
   * in `provision.interfaces`: `roleAssignments.interfaceRoles` and
   * `compatibility.supportedRoles` are equally valid declaration sites (the DTO,
   * the provisioning parser and the cluster-topology check all honour them), so
   * fold them into the accepted set before validating rule role references.
   */
  private addModelDeclaredInterfaceRoles(model: ValidationRecord, roles: Set<string>): void {
    this.addRoleAssignmentInterfaceRoles(model, roles);

    const compatibility = asReplicationProfileRecord(model.compatibility);
    if (compatibility) {
      this.addStringRolesFromUnknown(
        compatibility.supportedRoles ?? compatibility.supported_roles,
        roles,
      );
    }
  }

  private addRoleAssignmentInterfaceRoles(model: ValidationRecord, roles: Set<string>): void {
    const roleAssignments = asReplicationProfileRecord(model.roleAssignments);
    if (roleAssignments) {
      this.addStringRolesFromUnknown(
        roleAssignments.interfaceRoles ?? roleAssignments.interface_roles,
        roles,
      );
    }
  }

  private validateProvisionInterfaces(
    provision: ValidationRecord,
    provisionPath: string,
    parameterNames: Set<string>,
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

      this.validateProvisionAddresses(
        record.addresses ?? record.address ?? record.ips,
        `${path}.addresses`,
        parameterNames,
        errors,
      );

      roles.add(role);
    });

    return roles;
  }

  /** Every declared interface address must be a literal IP or a known param. */
  private validateProvisionAddresses(
    value: unknown,
    path: string,
    parameterNames: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (value === undefined || value === null) {
      return;
    }

    const items = Array.isArray(value) ? value : [value];

    items.forEach((item, index) => {
      const itemPath = Array.isArray(value) ? `${path}[${index}]` : path;

      // The entry itself may be the reference, or wrap it in a `value` field.
      if (this.validateParameterReference(item, itemPath, parameterNames, errors)) {
        return;
      }

      const record = asReplicationProfileRecord(item);
      const raw = record ? (record.value ?? record.address ?? record.cidr ?? record.ip) : item;

      if (this.validateParameterReference(raw, itemPath, parameterNames, errors)) {
        return;
      }

      if (parseReplicationProfileAddress(raw) === null) {
        this.addError(
          errors,
          'invalid_interface_address',
          'Interface addresses must be a valid IP address (optionally with a mask) or a parameter reference.',
          itemPath,
        );
      }
    });
  }

  /**
   * Returns true when the value is a parameter reference, reporting an error if
   * it names a parameter the profile never declared.
   */
  private validateParameterReference(
    value: unknown,
    path: string,
    parameterNames: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): boolean {
    if (!isReplicationProfileParameterRef(value)) {
      return false;
    }

    const name = (value as { param: string }).param;

    if (!parameterNames.has(name)) {
      this.addError(
        errors,
        'unknown_parameter_reference',
        `References parameter "${name}", which is not declared in model.parameters.`,
        path,
      );
    }

    return true;
  }

  private validateProvisionRules(
    provision: ValidationRecord,
    provisionPath: string,
    interfaceRoles: Set<string>,
    parameterNames: Set<string>,
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
      this.validateRuleChain(record, rulePath, errors);
      this.validateRuleInterfaceRoles(record, rulePath, interfaceRoles, errors);
      this.validatePortsAndProtocols(record, rulePath, parameterNames, errors);
      const ipVersion = record.ipVersion ?? record.ip_version ?? 4;
      const family = isReplicationProfileIpVersion(ipVersion) ? ipVersion : undefined;

      this.validateRuleSide(
        record.source,
        `${rulePath}.source`,
        interfaceRoles,
        parameterNames,
        errors,
        family,
      );
      this.validateRuleSide(
        record.destination,
        `${rulePath}.destination`,
        interfaceRoles,
        parameterNames,
        errors,
        family,
      );

      for (const field of ['translatedSource', 'translatedDestination']) {
        this.validateRuleSide(
          record[field],
          `${rulePath}.${field}`,
          interfaceRoles,
          parameterNames,
          errors,
          family,
        );
      }

      const chain =
        typeof record.chain === 'string' ? record.chain.trim().toLowerCase() : 'forward';
      const translatedFields = [
        'translatedSource',
        'translatedDestination',
        'translatedService',
      ].filter(
        (field) =>
          record[field] !== undefined &&
          (!Array.isArray(record[field]) || (record[field] as unknown[]).length > 0),
      );

      if (translatedFields.length && chain !== 'snat' && chain !== 'dnat') {
        this.addError(
          errors,
          'invalid_rule_translation',
          'Only SNAT and DNAT rules can translate source, destination or service.',
          `${rulePath}.${translatedFields[0]}`,
        );
      } else if (chain === 'snat' && record.translatedDestination !== undefined) {
        this.addError(
          errors,
          'invalid_rule_translation',
          'SNAT rules translate the source, not the destination.',
          `${rulePath}.translatedDestination`,
        );
      } else if (chain === 'dnat' && record.translatedSource !== undefined) {
        this.addError(
          errors,
          'invalid_rule_translation',
          'DNAT rules translate the destination, not the source.',
          `${rulePath}.translatedSource`,
        );
      }
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

  private validateRuleChain(
    rule: ValidationRecord,
    rulePath: string,
    errors: ReplicationProfileValidationError[],
  ): void {
    if (rule.chain !== undefined) {
      const chain = typeof rule.chain === 'string' ? rule.chain.trim().toLowerCase() : rule.chain;

      if (!isReplicationProfileStringValue(chain, REPLICATION_PROFILE_RULE_CHAINS)) {
        this.addError(
          errors,
          'invalid_rule_chain',
          `Rule chain must be one of: ${REPLICATION_PROFILE_RULE_CHAINS.join(', ')}.`,
          `${rulePath}.chain`,
        );
      }
    }

    const ipVersion = rule.ipVersion ?? rule.ip_version;

    if (ipVersion !== undefined && !isReplicationProfileIpVersion(ipVersion)) {
      this.addError(
        errors,
        'invalid_rule_ip_version',
        'Rule ipVersion must be 4 or 6.',
        `${rulePath}.ipVersion`,
      );
    }
  }

  /**
   * A rule side entry is either an interface-role reference or an object
   * (address/network/host) given as a literal or a parameter reference.
   */
  private validateRuleSide(
    value: unknown,
    path: string,
    interfaceRoles: Set<string>,
    parameterNames: Set<string>,
    errors: ReplicationProfileValidationError[],
    family?: 4 | 6,
  ): void {
    if (value === undefined || value === null) {
      return;
    }

    const items = Array.isArray(value) ? value : [value];

    items.forEach((item, index) => {
      const itemPath = Array.isArray(value) ? `${path}[${index}]` : path;

      if (this.validateParameterReference(item, itemPath, parameterNames, errors)) {
        return;
      }

      if (typeof item === 'string') {
        this.validateInterfaceRoleValue(item, itemPath, interfaceRoles, errors);
        return;
      }

      const record = asReplicationProfileRecord(item);

      if (!record) {
        this.addError(
          errors,
          'invalid_rule_object',
          'Rule source/destination entries must be strings or objects.',
          itemPath,
        );
        return;
      }

      if (
        record.kind === REPLICATION_PROFILE_STANDARD_OBJECT_KIND ||
        record.kind === REPLICATION_PROFILE_STANDARD_GROUP_KIND
      ) {
        if (typeof record.id !== 'number' || !Number.isInteger(record.id) || record.id < 1) {
          this.addError(
            errors,
            'invalid_standard_reference',
            'Predefined object references need the positive integer id of the FWCloud object.',
            `${itemPath}.id`,
          );
        }
        return;
      }

      const kind = typeof record.kind === 'string' ? record.kind.toLowerCase() : undefined;
      const type = typeof record.type === 'string' ? record.type.toLowerCase() : undefined;

      if (kind === 'interfacerole' || type === 'interface' || type === 'interfacerole') {
        const role = record.role ?? record.value ?? record.name ?? record.ref ?? record.label;
        this.validateInterfaceRoleValue(role, `${itemPath}.role`, interfaceRoles, errors);
        return;
      }

      const raw = record.value ?? record.address ?? record.cidr ?? record.network ?? record.ip;

      if (raw === undefined) {
        const role = record.role ?? record.ref ?? record.label;

        if (role !== undefined) {
          this.validateInterfaceRoleValue(role, `${itemPath}.role`, interfaceRoles, errors);
          return;
        }

        this.addError(
          errors,
          'invalid_rule_object',
          'Rule source/destination entries must reference an interface role or carry an address value.',
          itemPath,
        );
        return;
      }

      if (
        kind !== undefined &&
        !isReplicationProfileStringValue(kind, REPLICATION_PROFILE_OBJECT_KINDS)
      ) {
        this.addError(
          errors,
          'invalid_rule_object_kind',
          `Rule object kind must be one of: ${REPLICATION_PROFILE_OBJECT_KINDS.join(', ')}.`,
          `${itemPath}.kind`,
        );
        return;
      }

      if (this.validateParameterReference(raw, `${itemPath}.value`, parameterNames, errors)) {
        return;
      }

      const parse = (expectedIpVersion?: 4 | 6) =>
        kind === 'range'
          ? parseReplicationProfileRange(raw, expectedIpVersion)
          : kind === 'network' || kind === undefined
            ? parseReplicationProfileNetwork(raw, expectedIpVersion)
            : parseReplicationProfileAddress(raw, expectedIpVersion);

      if (parse() === null) {
        this.addError(
          errors,
          'invalid_rule_object',
          'Rule source/destination values must be a valid IP address or network.',
          `${itemPath}.value`,
        );
      } else if (family !== undefined && parse(family) === null) {
        // A rule lives in a single policy, so its objects must be of that IP family.
        this.addError(
          errors,
          'invalid_rule_object_family',
          `Rule source/destination values must be IPv${family} in an IPv${family} rule.`,
          `${itemPath}.value`,
        );
      }
    });
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
        `Rule references role "${role}", but this role is not declared by the profile (model.provision.interfaces, model.roleAssignments.interfaceRoles or model.compatibility.supportedRoles).`,
        path,
      );
    }
  }

  private validatePortsAndProtocols(
    value: unknown,
    path: string,
    parameterNames: Set<string>,
    errors: ReplicationProfileValidationError[],
  ): void {
    this.visitNestedFields(value, path, (key, item, itemPath) => {
      if (this.isProtocolField(key)) {
        this.validateProtocolValue(item, itemPath, errors);
        return true;
      }

      if (this.isPortField(key)) {
        // A port may be supplied at apply time, so a parameter reference is a
        // valid value here just like a literal.
        if (!this.validateParameterReference(item, itemPath, parameterNames, errors)) {
          this.validatePortValue(item, itemPath, errors);
        }

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
    const provision = asReplicationProfileRecord(model.provision);

    this.addRoleAssignmentInterfaceRoles(model, roles);

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
