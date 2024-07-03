import { Authorization, Policy } from '../fonaments/authorization/policy';
import { Firewall } from '../models/firewall/Firewall';
import { FwCloud } from '../models/fwcloud/FwCloud';
import { User } from '../models/user/User';
import { HAProxyRule } from '../models/system/haproxy/haproxy_r/haproxy_r.model';
import db from '../database/database-manager';

export class HAProxyPolicy extends Policy {
  static async create(firewall: Firewall, user: User): Promise<Authorization> {
    user = await this.getUser(user);
    firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: { id: firewall.id },
        relations: ['fwCloud'],
      });

    return this.checksAutorization(user, firewall);
  }

  static async show(rule: HAProxyRule, user: User): Promise<Authorization> {
    user = await this.getUser(user);
    const firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: { id: rule.firewallId },
        relations: ['fwCloud'],
      });

    return this.checksAutorization(user, rule.firewall);
  }

  protected static async checksAutorization(
    user: User,
    firewall: Firewall,
  ): Promise<Authorization> {
    if (user.role === 1) {
      return Authorization.grant();
    }

    const match: FwCloud[] = user.fwClouds.filter((fwCloud: FwCloud) => {
      return fwCloud.id === firewall.fwCloud.id;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  protected static async getUser(user: User): Promise<User> {
    return db
      .getSource()
      .manager.getRepository(User)
      .findOneOrFail({
        where: { id: user.id },
        relations: ['fwClouds'],
      });
  }
}
