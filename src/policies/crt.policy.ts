import { getRepository } from 'typeorm';
import { Policy, Authorization } from './../fonaments/authorization/policy';
import { User } from '../models/user/User';
import { Crt } from '../models/vpn/pki/Crt';

export class CrtPolicy extends Policy {
  static async update(crt: Crt, user: User): Promise<Authorization> {
    user = await getRepository(User).findOneOrFail(user.id, {
      relations: ['fwClouds'],
    });
    crt = await getRepository(Crt).findOneOrFail(crt.id, {
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
