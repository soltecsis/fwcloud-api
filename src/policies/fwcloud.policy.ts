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

import { Policy, Authorization } from '../fonaments/authorization/policy';
import { User } from '../models/user/User';
import { FwCloud } from '../models/fwcloud/FwCloud';

export class FwCloudPolicy extends Policy {
  static async store(user: User): Promise<Authorization> {
    return user.role === 1 ? Authorization.grant() : Authorization.revoke();
  }

  static async update(user: User): Promise<Authorization> {
    return user.role === 1 ? Authorization.grant() : Authorization.revoke();
  }

  static async colors(user: User, fwCloud: FwCloud): Promise<Authorization> {
    if (user.role === 1) {
      return Authorization.grant();
    }

    user = await User.findOne({
      where: { id: user.id },
      relations: ['fwClouds'],
    });
    return user.fwClouds.findIndex((item) => item.id === fwCloud.id) >= 0
      ? Authorization.grant()
      : Authorization.revoke();
  }
}
