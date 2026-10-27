import type { PolicyReplicationProvision } from './policy-replication.types';
import { asReplicationProfileRecord } from './replication-profile.constants';
import {
  isReplicationProfileParameterRef,
  parseReplicationProfileAddress,
} from './replication-profile-parameters';

/** A specific interface IP is identified by its declaration, independently of database IDs. */
export function getProvisionInterfaceAddressReferenceErrors(
  provision: PolicyReplicationProvision | null,
): { path: string; message: string }[] {
  const errors: { path: string; message: string }[] = [];
  if (!provision) {
    return errors;
  }
  const interfaces = new Map(provision.interfaces.map((iface) => [iface.role, iface]));

  const visit = (value: unknown, path: string, family?: 4 | 6): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, family));
      return;
    }
    const record = asReplicationProfileRecord(value);
    if (!record) {
      return;
    }
    const ipVersion = record.ipVersion === 4 || record.ipVersion === 6 ? record.ipVersion : family;
    if (
      record.interfaceAddressIndex !== undefined ||
      (Object.prototype.hasOwnProperty.call(record, 'kind') && record.interfaceRole !== undefined)
    ) {
      const role = record.interfaceRole;
      const index = record.interfaceAddressIndex;
      let message: string | undefined;
      if (
        record.kind !== 'address' ||
        typeof role !== 'string' ||
        role.trim() === '' ||
        typeof index !== 'number' ||
        !Number.isInteger(index) ||
        index < 0 ||
        record.value === undefined
      ) {
        message =
          'An interface IP reference requires kind "address", value, interfaceRole and a non-negative integer interfaceAddressIndex.';
      } else {
        const iface = interfaces.get(role);
        const declared = iface?.addresses[index];
        if (!declared) {
          message = `Interface IP reference "${role}" address #${index + 1} is not declared by the template.`;
        } else {
          const selectedParameter = declared.sourceParameter;
          const sameValue = isReplicationProfileParameterRef(record.value)
            ? (isReplicationProfileParameterRef(declared.value) &&
                record.value.param === declared.value.param) ||
              record.value.param === selectedParameter
            : !isReplicationProfileParameterRef(declared.value) &&
              parseReplicationProfileAddress(record.value) !== null &&
              (declared.useSelectedConfiguration === true ||
                JSON.stringify(parseReplicationProfileAddress(record.value)) ===
                  JSON.stringify(parseReplicationProfileAddress(declared.value)));
          const declaredFamily =
            declared.ipVersion ?? parseReplicationProfileAddress(declared.value)?.ipVersion;
          if (!sameValue) {
            message = `Interface IP reference "${role}" address #${index + 1} does not match its declared value or parameter.`;
          } else if (
            ipVersion !== undefined &&
            declaredFamily !== undefined &&
            declaredFamily !== ipVersion
          ) {
            message = `Interface IP reference "${role}" address #${index + 1} is not an IPv${ipVersion} address.`;
          }
        }
      }
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
