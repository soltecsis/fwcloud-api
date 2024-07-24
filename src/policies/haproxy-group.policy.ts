import { Policy } from '../fonaments/authorization/policy';
import { Authorization } from '../fonaments/authorization/policy';
import { Firewall } from '../models/firewall/Firewall';
import { User } from '../models/user/User';
import { HAProxyGroup } from '../models/system/haproxy/haproxy_g/haproxy_g.model';
import { FwCloud } from '../models/fwcloud/FwCloud';
import db from '../database/database-manager';

export class HAProxyGroupPolicy extends Policy {
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

  static async show(group: HAProxyGroup, user: User): Promise<Authorization> {
    user = await this.getUser(user);
    await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: { id: group.firewall.id },
        relations: ['fwCloud'],
      });

    return this.checksAutorization(user, group.firewall);
  }

  protected static async checksAutorization(
    user: User,
    firewall: Firewall,
  ): Promise<Authorization> {
    return new Promise<Authorization>((resolve, reject) => {
      try {
        if (user.role === 1) {
          return Authorization.grant();
        }

        const match: FwCloud[] = user.fwClouds.filter((fwCloud: FwCloud) => {
          return fwCloud.id === firewall.fwCloud.id;
        });

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
      } catch (e) {
        reject(e);
      }
    });
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
