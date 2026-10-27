import type {
  PolicyReplicationProvision,
  PolicyReplicationProvisionAddress,
  PolicyReplicationProvisionInterface,
} from './policy-replication.types';
import {
  asReplicationProfileRecord,
  isReplicationProfileIpVersion,
  type ReplicationProfileIpVersion,
  type ReplicationProfileRecord,
} from './replication-profile.constants';
import {
  isReplicationProfileParameterRef,
  parseReplicationProfileAddress,
  type ReplicationProfileAddressValue,
} from './replication-profile-parameters';

function matchesDeclaredAddress(
  value: unknown,
  declared: PolicyReplicationProvisionAddress,
  declaredAddress: ReplicationProfileAddressValue | null,
): boolean {
  if (isReplicationProfileParameterRef(value)) {
    return (
      (isReplicationProfileParameterRef(declared.value) && value.param === declared.value.param) ||
      value.param === declared.sourceParameter
    );
  }
  if (isReplicationProfileParameterRef(declared.value)) {
    return false;
  }
  const address = parseReplicationProfileAddress(value);
  return (
    address !== null &&
    (declared.useSelectedConfiguration === true ||
      (declaredAddress !== null &&
        address.address === declaredAddress.address &&
        address.netmask === declaredAddress.netmask &&
        address.ipVersion === declaredAddress.ipVersion))
  );
}

/** Returns the first error for a reference, keeping value errors ahead of family errors. */
function getReferenceError(
  record: ReplicationProfileRecord,
  interfaces: ReadonlyMap<string, PolicyReplicationProvisionInterface>,
  ipVersion: ReplicationProfileIpVersion | undefined,
): string | undefined {
  const { kind, value, interfaceRole: role, interfaceAddressIndex: index } = record;
  if (
    kind !== 'address' ||
    typeof role !== 'string' ||
    role.trim() === '' ||
    typeof index !== 'number' ||
    !Number.isInteger(index) ||
    index < 0 ||
    value === undefined
  ) {
    return 'An interface IP reference requires kind "address", value, interfaceRole and a non-negative integer interfaceAddressIndex.';
  }

  const declared = interfaces.get(role)?.addresses[index];
  const label = `Interface IP reference "${role}" address #${index + 1}`;
  if (!declared) {
    return `${label} is not declared by the template.`;
  }

  const declaredAddress = parseReplicationProfileAddress(declared.value);
  if (!matchesDeclaredAddress(value, declared, declaredAddress)) {
    return `${label} does not match its declared value or parameter.`;
  }
  const declaredFamily = declared.ipVersion ?? declaredAddress?.ipVersion;
  if (ipVersion !== undefined && declaredFamily !== undefined && declaredFamily !== ipVersion) {
    return `${label} is not an IPv${ipVersion} address.`;
  }
}

/** A specific interface IP is identified by its declaration, independently of database IDs. */
export function getProvisionInterfaceAddressReferenceErrors(
  provision: PolicyReplicationProvision | null,
): { path: string; message: string }[] {
  const errors: { path: string; message: string }[] = [];
  if (!provision) {
    return errors;
  }
  const interfaces = new Map(provision.interfaces.map((iface) => [iface.role, iface]));

  const visit = (value: unknown, path: string, family?: ReplicationProfileIpVersion): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, family));
      return;
    }
    const record = asReplicationProfileRecord(value);
    if (!record) {
      return;
    }
    const ipVersion = isReplicationProfileIpVersion(record.ipVersion) ? record.ipVersion : family;
    if (
      record.interfaceAddressIndex !== undefined ||
      (Object.prototype.hasOwnProperty.call(record, 'kind') && record.interfaceRole !== undefined)
    ) {
      const message = getReferenceError(record, interfaces, ipVersion);
      if (message) {
        errors.push({ path, message });
      }
    }
    for (const [key, nested] of Object.entries(record)) {
      visit(nested, path ? `${path}.${key}` : key, ipVersion);
    }
  };

  visit(provision, '');
  return errors;
}
