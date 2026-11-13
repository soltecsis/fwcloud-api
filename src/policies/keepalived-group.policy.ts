import { Authorization, Policy } from '../fonaments/authorization/policy';
import { Firewall } from '../models/firewall/Firewall';
import { User } from '../models/user/User';
import { KeepalivedGroup } from '../models/system/keepalived/keepalived_g/keepalived_g.model';
import db from '../database/database-manager';
import { authorizeCloudMembership, loadPolicyUser } from './policy-authorization';

export class KeepalivedGroupPolicy extends Policy {
  static async index(firewall: Firewall, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOne({
        where: { id: firewall.id },
        relations: { fwCloud: true },
      });
    return this.checkAuthorization(user, firewall);
  }

  static async show(group: KeepalivedGroup, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    const firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOne({
        where: { id: group.firewallId },
        relations: { fwCloud: true },
      });
    return this.checkAuthorization(user, firewall);
  }

  static async create(firewall: Firewall, user: User): Promise<Authorization> {
    return this.index(firewall, user);
  }

  static async update(group: KeepalivedGroup, user: User): Promise<Authorization> {
    return this.show(group, user);
  }

  static async remove(group: KeepalivedGroup, user: User): Promise<Authorization> {
    return this.show(group, user);
  }

  protected static async checkAuthorization(
    user: User,
    firewall: Firewall,
  ): Promise<Authorization> {
    if (user.role === 1) {
      return Authorization.grant();
    }

    return authorizeCloudMembership(user, firewall.fwCloud.id);
  }

  protected static async getUser(id: number): Promise<User> {
    return loadPolicyUser(id);
  }
}
