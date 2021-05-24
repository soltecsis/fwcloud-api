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

import { EntityRepository, Repository, SelectQueryBuilder } from "typeorm";
import { Route } from "./route.model";

export interface FindOneWithinFwCloud {
    id: number;
    routingTableId: number;
    firewallId: number;
    fwCloudId: number;
}

@EntityRepository(Route)
export class RouteRepository extends Repository<Route> {
    findOneWithinFwCloud(criteria: FindOneWithinFwCloud): Promise<Route | undefined> {
        return this.getFindOneWithinFwCloudQueryBuilder(criteria).getOne();
    }

    findOneWithinFwCloudOrFail(criteria: FindOneWithinFwCloud): Promise<Route> {
        return this.getFindOneWithinFwCloudQueryBuilder(criteria).getOneOrFail();
    }

    protected getFindOneWithinFwCloudQueryBuilder(criteria: FindOneWithinFwCloud): SelectQueryBuilder<Route> {
        return this.createQueryBuilder("route")
            .innerJoinAndSelect("route.routingTable", "table")
            .innerJoinAndSelect("table.firewall", "firewall")
            .innerJoinAndSelect("firewall.fwCloud", "fwcloud")
            .where("route.id = :id", {id: criteria.id})
            .andWhere("table.id = :routingTableId", {routingTableId: criteria.routingTableId})
            .andWhere("firewall.id = :firewallId", {firewallId: criteria.firewallId})
            .andWhere("fwcloud.id = :fwCloudId", {fwCloudId: criteria.fwCloudId})
    }
}