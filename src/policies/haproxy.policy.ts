import { Authorization, Policy } from '../fonaments/authorization/policy';
import { Firewall } from '../models/firewall/Firewall';
import { User } from '../models/user/User';
import { HAProxyRule } from '../models/system/haproxy/haproxy_r/haproxy_r.model';
import db from '../database/database-manager';
import {
  authorizeCloudMembership,
  authorizeFirewall,
  loadPolicyUser,
} from './policy-authorization';

export class HAProxyPolicy extends Policy {
  static async create(firewall: Firewall, user: User): Promise<Authorization> {
    return authorizeFirewall(firewall, user);
  }

  static async show(rule: HAProxyRule, user: User): Promise<Authorization> {
    user = await this.getUser(user);
    const firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: { id: rule.firewallId },
        relations: { fwCloud: true },
      });

    return this.checksAutorization(user, firewall);
  }

  protected static async checksAutorization(
    user: User,
    firewall: Firewall,
  ): Promise<Authorization> {
    if (user.role === 1) {
      return Authorization.grant();
    }

    return authorizeCloudMembership(user, firewall.fwCloud.id);
  }

  protected static async getUser(user: User): Promise<User> {
    return loadPolicyUser(user.id);
  }
}
