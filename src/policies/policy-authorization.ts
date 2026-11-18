import { Authorization } from '../fonaments/authorization/policy';
import db from '../database/database-manager';
import { Firewall } from '../models/firewall/Firewall';
import { User } from '../models/user/User';
import { EntityTarget } from 'typeorm';

export function loadPolicyUser(userId: number): Promise<User> {
  return db
    .getSource()
    .manager.getRepository(User)
    .findOneOrFail({
      where: { id: userId },
      relations: { fwClouds: true },
    });
}

/** The caller must load the user and any required resources before checking access. */
export function authorizeCloudMembership(user: User, fwCloudId: number): Authorization {
  return user.role === 1 || user.fwClouds.some((cloud) => cloud.id === fwCloudId)
    ? Authorization.grant()
    : Authorization.revoke();
}

/** Preserve resource validation before the administrator bypass. */
export async function authorizeFirewall(firewall: Firewall, user: User): Promise<Authorization> {
  user = await loadPolicyUser(user.id);
  firewall = await db
    .getSource()
    .manager.getRepository(Firewall)
    .findOneOrFail({
      where: { id: firewall.id },
      relations: { fwCloud: true },
    });
  return authorizeCloudMembership(user, firewall.fwCloudId);
}

/** VPNs are validated before the administrator bypass, firewalls afterwards. */
export async function authorizeVPN(
  entity: EntityTarget<{ id: number; firewall: Firewall }>,
  vpnId: number,
  user: User,
): Promise<Authorization> {
  user = await loadPolicyUser(user.id);
  const vpn = await db
    .getSource()
    .manager.getRepository(entity)
    .findOneOrFail({
      where: { id: vpnId },
      relations: { firewall: true },
    });
  if (user.role === 1) {
    return Authorization.grant();
  }
  if (!vpn.firewall) {
    return Authorization.revoke();
  }
  const firewall = await db
    .getSource()
    .manager.getRepository(Firewall)
    .findOneOrFail({
      where: { id: vpn.firewall.id },
      relations: { fwCloud: true },
    });
  return authorizeCloudMembership(user, firewall.fwCloudId);
}
