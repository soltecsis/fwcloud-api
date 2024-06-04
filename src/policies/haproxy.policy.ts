import { getRepository } from "typeorm";
import { Authorization, Policy } from "../fonaments/authorization/policy";
import { Firewall } from "../models/firewall/Firewall";
import { FwCloud } from "../models/fwcloud/FwCloud";
import { User } from "../models/user/User";
import { HAProxyRule } from "../models/system/haproxy/haproxy_r/haproxy_r.model";

export class HAProxyPolicy extends Policy {
  static async create(firewall: Firewall, user: User): Promise<Authorization> {
    user = await this.getUser(user);
    firewall = await getRepository(Firewall).findOneOrFail(firewall.id, {
      relations: ["fwCloud"],
    });

    return this.checksAutorization(user, firewall);
  }

  static async show(rule: HAProxyRule, user: User): Promise<Authorization> {
    user = await this.getUser(user);
    const firewall = await getRepository(Firewall).findOneOrFail(
      rule.firewallId,
      {
        relations: ["fwCloud"],
      },
    );

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
    return getRepository(User).findOneOrFail(user.id, {
      relations: ["fwClouds"],
    });
  }
}
