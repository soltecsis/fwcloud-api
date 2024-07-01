import { getRepository } from 'typeorm';
import { Policy, Authorization } from '../fonaments/authorization/policy';
import { User } from '../models/user/User';
import { KeepalivedRule } from '../models/system/keepalived/keepalived_r/keepalived_r.model';
import { Firewall } from '../models/firewall/Firewall';

export class KeepalivedPolicy extends Policy {
  static async index(firewall: Firewall, user: User): Promise<Authorization> {
    user = await getRepository(User).findOneOrFail(user.id, {
      relations: ['fwClouds'],
    });
    firewall = await getRepository(Firewall).findOneOrFail(firewall.id, {
      relations: ['fwCloud'],
    });

    if (user.role === 1) {
      return Authorization.grant();
    }

    const match = user.fwClouds.filter((fwcloud) => {
      return fwcloud.id === firewall.fwCloudId;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  static async show(
    keepalived: KeepalivedRule,
    user: User,
  ): Promise<Authorization> {
    user = await this.getUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    keepalived = await this.getKeepalivedR(keepalived.id);

    return this.checkAuthorization(user, keepalived.firewall.fwCloudId);
  }

  static async create(firewall: Firewall, user: User): Promise<Authorization> {
    user = await getRepository(User).findOneOrFail(user.id, {
      relations: ['fwClouds'],
    });
    firewall = await getRepository(Firewall).findOneOrFail(firewall.id, {
      relations: ['fwCloud'],
    });

    if (user.role === 1) {
      return Authorization.grant();
    }

    const match = user.fwClouds.filter((fwcloud) => {
      return fwcloud.id === firewall.fwCloudId;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  static async copy(
    keepalived: KeepalivedRule,
    user: User,
  ): Promise<Authorization> {
    user = await this.getUser(user.id);

    if (user.role === 1) {
      return Authorization.grant();
    }

    keepalived = await this.getKeepalivedR(keepalived.id);

    return this.checkAuthorization(user, keepalived.firewall.fwCloudId);
  }

  static async move(firewall: Firewall, user: User): Promise<Authorization> {
    user = await getRepository(User).findOneOrFail(user.id, {
      relations: ['fwClouds'],
    });
    firewall = await getRepository(Firewall).findOneOrFail(firewall.id, {
      relations: ['fwCloud'],
    });

    if (user.role === 1) {
      return Authorization.grant();
    }

    const match = user.fwClouds.filter((fwcloud) => {
      return fwcloud.id === firewall.fwCloudId;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  static async update(
    keepalived: KeepalivedRule,
    user: User,
  ): Promise<Authorization> {
    user = await this.getUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    keepalived = await this.getKeepalivedR(keepalived.id);

    return this.checkAuthorization(user, keepalived.firewall.fwCloudId);
  }

  static async delete(
    keepalived: KeepalivedRule,
    user: User,
  ): Promise<Authorization> {
    user = await this.getUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    keepalived = await this.getKeepalivedR(keepalived.id);

    return this.checkAuthorization(user, keepalived.firewall.fwCloudId);
  }

  private static async checkAuthorization(
    user: User,
    fwCloudId: number,
  ): Promise<Authorization> {
    const match = user.fwClouds.filter((fwcloud) => fwcloud.id === fwCloudId);

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  private static getKeepalivedR(keepalivedId: number): Promise<KeepalivedRule> {
    return getRepository(KeepalivedRule).findOneOrFail(keepalivedId, {
      relations: ['group', 'firewall', 'firewall.fwCloud'],
    });
  }

  private static getUser(userId: number): Promise<User> {
    return getRepository(User).findOneOrFail(userId, {
      relations: ['fwClouds'],
    });
  }
}
