import { getRepository } from 'typeorm';
import { Policy } from '../fonaments/authorization/policy';
import { Authorization } from '../fonaments/authorization/policy';
import { Firewall } from '../models/firewall/Firewall';
import { User } from '../models/user/User';
import { HAProxyGroup } from '../models/system/haproxy/haproxy_g/haproxy_g.model';
import { FwCloud } from '../models/fwcloud/FwCloud';

export class HAProxyGroupPolicy extends Policy {
  static async create(firewall: Firewall, user: User): Promise<Authorization> {
    user = await this.getUser(user);
    firewall = await getRepository(Firewall).findOneOrFail(firewall.id, {
      relations: ['fwCloud'],
    });

    return this.checksAutorization(user, firewall);
  }

  static async show(group: HAProxyGroup, user: User): Promise<Authorization> {
    user = await this.getUser(user);
    const firewall = await getRepository(Firewall).findOneOrFail(
      group.firewall.id,
      {
        relations: ['fwCloud'],
      },
    );

    return this.checksAutorization(user, group.firewall);
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
    return getRepository(User).findOneOrFail(user.id, {
      relations: ['fwClouds'],
    });
  }
}
