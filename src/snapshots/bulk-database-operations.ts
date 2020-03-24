import { SnapshotData } from "./snapshot-data";
import { DatabaseService } from "../database/database.service";
import { app } from "../fonaments/abstract-application";
import { QueryRunner } from "typeorm";

export class BulkDatabaseOperations {
    protected _data: SnapshotData;
    protected _operation: 'insert' | 'delete'

    constructor(data: SnapshotData, operation: 'insert' | 'delete') {
        this._data = data;
        this._operation = operation;
    }

    public async run(): Promise<void> {
        return new Promise(async(resolve, reject) => {
            const databaseService: DatabaseService = await app().getService<DatabaseService>(DatabaseService.name);
            const qr: QueryRunner = databaseService.connection.createQueryRunner();

            await qr.startTransaction();

            try {
                await qr.query('SET FOREIGN_KEY_CHECKS = 0');

                for (let table in this._data.data) {
                    for (let className in this._data.data[table]) {
                        for (let i = 0; i < this._data.data[table][className].length; i++) {
                            if (this._operation === 'insert') {
                                await qr.manager.insert(table, this._data.data[table][className][i]);
                            }

                            if (this._operation === 'delete') {
                                await qr.manager.delete(table, this._data.data[table][className][i]);
                            }
                        }
                    }
                }

                await qr.query('SET FOREIGN_KEY_CHECKS = 1');
                await qr.commitTransaction();
            } catch (e) {
                await qr.rollbackTransaction();
                await qr.query('SET FOREIGN_KEY_CHECKS = 1');
                reject(e);
            }

            await qr.release();
            resolve();
        });
    }
}