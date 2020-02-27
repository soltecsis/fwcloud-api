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
import { getRepository, ObjectType, EntitySchema, Repository } from "typeorm";

export class RepositoryService extends Service {
    protected _databaseService: DatabaseService;

    public async build(): Promise<RepositoryService> {
        this._databaseService = await this._app.getService<DatabaseService>(DatabaseService.name);
        return this;
    }

    public for<Entity>(entityClass: ObjectType<Entity> | EntitySchema<Entity> | string, connectionName?: string): Repository<Entity> {
        return getRepository(entityClass, this._databaseService.connection.name);
    }
}