/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { Snapshot } from '../snapshots/snapshot';
import { User } from '../models/user/User';
import { FwCloud } from '../models/fwcloud/FwCloud';
import { authorizeCloudMembership } from './policy-authorization';

export class SnapshotPolicy extends Policy {
  static async read(snapshot: Snapshot, user: User): Promise<Authorization> {
    return this.authorizeSnapshot(snapshot, user);
  }

  static async create(fwcloud: FwCloud, user: User): Promise<Authorization> {
    user = await User.findOneOrFail({
      where: { id: user.id },
      relations: { fwClouds: true },
    });

    if (user.role === 1) {
      return Authorization.grant();
    }

    return authorizeCloudMembership(user, fwcloud.id);
  }

  static async update(snapshot: Snapshot, user: User): Promise<Authorization> {
    return this.authorizeSnapshot(snapshot, user);
  }

  static async restore(snapshot: Snapshot, user: User): Promise<Authorization> {
    return this.authorizeSnapshot(snapshot, user);
  }

  static async destroy(snapshot: Snapshot, user: User): Promise<Authorization> {
    return this.authorizeSnapshot(snapshot, user);
  }

  private static async authorizeSnapshot(snapshot: Snapshot, user: User): Promise<Authorization> {
    user = await User.findOneOrFail({
      where: { id: user.id },
      relations: { fwClouds: true },
    });

    if (user.role === 1) {
      return Authorization.grant();
    }

    if (snapshot.fwCloud) {
      return authorizeCloudMembership(user, snapshot.fwCloud.id);
    }
    return Authorization.revoke();
  }
}
