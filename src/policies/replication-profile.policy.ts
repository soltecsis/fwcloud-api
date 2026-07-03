/*!
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { FwCloudPolicy } from './fwcloud.policy';

/**
 * Authorization rules for the assistant replication profiles: listing the
 * catalog, reading a profile detail and applying a profile to a firewall or
 * cluster of a FWCloud. Every operation requires access to the FWCloud the
 * profile is being used in.
 */
export class ReplicationProfilePolicy extends Policy {
  static async index(user: User, fwCloud: FwCloud): Promise<Authorization> {
    return this.access(user, fwCloud);
  }

  static async show(user: User, fwCloud: FwCloud): Promise<Authorization> {
    return this.access(user, fwCloud);
  }

  static async create(user: User, fwCloud: FwCloud): Promise<Authorization> {
    return this.access(user, fwCloud);
  }

  static async clone(user: User, fwCloud: FwCloud): Promise<Authorization> {
    return this.access(user, fwCloud);
  }

  static async update(user: User, fwCloud: FwCloud): Promise<Authorization> {
    return this.access(user, fwCloud);
  }

  static async delete(user: User, fwCloud: FwCloud): Promise<Authorization> {
    return this.access(user, fwCloud);
  }

  static async apply(user: User, fwCloud: FwCloud): Promise<Authorization> {
    return this.access(user, fwCloud);
  }

  static async store(user: User, fwCloud: FwCloud): Promise<Authorization> {
    return this.create(user, fwCloud);
  }

  static async storeVersion(user: User, fwCloud: FwCloud): Promise<Authorization> {
    return this.update(user, fwCloud);
  }

  static async destroy(user: User, fwCloud: FwCloud): Promise<Authorization> {
    return this.delete(user, fwCloud);
  }

  private static async access(user: User, fwCloud: FwCloud): Promise<Authorization> {
    return FwCloudPolicy.userCanAccessFwCloud(user, fwCloud);
  }
}
