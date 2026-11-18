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
import { Firewall } from '../models/firewall/Firewall';
import { User } from '../models/user/User';
import { FwCloud } from '../models/fwcloud/FwCloud';
import { authorizeCloudMembership, loadPolicyUser } from './policy-authorization';

export class FirewallPolicy extends Policy {
  static async compile(firewall: Firewall, user: User): Promise<Authorization> {
    return this.authorizeFirewall(firewall, user);
  }

  static async ping(fwcloud: FwCloud, user: User): Promise<Authorization> {
    user = await loadPolicyUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }
    return authorizeCloudMembership(user, fwcloud.id);
  }

  static async info(fwcloud: FwCloud, user: User): Promise<Authorization> {
    return this.ping(fwcloud, user);
  }

  static async install(firewall: Firewall, user: User): Promise<Authorization> {
    return this.authorizeFirewall(firewall, user);
  }

  private static async authorizeFirewall(firewall: Firewall, user: User): Promise<Authorization> {
    user = await loadPolicyUser(user.id);
    if (user.role === 1) {
      return Authorization.grant();
    }

    if (firewall.fwCloudId) {
      return authorizeCloudMembership(user, firewall.fwCloudId);
    }
    return Authorization.revoke();
  }
}
