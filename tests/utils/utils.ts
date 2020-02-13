import { Connection, createConnection, getRepository } from "typeorm";
import * as config from "../../src/config/config";
import { FwCloudMigrationExecutor } from "../../src/utils/typeorm/migrations/MigrationExecutor";
import { Application } from "../../src/Application";
import db from "../../src/database/DatabaseService";

const configDB = config.get('db');

export async function getDatabaseConnection(): Promise<Connection> {
    return await createConnection({
        name: Math.random().toString(),
        type: 'mysql',
        host: configDB.host,
        port: configDB.port,
        database: configDB.name,
        username: configDB.user,
        password: configDB.pass,
        migrations: configDB.migrations
    });
}

export async function runMigrations(connection: Connection): Promise<void> {
    await connection.runMigrations();
}

export async function resetMigrations(connection: Connection): Promise<void> {
    const executor = new FwCloudMigrationExecutor(connection, connection.createQueryRunner());
    await executor.undoAllMigrations();
}

export async function runApplication(resetDatabase: boolean = true): Promise<Application> {
    const application: Application = new Application();
    await application.bootstrap();

    if (resetDatabase) {
        const connection: Connection = await getDatabaseConnection();
        await resetMigrations(connection);
        await runMigrations(connection);
    }

    return application;
}

export function randomString(length: number = 10) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

