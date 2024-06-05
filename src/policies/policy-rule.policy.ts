import { getRepository } from 'typeorm';
import { User } from './../models/user/User';
import { Firewall } from './../models/firewall/Firewall';
import { Policy, Authorization } from './../fonaments/authorization/policy';

export class PolicyRulePolicy extends Policy {
  static async read(firewall: Firewall, user: User): Promise<Authorization> {
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
  static async download(
    firewall: Firewall,
    user: User,
  ): Promise<Authorization> {
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
}
