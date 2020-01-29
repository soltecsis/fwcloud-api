import { Connection, createConnection } from "typeorm";
import * as config from "../../src/config/config";
import { FwCloudMigrationExecutor } from "../../src/utils/typeorm/migrations/MigrationExecutor";

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