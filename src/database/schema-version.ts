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

import { DatabaseService } from "./database.service";
import { app } from "../fonaments/abstract-application";
import mysqldump, { DumpReturn } from "mysqldump";
import * as crypto from "crypto";

/**
 * This class generates a hash based on the schema as it was a schema version
 * @deprecated
 */
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
            },
            dump: {
                data: false,
                trigger: false,
                schema: {
                    autoIncrement: false,
                }
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