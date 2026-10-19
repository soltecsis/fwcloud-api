import {
  asReplicationProfileNonEmptyString as text,
  asReplicationProfileRecord as record,
  type ReplicationProfileRecord,
} from './replication-profile.constants';
import {
  dereferenceParameter,
  getProfileParameters,
  parseReplicationProfileAddress,
  resolveParameterValues,
  type ReplicationProfileParameterValues,
} from './replication-profile-parameters';
import {
  getProfileProvisioningSource,
  type PolicyReplicationProvision,
  type PolicyReplicationProvisionAddress,
  type PolicyReplicationVpnConversion,
} from './policy-replication.types';

/**
 * Build an application-local IP representation without changing the stored VPN identity. The
 * existing object resolver owns IP reuse/creation, and creates nothing during a dry run.
 */
export function convertProfileVpnReferencesToIp(
  model: unknown,
  provision: PolicyReplicationProvision | null,
  supplied: ReplicationProfileParameterValues | undefined,
): {
  provision: PolicyReplicationProvision | null;
  vpnConversions: PolicyReplicationVpnConversion[];
  errors: string[];
} {
  const source = record(model);
  const template = record(source?.vpnTemplate);
  // Preserve the first matching client when legacy templates contain duplicate ids.
  const clients = new Map<unknown, ReplicationProfileRecord>();
  for (const value of Array.isArray(template?.connections) ? template.connections : []) {
    const connection = record(value);
    if (connection?.role === 'client' && !clients.has(connection.id)) {
      clients.set(connection.id, connection);
    }
  }
  const interfaceValues = new Map<string, PolicyReplicationProvisionAddress['value'][]>();
  for (const iface of provision?.interfaces ?? []) {
    for (const address of iface.addresses) {
      if (address.sourceParameter) {
        const overrides = interfaceValues.get(address.sourceParameter) ?? [];
        overrides.push(address.value);
        interfaceValues.set(address.sourceParameter, overrides);
      }
    }
  }
  const runtime = record(source?.vpnRuntime);
  const conversions = new Map<string, PolicyReplicationVpnConversion>();
  let values: Map<string, unknown>;
  let parameterError: string | undefined;
  try {
    values = resolveParameterValues(getProfileParameters(model), supplied);
  } catch (error) {
    values = new Map();
    parameterError = (error as Error).message;
  }

  // Inspect the raw provisioning source too: the parser may discard malformed references.
  const inspect = (value: unknown, path: string, family?: 4 | 6): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => inspect(item, `${path}[${index}]`, family));
      return;
    }
    const item = record(value);
    if (!item) return;
    const ipVersion = item.ipVersion ?? item.ip_version;
    const expectedFamily = ipVersion === 4 || ipVersion === 6 ? ipVersion : family;
    if (String((item.kind ?? item.type) as string).toLowerCase() !== 'vpnclient') {
      Object.entries(item).forEach(([field, entry]) =>
        inspect(entry, `${path}.${field}`, expectedFamily),
      );
      return;
    }
    const vpnId = text(item.vpnId) ?? text(item.vpnid) ?? path;
    const connection = clients.get(vpnId);
    const sourceName = text(connection?.name) ?? text(item.name) ?? vpnId;
    const conversion = conversions.get(vpnId) ?? {
      vpnId,
      sourceName,
      targetType: 'address' as const,
    };
    conversions.set(vpnId, conversion);
    const fail = (reason: string): void => {
      conversion.error = `VPN object "${sourceName}": ${reason}`;
    };
    if (!connection || !['openvpn', 'wireguard', 'ipsec'].includes(connection.kind as string)) {
      fail('the source client is missing or unsupported.');
      return;
    }
    if (parameterError) {
      fail(parameterError);
      return;
    }
    const binding = record(runtime?.[vpnId])?.network;
    let raw = binding === undefined ? connection.network : dereferenceParameter(binding, values);
    // An interface address override is authoritative when the VPN uses that same parameter.
    const parameter = text(record(binding)?.param);
    const overrides = (parameter && interfaceValues.get(parameter)) || [];
    if (overrides.length) {
      const distinct = new Set(overrides.map((value) => JSON.stringify(value)));
      if (distinct.size !== 1) {
        fail('the bound interface parameter has multiple destination IP values.');
        return;
      }
      raw = overrides[0];
    }
    const parsed =
      typeof raw === 'string' && raw.split('/').length <= 2
        ? parseReplicationProfileAddress(raw, expectedFamily)
        : null;
    if (!parsed) {
      fail(
        `no valid${expectedFamily ? ` IPv${expectedFamily}` : ' IP'} destination address was provided.`,
      );
      return;
    }
    conversion.address = parsed.address;
    conversion.netmask = parsed.netmask;
    conversion.ipVersion = parsed.ipVersion;
  };
  inspect(getProfileProvisioningSource(model), 'provision');

  const vpnConversions = [...conversions.values()];
  const errors = vpnConversions.flatMap((conversion) =>
    conversion.error ? [conversion.error] : [],
  );
  if (errors.length || !provision) return { provision, vpnConversions, errors };

  const replace = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(replace);
    const item = record(value);
    if (!item) return value;
    if (item.kind === 'vpnClient') {
      const vpnId = item.vpnId as string;
      const conversion = conversions.get(String(vpnId));
      // Completeness was checked on the unparsed source before any provisioning write.
      if (!conversion?.address) throw new Error(`VPN reference "${vpnId}" has no conversion plan.`);
      return {
        kind: 'address',
        name: conversion.sourceName,
        value: `${conversion.address}${conversion.netmask}`,
      };
    }
    return Object.fromEntries(
      Object.entries(item).map(([field, entry]) => [field, replace(entry)]),
    );
  };
  return { provision: replace(provision) as PolicyReplicationProvision, vpnConversions, errors };
}
