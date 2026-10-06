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

import { isIP } from 'net';
import { parseReplicationProfileRange } from './replication-profile-parameters';
import {
  getProfileObjectReferenceLocations,
  getProfileObjectReferences,
  getProfileReferenceDataFields,
  getProfileReferenceIpObjType,
  getProfileReferenceRequiredFields,
  isProfileReferenceGroupType,
  PROFILE_OBJECT_DATA_FIELDS,
  ProfileExternalObjectBinding,
  ProfileObjectReplacement,
  ReplicationProfileObjectReference,
  ResolvedProfileObjectReference,
} from './replication-profile-object-reference';
import {
  asReplicationProfileRecord,
  isReplicationProfilePositiveInteger,
  REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS,
  REPLICATION_PROFILE_IPOBJ_TYPE_BY_VPN_PROTOCOL,
  REPLICATION_PROFILE_IPOBJ_TYPE_HOST,
  REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
  REPLICATION_PROFILE_PROTOCOL_BY_IPOBJ_TYPE,
  type ReplicationProfileRecord,
  type ReplicationProfileVpnProtocol,
} from './replication-profile.constants';
import { addToList, dbQuery, sqlPlaceholders } from './replication-sql.helpers';

/** Validator of the FWCloud objects API, the one its object forms go through. */
const ipobjSchema = require('../../middleware/joi_schemas/ipobj');

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

/** An object read from the FWCloud, with its snapshot. */
interface LoadedObject {
  type: number;
  id: number;
  data: ReplicationProfileRecord;
}

/** The snapshot of the object of a type and id, among the ones read from the FWCloud. */
type ProfileObjectLookup = (type: number, id: unknown) => ReplicationProfileRecord | undefined;

interface HostInterfaceSnapshot {
  id: number;
  name: unknown;
  addresses: ReplicationProfileRecord[];
}

export interface ProfileObjectResolution {
  /** Every reference of the template, resolved or not. */
  objectReferences: ResolvedProfileObjectReference[];
  /** References the template uses whose object is gone and that have no usable replacement. */
  missingObjects: ResolvedProfileObjectReference[];
  /** referenceId -> what every usage of that reference binds to. */
  bindings: Map<string, ProfileExternalObjectBinding>;
  /** Replacements that cannot be used, each one naming its reference. */
  errors: string[];
}

/**
 * Completes the references of a model about to be saved. A reference whose object the FWCloud
 * still sees takes that object's current name and data as its snapshot; one whose object is gone
 * keeps the snapshot it came with, which is how a template edited after the deletion preserves it.
 * Every reference gets the locations of its usages, and what only responses carry (`resolved`,
 * `currentObject`...) is dropped. Anything malformed is left as it came, for the validation of the
 * model to report it.
 */
export async function captureProfileObjectReferences<T>(model: T, fwCloudId: number): Promise<T> {
  const record = asReplicationProfileRecord(model);

  if (!record || !Array.isArray(record.objectReferences)) {
    return model;
  }

  const references = record.objectReferences.map((value) => {
    const reference = asReplicationProfileRecord(value);

    return { value, reference, type: getProfileReferenceIpObjType(reference?.objectType) };
  });
  const findObject = await loadProfileObjects(
    references.map(({ reference, type }) => ({ type, id: reference?.sourceObjectId })),
    fwCloudId,
  );
  const locations = getProfileObjectReferenceLocations(record);

  return {
    ...record,
    objectReferences: references.map(({ value, reference, type }) =>
      reference && type !== undefined && typeof reference.referenceId === 'string'
        ? storedReference(
            reference as unknown as ReplicationProfileObjectReference,
            locations,
            findObject(type, reference.sourceObjectId),
          )
        : value,
    ),
  } as T;
}

/**
 * Resolves the references of a template against the FWCloud it is loaded or applied in, writing
 * nothing. A reference resolves to its original object while the FWCloud sees it with the same
 * type, or to the replacement the caller gives: an existing object of that type, or the data of a
 * new one, checked by the validator of the FWCloud objects API. Replacements are input of one
 * application: they never change the template.
 */
export async function resolveProfileObjectReferences(
  model: unknown,
  fwCloudId: number,
  replacements?: Record<string, ProfileObjectReplacement>,
): Promise<ProfileObjectResolution> {
  const requested: ReplicationProfileRecord = replacements ?? {};
  const references = getProfileObjectReferences(model).map((reference) => ({
    reference,
    type: getProfileReferenceIpObjType(reference.objectType)!,
    replacement: Object.prototype.hasOwnProperty.call(requested, reference.referenceId)
      ? requested[reference.referenceId]
      : undefined,
  }));
  const resolution: ProfileObjectResolution = {
    objectReferences: [],
    missingObjects: [],
    bindings: new Map(),
    errors: [],
  };
  const declared = new Set(references.map(({ reference }) => reference.referenceId));

  for (const referenceId of Object.keys(requested)) {
    if (!declared.has(referenceId)) {
      resolution.errors.push(
        `objectReplacements: "${referenceId}" is not an object reference of the profile.`,
      );
    }
  }

  if (references.length === 0) {
    return resolution;
  }

  const locations = getProfileObjectReferenceLocations(model);
  // A single read covers the original objects and the existing ones chosen as replacements.
  const findObject = await loadProfileObjects(
    references.map(({ reference, type, replacement }) => ({
      type,
      id:
        replacement === undefined
          ? reference.sourceObjectId
          : asReplicationProfileRecord(replacement)?.sourceObjectId,
    })),
    fwCloudId,
  );

  for (const { reference, type, replacement } of references) {
    let binding: ProfileExternalObjectBinding | null = null;

    if (replacement === undefined) {
      binding = bindExistingObject(type, reference.sourceObjectId, findObject);
    } else {
      const replaced = await bindReplacement(reference, type, replacement, findObject, fwCloudId);

      if (typeof replaced === 'string') {
        resolution.errors.push(`objectReplacements.${reference.referenceId}: ${replaced}`);
      } else {
        binding = replaced;
      }
    }

    const resolved: ResolvedProfileObjectReference = {
      ...storedReference(reference, locations),
      resolved: binding !== null,
      currentObject: binding
        ? { ...(binding.id === undefined ? {} : { id: binding.id }), ...binding.data }
        : null,
      requiredFields: getProfileReferenceRequiredFields(type),
    };

    resolution.objectReferences.push(resolved);

    if (binding) {
      resolution.bindings.set(reference.referenceId, binding);
    } else if (resolved.locations.length > 0) {
      // A reference no usage is left for is listed, but nothing has to replace it.
      resolution.missingObjects.push(resolved);
    }
  }

  return resolution;
}

/**
 * A reference as templates store it: nothing else is kept of what it came with. Its name and
 * snapshot are those of the given object, when the FWCloud has it, and its own otherwise.
 */
function storedReference(
  reference: ReplicationProfileObjectReference,
  locations: Map<string, string[]>,
  object?: ReplicationProfileRecord,
): ReplicationProfileObjectReference {
  return {
    referenceId: reference.referenceId,
    objectType: reference.objectType,
    ...(reference.sourceObjectId === undefined ? {} : { sourceObjectId: reference.sourceObjectId }),
    sourceName: object ? (object.name as string) : reference.sourceName,
    snapshot: object ?? reference.snapshot,
    locations: locations.get(reference.referenceId) ?? [],
  };
}

function bindExistingObject(
  type: number,
  id: unknown,
  findObject: ProfileObjectLookup,
): ProfileExternalObjectBinding | null {
  const data = findObject(type, id);

  return data ? { id: id as number, type, data } : null;
}

/** The binding of a replacement, or why it cannot be used. */
async function bindReplacement(
  reference: ReplicationProfileObjectReference,
  type: number,
  replacement: unknown,
  findObject: ProfileObjectLookup,
  fwCloudId: number,
): Promise<ProfileExternalObjectBinding | string> {
  const input = asReplicationProfileRecord(replacement);

  if (
    !input ||
    Object.keys(input).some((key) => key !== 'sourceObjectId' && key !== 'data') ||
    (input.sourceObjectId === undefined) === (input.data === undefined)
  ) {
    return 'send either the sourceObjectId of an existing object or the data of a new one.';
  }

  if (input.data !== undefined) {
    return bindReplacementData(reference, type, input.data, fwCloudId);
  }

  if (!isReplicationProfilePositiveInteger(input.sourceObjectId)) {
    return 'sourceObjectId must be a positive integer.';
  }

  return (
    bindExistingObject(type, input.sourceObjectId, findObject) ??
    `object ${input.sourceObjectId} does not exist in this FWCloud or is not of type "${reference.objectType}".`
  );
}

async function bindReplacementData(
  reference: ReplicationProfileObjectReference,
  type: number,
  value: unknown,
  fwCloudId: number,
): Promise<ProfileExternalObjectBinding | string> {
  const dataFields = getProfileReferenceDataFields(type);

  if (!dataFields) {
    return `objects of type "${reference.objectType}" can only be replaced by an existing one: send its sourceObjectId.`;
  }

  const data = asReplicationProfileRecord(value);

  if (!data) {
    return 'data must be an object.';
  }

  const unknownFields = Object.keys(data).filter(
    (field) => !(PROFILE_OBJECT_DATA_FIELDS as readonly string[]).includes(field),
  );
  const missingFields = dataFields.filter(
    (field) => data[field] === undefined || data[field] === null || data[field] === '',
  );

  if (unknownFields.length > 0) {
    return `data does not take ${unknownFields.join(', ')}.`;
  }

  if (missingFields.length > 0) {
    return `data must hold ${missingFields.join(', ')}.`;
  }

  if (data.type !== undefined && data.type !== type) {
    return `data must describe an object of type ${type} ("${reference.objectType}").`;
  }

  const object = completeReplacementData(type, reference.sourceName, data);
  const invalid = await validateObjectData(object, fwCloudId);

  if (invalid) {
    return invalid;
  }

  // The objects API does not check the order of a range; the parser profile ranges go through does.
  if (
    type === REPLICATION_PROFILE_IPOBJ_TYPE_RANGE &&
    !parseReplicationProfileRange(
      `${object.range_start as string}-${object.range_end as string}`,
      object.ip_version as 4 | 6,
    )
  ) {
    return 'range_start must not be greater than range_end.';
  }

  return { type, data: object };
}

/**
 * Fills in what a replacement does not have to repeat: its type, the original name, the protocol
 * of a TCP, UDP or ICMP service, the IP version of its address and, for an address, a host netmask
 * as profiles give the addresses they create.
 */
function completeReplacementData(
  type: number,
  name: string,
  data: ReplicationProfileRecord,
): ReplicationProfileRecord {
  const object: ReplicationProfileRecord = { name, ...data, type };
  const address =
    type === REPLICATION_PROFILE_IPOBJ_TYPE_RANGE ? object.range_start : object.address;
  const protocol = REPLICATION_PROFILE_PROTOCOL_BY_IPOBJ_TYPE[type];
  const ipVersion = typeof address === 'string' ? isIP(address) : 0;

  if (object.protocol === undefined && protocol !== undefined) {
    object.protocol = protocol;
  }

  if (object.ip_version === undefined && ipVersion !== 0) {
    object.ip_version = ipVersion;
  }

  if (
    type === REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS &&
    object.netmask === undefined &&
    (object.ip_version === 4 || object.ip_version === 6)
  ) {
    object.netmask = object.ip_version === 4 ? '/32' : '/128';
  }

  return object;
}

/**
 * Runs the object through the validator of the FWCloud objects API as an edition (PUT /ipobj)
 * would, the request shape that needs no tree node; the id is only part of that shape. Returns
 * what is wrong, or null.
 */
async function validateObjectData(
  object: ReplicationProfileRecord,
  fwCloudId: number,
): Promise<string | null> {
  try {
    await ipobjSchema.validate({
      method: 'PUT',
      url: '/ipobj',
      body: { ...object, id: 1, fwcloud: fwCloudId },
    });

    return null;
  } catch (error) {
    // Joi errors carry a message; the semantic checks reject with an error_table entry.
    return error?.message ?? error?.msg ?? String(error);
  }
}

/**
 * Reads, as snapshots, the given objects the FWCloud sees: its own ones and the predefined ones
 * (NULL fwcloud). An object that was deleted, belongs to another FWCloud or is not of the type
 * asked for is not found; neither is a type or an id that is not one.
 */
async function loadProfileObjects(
  keys: { type: number | undefined; id: unknown }[],
  fwCloudId: number,
): Promise<ProfileObjectLookup> {
  const idsOf = (groups: boolean): number[] => [
    ...new Set(
      keys
        .filter(({ type }) => type !== undefined && isProfileReferenceGroupType(type) === groups)
        .map(({ id }) => id)
        .filter(isReplicationProfilePositiveInteger),
    ),
  ];
  const loaded = await Promise.all([
    loadObjects(idsOf(false), fwCloudId),
    loadGroups(idsOf(true), fwCloudId),
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

    return { type: data.type as number, id: Number(row.id), data };
  });
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

  if (hostIds.length === 0) {
    return interfaces;
  }

  const rows = await dbQuery<ReplicationProfileRecord>(
    `SELECT H.ipobj AS host_id, I.id AS interface_id, I.name AS interface_name, ${OBJECT_COLUMNS}
     FROM interface__ipobj H
     INNER JOIN interface I ON I.id = H.interface
     LEFT JOIN ipobj O ON O.interface = I.id
     WHERE H.ipobj IN (${sqlPlaceholders(hostIds.length)})
     ORDER BY H.ipobj, I.id, O.id`,
    hostIds,
  );

  for (const row of rows) {
    const hostId = Number(row.host_id);
    const interfaceId = Number(row.interface_id);
    let hostInterface = interfaces.get(hostId)?.find((item) => item.id === interfaceId);

    if (!hostInterface) {
      hostInterface = { id: interfaceId, name: row.interface_name, addresses: [] };
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

  objectRows.forEach((row) =>
    addToList(members, Number(row.group_id), { id: Number(row.id), ...objectData(row) }),
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

/** The data fields of an ipobj row that hold a value. */
function objectData(row: ReplicationProfileRecord): ReplicationProfileRecord {
  const data: ReplicationProfileRecord = {};

  for (const field of PROFILE_OBJECT_DATA_FIELDS) {
    if (row[field] !== null && row[field] !== undefined) {
      data[field] = field === 'type' ? Number(row[field]) : row[field];
    }
  }

  return data;
}
