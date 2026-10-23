/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com

    This file is part of FWCloud (https://fwcloud.net).
    FWCloud is free software under the GNU Affero General Public License v3 or later.
*/

import { isIP } from 'net';
import * as ipaddr from 'ipaddr.js';
import { addToList, dbQuery, sqlPlaceholders } from './replication-sql.helpers';
import db from '../../database/database-manager';
import {
  isProfileReferenceGroupType,
  PROFILE_OBJECT_DATA_FIELDS,
  PROFILE_REFERENCE_OBJECT_TYPES,
  PROFILE_SERVICE_REFERENCE_TYPES,
  withProfileServiceSourcePorts,
  type ProfileExternalObjectBinding,
} from './replication-profile-object-reference';
import {
  asReplicationProfileRecord,
  describeReplicationProfileError,
  isReplicationProfilePositiveInteger,
  REPLICATION_PROFILE_FAMILY_TYPES,
  REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS,
  REPLICATION_PROFILE_IPOBJ_TYPE_BY_VPN_PROTOCOL,
  REPLICATION_PROFILE_IPOBJ_TYPE_CONTINENT,
  REPLICATION_PROFILE_IPOBJ_TYPE_COUNTRY,
  REPLICATION_PROFILE_IPOBJ_TYPE_DNS,
  REPLICATION_PROFILE_IPOBJ_TYPE_HOST,
  REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK,
  REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
  REPLICATION_PROFILE_IPOBJ_TYPE_SERVICE_GROUP,
  type ReplicationProfileRecord,
  type ReplicationProfileVpnProtocol,
} from './replication-profile.constants';
import { parseReplicationProfileRange } from './replication-profile-parameters';

const ipobjSchema = require('../../middleware/joi_schemas/ipobj');
const interfaceSchema = require('../../middleware/joi_schemas/interface');
const duplicityCheck = require('../../middleware/duplicity');

/** Object types a template can reference, as the numbers FWCloud stores. */
const REFERENCE_TYPES: readonly number[] = Object.values(PROFILE_REFERENCE_OBJECT_TYPES);

/** An integer `options` read from its VARCHAR column, as the object API (an integer) takes it. */
function integerOptions(value: unknown): unknown {
  return typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;
}

/** The fields of a record that hold a value (undefined ones are left out), in the given order. */
export function pickProfileFields(
  record: ReplicationProfileRecord,
  fields: readonly string[],
): ReplicationProfileRecord {
  return Object.fromEntries(
    fields.filter((field) => record[field] !== undefined).map((field) => [field, record[field]]),
  );
}

/** The id and data columns of an ipobj row aliased as O. */
const OBJECT_COLUMNS = ['id', ...PROFILE_OBJECT_DATA_FIELDS]
  .map((field) => `O.${field}`)
  .join(', ');

/** ipobj types of the VPN prefixes, the other VPN members a group can hold besides clients. */
const VPN_PREFIX_TYPES: Readonly<Record<ReplicationProfileVpnProtocol, number>> = {
  openvpn: 401,
  wireguard: 402,
  ipsec: 403,
};

/** VPN members of groups as FWCloud lists them: clients by certificate, prefixes by name. */
const VPN_GROUP_MEMBER_QUERIES = (['openvpn', 'wireguard', 'ipsec'] as const).flatMap(
  (protocol) => [
    `SELECT R.ipobj_g AS group_id, V.id, C.cn AS name, ${REPLICATION_PROFILE_IPOBJ_TYPE_BY_VPN_PROTOCOL[protocol]} AS type
     FROM ${protocol}__ipobj_g R
     INNER JOIN ${protocol} V ON V.id = R.${protocol}
     INNER JOIN crt C ON C.id = V.crt`,
    `SELECT R.ipobj_g AS group_id, P.id, P.name, ${VPN_PREFIX_TYPES[protocol]} AS type
     FROM ${protocol}_prefix__ipobj_g R
     INNER JOIN ${protocol}_prefix P ON P.id = R.prefix`,
  ],
);

/** A destination object and its saved configuration. */
interface SnapshotCandidate {
  id: number;
  data: ReplicationProfileRecord;
}

/** An object read from the FWCloud, with its snapshot and table-disambiguating type. */
interface LoadedObject extends SnapshotCandidate {
  type: number;
}

/** The snapshot of the object of a type and id, among the ones read from the FWCloud. */
export type ProfileObjectLookup = (
  type: number,
  id: unknown,
) => ReplicationProfileRecord | undefined;

interface HostInterfaceSnapshot {
  id: number;
  name: unknown;
  type?: unknown;
  interface_type?: unknown;
  labelName?: unknown;
  mac?: unknown;
  comment?: unknown;
  interface_order?: unknown;
  addresses: ReplicationProfileRecord[];
}

export const PROFILE_HOST_INTERFACE_FIELDS = [
  'name',
  'labelName',
  'type',
  'interface_type',
  'comment',
  'mac',
  'interface_order',
] as const;

/** Columns of a host interface row, as the interfaces API takes them: its order is in interface__ipobj. */
export const PROFILE_HOST_INTERFACE_COLUMNS = PROFILE_HOST_INTERFACE_FIELDS.filter(
  (field) => field !== 'interface_order',
);

/**
 * Compares the configuration an object represents, independent of IDs, comments and equivalent
 * address formats. Group membership and interface addresses are unordered; their database row
 * order must not turn an existing object into a conflict. The saved data itself stays untouched.
 */
export function profileObjectSnapshotKey(snapshot: ReplicationProfileRecord): string {
  return JSON.stringify(normalizeSnapshotValue(snapshot));
}

function normalizeSnapshotValue(value: unknown, field?: string): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map((item) => normalizeSnapshotValue(item));

    if (field !== 'members' && field !== 'addresses') {
      return normalized;
    }

    // Each item is serialized once, not on every comparison of the sort.
    return normalized
      .map((item) => ({ item, text: JSON.stringify(item) }))
      .sort((left, right) => left.text.localeCompare(right.text))
      .map(({ item }) => item);
  }

  if (typeof value === 'string') {
    if ((field === 'address' || field === 'range_start' || field === 'range_end') && isIP(value)) {
      return ipaddr.parse(value).toString();
    }

    if (field === 'netmask' && isIP(value)) {
      const prefix = ipaddr.parse(value).prefixLengthFromSubnetMask();

      if (prefix !== null) {
        return `/${prefix}`;
      }
    }

    if (field === 'options') {
      return integerOptions(value);
    }
  }

  const rawRecord = asReplicationProfileRecord(value);
  const record = rawRecord && withProfileServiceSourcePorts(rawRecord);

  if (!record) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(record)
      .filter(
        (field) =>
          field !== 'id' &&
          field !== 'comment' &&
          record[field] !== undefined &&
          record[field] !== null,
      )
      .sort()
      .map((field) => [field, normalizeSnapshotValue(record[field], field)]),
  );
}

/** Conflicts between pending objects are checked even while the destination contains neither. */
export function validateProfileObjectSnapshotPlan(
  bindings: ReadonlyMap<string, ProfileExternalObjectBinding>,
): string[] {
  const planned = new Map<string, { definition: string; referenceId: string }>();
  const errors: string[] = [];
  const visited = new Set<ReplicationProfileRecord>();
  const check = (data: ReplicationProfileRecord, referenceId: string): void => {
    if (visited.has(data) || typeof data.name !== 'string') {
      return;
    }
    visited.add(data);
    const type = Number(data.type);
    // The type tells groups (ipobj_g) from objects (ipobj) apart.
    const key = `${type}:${data.name}`;
    const definition = profileObjectSnapshotKey(data);
    const previous = planned.get(key);

    if (previous && previous.definition !== definition) {
      errors.push(
        `Template object reference "${referenceId}": conflict with reference "${previous.referenceId}" for object "${data.name}".`,
      );
    } else {
      planned.set(key, { definition, referenceId });
    }

    if (Array.isArray(data.members)) {
      data.members.forEach((member) => {
        const memberData = asReplicationProfileRecord(member);

        if (memberData) {
          check(memberData, referenceId);
        }
      });
    }
  };

  for (const [referenceId, binding] of bindings) {
    if (binding.id === undefined) {
      check(binding.data, referenceId);
    }
  }

  return errors;
}

/**
 * Finds an equivalent, destination-owned object by its saved name. An incompatible object of
 * that name is a conflict, rather than permission to replace it or create an arbitrary variant.
 */
export async function findExistingProfileSnapshot(
  snapshot: ReplicationProfileRecord,
  type: number,
  fwCloudId: number,
): Promise<SnapshotCandidate | null> {
  if (typeof snapshot.name !== 'string' || !snapshot.name) {
    throw new Error('snapshot must contain the original object name.');
  }
  const candidates = await loadSnapshotCandidates(type, fwCloudId, snapshot.name);
  const key = profileObjectSnapshotKey(snapshot);
  const equivalent = candidates.find(
    (candidate) => profileObjectSnapshotKey(candidate.data) === key,
  );

  if (equivalent) {
    return equivalent;
  }

  if (candidates.length > 0) {
    throw new ProfileSnapshotConflict(snapshot.name, candidates);
  }

  return null;
}

/** A same-name conflict carries the full destination configurations for the choice dialog. */
export class ProfileSnapshotConflict extends Error {
  constructor(
    name: string,
    public readonly objects: SnapshotCandidate[],
  ) {
    super(`conflict: object "${name}" already exists with an incompatible configuration.`);
  }
}

/** Objects of a type the FWCloud sees, standalone ones only, all of them or those of a name. */
async function loadSnapshotCandidates(
  type: number,
  fwCloudId: number,
  name?: string,
): Promise<SnapshotCandidate[]> {
  const table = isProfileReferenceGroupType(type) ? 'ipobj_g' : 'ipobj';
  const rows = await dbQuery<{ id: number }>(
    `SELECT id FROM ${table} WHERE (fwcloud = ? OR fwcloud IS NULL) AND type = ?${name === undefined ? '' : ' AND name = ?'}${table === 'ipobj' ? ' AND interface IS NULL' : ''} ORDER BY id`,
    name === undefined ? [fwCloudId, type] : [fwCloudId, type, name],
  );

  if (rows.length === 0) {
    return [];
  }

  const lookup = await loadProfileObjects(
    rows.map(({ id }) => ({ type, id: Number(id) })),
    fwCloudId,
  );
  return rows.flatMap((row) => {
    const id = Number(row.id);
    const data = lookup(type, id);
    return data ? [{ id, data }] : [];
  });
}

/**
 * Plans explicit template choices without writes. All references and group dependencies share
 * the same definitions and names, so a recreated member and its standalone reference bind to
 * one object. Only descriptive names can change; DNS and geographic names have runtime meaning.
 */
export class ProfileSnapshotSelectionPlan {
  private readonly bindings = new Map<string, ProfileExternalObjectBinding>();
  private readonly names = new Map<string, string>();
  private readonly choices = new Map<string, string>();
  private readonly equivalentCandidates = new Map<
    number,
    Promise<Map<string, SnapshotCandidate[]>>
  >();

  constructor(private readonly fwCloudId: number) {}

  get(snapshot: ReplicationProfileRecord): ProfileExternalObjectBinding | undefined {
    return this.bindings.get(profileObjectSnapshotKey(snapshot));
  }

  /** Explicit choices also apply wherever the same saved object is used as a group member. */
  setChoice(
    snapshot: ReplicationProfileRecord,
    choice: string,
    binding?: ProfileExternalObjectBinding,
  ): void {
    const key = profileObjectSnapshotKey(snapshot);
    const previous = this.choices.get(key);
    if (previous !== undefined && previous !== choice) {
      throw new Error(
        `Object "${snapshot.name as string}": conflicting choices for the same template object.`,
      );
    }
    this.choices.set(key, choice);
    if (binding) {
      this.bindings.set(key, binding);
      this.reserveName(binding.data, binding.type);
    }
  }

  hasSelectedDependency(snapshot: ReplicationProfileRecord): boolean {
    return (
      Array.isArray(snapshot.members) &&
      snapshot.members.some((member) => {
        const key = profileObjectSnapshotKey(member);
        return (
          this.choices.has(key) || this.bindings.has(key) || this.hasSelectedDependency(member)
        );
      })
    );
  }

  async select(
    snapshot: ReplicationProfileRecord,
    type: number,
  ): Promise<ProfileExternalObjectBinding> {
    // A conflict never permits a malformed original definition to be repaired by renaming it.
    const originalError = await validateProfileObjectSnapshot(snapshot, type, this.fwCloudId, {
      checkDestination: false,
    });
    if (originalError) {
      throw new Error(originalError);
    }

    const binding = await this.planSnapshot(snapshot, type);
    const finalError = await validateProfileObjectSnapshot(binding.data, type, this.fwCloudId);
    if (finalError) {
      throw new Error(finalError);
    }

    return binding;
  }

  private async planSnapshot(
    snapshot: ReplicationProfileRecord,
    type: number,
  ): Promise<ProfileExternalObjectBinding> {
    const originalKey = profileObjectSnapshotKey(snapshot);
    const previous = this.bindings.get(originalKey);
    if (previous) {
      return previous;
    }

    const data: ReplicationProfileRecord = JSON.parse(JSON.stringify(snapshot));
    delete data.id;
    // A group with an explicitly chosen member must use that choice before comparing it.
    if (!this.hasSelectedDependency(snapshot)) {
      try {
        const existing = await findExistingProfileSnapshot(data, type, this.fwCloudId);
        if (existing && this.reserveName(existing.data, type)) {
          const binding = { id: existing.id, type, data: existing.data };
          this.bindings.set(originalKey, binding);
          return binding;
        }
      } catch (error) {
        if (!(error instanceof ProfileSnapshotConflict)) {
          throw error;
        }
      }
    }

    if (Array.isArray(data.members)) {
      const members: ReplicationProfileRecord[] = [];
      for (const member of data.members as ReplicationProfileRecord[]) {
        const dependency = await this.planSnapshot(member, Number(member.type));
        members.push({
          ...dependency.data,
          ...(dependency.id === undefined ? {} : { id: dependency.id }),
        });
      }
      data.members = members;
    }

    const originalName = snapshot.name as string;
    const functionalName = [
      REPLICATION_PROFILE_IPOBJ_TYPE_DNS,
      REPLICATION_PROFILE_IPOBJ_TYPE_COUNTRY,
      REPLICATION_PROFILE_IPOBJ_TYPE_CONTINENT,
    ].includes(type);
    if (!functionalName) {
      const equivalent = await this.findEquivalent(data, type);
      if (equivalent) {
        const binding = { id: equivalent.id, type, data: equivalent.data };
        this.bindings.set(originalKey, binding);
        return binding;
      }
    }
    for (let suffix = 0; suffix < 10000; suffix++) {
      if (suffix > 0) {
        if (functionalName) {
          throw new Error(
            `conflict: object "${originalName}" cannot be renamed because its name defines its DNS or geographic value; choose an existing object.`,
          );
        }
        const ending = suffix === 1 ? ' (template)' : ` (template ${suffix})`;
        data.name = `${originalName.slice(0, 64 - ending.length)}${ending}`;
      }

      try {
        const existing = await findExistingProfileSnapshot(data, type, this.fwCloudId);
        if (existing && !this.memberBindingsMatch(data, existing.data)) {
          continue;
        }
        const plannedData = existing?.data ?? data;
        if (!this.reserveName(plannedData, type)) {
          continue;
        }
        const binding: ProfileExternalObjectBinding = {
          ...(existing ? { id: existing.id } : {}),
          type,
          data: plannedData,
        };
        this.bindings.set(originalKey, binding);
        return binding;
      } catch (error) {
        if (!(error instanceof ProfileSnapshotConflict)) {
          throw error;
        }
      }
    }

    throw new Error(`Could not find an available template name for object "${originalName}".`);
  }

  private reserveName(data: ReplicationProfileRecord, type: number): boolean {
    const nameKey = `${type}:${data.name as string}`;
    const definition = profileObjectSnapshotKey(data);
    const previous = this.names.get(nameKey);
    if (previous !== undefined && previous !== definition) {
      return false;
    }
    this.names.set(nameKey, definition);
    return true;
  }

  private memberBindingsMatch(
    expected: ReplicationProfileRecord,
    existing: ReplicationProfileRecord,
  ): boolean {
    return (
      !Array.isArray(expected.members) ||
      expected.members.every(
        (member) =>
          member.id === undefined ||
          (Array.isArray(existing.members) &&
            existing.members.some(
              (actual) =>
                actual.id === member.id &&
                profileObjectSnapshotKey(actual) === profileObjectSnapshotKey(member),
            )),
      )
    );
  }

  /** The catalog disallows equivalent configurations even when their descriptive names differ. */
  private async findEquivalent(
    data: ReplicationProfileRecord,
    type: number,
  ): Promise<SnapshotCandidate | undefined> {
    let candidates = this.equivalentCandidates.get(type);
    if (!candidates) {
      candidates = loadSnapshotCandidates(type, this.fwCloudId).then((objects) => {
        const byDefinition = new Map<string, SnapshotCandidate[]>();
        for (const object of objects) {
          const definition = profileObjectSnapshotKey({ ...object.data, name: undefined });
          addToList(byDefinition, definition, object);
        }
        return byDefinition;
      });
      this.equivalentCandidates.set(type, candidates);
    }
    // Only the root descriptive name may differ; dependency names remain part of the definition.
    const definition = profileObjectSnapshotKey({ ...data, name: undefined });
    return (await candidates)
      .get(definition)
      ?.find(
        (candidate) =>
          this.memberBindingsMatch(data, candidate.data) && this.reserveName(candidate.data, type),
      );
  }
}

/**
 * Checks the entire recreation plan using the same validators as the object and interface
 * APIs. No values are invented and no objects are written, including dependencies of groups.
 */
export async function validateProfileObjectSnapshot(
  snapshot: unknown,
  type: number,
  fwCloudId: number,
  options: { checkDestination?: boolean } = {},
): Promise<string | null> {
  try {
    return await validateSnapshot(
      snapshot,
      type,
      fwCloudId,
      new Set(),
      'snapshot',
      options.checkDestination !== false,
    );
  } catch (error) {
    return describeReplicationProfileError(error);
  }
}

async function validateSnapshot(
  snapshot: unknown,
  type: number,
  fwCloudId: number,
  ancestors: Set<unknown>,
  path: string,
  /** Off for the addresses of a recreated host interface, which are not standalone objects. */
  checkDestination: boolean,
): Promise<string | null> {
  const data = asReplicationProfileRecord(snapshot);

  if (!data || data.type !== type || typeof data.name !== 'string' || !data.name) {
    return `${path} must contain the original object's type and name.`;
  }

  if (!REFERENCE_TYPES.includes(type)) {
    return `${path} contains unsupported object type ${type}.`;
  }

  if (ancestors.has(snapshot)) {
    return `${path} contains a cyclic object dependency.`;
  }

  ancestors.add(snapshot);
  const group = isProfileReferenceGroupType(type);
  const host = type === REPLICATION_PROFILE_IPOBJ_TYPE_HOST;
  const allowed = group ? ['type', 'name', 'comment', 'members'] : [...PROFILE_OBJECT_DATA_FIELDS];

  if (host) {
    allowed.push('interfaces');
  }

  const unknown = Object.keys(data).filter((field) => field !== 'id' && !allowed.includes(field));

  if (unknown.length > 0) {
    return `${path} does not take ${unknown.join(', ')}.`;
  }

  const columns = Object.fromEntries(
    Object.entries(withProfileServiceSourcePorts(data)).filter(
      ([field, value]) =>
        allowed.includes(field) && field !== 'members' && field !== 'interfaces' && value !== null,
    ),
  );

  // Continents are stored as groups, but their type is accepted by the general object schema.
  await ipobjSchema.validate({
    method: 'PUT',
    url: group && type !== REPLICATION_PROFILE_IPOBJ_TYPE_CONTINENT ? '/ipobj/group' : '/ipobj',
    body: { ...columns, id: 1, fwcloud: fwCloudId },
  });

  if (
    type === REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK &&
    (typeof data.address !== 'string' || !data.address)
  ) {
    return `${path} must contain the network address.`;
  }

  if (
    type === REPLICATION_PROFILE_IPOBJ_TYPE_RANGE &&
    !parseReplicationProfileRange(
      `${data.range_start as string}-${data.range_end as string}`,
      data.ip_version as 4 | 6,
    )
  ) {
    return `${path}.range_start must not be greater than range_end.`;
  }

  if (checkDestination) {
    const existing = await findExistingProfileSnapshot(data, type, fwCloudId);

    if (!existing && !group) {
      const duplicate = await validateObjectDuplicity(columns, fwCloudId);

      if (duplicate) {
        return `${path}: object "${data.name}" conflicts with an existing object (${duplicate}).`;
      }
    }
  }

  if (host) {
    if (!Array.isArray(data.interfaces)) {
      return `${path}.interfaces must preserve the host's interfaces.`;
    }

    for (const [index, value] of data.interfaces.entries()) {
      const hostInterface = asReplicationProfileRecord(value);
      const interfacePath = `${path}.interfaces[${index}]`;

      if (!hostInterface || !Array.isArray(hostInterface.addresses)) {
        return `${interfacePath} must preserve the interface configuration and addresses.`;
      }

      const unsupported = Object.keys(hostInterface).filter(
        (field) =>
          field !== 'id' &&
          field !== 'addresses' &&
          !(PROFILE_HOST_INTERFACE_FIELDS as readonly string[]).includes(field),
      );

      if (unsupported.length > 0) {
        return `${interfacePath} does not take ${unsupported.join(', ')}.`;
      }

      await interfaceSchema.validate({
        method: 'PUT',
        url: '/interface',
        body: {
          ...pickProfileFields(hostInterface, PROFILE_HOST_INTERFACE_COLUMNS),
          id: 1,
          fwcloud: fwCloudId,
        },
      });

      for (const [addressIndex, address] of hostInterface.addresses.entries()) {
        const invalid = await validateSnapshot(
          address,
          REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS,
          fwCloudId,
          ancestors,
          `${interfacePath}.addresses[${addressIndex}]`,
          false,
        );

        if (invalid) {
          return invalid;
        }
      }
    }
  }

  if (group) {
    if (!Array.isArray(data.members)) {
      return `${path}.members must preserve the group's dependencies.`;
    }

    for (const [index, member] of data.members.entries()) {
      const memberData = asReplicationProfileRecord(member);
      const memberType = memberData?.type;

      if (typeof memberType !== 'number') {
        return `${path}.members[${index}] must contain the member's original type.`;
      }

      const service = PROFILE_SERVICE_REFERENCE_TYPES.has(memberType);
      const accepted =
        !isProfileReferenceGroupType(memberType) &&
        (type === REPLICATION_PROFILE_IPOBJ_TYPE_SERVICE_GROUP
          ? service
          : type === REPLICATION_PROFILE_IPOBJ_TYPE_CONTINENT
            ? memberType === REPLICATION_PROFILE_IPOBJ_TYPE_COUNTRY
            : !service);

      if (!accepted || !REFERENCE_TYPES.includes(memberType)) {
        return `${path}.members[${index}] contains unsupported dependency type ${memberType}.`;
      }

      const invalid = await validateSnapshot(
        member,
        memberType,
        fwCloudId,
        ancestors,
        `${path}.members[${index}]`,
        checkDestination,
      );

      if (invalid) {
        return invalid;
      }
    }
  }

  ancestors.delete(snapshot);
  return null;
}

/** The object API's existing duplication rules, adapted to a read-only preflight. */
function validateObjectDuplicity(
  data: ReplicationProfileRecord,
  fwCloudId: number,
): Promise<string | null> {
  // A synchronous throw of the middleware rejects the promise, as an executor's throw does.
  return new Promise((resolve) =>
    duplicityCheck.ipobj(
      { body: { ...data, fwcloud: fwCloudId }, dbCon: db.getQuery() },
      {
        status: () => ({
          json: (error) => resolve(error?.msg ?? error?.message ?? 'already exists'),
        }),
      },
      () => resolve(null),
    ),
  );
}

/** The address families present in a saved group, including its hosts' interface addresses. */
export function profileSnapshotHasIpVersion(
  snapshot: ReplicationProfileRecord,
  ipVersion: 4 | 6,
): boolean {
  if (REPLICATION_PROFILE_FAMILY_TYPES.includes(Number(snapshot.type))) {
    return Number(snapshot.ip_version) === ipVersion;
  }

  if (snapshot.type === REPLICATION_PROFILE_IPOBJ_TYPE_HOST && Array.isArray(snapshot.interfaces)) {
    return snapshot.interfaces.some((value) => {
      const hostInterface = asReplicationProfileRecord(value);
      return (
        Array.isArray(hostInterface?.addresses) &&
        hostInterface.addresses.some((address) => profileSnapshotHasIpVersion(address, ipVersion))
      );
    });
  }

  return (
    Array.isArray(snapshot.members) &&
    snapshot.members.some((member) => profileSnapshotHasIpVersion(member, ipVersion))
  );
}

/**
 * Reads, as snapshots, the given objects the FWCloud sees: its own ones and the predefined ones
 * (NULL fwcloud). An object that was deleted, belongs to another FWCloud or is not of the type
 * asked for is not found; neither is a type or an id that is not one.
 */
export async function loadProfileObjects(
  keys: { type: number | undefined; id: unknown }[],
  fwCloudId: number,
): Promise<ProfileObjectLookup> {
  const objectIds = new Set<number>();
  const groupIds = new Set<number>();
  for (const { type, id } of keys) {
    if (type !== undefined && isReplicationProfilePositiveInteger(id)) {
      (isProfileReferenceGroupType(type) ? groupIds : objectIds).add(id);
    }
  }
  const loaded = await Promise.all([
    loadObjects([...objectIds], fwCloudId),
    loadGroups([...groupIds], fwCloudId),
  ]);
  // ipobj and ipobj_g ids overlap: the type tells which table an id belongs to.
  const key = (type: number, id: number) => `${type}:${id}`;
  const found = new Map(loaded.flat().map(({ type, id, data }) => [key(type, id), data]));

  return (type, id) =>
    isReplicationProfilePositiveInteger(id) ? found.get(key(type, id)) : undefined;
}

/** ipobj rows among the ids, hosts with their interfaces. */
async function loadObjects(ids: number[], fwCloudId: number): Promise<LoadedObject[]> {
  if (ids.length === 0) {
    return [];
  }

  const rows = await dbQuery<ReplicationProfileRecord>(
    `SELECT ${OBJECT_COLUMNS} FROM ipobj O
     WHERE O.id IN (${sqlPlaceholders(ids.length)}) AND (O.fwcloud = ? OR O.fwcloud IS NULL)`,
    [...ids, fwCloudId],
  );
  const objects = await objectsData(rows);

  return rows.map((row, index) => ({
    type: objects[index].type as number,
    id: Number(row.id),
    data: objects[index],
  }));
}

/** ipobj_g rows among the ids, with their members. */
async function loadGroups(ids: number[], fwCloudId: number): Promise<LoadedObject[]> {
  if (ids.length === 0) {
    return [];
  }

  const rows = await dbQuery<ReplicationProfileRecord>(
    `SELECT id, type, name, comment FROM ipobj_g
     WHERE id IN (${sqlPlaceholders(ids.length)}) AND (fwcloud = ? OR fwcloud IS NULL)`,
    [...ids, fwCloudId],
  );
  const members = await loadGroupMembers(rows.map((row) => Number(row.id)));

  return rows.map((row) => ({
    type: Number(row.type),
    id: Number(row.id),
    data: {
      type: Number(row.type),
      name: row.name,
      ...(row.comment ? { comment: row.comment } : {}),
      members: members.get(Number(row.id)) ?? [],
    },
  }));
}

/** Interfaces of each host, with their addresses. */
async function loadHostInterfaces(
  hostIds: number[],
): Promise<Map<number, HostInterfaceSnapshot[]>> {
  const interfaces = new Map<number, HostInterfaceSnapshot[]>();
  const interfacesById = new Map<string, HostInterfaceSnapshot>();

  if (hostIds.length === 0) {
    return interfaces;
  }

  const rows = await dbQuery<ReplicationProfileRecord>(
    `SELECT H.ipobj AS host_id, I.id AS interface_id, I.name AS interface_name,
      I.type AS interface_kind, I.interface_type, I.labelName, I.mac, I.comment AS interface_comment,
      H.interface_order,
      ${OBJECT_COLUMNS}
     FROM interface__ipobj H
     INNER JOIN interface I ON I.id = H.interface
     LEFT JOIN ipobj O ON O.interface = I.id
     WHERE H.ipobj IN (${sqlPlaceholders(hostIds.length)})
     ORDER BY H.ipobj, H.interface_order, I.id, O.id`,
    hostIds,
  );

  for (const row of rows) {
    const hostId = Number(row.host_id);
    const interfaceId = Number(row.interface_id);
    const key = `${hostId}:${interfaceId}`;
    let hostInterface = interfacesById.get(key);

    if (!hostInterface) {
      hostInterface = {
        id: interfaceId,
        name: row.interface_name,
        type: Number(row.interface_kind),
        interface_type: Number(row.interface_type),
        labelName: row.labelName,
        mac: row.mac,
        comment: row.interface_comment,
        interface_order: Number(row.interface_order),
        addresses: [],
      };
      interfacesById.set(key, hostInterface);
      addToList(interfaces, hostId, hostInterface);
    }

    if (row.id !== null) {
      hostInterface.addresses.push({ id: Number(row.id), ...objectData(row) });
    }
  }

  return interfaces;
}

/** Members of each group: objects with their data, then VPN clients and prefixes. */
async function loadGroupMembers(
  groupIds: number[],
): Promise<Map<number, ReplicationProfileRecord[]>> {
  const members = new Map<number, ReplicationProfileRecord[]>();

  if (groupIds.length === 0) {
    return members;
  }

  const placeholders = sqlPlaceholders(groupIds.length);
  const [objectRows, vpnRows] = await Promise.all([
    dbQuery<ReplicationProfileRecord>(
      `SELECT R.ipobj_g AS group_id, ${OBJECT_COLUMNS}
       FROM ipobj__ipobjg R
       INNER JOIN ipobj O ON O.id = R.ipobj
       WHERE R.ipobj_g IN (${placeholders})
       ORDER BY R.id_gi`,
      groupIds,
    ),
    dbQuery<ReplicationProfileRecord>(
      `${VPN_GROUP_MEMBER_QUERIES.map((query) => `${query} WHERE R.ipobj_g IN (${placeholders})`).join(' UNION ALL ')}
       ORDER BY type, id`,
      VPN_GROUP_MEMBER_QUERIES.flatMap(() => groupIds),
    ),
  ]);

  (await objectsData(objectRows)).forEach((data, index) =>
    addToList(members, Number(objectRows[index].group_id), {
      id: Number(objectRows[index].id),
      ...data,
    }),
  );
  vpnRows.forEach((row) =>
    addToList(members, Number(row.group_id), {
      id: Number(row.id),
      type: Number(row.type),
      name: row.name,
    }),
  );

  return members;
}

/** The data of each ipobj row, in their order: a host also holds its interfaces. */
async function objectsData(rows: ReplicationProfileRecord[]): Promise<ReplicationProfileRecord[]> {
  const interfaces = await loadHostInterfaces(
    rows
      .filter((row) => Number(row.type) === REPLICATION_PROFILE_IPOBJ_TYPE_HOST)
      .map((row) => Number(row.id)),
  );

  return rows.map((row) => {
    const data = objectData(row);

    if (data.type === REPLICATION_PROFILE_IPOBJ_TYPE_HOST) {
      data.interfaces = interfaces.get(Number(row.id)) ?? [];
    }

    return data;
  });
}

/** The data fields of an ipobj row that hold a value. */
function objectData(row: ReplicationProfileRecord): ReplicationProfileRecord {
  const data: ReplicationProfileRecord = {};

  for (const field of PROFILE_OBJECT_DATA_FIELDS) {
    if (row[field] !== null && row[field] !== undefined) {
      data[field] =
        field === 'type'
          ? Number(row[field])
          : field === 'options'
            ? integerOptions(row[field])
            : row[field];
    }
  }

  return withProfileServiceSourcePorts(data);
}
