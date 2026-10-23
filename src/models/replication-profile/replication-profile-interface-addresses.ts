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

import type {
  PolicyReplicationInterfaceAddressOverrides,
  PolicyReplicationProvision,
  PolicyReplicationProvisionAddress,
  PolicyReplicationProvisionInterface,
} from './policy-replication.types';
import {
  asReplicationProfileNonEmptyString,
  asReplicationProfileRecord,
  REPLICATION_PROFILE_IPOBJ_TYPE_BY_KIND,
} from './replication-profile.constants';
import {
  isReplicationProfileParameterRef,
  parseReplicationProfileAddress,
  ReplicationProfileParameter,
  ReplicationProfileParameterValues,
} from './replication-profile-parameters';
import { validateProfileObjectSnapshot } from './replication-profile-object-snapshot';

/**
 * Validates all chosen interface addresses before VPN or policy writes, then updates only the
 * provisioning block parsed for this application. The saved model and external objects keep
 * their own configurations.
 */
export async function applyInterfaceAddressOverrides(
  provision: PolicyReplicationProvision | null,
  overrides: PolicyReplicationInterfaceAddressOverrides | undefined,
  parameters: ReplicationProfileParameter[],
  parameterValues: ReplicationProfileParameterValues | undefined,
  fwCloudId: number,
): Promise<string[]> {
  if (overrides === undefined) {
    return [];
  }

  const record = asReplicationProfileRecord(overrides);
  if (!record) {
    return ['interfaceAddressOverrides must be an object mapping interface roles to addresses.'];
  }

  if (!provision) {
    return ['interfaceAddressOverrides requires a provisioning template.'];
  }

  const errors: string[] = [];
  const selected = new Map<
    PolicyReplicationProvisionInterface,
    PolicyReplicationProvisionAddress[]
  >();
  const interfaces = new Map(provision.interfaces.map((iface) => [iface.role, iface]));
  const parametersByName = new Map(parameters.map((parameter) => [parameter.name, parameter]));

  for (const [role, values] of Object.entries(record)) {
    const path = `interfaceAddressOverrides.${role}`;
    const iface = interfaces.get(role);
    if (!iface) {
      errors.push(`${path}: role "${role}" is not declared by the template interfaces.`);
      continue;
    }

    if (!Array.isArray(values) || values.length !== iface.addresses.length) {
      errors.push(`${path} must contain exactly ${iface.addresses.length} addresses.`);
      continue;
    }

    const addresses: PolicyReplicationProvisionAddress[] = [];
    const names = new Set<string>();
    for (const [index, value] of values.entries()) {
      const addressPath = `${path}[${index}]`;
      const data = asReplicationProfileRecord(value);
      if (!data) {
        errors.push(`${addressPath} must contain name and value, with an optional comment.`);
        continue;
      }

      const unknownFields = Object.keys(data).filter(
        (field) => !['name', 'value', 'comment'].includes(field),
      );
      if (unknownFields.length > 0) {
        errors.push(`${addressPath} does not take ${unknownFields.join(', ')}.`);
        continue;
      }

      const name = asReplicationProfileNonEmptyString(data.name);
      const raw = asReplicationProfileNonEmptyString(data.value);
      if (!name || !raw || (data.comment !== undefined && typeof data.comment !== 'string')) {
        errors.push(`${addressPath} requires a non-empty name and IP value, and a string comment.`);
        continue;
      }

      const nameKey = name.toLowerCase();
      if (names.has(nameKey)) {
        errors.push(
          `${addressPath}: IP name "${name}" is duplicated on interface "${iface.name}".`,
        );
        continue;
      }
      names.add(nameKey);

      const declared = iface.addresses[index];
      const sourceParameter = isReplicationProfileParameterRef(declared.value)
        ? declared.value.param
        : undefined;
      const parameter =
        sourceParameter === undefined ? undefined : parametersByName.get(sourceParameter);
      const originalValue =
        sourceParameter !== undefined
          ? (parameter?.default ?? parameterValues?.[sourceParameter])
          : declared.value;
      const expectedIpVersion =
        declared.ipVersion ??
        parameter?.ipVersion ??
        parseReplicationProfileAddress(originalValue)?.ipVersion;
      const parsed = parseReplicationProfileAddress(raw, expectedIpVersion);

      if (!parsed) {
        errors.push(
          `${addressPath}.value must contain a valid${expectedIpVersion ? ` IPv${expectedIpVersion}` : ' IP'} address and netmask.`,
        );
        continue;
      }

      const invalid = await validateProfileObjectSnapshot(
        {
          type: REPLICATION_PROFILE_IPOBJ_TYPE_BY_KIND.address,
          name,
          address: parsed.address,
          netmask: parsed.netmask,
          ip_version: parsed.ipVersion,
          ...(data.comment === undefined ? {} : { comment: data.comment }),
        },
        REPLICATION_PROFILE_IPOBJ_TYPE_BY_KIND.address,
        fwCloudId,
        { checkDestination: false },
      );
      if (invalid) {
        errors.push(`${addressPath}: ${invalid}`);
        continue;
      }

      addresses.push({
        ...declared,
        name,
        value: raw,
        ...(sourceParameter === undefined ? {} : { sourceParameter }),
        ...(data.comment === undefined ? {} : { comment: data.comment as string }),
        useSelectedConfiguration: true,
      });
    }
    selected.set(iface, addresses);
  }

  if (errors.length === 0) {
    for (const [iface, addresses] of selected) {
      iface.addresses = addresses;
    }
  }

  return errors;
}
