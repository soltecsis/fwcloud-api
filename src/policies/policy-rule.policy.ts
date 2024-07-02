import { User } from './../models/user/User';
import { Firewall } from './../models/firewall/Firewall';
import { Policy, Authorization } from './../fonaments/authorization/policy';
import db from '../database/database-manager';

export class PolicyRulePolicy extends Policy {
  static async read(firewall: Firewall, user: User): Promise<Authorization> {
    user = await db
      .getSource()
      .manager.getRepository(User)
      .findOneOrFail({
        where: { id: user.id },
        relations: ['fwClouds'],
      });
    firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: { id: firewall.id },
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
  static async download(
    firewall: Firewall,
    user: User,
  ): Promise<Authorization> {
    user = await db
      .getSource()
      .manager.getRepository(User)
      .findOneOrFail({
        where: { id: user.id },
        relations: ['fwClouds'],
      });
    firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: { id: firewall.id },
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
}
