import type { PolicyReplicationProvision } from './policy-replication.types';
import type { ReplicationProfileTargetKind } from './replication-profile.constants';

/** Convert an application-local plan as FWCloud converts a cluster policy to a firewall. */
export function convertProfileProvisionTarget(
  provision: PolicyReplicationProvision | null,
  targetKind: ReplicationProfileTargetKind,
): { provision: PolicyReplicationProvision | null; warnings: string[] } {
  if (!provision || targetKind === 'cluster') return { provision, warnings: [] };

  const countRestricted = (entries: { nodeRole?: string }[]) =>
    entries.reduce((count, entry) => count + Number(entry.nodeRole !== undefined), 0);
  const policyRestricted = countRestricted(provision.rules);
  const keepalivedRestricted = countRestricted(provision.system.keepalived);
  const warnings: string[] = [];
  if (policyRestricted || keepalivedRestricted) {
    warnings.push(
      `Template topology conversion: removed cluster-node restrictions from ${policyRestricted} policy rule(s) and ${keepalivedRestricted} Keepalived rule(s) for the standalone firewall.`,
    );
  }
  if (provision.system.keepalived.length) {
    warnings.push(
      `Keepalived: ${provision.system.keepalived.length} configuration(s) will be retained on the standalone firewall. In FWCloud, their policy can be managed after converting the firewall to a cluster.`,
    );
  }
  if (!policyRestricted && !keepalivedRestricted) return { provision, warnings };

  // Keep every configuration and its native values. Only the target-specific node restriction
  // changes; the parsed source plan and the saved template remain untouched.
  const withoutNode = <T extends { nodeRole?: string }>(entry: T): T => {
    const copy = { ...entry };
    delete copy.nodeRole;
    return copy;
  };
  return {
    provision: {
      ...provision,
      rules: provision.rules.map(withoutNode),
      system: {
        ...provision.system,
        keepalived: provision.system.keepalived.map(withoutNode),
      },
    },
    warnings,
  };
}
