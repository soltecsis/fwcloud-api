export const REPLICATION_PROFILE_TARGET_KINDS = ['firewall', 'cluster'] as const;
export type ReplicationProfileTargetKind = (typeof REPLICATION_PROFILE_TARGET_KINDS)[number];

export const REPLICATION_PROFILE_CATALOG_ORIGINS = ['builtin', 'custom', 'all'] as const;
export type ReplicationProfileCatalogOrigin = (typeof REPLICATION_PROFILE_CATALOG_ORIGINS)[number];

/** Interface roles supported by the MVP custom-profile DTO contract. */
export const REPLICATION_PROFILE_INTERFACE_ROLES = ['wan', 'lan', 'dmz', 'sync'] as const;

/** Policy rule actions supported by the MVP custom-profile contract. */
export const REPLICATION_PROFILE_RULE_ACTIONS = ['accept', 'deny'] as const;

export const REPLICATION_PROFILE_RULE_PROTOCOLS = ['tcp', 'udp'] as const;
export type ReplicationProfileRuleProtocol = (typeof REPLICATION_PROFILE_RULE_PROTOCOLS)[number];

/** Netfilter chains the profile vocabulary can express. */
export const REPLICATION_PROFILE_RULE_CHAINS = [
  'input',
  'output',
  'forward',
  'snat',
  'dnat',
] as const;
export type ReplicationProfileRuleChain = (typeof REPLICATION_PROFILE_RULE_CHAINS)[number];

export const REPLICATION_PROFILE_IP_VERSIONS = [4, 6] as const;
export type ReplicationProfileIpVersion = (typeof REPLICATION_PROFILE_IP_VERSIONS)[number];

/** Value kinds a profile parameter can hold. */
export const REPLICATION_PROFILE_PARAMETER_TYPES = [
  'address',
  'network',
  'range',
  'host',
  'port',
  'service',
  'text',
] as const;
export type ReplicationProfileParameterType = (typeof REPLICATION_PROFILE_PARAMETER_TYPES)[number];

/** Object kinds a rule side can reference. */
export const REPLICATION_PROFILE_OBJECT_KINDS = ['address', 'network', 'range', 'host'] as const;
export type ReplicationProfileObjectKind = (typeof REPLICATION_PROFILE_OBJECT_KINDS)[number];

/**
 * References to FWCloud's predefined (standard) objects. They exist with the
 * same fixed id in every installation (`ipobj` / `ipobj_g` rows with a NULL
 * fwcloud), so a profile can point at them portably instead of creating copies.
 */
export const REPLICATION_PROFILE_STANDARD_OBJECT_KIND = 'std';
export const REPLICATION_PROFILE_STANDARD_GROUP_KIND = 'stdGroup';

/** ipobj.type ids the profile vocabulary creates or references. */
export const REPLICATION_PROFILE_IPOBJ_TYPE_IP = 1;
export const REPLICATION_PROFILE_IPOBJ_TYPE_TCP = 2;
export const REPLICATION_PROFILE_IPOBJ_TYPE_ICMP = 3;
export const REPLICATION_PROFILE_IPOBJ_TYPE_UDP = 4;
export const REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS = 5;
export const REPLICATION_PROFILE_IPOBJ_TYPE_RANGE = 6;
export const REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK = 7;
export const REPLICATION_PROFILE_IPOBJ_TYPE_HOST = 8;
export const REPLICATION_PROFILE_IPOBJ_TYPE_INTERFACE = 10;
export const REPLICATION_PROFILE_IPOBJ_TYPE_GROUP = 20;
export const REPLICATION_PROFILE_IPOBJ_TYPE_SERVICE_GROUP = 21;
export const REPLICATION_PROFILE_IPOBJ_TYPE_CONTINENT = 23;
export const REPLICATION_PROFILE_IPOBJ_TYPE_COUNTRY = 24;

/** ipobj.type of each object kind a rule side can create. */
export const REPLICATION_PROFILE_IPOBJ_TYPE_BY_KIND: Record<ReplicationProfileObjectKind, number> =
  {
    address: REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS,
    network: REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK,
    range: REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
    host: REPLICATION_PROFILE_IPOBJ_TYPE_HOST,
  };

export function isReplicationProfileIpVersion(
  value: unknown,
): value is ReplicationProfileIpVersion {
  return value === 4 || value === 6;
}

export const REPLICATION_PROFILE_MIN_PORT = 1;
export const REPLICATION_PROFILE_MAX_PORT = 65535;
export const REPLICATION_PROFILE_TARGET_KIND_FIELDS = ['targetKind', 'target_kind'] as const;
export const REPLICATION_PROFILE_COMPATIBILITY_TARGET_KIND_FIELDS = [
  'target_kinds',
  'targetKinds',
  'target_kind',
  'targetKind',
] as const;
export const REPLICATION_PROFILE_INTERFACE_ROLE_FIELDS = [
  'sourceRole',
  'destinationRole',
  'inRole',
  'outRole',
] as const;

export type ReplicationProfileRecord = Record<string, unknown>;

export function asReplicationProfileRecord(value: unknown): ReplicationProfileRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as ReplicationProfileRecord)
    : null;
}

export function isReplicationProfileStringValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

export function normalizeReplicationProfileTargetKind(
  value: unknown,
): ReplicationProfileTargetKind | null {
  return normalizeAllowedString(value, REPLICATION_PROFILE_TARGET_KINDS);
}

export function normalizeReplicationProfileCatalogOrigin(
  value: unknown,
): ReplicationProfileCatalogOrigin | null {
  return normalizeAllowedString(value, REPLICATION_PROFILE_CATALOG_ORIGINS);
}

function normalizeAllowedString<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return isReplicationProfileStringValue(normalized, allowed) ? normalized : null;
}

export function normalizeReplicationProfileTargetKinds(
  value: unknown,
): ReplicationProfileTargetKind[] {
  if (Array.isArray(value)) {
    return value
      .map(normalizeReplicationProfileTargetKind)
      .filter((item): item is ReplicationProfileTargetKind => item !== null);
  }

  const targetKind = normalizeReplicationProfileTargetKind(value);

  return targetKind ? [targetKind] : [];
}

export function asReplicationProfileNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

export function isReplicationProfilePort(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= REPLICATION_PROFILE_MIN_PORT &&
    value <= REPLICATION_PROFILE_MAX_PORT
  );
}

export function getReplicationProfileModelTargetKinds(
  model: unknown,
): ReplicationProfileTargetKind[] {
  const record = asReplicationProfileRecord(model);
  if (!record) {
    return [];
  }

  const compatibility = asReplicationProfileRecord(record.compatibility);
  const candidates = [
    ...getFieldValues(record, REPLICATION_PROFILE_TARGET_KIND_FIELDS),
    ...getFieldValues(compatibility, REPLICATION_PROFILE_COMPATIBILITY_TARGET_KIND_FIELDS),
  ];

  return candidates.flatMap(normalizeReplicationProfileTargetKinds);
}

function getFieldValues(
  record: ReplicationProfileRecord | null,
  fields: readonly string[],
): unknown[] {
  return record ? fields.map((field) => record[field]) : [];
}
