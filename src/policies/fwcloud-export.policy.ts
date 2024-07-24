/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import db from '../database/database-manager';
import { Policy, Authorization } from '../fonaments/authorization/policy';
import { FwCloud } from '../models/fwcloud/FwCloud';
import { User } from '../models/user/User';

export class FwCloudExportPolicy extends Policy {
  static async store(fwCloud: FwCloud, user: User): Promise<Authorization> {
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

    const match = user.fwClouds.filter((f) => {
      return f.id === fwCloud.id;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  static async import(user: User): Promise<Authorization> {
    return new Promise<Authorization>((resolve, reject) => {
      try {
        resolve(user.role === 1 ? Authorization.grant() : Authorization.revoke());
      } catch (e) {
        reject(e);
      }
    });
  }
}
