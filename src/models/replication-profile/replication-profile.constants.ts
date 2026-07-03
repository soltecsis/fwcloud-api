export const REPLICATION_PROFILE_TARGET_KINDS = ['firewall', 'cluster'] as const;
export type ReplicationProfileTargetKind = (typeof REPLICATION_PROFILE_TARGET_KINDS)[number];

export const REPLICATION_PROFILE_CATALOG_ORIGINS = ['builtin', 'custom', 'all'] as const;
export type ReplicationProfileCatalogOrigin = (typeof REPLICATION_PROFILE_CATALOG_ORIGINS)[number];

/** Interface roles supported by the MVP custom-profile DTO contract. */
export const REPLICATION_PROFILE_INTERFACE_ROLES = ['wan', 'lan', 'dmz'] as const;

/** Policy rule actions supported by the MVP custom-profile contract. */
export const REPLICATION_PROFILE_RULE_ACTIONS = ['accept', 'deny'] as const;

export const REPLICATION_PROFILE_RULE_PROTOCOLS = ['tcp', 'udp'] as const;

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
