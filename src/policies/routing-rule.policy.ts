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

import { Policy, Authorization } from "../fonaments/authorization/policy";
import { Firewall } from "../models/firewall/Firewall";
import { User } from "../models/user/User";
import { getRepository } from "typeorm";
import { RoutingRule } from "../models/routing/routing-rule/routing-rule.model";

export class RoutingRulePolicy extends Policy {
  static async create(firewall: Firewall, user: User): Promise<Authorization> {
    user = await getRepository(User).findOneOrFail(user.id, {
      relations: ["fwClouds"],
    });
    firewall = await getRepository(Firewall).findOneOrFail(firewall.id, {
      relations: ["fwCloud"],
    });

    if (user.role === 1) {
      return Authorization.grant();
    }

    const match = user.fwClouds.filter((fwcloud) => {
      return fwcloud.id === firewall.fwCloudId;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  static async index(firewall: Firewall, user: User): Promise<Authorization> {
    user = await getRepository(User).findOneOrFail(user.id, {
      relations: ["fwClouds"],
    });
    firewall = await getRepository(Firewall).findOneOrFail(firewall.id, {
      relations: ["fwCloud"],
    });

    if (user.role === 1) {
      return Authorization.grant();
    }

    const match = user.fwClouds.filter((fwcloud) => {
      return fwcloud.id === firewall.fwCloudId;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  static async show(rule: RoutingRule, user: User): Promise<Authorization> {
    user = await getRepository(User).findOneOrFail(user.id, {
      relations: ["fwClouds"],
    });
    rule = await getRepository(RoutingRule).findOneOrFail(rule.id, {
      relations: [
        "routingTable",
        "routingTable.firewall",
        "routingTable.firewall.fwCloud",
      ],
    });

    if (user.role === 1) {
      return Authorization.grant();
    }

    const match = user.fwClouds.filter((fwcloud) => {
      return fwcloud.id === rule.routingTable.firewall.fwCloudId;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  static async update(rule: RoutingRule, user: User): Promise<Authorization> {
    user = await getRepository(User).findOneOrFail(user.id, {
      relations: ["fwClouds"],
    });
    rule = await getRepository(RoutingRule).findOneOrFail(rule.id, {
      relations: [
        "routingTable",
        "routingTable.firewall",
        "routingTable.firewall.fwCloud",
      ],
    });

    if (user.role === 1) {
      return Authorization.grant();
    }

    const match = user.fwClouds.filter((fwcloud) => {
      return fwcloud.id === rule.routingTable.firewall.fwCloudId;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }

  static async delete(rule: RoutingRule, user: User): Promise<Authorization> {
    user = await getRepository(User).findOneOrFail(user.id, {
      relations: ["fwClouds"],
    });
    rule = await getRepository(RoutingRule).findOneOrFail(rule.id, {
      relations: [
        "routingTable",
        "routingTable.firewall",
        "routingTable.firewall.fwCloud",
      ],
    });

    if (user.role === 1) {
      return Authorization.grant();
    }

    const match = user.fwClouds.filter((fwcloud) => {
      return fwcloud.id === rule.routingTable.firewall.fwCloudId;
    });

    return match.length > 0 ? Authorization.grant() : Authorization.revoke();
  }
}
