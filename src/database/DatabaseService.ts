import "reflect-metadata";
import * as path from 'path';
import { Connection, createConnection, QueryRunner } from "typeorm";
import * as config from "../config/config";
import Query from "./Query";
import * as Logger from "log4js";
import { FirewallTest } from "../../tests/Unit/models/fixtures/FirewallTest"

const logger = Logger.getLogger("app");

export class DatabaseService {

    private _connected: boolean = false;
    private _connection: Connection = null;
    private configDB: {
        host: string,
        user: string,
        port: number,
        pass: string,
        name: string
    } = config.get('db');


    constructor() {

    }

    public async connect(): Promise<Connection> {
        if (this._connected) {
            return this._connection;
        }

        this._connection = await createConnection({
            type: "mysql",
            host: this.configDB.host,
            port: this.configDB.port,
            database: this.configDB.name,
            username: this.configDB.user,
            password: this.configDB.pass,
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

    public lockTableCon(table: string, where: string, done: () => void) {
        this.getQuery().query("SELECT count(*) from " + table + " " + where + " FOR UPDATE;", (error, result) => {
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

const db: DatabaseService = new DatabaseService();

export default db;