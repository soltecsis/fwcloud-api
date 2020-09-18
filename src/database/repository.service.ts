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

import { Service } from "../fonaments/services/service";
import { DatabaseService } from "./database.service";
import { getRepository, ObjectType, EntitySchema, Repository, getCustomRepository } from "typeorm";
import { PolicyRule } from "../models/policy/PolicyRule";
import { PolicyRuleRepository } from "../models/policy/policy-rule.repository";
import { Firewall } from "../models/firewall/Firewall";
import { FirewallRepository } from "../models/firewall/firewall.repository";
import { PolicyGroup } from "../models/policy/PolicyGroup";
import PolicyGroupRepository from "../repositories/PolicyGroupRepository";
import { deprecate } from "util";

type RepositoryMapItem = {"entityClass": Function, "repository": Function};
export class RepositoryService extends Service {
    protected _databaseService: DatabaseService;

    protected _customRepositories: Array<RepositoryMapItem> = [
         {
             "entityClass": PolicyRule,
             "repository": PolicyRuleRepository
         },
         {
             "entityClass": Firewall,
             "repository": FirewallRepository
         },
         {
             "entityClass": PolicyGroup,
             "repository": PolicyGroupRepository
         }
    ]

    public async build(): Promise<RepositoryService> {
        this._databaseService = await this._app.getService<DatabaseService>(DatabaseService.name);
        return this;
    }

    public for<Entity>(entityClass: ObjectType<Entity> | EntitySchema<Entity> | string, connectionName?: string): any {
        return deprecate(() => {
            if(this.hasCustomRepository(entityClass)) {
                return getCustomRepository(this.getCustomRepositoryFor(entityClass), this._databaseService.connection.name);
            }
            return getRepository(entityClass, this._databaseService.connection.name);
        }, 'Repository service is deprecated and will be removed. Use getRepository() or getCustomRepository() from TypeORM instead')();
    }

    protected hasCustomRepository<Entity>(entityClass: ObjectType<Entity> | EntitySchema<Entity> | string): boolean {
        const matches: Array<RepositoryMapItem> = this._customRepositories.filter((item: RepositoryMapItem) => {
            return item.entityClass === entityClass;
        });

        return matches.length > 0;
    }

    protected getCustomRepositoryFor<Entity>(entityClass: ObjectType<Entity> | EntitySchema<Entity> | string): Function {
        const matches: Array<RepositoryMapItem> = this._customRepositories.filter((item: RepositoryMapItem) => {
            return item.entityClass === entityClass;
        });

        if (matches.length > 0) {
            return matches[0].repository;
        }

        return null;
    }
}