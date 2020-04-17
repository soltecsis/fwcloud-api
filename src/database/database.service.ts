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
import { Connection, QueryRunner, Migration, getConnectionManager, ConnectionOptions } from "typeorm";
import * as path from "path";
import * as fs from "fs";
import moment from "moment";
import { FirewallTest } from "../../tests/Unit/models/fixtures/FirewallTest";
import ObjectHelpers from "../utils/object-helpers";

export interface DatabaseConfig {
    host: string,
    user: string,
    port: number,
    pass: string,
    name: string,
    migrations: Array<string>,
    migration_directory: string
}

export class DatabaseService extends Service {
    protected _id: number;
    protected _connection: Connection;
    protected _config: DatabaseConfig;

    public async build(): Promise<DatabaseService> {
        this._config = this._app.config.get('db');
        this._connection = null;
        this._id = moment().valueOf();

        this._connection = await this.getConnection({name: 'default'});
        
        return this;
    }

    public async close(): Promise<void> {
        const connections: Array<Connection> = getConnectionManager().connections;

        for(let i = 0; i < connections.length; i++) {
            if (connections[i].isConnected) {
                await connections[i].close();
            }
        }
    }

    get config(): any {
        return this._config;
    }

    get connection(): Connection {
        return this._connection;
    }

    public async getConnection(options: Partial<ConnectionOptions>): Promise<Connection> {
        const connectionOptions: ConnectionOptions = <ConnectionOptions>ObjectHelpers.merge(this.getDefaultConnectionConfiguration(), options);
        let connection: Connection = null;

        connection = getConnectionManager().has(options.name) ? getConnectionManager().get(options.name) : getConnectionManager().create(connectionOptions);
        
        if(!connection.isConnected) {
            await connection.connect();
        }
        
        return connection;
    }

    public async emptyDatabase(connection: Connection = null): Promise<void> {
        connection = connection ? connection : this._connection;
        const queryRunner: QueryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();

        try {
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

            const tables: Array<string> = await this.getTables(connection);

            for (let i = 0; i < tables.length; i++) {
                await queryRunner.dropTable(tables[i]);
            }

            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
            await queryRunner.commitTransaction();
            await queryRunner.release();
        } catch (e) {
            await queryRunner.rollbackTransaction();
            await queryRunner.release();
            throw e;
        }
    }

    public async isDatabaseEmpty(connection: Connection = null): Promise<boolean> {
        connection = connection ? connection : this._connection;
        
        const queryRunner: QueryRunner = connection.createQueryRunner();
        const result: Array<any> = await queryRunner.query('SELECT table_name FROM information_schema.tables WHERE table_schema=?', [this._config.name]);
        await queryRunner.release();
        return result.length === 0;
    }

    public async runMigrations(connection: Connection = null): Promise<Migration[]> {
        connection = connection ? connection : this._connection;
        
        return await connection.runMigrations();
    }

    public async resetMigrations(connection: Connection = null): Promise<void> {
        connection = connection ? connection : this._connection;
        
        return await this.emptyDatabase(connection);
    }

    public async feedDefaultData(connection: Connection = null): Promise<void> {
        connection = connection ? connection : this._connection;

        await this.importSQLFile(path.join(process.cwd(), 'config', 'seeds', 'default.sql'), connection);
        await this.importSQLFile(path.join(process.cwd(), 'config', 'seeds', 'ipobj_std.sql'), connection);
    }

    public async removeData(connection: Connection = null): Promise<void> {
        connection = connection ? connection : this._connection;
        
        const queryRunner: QueryRunner = connection.createQueryRunner();
        
        await queryRunner.startTransaction();

        try {
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

            const tables: Array<string> = await this.getTables(connection);

            for (let i = 0; i < tables.length; i++) {
                if (tables[i] !== 'migrations') {
                    await queryRunner.query(`TRUNCATE TABLE ${tables[i]}`);
                }
            }

            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
            await queryRunner.commitTransaction();
            await queryRunner.release();
        } catch (e) {
            await queryRunner.rollbackTransaction();
            await queryRunner.release();
            throw e;
        }

        return;
    }

    protected getDefaultConnectionConfiguration(): ConnectionOptions {
        return {
            type: 'mysql',
            host: this._config.host,
            port: this._config.port,
            database: this._config.name,
            username: this._config.user,
            password: this._config.pass,
            subscribers: [],
            synchronize: false,
            migrationsRun: false,
            dropSchema: false,
            logging: ["error"],
            migrations: this._config.migrations,
            cli: {
                migrationsDir: this._config.migration_directory
            },
            entities: [
                path.join(process.cwd(), 'dist', 'src', 'models', '**', '*'),
                FirewallTest
            ]
        }
    }

    protected async importSQLFile(path: string, connection: Connection = null): Promise<void> {
        connection = connection ? connection : this._connection;
        const queryRunner: QueryRunner = connection.createQueryRunner();
        const queries = fs.readFileSync(path, { encoding: 'UTF-8' })
            .replace(new RegExp('\'', 'gm'), '"')
            .replace(new RegExp('^--.*\n', 'gm'), '')
            .replace(/(\r\n|\n|\r)/gm, " ")
            .replace(/\s+/g, ' ')
            .split(';');

        await queryRunner.startTransaction();

        try {
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
            
            for (let i = 0; i < queries.length; i++) {
                let query = queries[i].trim();
    
                if (query !== '') {
                    await queryRunner.query(query);
                }
            }
            
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
            await queryRunner.commitTransaction();
            await queryRunner.release();
        } catch (e) {
            await queryRunner.rollbackTransaction();
            await queryRunner.release();
            throw e;
        }
    }

    protected async getTables(connection: Connection = null): Promise<Array<string>> {
        connection = connection ? connection : this._connection;
        const queryRunner: QueryRunner = connection.createQueryRunner();

        const result: Array<any> = await queryRunner.query('SELECT table_name FROM information_schema.tables WHERE table_schema=?', [this._config.name]);

        const tables: Array<string> = result.map((row) => {
            if (row.hasOwnProperty('table_name')) {
                return row.table_name;
            }

            if (row.hasOwnProperty('TABLE_NAME')) {
                return row.TABLE_NAME;
            }
        })

        await queryRunner.release();

        return tables;
    }
}