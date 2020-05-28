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


import { Connection, QueryRunner } from "typeorm";
import * as config from "../config/config";
import Query from "./Query";
import { AbstractApplication } from '../fonaments/abstract-application';
import { DatabaseService } from './database.service';

export class DatabaseManager {

    private _connected: boolean = false;
    private _connection: Connection = null;
    private configDB: {
        host: string,
        user: string,
        port: number,
        pass: string,
        name: string
    } = config.get('db');

    public async connect(app: AbstractApplication): Promise<Connection> {
        const databaseService: DatabaseService = await app.getService<DatabaseService>(DatabaseService.name);

        this._connection = databaseService.connection;
        return this._connection;
    }

    public get(done: (err, query: Query) => void) {
        if (!this._connection) {
            done(new Error('Connection not found'), null);
        }

        const query: Query = new Query();

        done(null, query);
    }

    public getQueryRunner(): QueryRunner {
        if (!this._connection) {
            throw Error('Connection not found');
        }

        return this._connection.createQueryRunner();
    }

    public getQuery(): Query {
        if (!this._connection) {
            throw Error('Connection not found');
        }

        return new Query();
    }
}

const db: DatabaseManager = new DatabaseManager();

export default db;