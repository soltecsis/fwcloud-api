import { Service } from "../fonaments/services/service";
import { Connection, createConnection, QueryRunner, Migration, MigrationExecutor } from "typeorm";
import * as path from "path";
import * as fs from "fs";

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

    protected _connected: boolean;
    protected _connection: Connection;
    protected _config: DatabaseConfig;

    public async start(): Promise<Service> {
        this._config = this._app.config.get('db');
        this._connected = false;
        this._connection = null;

        await this.init();

        return this;
    }

    get config(): any {
        return this._config;
    }

    get connection(): Connection {
        return this._connection;
    }

    public async init() {
        if (this._connected) {
            return this._connection;
        }


        this._connection = await createConnection({
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
            logging: ["error", "query"],
            migrations: this._config.migrations,
            cli: {
                migrationsDir: this._config.migration_directory
            }
        }).catch(e => {
            console.error('Unable to connect to MySQL: ' + e.message);
            process.exit(1);
        });

        this._connected = true;
        return this._connection;
    }

    public async emptyDatabase(): Promise<void> {
        const queryRunner: QueryRunner = this.getQueryRunner();
        queryRunner.startTransaction();

        try {
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

            const tables: Array<string> = await this.getTables();

            for(let i = 0; i < tables.length; i++) {
                await queryRunner.dropTable(tables[i]);
            }

            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
            queryRunner.commitTransaction();
        } catch (e) {
            queryRunner.rollbackTransaction();
            throw e;
        }
    }

    public async isDatabaseEmpty(): Promise<boolean> {
        const queryRunner: QueryRunner = this.getQueryRunner();
        const result: Array<any> = await queryRunner.query('SELECT table_name FROM information_schema.tables WHERE table_schema=?', [this._config.name]);

        return result.length === 0;
    }

    public async runMigrations(): Promise<Migration[]> {
        return await this.connection.runMigrations();
    }

    public async resetMigrations() {
        const migrationExecutor: MigrationExecutor = new MigrationExecutor(this.connection)
        
        // get all migrations that are executed and saved in the database
        const executedMigrations = await migrationExecutor.getPendingMigrations();

        if (executedMigrations.length <= 0) {
            this.connection.logger.logSchemaBuild(`No migrations was found in the database. Nothing to reset!`);
            return;
        }

        for (let i: number = 0; i < executedMigrations.length; i++) {
            await migrationExecutor.undoLastMigration();
        }
    }

    public async feedDefaultData(): Promise<void> {
        await this.importSQLFile(path.join(process.cwd(), 'config', 'seeds', 'default.sql'));
        await this.importSQLFile(path.join(process.cwd(), 'config', 'seeds', 'ipobj_std.sql'));
    }

    public async removeData(): Promise<void> {
        const queryRunner: QueryRunner = this.getQueryRunner();
        queryRunner.startTransaction();

        try {
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

            const tables: Array<string> = await this.getTables();

            for(let i = 0; i < tables.length; i++) {
                await queryRunner.query(`TRUNCATE TABLE ${tables[i]}`);
            }
            
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
            queryRunner.commitTransaction();
        } catch (e) {
            queryRunner.rollbackTransaction();
            throw e;
        }
    }

    public getQueryRunner(): QueryRunner {
        return this.connection.createQueryRunner();
    }

    protected async importSQLFile(path: string): Promise<void> {
        const queries = fs.readFileSync(path, { encoding: 'UTF-8' })
            .replace(new RegExp('\'', 'gm'), '"')
            .replace(new RegExp('^--.*\n', 'gm'), '')
            .replace(/(\r\n|\n|\r)/gm, " ")
            .replace(/\s+/g, ' ')
            .split(';');

        for (let i = 0; i < queries.length; i++) {
            let query = queries[i].trim();

            if (query !== '') {
                await this.getQueryRunner().query(query);
            }
        }
    }

    protected async getTables(): Promise<Array<string>> {
        const queryRunner: QueryRunner = this.connection.createQueryRunner();

        const result: Array<any> = await queryRunner.query('SELECT table_name FROM information_schema.tables WHERE table_schema=?', [this._config.name]);

        return result.map((row) => {
            if (row.hasOwnProperty('table_name')) {
                return row.table_name;
            }

            if (row.hasOwnProperty('TABLE_NAME')) {
                return row.TABLE_NAME;
            }
        })
    }


}