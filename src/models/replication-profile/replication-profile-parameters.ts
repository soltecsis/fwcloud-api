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

import {
  asReplicationProfileNonEmptyString,
  asReplicationProfileRecord,
  isReplicationProfilePort,
  isReplicationProfileStringValue,
  REPLICATION_PROFILE_PARAMETER_TYPES,
  REPLICATION_PROFILE_RULE_PROTOCOLS,
  ReplicationProfileParameterType,
  ReplicationProfileRuleProtocol,
} from './replication-profile.constants';

/**
 * A profile parameter is the unit that makes a template reusable: the profile
 * declares WHAT it needs ("the LAN network", "the service port"), and the
 * caller supplies the concrete value at apply time. Rules and interfaces refer
 * to parameters symbolically, so the same profile produces semantically
 * identical policy on firewalls whose objects are completely different.
 */
export interface ReplicationProfileParameter {
  name: string;
  type: ReplicationProfileParameterType;
  /** Human label shown by the wizard when asking for the value. */
  label?: string;
  description?: string;
  required: boolean;
  default?: unknown;
  /** Constrains address/network parameters to one IP family. */
  ipVersion?: 4 | 6;
}

/** Values supplied by the caller, keyed by parameter name. */
export type ReplicationProfileParameterValues = Record<string, unknown>;

/** A `{ "param": "LAN_NET" }` reference found inside a provision block. */
export interface ReplicationProfileParameterRef {
  param: string;
}

export interface ReplicationProfileAddressValue {
  address: string;
  /** Dotted mask for IPv4, prefix length for IPv6, always stored `/`-prefixed. */
  netmask: string;
  ipVersion: 4 | 6;
}

export interface ReplicationProfileRangeValue {
  start: string;
  end: string;
  ipVersion: 4 | 6;
}

export interface ReplicationProfileServiceValue {
  protocol: ReplicationProfileRuleProtocol;
  port: number;
}

/** Raised when a parameter is missing, unknown or holds an unusable value. */
export class ReplicationProfileParameterError extends Error {
  constructor(
    message: string,
    public readonly parameterName: string | null = null,
  ) {
    super(message);
    this.name = 'ReplicationProfileParameterError';
  }
}

/** Model fields a profile may declare its parameters in. */
export const PARAMETER_FIELDS = ['parameters', 'params'] as const;
const PARAMETER_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

export function isReplicationProfileParameterRef(
  value: unknown,
): value is ReplicationProfileParameterRef {
  const record = asReplicationProfileRecord(value);

  return !!record && asReplicationProfileNonEmptyString(record.param) !== null;
}

/**
 * Reads the parameter declarations of a profile model. Unknown or malformed
 * entries are dropped here; `ReplicationProfileValidationService` is the place
 * that reports them to the user.
 */
export function getProfileParameters(model: unknown): ReplicationProfileParameter[] {
  const record = asReplicationProfileRecord(model);

  if (!record) {
    return [];
  }

  const raw = PARAMETER_FIELDS.map((field) => record[field]).find((value) => Array.isArray(value));

  if (!Array.isArray(raw)) {
    return [];
  }

  const byName = new Map<string, ReplicationProfileParameter>();

  for (const item of raw) {
    const parameter = parseParameter(item);

    if (parameter && !byName.has(parameter.name)) {
      byName.set(parameter.name, parameter);
    }
  }

  return Array.from(byName.values());
}

export function isValidReplicationProfileParameterName(value: unknown): value is string {
  return typeof value === 'string' && PARAMETER_NAME_PATTERN.test(value);
}

function parseParameter(value: unknown): ReplicationProfileParameter | null {
  const record = asReplicationProfileRecord(value);

  if (!record) {
    return null;
  }

  const name = asReplicationProfileNonEmptyString(record.name);
  const type = record.type;

  if (
    !isValidReplicationProfileParameterName(name) ||
    !isReplicationProfileStringValue(type, REPLICATION_PROFILE_PARAMETER_TYPES)
  ) {
    return null;
  }

  const ipVersion = record.ipVersion ?? record.ip_version;

  return {
    name,
    type,
    label: asReplicationProfileNonEmptyString(record.label) ?? undefined,
    description: asReplicationProfileNonEmptyString(record.description) ?? undefined,
    // A parameter carrying a default is optional unless it says otherwise.
    required: record.required === undefined ? record.default === undefined : !!record.required,
    default: record.default,
    ipVersion: ipVersion === 4 || ipVersion === 6 ? ipVersion : undefined,
  };
}

/**
 * Resolves the effective value of every declared parameter, merging supplied
 * values over declared defaults. Throws on a missing required parameter so an
 * incomplete apply never reaches the database.
 */
export function resolveParameterValues(
  parameters: ReplicationProfileParameter[],
  supplied: ReplicationProfileParameterValues | undefined,
): Map<string, unknown> {
  const values = new Map<string, unknown>();
  const declared = new Set(parameters.map((parameter) => parameter.name));

  for (const name of Object.keys(supplied ?? {})) {
    if (!declared.has(name)) {
      throw new ReplicationProfileParameterError(`Unknown profile parameter "${name}".`, name);
    }
  }

  for (const parameter of parameters) {
    const value = supplied?.[parameter.name] ?? parameter.default;

    if (value === undefined || value === null || value === '') {
      if (parameter.required) {
        throw new ReplicationProfileParameterError(
          `Profile parameter "${parameter.name}" is required.`,
          parameter.name,
        );
      }

      continue;
    }

    values.set(parameter.name, value);
  }

  return values;
}

/** A raw value as error messages quote it. */
export function describeReplicationProfileValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Dereferences a literal or a `{ param }` reference. Returns undefined when an
 * optional parameter carries no value, so callers can skip the element.
 */
export function dereferenceParameter(value: unknown, values: Map<string, unknown>): unknown {
  if (!isReplicationProfileParameterRef(value)) {
    return value;
  }

  const name = asReplicationProfileNonEmptyString((value as ReplicationProfileParameterRef).param)!;

  if (!values.has(name)) {
    return undefined;
  }

  return values.get(name);
}

const IPV4_OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4_PATTERN = new RegExp(`^${IPV4_OCTET}(\\.${IPV4_OCTET}){3}$`);

/** Parses "10.0.0.1", "10.0.0.1/24" or "10.0.0.1/255.255.255.0". */
export function parseReplicationProfileAddress(
  value: unknown,
  expectedIpVersion?: 4 | 6,
): ReplicationProfileAddressValue | null {
  const raw = asReplicationProfileNonEmptyString(value);

  if (!raw) {
    return null;
  }

  const [addressPart, maskPart] = raw.split('/', 2);
  const ipVersion = detectIpVersion(addressPart);

  if (ipVersion === null || (expectedIpVersion && ipVersion !== expectedIpVersion)) {
    return null;
  }

  const netmask = normalizeNetmask(maskPart, ipVersion);

  return netmask === null ? null : { address: addressPart, netmask, ipVersion };
}

/**
 * Parses a network in CIDR form and returns its network address. A host bit
 * left set (10.0.0.5/24) is normalized down to 10.0.0.0/24 so two callers
 * writing the same subnet differently still resolve to a single object.
 */
export function parseReplicationProfileNetwork(
  value: unknown,
  expectedIpVersion?: 4 | 6,
): ReplicationProfileAddressValue | null {
  const parsed = parseReplicationProfileAddress(value, expectedIpVersion);

  if (!parsed || parsed.ipVersion !== 4) {
    // IPv6 networks are kept verbatim: prefix arithmetic is not needed to
    // deduplicate them because they are always written in canonical form.
    return parsed;
  }

  const prefix = netmaskToPrefix(parsed.netmask);

  if (prefix === null) {
    return null;
  }

  return { ...parsed, address: applyIpv4Prefix(parsed.address, prefix) };
}

/** Parses an address range written "10.0.0.10-10.0.0.20" (both ends of one IP family). */
export function parseReplicationProfileRange(
  value: unknown,
  expectedIpVersion?: 4 | 6,
): ReplicationProfileRangeValue | null {
  const raw = asReplicationProfileNonEmptyString(value);
  const parts = raw?.split('-').map((part) => part.trim());

  if (!parts || parts.length !== 2 || parts.some((part) => part.includes('/'))) {
    return null;
  }

  const [start, end] = parts.map((part) => parseReplicationProfileAddress(part, expectedIpVersion));

  if (!start || !end || start.ipVersion !== end.ipVersion) {
    return null;
  }

  if (start.ipVersion === 4 && ipv4ToNumber(start.address) > ipv4ToNumber(end.address)) {
    return null;
  }

  return { start: start.address, end: end.address, ipVersion: start.ipVersion };
}

export function parseReplicationProfilePort(value: unknown): number | null {
  const numeric = typeof value === 'string' ? Number(value.trim()) : value;

  return isReplicationProfilePort(numeric) ? (numeric as number) : null;
}

/** Parses `{protocol, port}` objects and the "tcp/800" shorthand. */
export function parseReplicationProfileService(
  value: unknown,
): ReplicationProfileServiceValue | null {
  const record = asReplicationProfileRecord(value);

  if (record) {
    const protocol = record.protocol;
    const port = parseReplicationProfilePort(record.port);

    return isReplicationProfileStringValue(protocol, REPLICATION_PROFILE_RULE_PROTOCOLS) &&
      port !== null
      ? { protocol, port }
      : null;
  }

  const shorthand = asReplicationProfileNonEmptyString(value)?.match(/^(tcp|udp)[/:](\d+)$/i);

  if (!shorthand) {
    return null;
  }

  const protocol = shorthand[1].toLowerCase();
  const port = parseReplicationProfilePort(shorthand[2]);

  return isReplicationProfileStringValue(protocol, REPLICATION_PROFILE_RULE_PROTOCOLS) &&
    port !== null
    ? { protocol, port }
    : null;
}

function detectIpVersion(address: string): 4 | 6 | null {
  if (IPV4_PATTERN.test(address)) {
    return 4;
  }

  // Deliberately permissive: the database column accepts any textual IPv6 and
  // stricter parsing belongs to the validation service.
  return /^[0-9A-Fa-f:]+$/.test(address) && address.includes(':') ? 6 : null;
}

function normalizeNetmask(maskPart: string | undefined, ipVersion: 4 | 6): string | null {
  if (maskPart === undefined) {
    return ipVersion === 4 ? '/32' : '/128';
  }

  const trimmed = maskPart.trim();

  if (IPV4_PATTERN.test(trimmed) && ipVersion === 4) {
    const prefix = dottedMaskToPrefix(trimmed);

    return prefix === null ? null : `/${prefix}`;
  }

  const prefix = Number(trimmed);
  const maxPrefix = ipVersion === 4 ? 32 : 128;

  return Number.isInteger(prefix) && prefix >= 0 && prefix <= maxPrefix ? `/${prefix}` : null;
}

function netmaskToPrefix(netmask: string): number | null {
  const prefix = Number(netmask.replace('/', ''));

  return Number.isInteger(prefix) && prefix >= 0 && prefix <= 32 ? prefix : null;
}

function dottedMaskToPrefix(mask: string): number | null {
  const value = ipv4ToNumber(mask);
  const prefix = 32 - Math.log2((~value >>> 0) + 1);

  return Number.isInteger(prefix) && prefix >= 0 && prefix <= 32 ? prefix : null;
}

function applyIpv4Prefix(address: string, prefix: number): string {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

  return numberToIpv4((ipv4ToNumber(address) & mask) >>> 0);
}

function ipv4ToNumber(address: string): number {
  return address
    .split('.')
    .reduce((accumulator, octet) => ((accumulator << 8) | Number(octet)) >>> 0, 0);
}

function numberToIpv4(value: number): string {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 0xff).join('.');
}
