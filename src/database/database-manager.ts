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


import { Connection, createConnection, QueryRunner } from "typeorm";
import * as config from "../config/config";
import Query from "./Query";
import * as Logger from "log4js";
import { AbstractApplication } from '../fonaments/abstract-application';
import { DatabaseService } from './database.service';

const logger = Logger.getLogger("app");

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

    public lockTable(cn: Query, table: string, where: string, done: () => void) {
        cn.query("SELECT count(*) from " + table + " " + where + " FOR UPDATE;", (error, result) => {
            if (error)
                logger.debug("DATABASE ERROR IN LOCK TABLE : " + error);
            else
                logger.debug("TABLE " + table + " LOCKED");
        });
        done();
    };

    public startTX(cn: Query, done: () => void) {
        cn.query("START TRANSACTION;", (error, result) => {
            if (error)
                logger.debug("DATABASE ERROR IN START TRANSACTION : " + error);
            else
                logger.debug("START TX");
        });
        done();
    };

    public startTXcon(done: () => void) {
        this.getQuery().query("START TRANSACTION;", (error, result) => {
            if (error)
                logger.debug("DATABASE ERROR IN START TRANSACTION : " + error);
            else
                logger.debug("START TX");
        });
        done();
    };

    public endTX(cn: Query, done: () => void) {
        cn.query("COMMIT;", (error, result) => {
            if (error)
                logger.debug("DATABASE ERROR IN COMMIT TRANSACTION: " + error);
            else
                logger.debug("END TX");
        });
        done();
    };

    public endTXcon(done: () => void) {
        this.getQuery().query("COMMIT;", (error, result) => {
            if (error)
                logger.debug("DATABASE ERROR IN COMMIT TRANSACTION: " + error);
            else
                logger.debug("END TX");
        });
        done();
    };

    public backTX(cn: Query, done: () => void) {
        cn.query("ROLLBACK;", (error, result) => {
            if (error)
                logger.debug("DATABASE ERROR IN ROLLBACK TRANSACTION ");
            else
                logger.debug("ROLLBACK TX");
        });
        done();
    };

    public backTXcon(done: () => void) {
        this.getQuery().query("ROLLBACK;", (error, result) => {
            if (error)
                logger.debug("DATABASE ERROR IN ROLLBACK TRANSACTION ");
            else
                logger.debug("ROLLBACK TX");
        });
        done();
    };
}

const db: DatabaseManager = new DatabaseManager();

export default db;