import { Authorization, Policy } from '../fonaments/authorization/policy';
import { Firewall } from '../models/firewall/Firewall';
import { User } from '../models/user/User';
import { KeepalivedGroup } from '../models/system/keepalived/keepalived_g/keepalived_g.model';
import db from '../database/database-manager';

export class KeepalivedGroupPolicy extends Policy {
  static async index(firewall: Firewall, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOne({
        where: { id: firewall.id },
        relations: ['fwCloud'],
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
        relations: ['fwCloud'],
      });
    return this.checkAuthorization(user, firewall);
  }

  static async create(firewall: Firewall, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOne({
        where: { id: firewall.id },
        relations: ['fwCloud'],
      });
    return this.checkAuthorization(user, firewall);
  }

  static async update(group: KeepalivedGroup, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    const firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOne({
        where: { id: group.firewallId },
        relations: ['fwCloud'],
      });
    return this.checkAuthorization(user, firewall);
  }

  static async remove(group: KeepalivedGroup, user: User): Promise<Authorization> {
    user = await this.getUser(user.id);
    const firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOne({
        where: { id: group.firewallId },
        relations: ['fwCloud'],
      });
    return this.checkAuthorization(user, firewall);
  }

  protected static async checkAuthorization(
    user: User,
    firewall: Firewall,
  ): Promise<Authorization> {
    return new Promise<Authorization>((resolve, reject) => {
      try {
        if (user.role === 1) {
          resolve(Authorization.grant());
        }

        const match = user.fwClouds.filter((fwcloud) => {
          return fwcloud.id === firewall.fwCloud.id;
        });

        resolve(match.length > 0 ? Authorization.grant() : Authorization.revoke());
      } catch (e) {
        reject(e);
      }
    });
  }

  protected static async getUser(id: number): Promise<User> {
    return db
      .getSource()
      .manager.getRepository(User)
      .findOneOrFail({
        where: { id },
        relations: ['fwClouds'],
      });
  }
}
