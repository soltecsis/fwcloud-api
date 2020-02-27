import { Service } from "../fonaments/services/service";
import { Connection, createConnection, QueryRunner, Migration, MigrationExecutor, getConnectionManager } from "typeorm";
import * as path from "path";
import * as fs from "fs";
import { timingSafeEqual } from "crypto";
import moment = require("moment");
import { FirewallTest } from "../../tests/Unit/models/fixtures/FirewallTest";

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

        await this.startDefaultConnection();
        
        return this;
    }

    public async close(): Promise<void> {
        await this.connection.close();
    }

    get config(): any {
        return this._config;
    }

    get connection(): Connection {
        return this._connection;
    }

    protected async startDefaultConnection(): Promise<void> {
        this._connection = await this.createConnection();
    }

    public async createConnection(): Promise<Connection> {
        try {
            return await createConnection({
                name: this._id.toString(),
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
            });
        } catch(e) {
            throw e;
        };
    }

    public async emptyDatabase(): Promise<void> {
        const queryRunner: QueryRunner = this._connection.createQueryRunner();
        await queryRunner.startTransaction();

        try {
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

            const tables: Array<string> = await this.getTables();

            for (let i = 0; i < tables.length; i++) {
                await queryRunner.dropTable(tables[i]);
            }

            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
            await queryRunner.commitTransaction();
        } catch (e) {
            await queryRunner.rollbackTransaction();
            throw e;
        } finally {
            await queryRunner.release();
        }
    }

    public async isDatabaseEmpty(): Promise<boolean> {
        const queryRunner: QueryRunner = this._connection.createQueryRunner();
        const result: Array<any> = await queryRunner.query('SELECT table_name FROM information_schema.tables WHERE table_schema=?', [this._config.name]);

        return result.length === 0;
    }

    public async runMigrations(): Promise<Migration[]> {
        return await this.connection.runMigrations();
    }

    public async resetMigrations(): Promise<void> {
        return await this.emptyDatabase();
    }

    public async feedDefaultData(): Promise<void> {
        await this.importSQLFile(path.join(process.cwd(), 'config', 'seeds', 'default.sql'));
        await this.importSQLFile(path.join(process.cwd(), 'config', 'seeds', 'ipobj_std.sql'));
    }

    public async removeData(): Promise<void> {
        const queryRunner: QueryRunner = this._connection.createQueryRunner();
        
        await queryRunner.startTransaction();

        try {
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

            const tables: Array<string> = await this.getTables();

            for (let i = 0; i < tables.length; i++) {
                await queryRunner.query(`TRUNCATE TABLE ${tables[i]}`);
            }

            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
            await queryRunner.commitTransaction();
        } catch (e) {
            await queryRunner.rollbackTransaction();
            throw e;
        } finally {
            await queryRunner.release();
        }

        return;
    }

    protected async importSQLFile(path: string): Promise<void> {
        const queryRunner: QueryRunner = this._connection.createQueryRunner();
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
        } catch (e) {
            await queryRunner.rollbackTransaction();
            throw e;
        }
    }

    protected async getTables(): Promise<Array<string>> {
        const queryRunner: QueryRunner = this._connection.createQueryRunner();

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