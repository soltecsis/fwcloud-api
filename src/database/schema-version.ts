import { DatabaseService } from "./database.service";
import { app } from "../fonaments/abstract-application";
import mysqldump, { DumpReturn } from "mysqldump";
import * as crypto from "crypto";

export class SchemaVersion {
    protected _dump: DumpReturn;
    protected _version: string;

    protected constructor() { }

    public async build(): Promise<SchemaVersion> {
        const databaseService: DatabaseService = await app().getService<DatabaseService>(DatabaseService.name);
        const dbConfig = databaseService.config;

        this._dump = await mysqldump({
            connection: {
                host: dbConfig.host,
                port: dbConfig.port,
                user: dbConfig.user,
                password: dbConfig.pass,
                database: dbConfig.name,
            }
        });

        this._version = await this.generateVersion(this._dump.dump.schema);

        return this;
    }

    public getVersion(): string {
        return this._version;
    }

    protected async generateVersion(dump: any): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const hash = crypto.createHash('sha256');

            hash.on('readable', () => {
                // Only one element is going to be produced by the
                // hash stream.
                const data = hash.read();
                if (data) {
                    resolve(data.toString('hex'));
                }
            });

            hash.write(dump);
            hash.end();
        });
    }

    public static async make(): Promise<SchemaVersion> {
        const schemaVersion: SchemaVersion = new SchemaVersion();
        await schemaVersion.build();
        return schemaVersion;
    }
}