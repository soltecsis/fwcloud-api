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
import { QueryRunner, getMetadataArgsStorage, DeepPartial, DeleteResult, Repository, EntityRepository } from "typeorm";
import { TableMetadataArgs } from "typeorm/metadata-args/TableMetadataArgs";
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";
import { RepositoryService } from "../database/repository.service";
import Model from "../models/Model";

export class BulkDatabaseDelete {
    protected _data: SnapshotData;
    protected _repositoryService: RepositoryService;
    protected _databaseService: DatabaseService;

    constructor(data: SnapshotData) {
        this._data = data;
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

                    if (entity) {
                        await this.processEntityRows(qr, table, entity, rows);
                    } else {
                        await this.processRows(qr, table, rows);
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

    protected async processEntityRows(queryRunner: QueryRunner, tableName: string, entityName: string, rows: Array<object>): Promise<DeleteResult> {
        
        if (rows.length <= 0) {
            return;
        }

        let entity: typeof Model = Model.getEntitiyDefinition(tableName, entityName);

        return await queryRunner.manager.createQueryBuilder(tableName, tableName).delete()
            .whereInIds(rows.map((item) => {
                const result = {};
                for(let i = 0; i < entity.getPrimaryKeys().length; i++) {
                    result[entity.getPrimaryKeys()[i].propertyName] = item[entity.getPrimaryKeys()[0].propertyName];
                }

                return result;
            })).execute();
    }

    protected async processRows(queryRunner: QueryRunner, table: string, rows: Array<object>): Promise<DeleteResult> {
        for (let i = 0; i < rows.length; i++) {
            const row: object = rows[i];
            return await queryRunner.manager.createQueryBuilder(table, "table").delete().where(row).execute();
        }
    }

    /**
     * Returns the column values which are primary key
     * 
     * @param tableName 
     * @param entityName 
     * @param data 
     */
    protected getPrimaryKeysData(tableName: string, entityName: string, data: DeepPartial<any>): DeepPartial<any> {
        let entity: typeof Model = Model.getEntitiyDefinition(tableName, entityName);
        const result: DeepPartial<any> = {};
        
        const primaryKeysMetadata: Array<ColumnMetadataArgs> = entity.getPrimaryKeys();

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