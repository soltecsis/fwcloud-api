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
  PROFILE_OBJECT_DATA_FIELDS,
  ProfileExternalObjectBinding,
  ProfileObjectReplacement,
  ReplicationProfileObjectReference,
  ResolvedProfileObjectReference,
} from './replication-profile-object-reference';
import {
  asReplicationProfileRecord,
  describeReplicationProfileError,
  isReplicationProfilePositiveInteger,
  REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS,
  REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
  REPLICATION_PROFILE_PROTOCOL_BY_IPOBJ_TYPE,
  type ReplicationProfileRecord,
} from './replication-profile.constants';
import {
  findExistingProfileSnapshot,
  loadProfileObjects,
  type ProfileObjectLookup,
  ProfileSnapshotConflict,
  ProfileSnapshotSelectionPlan,
  profileObjectSnapshotKey,
  validateProfileObjectSnapshot,
} from './replication-profile-object-snapshot';

/** Validator of the FWCloud objects API, the one its object forms go through. */
const ipobjSchema = require('../../middleware/joi_schemas/ipobj');

export interface ProfileObjectResolution {
  /** Every reference of the template, resolved or not. */
  objectReferences: ResolvedProfileObjectReference[];
  /** Used references without a real object yet, including objects planned for recreation. */
  missingObjects: ResolvedProfileObjectReference[];
  /** referenceId -> what every usage of that reference binds to. */
  bindings: Map<string, ProfileExternalObjectBinding>;
  /** Invalid replacements or recreation snapshots, each one naming its reference. */
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
 * Resolves references without writes. Equivalent destination objects are reused; incompatible
 * configurations expose their candidates for an explicit choice. `useSnapshot` keeps the saved
 * configuration with distinct descriptive names where needed. Every choice also applies to shared
 * group dependencies. The bindings are application-local and never change the template.
 */
export async function resolveProfileObjectReferences(
  model: unknown,
  fwCloudId: number,
  replacements?: Record<string, ProfileObjectReplacement>,
): Promise<ProfileObjectResolution> {
  const requested: ReplicationProfileRecord = replacements ?? {};
  const references = getProfileObjectReferences(model).map((reference) => {
    const replacement = Object.prototype.hasOwnProperty.call(requested, reference.referenceId)
      ? requested[reference.referenceId]
      : undefined;

    return {
      reference,
      type: getProfileReferenceIpObjType(reference.objectType)!,
      replacement,
      useSnapshot: asReplicationProfileRecord(replacement)?.useSnapshot === true,
    };
  });
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

  const selectionPlan = new ProfileSnapshotSelectionPlan(fwCloudId);
  const replacementBindings = new Map<string, ProfileExternalObjectBinding | string>();
  // Record all explicit existing/data choices before planning groups, independent of reference order.
  for (const { reference, type, replacement, useSnapshot } of references) {
    if (replacement === undefined || useSnapshot) {
      continue;
    }
    const binding = await bindReplacement(
      reference,
      type,
      replacement,
      findObject,
      fwCloudId,
      selectionPlan,
    );
    replacementBindings.set(reference.referenceId, binding);
    if (typeof binding !== 'string') {
      try {
        selectionPlan.setChoice(
          reference.snapshot,
          binding.id === undefined
            ? `data:${profileObjectSnapshotKey(binding.data)}`
            : `existing:${binding.id}`,
          binding,
        );
      } catch (error) {
        replacementBindings.set(reference.referenceId, error.message);
      }
    }
  }
  // Mark every template choice before planning any dependencies, detecting contradictory choices.
  for (const { reference, useSnapshot } of references) {
    if (!useSnapshot) {
      continue;
    }
    try {
      selectionPlan.setChoice(reference.snapshot, 'snapshot');
    } catch (error) {
      replacementBindings.set(reference.referenceId, error.message);
    }
  }
  for (const { reference, type, replacement, useSnapshot } of references) {
    if (!useSnapshot || replacementBindings.has(reference.referenceId)) {
      continue;
    }
    replacementBindings.set(
      reference.referenceId,
      await bindReplacement(reference, type, replacement, findObject, fwCloudId, selectionPlan),
    );
  }

  for (const { reference, type, replacement } of references) {
    let binding: ProfileExternalObjectBinding | null = null;
    let conflictingObjects: ReplicationProfileRecord[] | undefined;
    let snapshotConflict: string | undefined;
    const used = (locations.get(reference.referenceId)?.length ?? 0) > 0;

    let original = bindExistingObject(type, reference.sourceObjectId, findObject);
    // Recycled IDs and objects edited since capture cannot silently replace the template version.
    if (
      original &&
      (original.data.name !== reference.sourceName ||
        profileObjectSnapshotKey(original.data) !== profileObjectSnapshotKey(reference.snapshot))
    ) {
      original = null;
    }
    if (!original && typeof reference.snapshot?.name === 'string' && used) {
      try {
        const existing = await findExistingProfileSnapshot(reference.snapshot, type, fwCloudId);
        original = existing ? { id: existing.id, type, data: existing.data } : null;
      } catch (error) {
        if (!(error instanceof ProfileSnapshotConflict)) {
          throw error;
        }
        snapshotConflict = error.message;
        conflictingObjects = error.objects.map(({ id, data }) => ({ ...data, id }));
      }
    }

    if (replacement === undefined) {
      binding = selectionPlan.get(reference.snapshot) ?? null;
      if (!binding && used && selectionPlan.hasSelectedDependency(reference.snapshot)) {
        try {
          binding = await selectionPlan.select(reference.snapshot, type);
        } catch (error) {
          resolution.errors.push(
            `objectReferences.${reference.referenceId}.snapshot: ${error.message}`,
          );
        }
      }
      binding ??= original;
      if (!binding && used) {
        const invalid =
          snapshotConflict ??
          (await validateProfileObjectSnapshot(reference.snapshot, type, fwCloudId));

        if (!invalid) {
          binding = { type, data: JSON.parse(JSON.stringify(reference.snapshot)) };
        } else {
          if (invalid.includes('conflict')) {
            snapshotConflict = invalid;
          }
          resolution.errors.push(`objectReferences.${reference.referenceId}.snapshot: ${invalid}`);
        }
      }
    } else {
      const replaced = replacementBindings.get(reference.referenceId)!;

      if (typeof replaced === 'string') {
        resolution.errors.push(`objectReplacements.${reference.referenceId}: ${replaced}`);
      } else {
        binding = replaced;
      }
    }

    // A snapshot to recreate is bound but not resolved: no object holds it yet.
    const confirmed = binding !== null && (replacement !== undefined || binding.id !== undefined);
    const resolved: ResolvedProfileObjectReference = {
      ...storedReference(reference, locations),
      resolved: confirmed,
      currentObject: confirmed
        ? { ...(binding.id === undefined ? {} : { id: binding.id }), ...binding.data }
        : null,
      requiredFields: getProfileReferenceRequiredFields(type),
      ...(conflictingObjects ? { conflictingObjects } : {}),
      ...(snapshotConflict ? { snapshotConflict } : {}),
    };

    resolution.objectReferences.push(resolved);

    if (binding) {
      resolution.bindings.set(reference.referenceId, binding);
    }
    if (!resolved.resolved && resolved.locations.length > 0) {
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
  selectionPlan: ProfileSnapshotSelectionPlan,
): Promise<ProfileExternalObjectBinding | string> {
  const input = asReplicationProfileRecord(replacement);

  if (
    !input ||
    Object.keys(input).some((key) => !['sourceObjectId', 'data', 'useSnapshot'].includes(key)) ||
    [input.sourceObjectId, input.data, input.useSnapshot].filter((value) => value !== undefined)
      .length !== 1 ||
    (input.useSnapshot !== undefined && input.useSnapshot !== true)
  ) {
    return 'send either the sourceObjectId of an existing object, the data of a new one, or useSnapshot: true.';
  }

  if (input.useSnapshot === true) {
    try {
      return await selectionPlan.select(reference.snapshot, type);
    } catch (error) {
      return describeReplicationProfileError(error);
    }
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

  const snapshotError = await validateProfileObjectSnapshot(object, type, fwCloudId);
  if (snapshotError) {
    return snapshotError;
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
    return describeReplicationProfileError(error);
  }
}
