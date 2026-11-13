import { Policy, Authorization } from '../fonaments/authorization/policy';
import { User } from '../models/user/User';
import { KeepalivedRule } from '../models/system/keepalived/keepalived_r/keepalived_r.model';
import { Firewall } from '../models/firewall/Firewall';
import db from '../database/database-manager';
import {
  authorizeCloudMembership,
  authorizeFirewall,
  loadPolicyUser,
} from './policy-authorization';

export class KeepalivedPolicy extends Policy {
  static async index(firewall: Firewall, user: User): Promise<Authorization> {
    return authorizeFirewall(firewall, user);
  }

  static async show(keepalived: KeepalivedRule, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    keepalived = await this.getKeepalivedR(keepalived.id);

    return this.checkAuthorization(user, keepalived.firewall.fwCloudId);
  }

  static async create(firewall: Firewall, user: User): Promise<Authorization> {
    return authorizeFirewall(firewall, user);
  }

  static async copy(keepalived: KeepalivedRule, user: User): Promise<Authorization> {
    return this.show(keepalived, user);
  }

  static async move(firewall: Firewall, user: User): Promise<Authorization> {
    return authorizeFirewall(firewall, user);
  }

  static async update(keepalived: KeepalivedRule, user: User): Promise<Authorization> {
    return this.show(keepalived, user);
  }

  static async delete(keepalived: KeepalivedRule, user: User): Promise<Authorization> {
    return this.show(keepalived, user);
  }

  private static async checkAuthorization(user: User, fwCloudId: number): Promise<Authorization> {
    return authorizeCloudMembership(user, fwCloudId);
  }

  private static getKeepalivedR(keepalivedId: number): Promise<KeepalivedRule> {
    return db
      .getSource()
      .manager.getRepository(KeepalivedRule)
      .findOneOrFail({
        where: { id: keepalivedId },
        relations: { group: true, firewall: { fwCloud: true } },
      });
  }

  private static getUser(userId: number): Promise<User> {
    return loadPolicyUser(userId);
  }
}
