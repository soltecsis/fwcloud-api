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

import { getProfileProvisioningSource, POLICY_STRUCTURE_FIELDS } from './policy-replication.types';
import {
  asReplicationProfileNonEmptyString,
  asReplicationProfileRecord,
  getReplicationProfileRuleIpVersion,
  isReplicationProfileExternalObjectUsage,
  isReplicationProfileIpVersion,
  isReplicationProfilePositiveInteger,
  isReplicationProfileStringValue,
  REPLICATION_PROFILE_EXTERNAL_OBJECT_KIND,
  REPLICATION_PROFILE_IPOBJ_GROUP_TYPES,
  REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS,
  REPLICATION_PROFILE_IPOBJ_TYPE_CONTINENT,
  REPLICATION_PROFILE_IPOBJ_TYPE_COUNTRY,
  REPLICATION_PROFILE_IPOBJ_TYPE_DNS,
  REPLICATION_PROFILE_IPOBJ_TYPE_GROUP,
  REPLICATION_PROFILE_IPOBJ_TYPE_HOST,
  REPLICATION_PROFILE_IPOBJ_TYPE_ICMP,
  REPLICATION_PROFILE_IPOBJ_TYPE_IP,
  REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK,
  REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
  REPLICATION_PROFILE_IPOBJ_TYPE_SERVICE_GROUP,
  REPLICATION_PROFILE_IPOBJ_TYPE_TCP,
  REPLICATION_PROFILE_IPOBJ_TYPE_UDP,
  type ReplicationProfileIpVersion,
  type ReplicationProfileRecord,
} from './replication-profile.constants';
import type { ReplicationProfileValidationError } from './replication-profile-validation.service';

/**
 * FWCloud objects created outside a template (an address, a range, a service, a group...) that
 * the template uses. Each one is declared once in `model.objectReferences`, and every field using
 * it (a rule position, a route, a routing rule, a DHCP, Keepalived or HAProxy entry) holds
 * `{ "kind": "external", "referenceId": "<referenceId>" }`:
 *
 *   "objectReferences": [{
 *     "referenceId": "wan-ip", "objectType": "address", "sourceObjectId": 1234,
 *     "sourceName": "WAN_PUBLIC_IP",
 *     "snapshot": { "type": 5, "name": "WAN_PUBLIC_IP", "ip_version": 4, "address": "203.0.113.5", "netmask": "/32" },
 *     "locations": ["model.provision.rules[0].source[0]"]
 *   }]
 *
 * The referenceId, chosen by the client and kept across edits, is what identifies a reference. The
 * id of the original object only finds that object while it exists; the snapshot keeps what the
 * template needs once it is deleted. Clients send referenceId, objectType and sourceObjectId: the
 * server captures the name, the snapshot and the locations whenever the template is saved (see
 * replication-profile-object-reference.service.ts).
 */

/**
 * Object types a template can reference, named after FWCloud's object types. FWCloud calls "IP"
 * the services of an IP protocol (GRE, ESP...), hence `ipProtocol`; an IP address is an `address`.
 * Interfaces and VPN configurations belong to a firewall, so templates use roles and their own VPN
 * template for them instead.
 */
export const PROFILE_REFERENCE_OBJECT_TYPES = {
  ipProtocol: REPLICATION_PROFILE_IPOBJ_TYPE_IP,
  tcp: REPLICATION_PROFILE_IPOBJ_TYPE_TCP,
  icmp: REPLICATION_PROFILE_IPOBJ_TYPE_ICMP,
  udp: REPLICATION_PROFILE_IPOBJ_TYPE_UDP,
  address: REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS,
  range: REPLICATION_PROFILE_IPOBJ_TYPE_RANGE,
  network: REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK,
  host: REPLICATION_PROFILE_IPOBJ_TYPE_HOST,
  dns: REPLICATION_PROFILE_IPOBJ_TYPE_DNS,
  group: REPLICATION_PROFILE_IPOBJ_TYPE_GROUP,
  serviceGroup: REPLICATION_PROFILE_IPOBJ_TYPE_SERVICE_GROUP,
  continent: REPLICATION_PROFILE_IPOBJ_TYPE_CONTINENT,
  country: REPLICATION_PROFILE_IPOBJ_TYPE_COUNTRY,
} as const;

export type ProfileReferenceObjectType = keyof typeof PROFILE_REFERENCE_OBJECT_TYPES;

const OBJECT_TYPE_NAMES = Object.keys(
  PROFILE_REFERENCE_OBJECT_TYPES,
) as ProfileReferenceObjectType[];

/**
 * The ipobj columns an object is made of, named as the FWCloud objects API (/ipobj) names them.
 * Owner (fwcloud, interface) and audit columns are left out.
 */
export const PROFILE_OBJECT_DATA_FIELDS = [
  'type',
  'name',
  'protocol',
  'address',
  'netmask',
  'diff_serv',
  'ip_version',
  'icmp_type',
  'icmp_code',
  'tcp_flags_mask',
  'tcp_flags_settings',
  'range_start',
  'range_end',
  'source_port_start',
  'source_port_end',
  'destination_port_start',
  'destination_port_end',
  'options',
  'comment',
] as const;

const SERVICE_TYPES: readonly number[] = [
  REPLICATION_PROFILE_IPOBJ_TYPE_IP,
  REPLICATION_PROFILE_IPOBJ_TYPE_TCP,
  REPLICATION_PROFILE_IPOBJ_TYPE_ICMP,
  REPLICATION_PROFILE_IPOBJ_TYPE_UDP,
  REPLICATION_PROFILE_IPOBJ_TYPE_SERVICE_GROUP,
];

const PORT_FIELDS = [
  'source_port_start',
  'source_port_end',
  'destination_port_start',
  'destination_port_end',
];

/**
 * Fields the `data` of a replacement must hold, by object type. The rest of what the FWCloud
 * objects API asks for is filled in (see completeReplacementData()). Types missing here (hosts,
 * groups, continents, countries) can only be replaced by an existing object.
 */
const REPLACEMENT_DATA_FIELDS: Readonly<Record<number, readonly string[]>> = {
  [REPLICATION_PROFILE_IPOBJ_TYPE_IP]: ['protocol'],
  [REPLICATION_PROFILE_IPOBJ_TYPE_TCP]: PORT_FIELDS,
  [REPLICATION_PROFILE_IPOBJ_TYPE_ICMP]: ['icmp_type', 'icmp_code'],
  [REPLICATION_PROFILE_IPOBJ_TYPE_UDP]: PORT_FIELDS,
  [REPLICATION_PROFILE_IPOBJ_TYPE_ADDRESS]: ['address'],
  [REPLICATION_PROFILE_IPOBJ_TYPE_RANGE]: ['range_start', 'range_end'],
  [REPLICATION_PROFILE_IPOBJ_TYPE_NETWORK]: ['address', 'netmask'],
  // A DNS object is named by the DNS name it resolves.
  [REPLICATION_PROFILE_IPOBJ_TYPE_DNS]: ['name'],
};

/** Template-local identifiers: the charset of profile codes, so they are safe as JSON keys. */
const REFERENCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** Rule fields that take address objects; the service ones follow. */
export const RULE_OBJECT_FIELDS = [
  'source',
  'destination',
  'translatedSource',
  'translatedDestination',
];
const RULE_SERVICE_FIELDS = ['service', 'services', 'translatedService', 'translatedServices'];

/** What a template keeps of an external object. Only the server writes it. */
export interface ReplicationProfileObjectReference {
  /** Template-local identifier, stable across edits, that the usages point at. */
  referenceId: string;
  objectType: ProfileReferenceObjectType;
  /**
   * The object it was taken from. Only a way to find that object while it exists: it never
   * identifies the reference, and an id of another FWCloud finds nothing.
   */
  sourceObjectId?: number;
  /** Name of that object when the template was last saved. */
  sourceName: string;
  /**
   * Data of that object when the template was last saved, named as the FWCloud objects API
   * (/ipobj) names it: `type` and the fields of its type that hold a value. Hosts also keep their
   * interfaces with their addresses, and groups their members.
   */
  snapshot: ReplicationProfileRecord;
  /** Where the template uses it, as validation paths (`model.provision.rules[0].source[0]`). */
  locations: string[];
}

/** A reference as the API returns it, resolved against the FWCloud the profile is used from. */
export interface ResolvedProfileObjectReference extends ReplicationProfileObjectReference {
  /** Bound to an object: the original one or, when applying, its replacement. */
  resolved: boolean;
  /** Data of that object, with its id when it exists already. Null when unresolved. */
  currentObject: ReplicationProfileRecord | null;
  /** What a replacement must send: the fields of its `data`, or `sourceObjectId` alone. */
  requiredFields: string[];
}

/**
 * Replacement of a reference for one application (`objectReplacements`, keyed by referenceId).
 * It is input of that application only: the template is not changed.
 */
export interface ProfileObjectReplacement {
  /** An existing object of the same type in the FWCloud the profile is applied in. */
  sourceObjectId?: number;
  /** A new object, as the FWCloud objects API takes it (see requiredFields). */
  data?: ReplicationProfileRecord;
}

/** What every usage of a reference binds to when the profile is applied. */
export interface ProfileExternalObjectBinding {
  /** The existing object or group. Unset for replacement data, matched or created on apply. */
  id?: number;
  type: number;
  data: ReplicationProfileRecord;
}

/** A field of a template holding an external object. */
interface ProfileExternalObjectUsageSite {
  referenceId: string;
  path: string;
  /** Rule services and HAProxy ports take services; every other field takes address objects. */
  takesServices: boolean;
  /** IP family of the rule, for rule positions. */
  ipVersion?: ReplicationProfileIpVersion;
}

/** ipobj type of a reference objectType, undefined when it is not one. */
export function getProfileReferenceIpObjType(objectType: unknown): number | undefined {
  return isReplicationProfileStringValue(objectType, OBJECT_TYPE_NAMES)
    ? PROFILE_REFERENCE_OBJECT_TYPES[objectType]
    : undefined;
}

export function isProfileReferenceGroupType(type: number): boolean {
  return REPLICATION_PROFILE_IPOBJ_GROUP_TYPES.includes(type);
}

/** Fields the `data` of a replacement must hold; undefined when only an existing object will do. */
export function getProfileReferenceDataFields(type: number): readonly string[] | undefined {
  return REPLACEMENT_DATA_FIELDS[type];
}

/** See ResolvedProfileObjectReference.requiredFields. */
export function getProfileReferenceRequiredFields(type: number): string[] {
  return [...(getProfileReferenceDataFields(type) ?? ['sourceObjectId'])];
}

/** The references of a validated model. */
export function getProfileObjectReferences(model: unknown): ReplicationProfileObjectReference[] {
  const references = asReplicationProfileRecord(model)?.objectReferences;

  return Array.isArray(references) ? (references as ReplicationProfileObjectReference[]) : [];
}

/**
 * Where each reference is used by the block an application provisions (see
 * getProfileProvisioningSource()). The editor saves its structure twice, as `policyStructure` and
 * as `provision`, so only that block counts: the other one would list every usage twice.
 */
export function getProfileObjectReferenceLocations(model: unknown): Map<string, string[]> {
  const source = getProfileProvisioningSource(model);
  const locations = new Map<string, string[]>();

  for (const site of source ? collectUsageSites(source.value, `model.${source.field}`) : []) {
    locations.set(site.referenceId, [...(locations.get(site.referenceId) ?? []), site.path]);
  }

  return locations;
}

/**
 * Checks the reference list and every usage: references are well formed and declared once, and
 * usages name a declared reference from a field that takes external objects, fitting it: a service
 * where services go, an address object elsewhere, of the IP family of the rule. The snapshot is
 * only checked to be of the declared type, so a template stays loadable whatever its objects held.
 */
export function validateProfileObjectReferences(
  model: ReplicationProfileRecord,
): ReplicationProfileValidationError[] {
  const errors: ReplicationProfileValidationError[] = [];
  const addError = (path: string, message: string) =>
    errors.push({ code: 'invalid_object_reference', message, path, severity: 'error' });
  const references = new Map<string, ReplicationProfileRecord>();

  if (model.objectReferences !== undefined && !Array.isArray(model.objectReferences)) {
    addError('model.objectReferences', 'model.objectReferences must be an array.');
  }

  (Array.isArray(model.objectReferences) ? model.objectReferences : []).forEach((value, index) => {
    const path = `model.objectReferences[${index}]`;
    const reference = asReplicationProfileRecord(value);

    if (!reference) {
      addError(path, 'Object references must be objects.');
      return;
    }

    const referenceId = reference.referenceId;

    if (typeof referenceId !== 'string' || !REFERENCE_ID_PATTERN.test(referenceId)) {
      addError(
        `${path}.referenceId`,
        'referenceId must be 1-128 letters, digits, ".", "_" or "-", starting with a letter or digit.',
      );
      return;
    }

    if (references.has(referenceId)) {
      addError(
        `${path}.referenceId`,
        `Object reference "${referenceId}" is declared more than once.`,
      );
      return;
    }

    references.set(referenceId, reference);
    const type = getProfileReferenceIpObjType(reference.objectType);

    if (type === undefined) {
      addError(`${path}.objectType`, `objectType must be one of: ${OBJECT_TYPE_NAMES.join(', ')}.`);
    }

    if (
      reference.sourceObjectId !== undefined &&
      !isReplicationProfilePositiveInteger(reference.sourceObjectId)
    ) {
      addError(`${path}.sourceObjectId`, 'sourceObjectId must be a positive integer.');
    }

    if (asReplicationProfileNonEmptyString(reference.sourceName) === null) {
      addError(
        `${path}.sourceName`,
        'An object reference must keep the name of its object. Send the sourceObjectId of an object of this FWCloud, or the sourceName and snapshot the reference already had.',
      );
    }

    const snapshot = asReplicationProfileRecord(reference.snapshot);

    if (!snapshot) {
      addError(
        `${path}.snapshot`,
        'An object reference must keep a snapshot of its object. Send the sourceObjectId of an object of this FWCloud, or the snapshot the reference already had.',
      );
    } else if (type !== undefined && snapshot.type !== type) {
      addError(
        `${path}.snapshot.type`,
        `The snapshot of an object of type "${reference.objectType as string}" must have type ${type}.`,
      );
    }
  });

  const sites = ['provision', ...POLICY_STRUCTURE_FIELDS].flatMap((field) =>
    collectUsageSites(model[field], `model.${field}`),
  );
  const sitePaths = new Set(sites.map((site) => site.path));

  for (const site of sites) {
    const reference = references.get(site.referenceId);
    const type = getProfileReferenceIpObjType(reference?.objectType);
    const ipVersion = asReplicationProfileRecord(reference?.snapshot)?.ip_version;

    if (!reference) {
      addError(site.path, `"${site.referenceId}" is not declared in model.objectReferences.`);
    } else if (type !== undefined && SERVICE_TYPES.includes(type) !== site.takesServices) {
      addError(
        site.path,
        site.takesServices
          ? `"${site.referenceId}" (${reference.objectType as string}) is not a service.`
          : `"${site.referenceId}" (${reference.objectType as string}) is a service: only service positions take it.`,
      );
    } else if (
      site.ipVersion &&
      isReplicationProfileIpVersion(ipVersion) &&
      ipVersion !== site.ipVersion
    ) {
      addError(
        site.path,
        `"${site.referenceId}" is an IPv${ipVersion} object and cannot be used in an IPv${site.ipVersion} rule.`,
      );
    }
  }

  visitExternalObjectRecords(model, (record, path) => {
    if (
      !isReplicationProfileExternalObjectUsage(record) ||
      Object.keys(record).some((key) => key !== 'kind' && key !== 'referenceId')
    ) {
      addError(
        path,
        'An external object is used as { "kind": "external", "referenceId": "<id>" }; its data belongs to model.objectReferences.',
      );
    } else if (!sitePaths.has(path)) {
      addError(path, 'This field does not take external objects.');
    }
  });

  return errors;
}

/**
 * Usages of external objects in a provisioning block: rule positions, routes, routing rules and
 * the DHCP, Keepalived and HAProxy entries, the fields that take objects.
 */
function collectUsageSites(block: unknown, path: string): ProfileExternalObjectUsageSite[] {
  const sites: ProfileExternalObjectUsageSite[] = [];
  const record = asReplicationProfileRecord(block);
  const routing = asReplicationProfileRecord(record?.routing);
  const system = asReplicationProfileRecord(record?.system);
  const field = (
    value: unknown,
    fieldPath: string,
    takesServices: boolean,
    ipVersion?: ReplicationProfileIpVersion,
  ) =>
    (Array.isArray(value) ? value : [value]).forEach((item, index) => {
      if (isReplicationProfileExternalObjectUsage(item)) {
        sites.push({
          referenceId: item.referenceId,
          path: Array.isArray(value) ? `${fieldPath}[${index}]` : fieldPath,
          takesServices,
          ipVersion,
        });
      }
    });

  forEachRecord(record?.rules, `${path}.rules`, (rule, rulePath) => {
    const ipVersion = getReplicationProfileRuleIpVersion(rule);

    RULE_OBJECT_FIELDS.forEach((name) =>
      field(rule[name], `${rulePath}.${name}`, false, ipVersion),
    );
    RULE_SERVICE_FIELDS.forEach((name) => field(rule[name], `${rulePath}.${name}`, true));
  });
  forEachRecord(routing?.tables, `${path}.routing.tables`, (table, tablePath) =>
    forEachRecord(table.routes, `${tablePath}.routes`, (route, routePath) => {
      field(route.destination, `${routePath}.destination`, false);
      field(route.gateway, `${routePath}.gateway`, false);
    }),
  );
  forEachRecord(routing?.rules, `${path}.routing.rules`, (rule, rulePath) =>
    field(rule.from, `${rulePath}.from`, false),
  );
  forEachRecord(system?.dhcp, `${path}.system.dhcp`, (entry, entryPath) =>
    ['network', 'range', 'router', 'dns'].forEach((name) =>
      field(entry[name], `${entryPath}.${name}`, false),
    ),
  );
  forEachRecord(system?.keepalived, `${path}.system.keepalived`, (entry, entryPath) =>
    field(entry.virtualIps, `${entryPath}.virtualIps`, false),
  );
  forEachRecord(system?.haproxy, `${path}.system.haproxy`, (entry, entryPath) => {
    field(entry.frontendIp, `${entryPath}.frontendIp`, false);
    field(entry.backendIps, `${entryPath}.backendIps`, false);
    field(entry.frontendService, `${entryPath}.frontendService`, true);
    field(entry.backendService, `${entryPath}.backendService`, true);
  });

  return sites;
}

function forEachRecord(
  value: unknown,
  path: string,
  visit: (record: ReplicationProfileRecord, path: string) => void,
): void {
  (Array.isArray(value) ? value : []).forEach((item, index) => {
    const record = asReplicationProfileRecord(item);

    if (record) {
      visit(record, `${path}[${index}]`);
    }
  });
}

/** Every `{ kind: 'external' }` record of a model, its reference list aside, with its path. */
function visitExternalObjectRecords(
  model: ReplicationProfileRecord,
  visit: (record: ReplicationProfileRecord, path: string) => void,
): void {
  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }

    const record = asReplicationProfileRecord(value);

    if (record?.kind === REPLICATION_PROFILE_EXTERNAL_OBJECT_KIND) {
      visit(record, path);
    } else if (record) {
      Object.entries(record).forEach(([key, item]) => walk(item, `${path}.${key}`));
    }
  };

  Object.entries(model)
    .filter(([key]) => key !== 'objectReferences')
    .forEach(([key, value]) => walk(value, `model.${key}`));
}
