import { Policy, Authorization } from './../fonaments/authorization/policy';
import { User } from '../models/user/User';
import { Crt } from '../models/vpn/pki/Crt';
import db from '../database/database-manager';

export class CrtPolicy extends Policy {
  static async update(crt: Crt, user: User): Promise<Authorization> {
    user = await db
      .getSource()
      .manager.getRepository(User)
      .findOneOrFail({
        where: { id: user.id },
        relations: ['fwClouds'],
      });
    crt = await db
      .getSource()
      .manager.getRepository(Crt)
      .findOneOrFail({
        where: { id: crt.id },
        relations: ['ca', 'ca.fwCloud'],
      });
    if (user.role === 1) {
      return Authorization.grant();
    }

    const match = user.fwClouds.filter((fwcloud) => {
      return fwcloud.id === crt.ca.fwCloudId;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }
}
