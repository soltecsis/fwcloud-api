import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import { ValidationException } from '../../fonaments/exceptions/validation-exception';
import {
  asReplicationProfileRecord,
  isReplicationProfileStringValue,
  REPLICATION_PROFILE_TARGET_KINDS,
} from './replication-profile.constants';
import type { ReplicationProfileTargetKind } from './replication-profile.constants';
import {
  assertReplicationProfileCode,
  assertReplicationProfileName,
} from './replication-profile-name';
import type {
  ReplicationProfileModel,
  ReplicationProfileVersionSlot,
} from './replication-profile-template';
import { assertReplicationProfilePayloadIsValid } from './replication-profile-validation.service';

export const REPLICATION_PROFILE_FORMAT = 'fwcloud-replication-profile';
export const REPLICATION_PROFILE_FORMAT_VERSION = 1;

/** Portable metadata only: no database identities, ownership or template paths. */
export interface ReplicationProfilePortableMetadata {
  code: string;
  name: string;
  description: string | null;
  scope: string;
  category: string | null;
  targetKind: ReplicationProfileTargetKind;
}

export interface ReplicationProfilePortableVersion {
  model: ReplicationProfileModel;
  /** Previous revisions may have different deployment metadata. */
  metadata?: ReplicationProfilePortableMetadata;
}

export interface ReplicationProfilePortableDocument {
  format: typeof REPLICATION_PROFILE_FORMAT;
  formatVersion: typeof REPLICATION_PROFILE_FORMAT_VERSION;
  profile: ReplicationProfilePortableMetadata;
  versions: {
    latest: ReplicationProfilePortableVersion;
    previous?: ReplicationProfilePortableVersion | null;
  };
}

export function portableProfileMetadata(
  profile: ReplicationProfilePortableMetadata,
): ReplicationProfilePortableMetadata {
  return {
    code: profile.code,
    name: profile.name,
    description: profile.description,
    scope: profile.scope,
    category: profile.category,
    targetKind: profile.targetKind,
  };
}

/**
 * Retain reference identifiers and snapshot values, discarding source database ids and
 * response-only resolution data. Imported ids can never select objects in another installation.
 */
export function portableProfileModel(model: ReplicationProfileModel): ReplicationProfileModel {
  const result: ReplicationProfileModel = JSON.parse(JSON.stringify(model));
  if (Array.isArray(result.objectReferences)) {
    result.objectReferences = result.objectReferences.map((reference) => ({
      referenceId: reference.referenceId,
      objectType: reference.objectType,
      sourceName: reference.sourceName,
      snapshot: withoutSnapshotIds(reference.snapshot),
      ...(reference.locations === undefined ? {} : { locations: reference.locations }),
    }));
  }
  return result;
}

function withoutSnapshotIds(value: unknown): unknown {
  // The model was already cloned. Prune that copy without rebuilding every snapshot again.
  if (Array.isArray(value)) {
    value.forEach(withoutSnapshotIds);
  } else {
    const record = asReplicationProfileRecord(value);
    if (record) {
      delete record.id;
      Object.values(record).forEach(withoutSnapshotIds);
    }
  }
  return value;
}

/** Checks the transport contract and delegates all model validation to the domain validator. */
export function parseReplicationProfileDocument(
  input: unknown,
): ReplicationProfilePortableDocument {
  const root = recordWithKeys(
    input,
    ['format', 'formatVersion', 'profile', 'versions'],
    'document',
  );
  if (root.format !== REPLICATION_PROFILE_FORMAT) invalid('format', 'Unsupported template format.');
  if (root.formatVersion !== REPLICATION_PROFILE_FORMAT_VERSION)
    invalid('formatVersion', 'Unsupported template format version.');
  const profile = parseMetadata(root.profile, 'profile');
  const versions = recordWithKeys(root.versions, ['latest', 'previous'], 'versions');
  const document: ReplicationProfilePortableDocument = {
    format: REPLICATION_PROFILE_FORMAT,
    formatVersion: REPLICATION_PROFILE_FORMAT_VERSION,
    profile,
    versions: {
      latest: parseVersion(versions.latest, 'latest', profile),
    },
  };
  if (versions.previous != null)
    document.versions.previous = parseVersion(versions.previous, 'previous', profile);
  return document;
}

function parseVersion(
  value: unknown,
  slot: ReplicationProfileVersionSlot,
  profile: ReplicationProfilePortableMetadata,
): ReplicationProfilePortableVersion {
  const field = `versions.${slot}`;
  const version = recordWithKeys(
    value,
    slot === 'previous' ? ['model', 'metadata'] : ['model'],
    field,
  );
  const metadata =
    version.metadata === undefined ? profile : parseMetadata(version.metadata, `${field}.metadata`);
  if (metadata.code !== profile.code)
    invalid(`${field}.metadata.code`, 'Version codes must match.');
  const model = asReplicationProfileRecord(version.model);
  if (!model || Object.keys(model).length === 0)
    invalid(`${field}.model`, 'A complete template model is required.');
  assertReplicationProfilePayloadIsValid({ ...metadata, model });
  return {
    model: portableProfileModel(model),
    ...(version.metadata === undefined ? {} : { metadata }),
  };
}

function parseMetadata(value: unknown, field: string): ReplicationProfilePortableMetadata {
  const metadata = recordWithKeys(
    value,
    ['code', 'name', 'description', 'scope', 'category', 'targetKind'],
    field,
  );
  const { code, name, scope = 'generic', targetKind } = metadata;
  assertReplicationProfileName(name);
  assertReplicationProfileCode(code);
  const description = parseNullableMetadataString(metadata.description, field, 'description');
  const category = parseNullableMetadataString(metadata.category, field, 'category');
  if (typeof scope !== 'string' || !scope.trim() || scope.length > 255)
    invalid(`${field}.scope`, 'scope must be a nonempty string of at most 255 characters.');
  if (!isReplicationProfileStringValue(targetKind, REPLICATION_PROFILE_TARGET_KINDS))
    invalid(`${field}.targetKind`, 'targetKind must be firewall or cluster.');
  return { code, name, description, scope, category, targetKind };
}

function parseNullableMetadataString(
  value: unknown,
  field: string,
  key: 'description' | 'category',
): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || (key === 'category' && value.length > 255))
    invalid(`${field}.${key}`, `${key} must be a string or null.`);
  return value;
}

function recordWithKeys(value: unknown, keys: string[], field: string): Record<string, unknown> {
  const record = asReplicationProfileRecord(value);
  if (!record) invalid(field, `${field} must be an object.`);
  for (const key of Object.keys(record)) {
    if (!keys.includes(key)) invalid(`${field}.${key}`, 'Unsupported field.');
  }
  return record;
}

function invalid(field: string, message: string): never {
  throw new ValidationException('Invalid replication profile import.', { [field]: [message] });
}

export class ReplicationProfileImportConflictException extends HttpException {
  constructor(private readonly profiles: ReplicationProfilePortableMetadata[]) {
    super('A template with this code or name already exists for this user.', 409);
  }

  public toResponse() {
    return {
      ...super.toResponse(),
      errors: { conflicts: this.profiles.map(portableProfileMetadata) },
    };
  }
}
