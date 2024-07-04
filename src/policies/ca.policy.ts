import { Policy, Authorization } from './../fonaments/authorization/policy';
import { User } from '../models/user/User';
import { Ca } from '../models/vpn/pki/Ca';
import db from '../database/database-manager';

export class CaPolicy extends Policy {
  static async update(ca: Ca, user: User): Promise<Authorization> {
    user = await db
      .getSource()
      .manager.getRepository(User)
      .findOneOrFail({
        where: { id: user.id },
        relations: ['fwClouds'],
      });

    if (user.role === 1) {
      return Authorization.grant();
    }

    const match = user.fwClouds.filter((fwcloud) => {
      return fwcloud.id === ca.fwCloudId;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }
}
