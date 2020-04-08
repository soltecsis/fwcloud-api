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

import { SnapshotData } from "./snapshot-data";
import { DatabaseService } from "../database/database.service";
import { app } from "../fonaments/abstract-application";
import { QueryRunner, getMetadataArgsStorage, DeepPartial, DeleteResult } from "typeorm";
import { TableMetadataArgs } from "typeorm/metadata-args/TableMetadataArgs";
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";
import { RepositoryService } from "../database/repository.service";

export class BulkDatabaseOperations {
    protected _data: SnapshotData;
    protected _operation: 'insert' | 'delete'
    protected _repositoryService: RepositoryService;
    protected _databaseService: DatabaseService;

    constructor(data: SnapshotData, operation: 'insert' | 'delete') {
        this._data = data;
        this._operation = operation;
    }

    public async run(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            this._databaseService = await app().getService<DatabaseService>(DatabaseService.name);
            this._repositoryService = await app().getService<RepositoryService>(RepositoryService.name);
            const qr: QueryRunner = this._databaseService.connection.createQueryRunner();

            await qr.startTransaction();

            try {
                await qr.query('SET FOREIGN_KEY_CHECKS = 0');

                for (let table in this._data.data) {
                    const entity: string = this._data.data[table].entity;
                    const rows: Array<object> = this._data.data[table].data;

                    for (let i = 0; i < rows.length; i++) {
                        if (entity) {
                            await this.processEntityRow(qr, this._operation, table, entity, rows[i]);
                        } else {
                            await this.processRow(qr, this._operation, table, rows[i]);
                        }
                    }
                }

                await qr.query('SET FOREIGN_KEY_CHECKS = 1');
                await qr.commitTransaction();
                await qr.release();
            } catch (e) {
                await qr.rollbackTransaction();
                await qr.query('SET FOREIGN_KEY_CHECKS = 1');
                qr.release();
                return reject(e);
            }

            resolve();
        });
    }

    protected async processEntityRow(queryRunner: QueryRunner, operation: 'insert' | 'delete', table: string, entity: string, row: object): Promise<object> {
        if(operation === 'insert') {
            return await this.processEntityRowInsertion(queryRunner, table, entity, row);
        }

        if (operation === 'delete') {
            return await this.processEntityRowDeletion(queryRunner, table, entity, row);
        }
    }

    protected async processEntityRowInsertion(queryRunner: QueryRunner, table: string, entity: string, row: object): Promise<any> {
        const rowData: any = this._repositoryService.for(this.getEntity(table, entity).target).create(row);
        return await queryRunner.manager.getRepository(this.getEntity(table, entity).target).save(rowData);
    }

    protected async processEntityRowDeletion(queryRunner: QueryRunner, table: string, entity: string, row: object): Promise<DeleteResult> {
        //Delete queries based only on primary keys colums. Other colums could have changed
        const criteria = this.getPrimaryKeysData(table, entity, row);
        return await queryRunner.manager.delete(table, criteria);
    }

    protected async processRow(queryRunner: QueryRunner, operation: 'insert' | 'delete', table: string, row: object): Promise<object> {
        if(operation === 'insert') {
            return await this.processRowInsertion(queryRunner, table, row);
        }

        if (operation === 'delete') {
            return await this.processRowDeletion(queryRunner, table, row);
        }
    }

    protected async processRowInsertion(queryRunner: QueryRunner, table: string, row: object): Promise<any> {
        return await queryRunner.manager.createQueryBuilder().insert().into(table).values(row).execute();
    }

    protected async processRowDeletion(queryRunner: QueryRunner, table: string, row: object): Promise<DeleteResult> {
        return await queryRunner.manager.createQueryBuilder(table, "table").delete().where(row).execute();
    }

    /**
     * Returns the column values which are primary key
     * 
     * @param tableName 
     * @param entityName 
     * @param data 
     */
    protected getPrimaryKeysData(tableName: string, entityName: string, data: DeepPartial<any>): DeepPartial<any> {
        let argsEntity: TableMetadataArgs = this.getEntity(tableName, entityName);
        const target = <any>argsEntity.target;
        const instance = new target();
        const result: DeepPartial<any> = {};

        const primaryKeysMetadata: Array<ColumnMetadataArgs> = instance.getPrimaryKeys();

        if (primaryKeysMetadata.length <= 0) {
            return data;
        }

        for (let i = 0; i < primaryKeysMetadata.length; i++) {
            const propertyName = primaryKeysMetadata[i].propertyName;
            if (data[propertyName]) {
                result[propertyName] = data[propertyName];
            }
        }

        return result;
    }

    /**
     * Returns the class definition for the given tableName and entityName
     * 
     * @param tableName 
     * @param entityName 
     */
    protected getEntity(tableName: string, entityName: string): any {
        const matches: Array<TableMetadataArgs> = getMetadataArgsStorage().tables.filter((item: TableMetadataArgs) => {
            const target = <any>item.target;
            return tableName === item.name && entityName === target.name;
        });

        return matches.length > 0 ? matches[0] : null;
    }
}