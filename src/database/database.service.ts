import { Service } from "../fonaments/services/service";
import { AbstractApplication } from "../fonaments/abstract-application";
import { Connection, createConnection } from "typeorm";
import * as path from "path";
import { FirewallTest } from "../../tests/Unit/models/fixtures/FirewallTest";

export interface DatabaseConfig {
    host: string,
    user: string,
    port: number,
    pass: string,
    name: string
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

    get connection(): Connection {
        return this._connection;
    }

    public async init() {
        if (this._connected) {
            return this._connection;
        }

        this._connection = await createConnection({
            type: "mysql",
            host: this._config.host,
            port: this._config.port,
            database: this._config.name,
            username: this._config.user,
            password: this._config.pass,
            debug: false,
            synchronize: false,
            entities: [
                path.join(process.cwd(), 'dist/src/models/**/*.js'),
                FirewallTest
            ]
        }).catch(e => {
            console.error('Unable to connect to MySQL: ' + e.message);
            process.exit(1);
        });

        this._connected = true;
        return this._connection;
    }


}