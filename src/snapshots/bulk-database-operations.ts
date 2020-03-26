import { SnapshotData } from "./snapshot-data";
import { DatabaseService } from "../database/database.service";
import { app } from "../fonaments/abstract-application";
import { QueryRunner, getMetadataArgsStorage, DeepPartial } from "typeorm";
import { TableMetadataArgs } from "typeorm/metadata-args/TableMetadataArgs";
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";

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
                                //Delete queries based only on primary keys colums. Other colums could have changed
                                const criteria = this.getPrimaryKeysData(table, className, this._data.data[table][className][i]);
                                await qr.manager.delete(table, criteria);
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

    protected getPrimaryKeysData(tableName: string, entityName: string, data: DeepPartial<any>): DeepPartial<any> {
        let argsEntity: TableMetadataArgs = this.getEntity(tableName, entityName);
        const target = <any>argsEntity.target;
        const instance = new target();
        const result: DeepPartial<any> = {};

        const primaryKeysMetadata: Array<ColumnMetadataArgs> = instance.getPrimaryKeys();

        if (primaryKeysMetadata.length <= 0) {
            return data;
        }

        for(let i = 0; i < primaryKeysMetadata.length; i++) {
            const propertyName = primaryKeysMetadata[i].propertyName;
            if (data[propertyName]) {
                result[propertyName] = data[propertyName];
            }
        }

        return result;
    }

    protected getEntity(tableName: string, entityName: string): any {
        const matches: Array<TableMetadataArgs> = getMetadataArgsStorage().tables.filter((item: TableMetadataArgs) => {
            const target = <any>item.target;
            return tableName === item.name && entityName === target.name;
        });

        return matches.length > 0 ? matches[0]: null;
    }
}